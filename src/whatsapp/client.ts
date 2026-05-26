import fs from "node:fs/promises";
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { AppConfig } from "../config";
import { logger } from "../logger";

export const createWhatsAppClient = async (config: AppConfig): Promise<Client> => {
  await fs.mkdir(config.sessionDir, { recursive: true });

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.sessionDir
    }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  });

  client.on("qr", (qr) => {
    logger.info("QR Code recebido. Escaneie no WhatsApp para autenticar.");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () => {
    logger.info("WhatsApp autenticado.");
  });

  client.on("auth_failure", (message) => {
    logger.error("Falha de autenticacao no WhatsApp.", message);
  });

  client.on("disconnected", (reason) => {
    logger.warn("WhatsApp desconectado.", reason);
  });

  const readyPromise = new Promise<void>((resolve, reject) => {
    client.once("ready", () => {
      logger.info("WhatsApp pronto para uso.");
      resolve();
    });

    client.once("auth_failure", (message) => {
      reject(new Error(`Falha de autenticacao no WhatsApp: ${message}`));
    });
  });

  logger.info("Inicializando WhatsApp Web...");
  await client.initialize();
  await readyPromise;

  return client;
};
