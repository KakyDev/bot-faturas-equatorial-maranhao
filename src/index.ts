import { loadConfig } from "./config";
import { logger } from "./logger";
import { EquatorialInvoiceFlow } from "./flow/equatorialFlow";
import { createWhatsAppClient } from "./whatsapp/client";
import { findChatByName } from "./whatsapp/chat";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const client = await createWhatsAppClient(config);

  try {
    const chat = await findChatByName(client, config.equatorialChatName);
    const flow = new EquatorialInvoiceFlow(client, chat, config);
    const filePath = await flow.run();

    logger.info(`Fluxo finalizado. Arquivo baixado: ${filePath}`);
  } finally {
    logger.info("Encerrando cliente WhatsApp.");
    await client.destroy();
  }
};

main().catch((error: unknown) => {
  logger.error("Falha ao executar o bot.", error);
  process.exitCode = 1;
});
