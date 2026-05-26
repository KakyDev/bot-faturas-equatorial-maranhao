import { Chat, Client, Message } from "whatsapp-web.js";
import { AppConfig } from "../config";
import { logger } from "../logger";
import { randomDelay } from "../utils/delay";
import { normalizeText } from "../utils/text";
import { TimeoutError } from "../utils/timeout";

type MessagePredicate = (message: Message) => boolean | Promise<boolean>;

export const findChatByName = async (client: Client, chatName: string): Promise<Chat> => {
  logger.info(`Procurando chat: ${chatName}`);
  const chats = await client.getChats();
  const target = normalizeText(chatName);

  const chat = chats.find((candidate) => {
    const candidateName = normalizeText(candidate.name || "");
    return (
      candidateName.length > 0 &&
      (candidateName === target || candidateName.includes(target) || target.includes(candidateName))
    );
  });

  if (!chat) {
    throw new Error(`Chat nao encontrado: ${chatName}`);
  }

  logger.info(`Chat localizado: ${chat.name}`);
  return chat;
};

export const sendTextWithDelay = async (
  chat: Chat,
  text: string,
  config: AppConfig
): Promise<void> => {
  await randomDelay(config.minDelayMs, config.maxDelayMs);
  logger.info(`Enviando mensagem: ${text}`);
  await chat.sendMessage(text);
};

export const waitForMessage = async (
  client: Client,
  chat: Chat,
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
      if (message.from !== chat.id._serialized) {
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
  chat: Chat,
  predicate: (body: string) => boolean,
  timeoutMs: number,
  description: string
): Promise<Message> =>
  waitForMessage(
    client,
    chat,
    (message) => Boolean(message.body) && predicate(message.body),
    timeoutMs,
    description
  );
