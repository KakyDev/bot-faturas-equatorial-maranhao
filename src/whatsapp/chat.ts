import { Client, Message } from "whatsapp-web.js";
import { AppConfig } from "../config";
import { logger } from "../logger";
import { randomDelay } from "../utils/delay";
import { TimeoutError } from "../utils/timeout";

type MessagePredicate = (message: Message) => boolean | Promise<boolean>;

export const normalizePhoneNumber = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length < 10) {
    throw new Error("EQUATORIAL_PHONE_NUMBER deve conter DDI, DDD e numero. Exemplo: 5598999999999");
  }

  return digits;
};

export const resolveChatIdByPhoneNumber = async (
  client: Client,
  phoneNumber: string
): Promise<string> => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  logger.info(`Procurando numero no WhatsApp: ${normalizedPhoneNumber}`);
  const contactId = await client.getNumberId(normalizedPhoneNumber);

  if (!contactId) {
    throw new Error(`Numero nao encontrado no WhatsApp: ${normalizedPhoneNumber}`);
  }

  logger.info(`Chat resolvido por numero: ${contactId._serialized}`);
  return contactId._serialized;
};

export const sendTextWithDelay = async (
  client: Client,
  chatId: string,
  text: string,
  config: AppConfig
): Promise<void> => {
  await randomDelay(config.minDelayMs, config.maxDelayMs);
  logger.info(`Enviando mensagem: ${text}`);
  await client.sendMessage(chatId, text);
};

export const waitForMessage = async (
  client: Client,
  chatId: string,
  predicate: MessagePredicate,
  timeoutMs: number,
  description: string
): Promise<Message> => {
  logger.info(`Aguardando: ${description}`);

  return new Promise<Message>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off("message", onMessage);
      reject(new TimeoutError(`Timeout aguardando ${description}`));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      client.off("message", onMessage);
    };

    const onMessage = async (message: Message): Promise<void> => {
      if (message.from !== chatId) {
        return;
      }

      try {
        if (await predicate(message)) {
          cleanup();
          resolve(message);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    client.on("message", onMessage);
  });
};

export const waitForTextMessage = async (
  client: Client,
  chatId: string,
  predicate: (body: string) => boolean,
  timeoutMs: number,
  description: string
): Promise<Message> =>
  waitForMessage(
    client,
    chatId,
    (message) => Boolean(message.body) && predicate(message.body),
    timeoutMs,
    description
  );
