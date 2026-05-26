import { Chat, Client } from "whatsapp-web.js";
import { AppConfig } from "../config";
import { logger } from "../logger";
import { includesAny } from "../utils/text";
import { findInvoiceOptionByReference, parseInvoiceOptions } from "./invoiceParser";
import { sendTextWithDelay, waitForMessage, waitForTextMessage } from "../whatsapp/chat";
import { downloadPdfFromMessage } from "../whatsapp/media";
import { savePdf } from "../storage/pdfStorage";

type FlowStep =
  | "START"
  | "WAIT_IDENTIFICATION_REQUEST"
  | "WAIT_PROPERTY_CONFIRMATION"
  | "WAIT_INVOICE_LIST"
  | "WAIT_PAYMENT_METHOD"
  | "WAIT_EMAIL_REQUEST"
  | "WAIT_PDF"
  | "DONE";

export class EquatorialInvoiceFlow {
  private step: FlowStep = "START";

  constructor(
    private readonly client: Client,
    private readonly chat: Chat,
    private readonly config: AppConfig
  ) {}

  async run(): Promise<string> {
    logger.info("Iniciando fluxo de segunda via da Equatorial.");

    this.step = "WAIT_IDENTIFICATION_REQUEST";
    await sendTextWithDelay(this.chat, "Segunda via Fatura", this.config);

    await waitForTextMessage(
      this.client,
      this.chat,
      (body) =>
        includesAny(body, [
          "cpf",
          "cnpj",
          "conta contrato",
          "unidade consumidora",
          "uc",
          "codigo unico"
        ]),
      this.config.messageTimeoutMs,
      "solicitacao de CPF/CNPJ/Conta Contrato/UC"
    );

    this.step = "WAIT_PROPERTY_CONFIRMATION";
    await sendTextWithDelay(this.chat, this.config.targetUc, this.config);

    await waitForTextMessage(
      this.client,
      this.chat,
      (body) =>
        includesAny(body, ["imovel", "endereco", "confirma", "correto", "encontrado", "sim"]),
      this.config.messageTimeoutMs,
      "confirmacao do imovel"
    );

    this.step = "WAIT_INVOICE_LIST";
    await sendTextWithDelay(this.chat, "Sim", this.config);

    const invoiceListMessage = await waitForTextMessage(
      this.client,
      this.chat,
      (body) => parseInvoiceOptions(body).length > 0,
      this.config.messageTimeoutMs,
      "lista de faturas disponiveis"
    );

    const options = parseInvoiceOptions(invoiceListMessage.body);
    const selected = findInvoiceOptionByReference(options, this.config.targetReference);

    if (!selected) {
      throw new Error(`Referencia nao encontrada na lista de faturas: ${this.config.targetReference}`);
    }

    logger.info(`Referencia selecionada: ${selected.reference}`, selected);

    this.step = "WAIT_PAYMENT_METHOD";
    await sendTextWithDelay(this.chat, selected.option, this.config);

    await waitForTextMessage(
      this.client,
      this.chat,
      (body) => includesAny(body, ["boleto", "pagamento", "pagar", "codigo de barras"]),
      this.config.messageTimeoutMs,
      "opcoes de pagamento"
    );

    this.step = "WAIT_EMAIL_REQUEST";
    await sendTextWithDelay(this.chat, "Pagar boleto", this.config);

    await waitForTextMessage(
      this.client,
      this.chat,
      (body) => includesAny(body, ["email", "e-mail", "mail", "@"]),
      this.config.messageTimeoutMs,
      "solicitacao de e-mail"
    );

    this.step = "WAIT_PDF";
    await sendTextWithDelay(this.chat, this.config.registeredEmail, this.config);

    const pdfMessage = await waitForMessage(
      this.client,
      this.chat,
      (message) => message.hasMedia,
      this.config.messageTimeoutMs,
      "PDF da fatura"
    );

    const pdf = await downloadPdfFromMessage(pdfMessage);
    const filePath = await savePdf(
      this.config.downloadDir,
      this.config.targetUc,
      this.config.targetReference,
      pdf.data
    );

    this.step = "DONE";
    logger.info(`PDF salvo com sucesso: ${filePath}`, {
      mimeType: pdf.mimeType,
      filename: pdf.filename
    });

    return filePath;
  }

  getCurrentStep(): FlowStep {
    return this.step;
  }
}
