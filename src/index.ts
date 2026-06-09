import { loadConfig } from "./config";
import { logger } from "./logger";
import { EquatorialInvoiceFlow } from "./flow/equatorialFlow";
import { loadInvoiceTargetsFromCsvDir } from "./input/csvInvoices";
import { createWhatsAppClient } from "./whatsapp/client";
import { resolveChatIdByPhoneNumber } from "./whatsapp/chat";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const targets = await loadInvoiceTargetsFromCsvDir(config.csvDir);
  const client = await createWhatsAppClient(config);

  try {
    const chatId = await resolveChatIdByPhoneNumber(client, config.equatorialPhoneNumber);
    const flow = new EquatorialInvoiceFlow(client, chatId, config);

    logger.info(`Iniciando processamento de ${targets.length} fatura(s) do CSV.`);

    for (const target of targets) {
      try {
        logger.info(
          `Processando ${target.sourceFile}:${target.lineNumber} - UC ${target.uc}, referencia ${target.reference}.`
        );
        const filePath = await flow.run(target);

        logger.info(`Fatura baixada com sucesso: ${filePath}`);
      } catch (error) {
        logger.error(
          `Falha ao processar UC ${target.uc}, referencia ${target.reference} (${target.sourceFile}:${target.lineNumber}).`,
          error
        );
      }
    }

    logger.info("Processamento dos CSVs finalizado.");
  } finally {
    logger.info("Encerrando cliente WhatsApp.");
    await client.destroy();
  }
};

main().catch((error: unknown) => {
  logger.error("Falha ao executar o bot.", error);
  process.exitCode = 1;
});
