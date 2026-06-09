import { Client } from "whatsapp-web.js";
import { AppConfig } from "../config";
import { InvoiceTarget } from "../input/csvInvoices";
import { logger } from "../logger";
import { sleep } from "../utils/delay";
import { includesAny } from "../utils/text";
import { findInvoiceOptionByReference, parseInvoiceOptions } from "./invoiceParser";
import { sendTextWithDelay, waitForMessage, waitForTextMessage } from "../whatsapp/chat";
import { downloadPdfFromMessage } from "../whatsapp/media";
import { savePdf } from "../storage/pdfStorage";

const NO_DEBTS_RETRY_DELAY_MS = 10000;
const NO_DEBTS_MAX_ATTEMPTS = 3;

type FlowStep =
  | "START"
  | "WAIT_STARTUP_RESPONSE"
  | "WAIT_DATA_POLICY"
  | "WAIT_IDENTIFICATION_REQUEST"
  | "WAIT_PROPERTY_CONFIRMATION"
  | "WAIT_INVOICE_LIST"
  | "WAIT_PAYMENT_METHOD"
  | "WAIT_EMAIL_REQUEST"
  | "WAIT_SATISFACTION_SURVEY"
  | "WAIT_RESOLUTION_SURVEY"
  | "WAIT_RETRY"
  | "WAIT_PDF"
  | "DONE";

type FlowAttemptResult =
  | {
      status: "PDF_SAVED";
      filePath: string;
    }
  | {
      status: "NO_OPEN_DEBTS";
    };

export class EquatorialInvoiceFlow {
  private step: FlowStep = "START";

  constructor(
    private readonly client: Client,
    private readonly chatId: string,
    private readonly config: AppConfig
  ) {}

  async run(target: InvoiceTarget): Promise<string> {
    logger.info(`Iniciando fluxo de segunda via da Equatorial para UC ${target.uc}, referencia ${target.reference}.`);

    for (let attempt = 1; attempt <= NO_DEBTS_MAX_ATTEMPTS; attempt += 1) {
      logger.info(`Iniciando tentativa ${attempt} do fluxo.`);
      const result = await this.runAttempt(target);

      if (result.status === "PDF_SAVED") {
        return result.filePath;
      }

      if (attempt === NO_DEBTS_MAX_ATTEMPTS) {
        throw new Error(
          `UC ${target.uc}, referencia ${target.reference}: sem debitos faturados apos ${NO_DEBTS_MAX_ATTEMPTS} tentativas.`
        );
      }

      await this.answerNoDebtsSurveyAndWait();
    }

    throw new Error(`Fluxo encerrado sem baixar PDF para UC ${target.uc}, referencia ${target.reference}.`);
  }

  private async runAttempt(target: InvoiceTarget): Promise<FlowAttemptResult> {
    this.step = "WAIT_STARTUP_RESPONSE";
    await sendTextWithDelay(this.client, this.chatId, ".", this.config);

    const startupMessage = await waitForTextMessage(
      this.client,
      this.chatId,
      (body) =>
        this.isDataPolicyRequest(body) ||
        this.isIdentificationRequest(body) ||
        this.hasNoOpenDebts(body),
      this.config.messageTimeoutMs,
      "resposta inicial da Clara"
    );

    if (this.hasNoOpenDebts(startupMessage.body)) {
      return { status: "NO_OPEN_DEBTS" };
    }

    if (this.isDataPolicyRequest(startupMessage.body)) {
      this.step = "WAIT_DATA_POLICY";
      await sendTextWithDelay(this.client, this.chatId, "Estou de acordo", this.config);
      const result = await this.waitForIdentificationRequestOrNoDebts();

      if (result === "NO_OPEN_DEBTS") {
        return { status: "NO_OPEN_DEBTS" };
      }
    } else if (this.isIdentificationRequest(startupMessage.body)) {
      logger.info("Solicitacao de identificacao recebida na resposta inicial.");
    } else {
      const result = await this.waitForIdentificationRequestOrNoDebts();

      if (result === "NO_OPEN_DEBTS") {
        return { status: "NO_OPEN_DEBTS" };
      }
    }

    this.step = "WAIT_PROPERTY_CONFIRMATION";
    await sendTextWithDelay(this.client, this.chatId, target.uc, this.config);

    const propertyMessage = await waitForTextMessage(
      this.client,
      this.chatId,
      (body) =>
        this.isPropertyConfirmation(body) ||
        this.hasNoOpenDebts(body),
      this.config.messageTimeoutMs,
      "confirmacao do imovel"
    );

    if (this.hasNoOpenDebts(propertyMessage.body)) {
      return { status: "NO_OPEN_DEBTS" };
    }

    this.step = "WAIT_PROPERTY_CONFIRMATION";
    await sendTextWithDelay(this.client, this.chatId, "Sim", this.config);

    this.step = "WAIT_INVOICE_LIST";
    const invoiceListMessage = await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => parseInvoiceOptions(body).length > 0 || this.hasNoOpenDebts(body),
      this.config.messageTimeoutMs,
      "lista de faturas disponiveis"
    );

    if (this.hasNoOpenDebts(invoiceListMessage.body)) {
      return { status: "NO_OPEN_DEBTS" };
    }

    const options = parseInvoiceOptions(invoiceListMessage.body);
    const selected = findInvoiceOptionByReference(options, target.reference);

    if (!selected) {
      throw new Error(`Referencia nao encontrada na lista de faturas: ${target.reference}`);
    }

    logger.info(`Referencia selecionada: ${selected.reference}`, selected);

    this.step = "WAIT_PAYMENT_METHOD";
    await sendTextWithDelay(this.client, this.chatId, selected.option, this.config);

    await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => includesAny(body, ["boleto", "pagamento", "pagar", "codigo de barras"]),
      this.config.messageTimeoutMs,
      "opcoes de pagamento"
    );

    this.step = "WAIT_EMAIL_REQUEST";
    await sendTextWithDelay(this.client, this.chatId, "Pagar boleto", this.config);

    await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => includesAny(body, ["email", "e-mail", "mail", "@"]),
      this.config.messageTimeoutMs,
      "solicitacao de e-mail"
    );

    this.step = "WAIT_PDF";
    await sendTextWithDelay(this.client, this.chatId, this.config.registeredEmail, this.config);

    const pdfMessage = await waitForMessage(
      this.client,
      this.chatId,
      (message) => message.hasMedia,
      this.config.messageTimeoutMs,
      "PDF da fatura"
    );

    const pdf = await downloadPdfFromMessage(pdfMessage);
    const filePath = await savePdf(
      this.config.downloadDir,
      target.uc,
      target.reference,
      pdf.data
    );

    this.step = "DONE";
    logger.info(`PDF salvo com sucesso: ${filePath}`, {
      mimeType: pdf.mimeType,
      filename: pdf.filename
    });

    return {
      status: "PDF_SAVED",
      filePath
    };
  }

  getCurrentStep(): FlowStep {
    return this.step;
  }

  private async requestSecondInvoice(): Promise<void> {
    this.step = "WAIT_IDENTIFICATION_REQUEST";
    await sendTextWithDelay(this.client, this.chatId, "Segunda via Fatura", this.config);
  }

  private async waitForIdentificationRequestOrNoDebts(): Promise<"IDENTIFICATION_REQUEST" | "NO_OPEN_DEBTS"> {
    await this.requestSecondInvoice();

    const message = await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => this.isIdentificationRequest(body) || this.hasNoOpenDebts(body),
      this.config.messageTimeoutMs,
      "solicitacao de CPF/CNPJ/Conta Contrato/UC"
    );

    if (this.hasNoOpenDebts(message.body)) {
      return "NO_OPEN_DEBTS";
    }

    return "IDENTIFICATION_REQUEST";
  }

  private async answerNoDebtsSurveyAndWait(): Promise<void> {
    logger.info("Nao existem debitos faturados em aberto. Encerrando conversa e tentando novamente.");

    await sendTextWithDelay(this.client, this.chatId, "Não", this.config);

    this.step = "WAIT_SATISFACTION_SURVEY";
    await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => this.isSatisfactionSurvey(body),
      this.config.messageTimeoutMs,
      "pesquisa de satisfacao"
    );
    await sendTextWithDelay(this.client, this.chatId, "5", this.config);

    this.step = "WAIT_RESOLUTION_SURVEY";
    await waitForTextMessage(
      this.client,
      this.chatId,
      (body) => this.isResolutionSurvey(body),
      this.config.messageTimeoutMs,
      "pergunta se conseguiu resolver a solicitacao"
    );
    await sendTextWithDelay(this.client, this.chatId, "3", this.config);

    this.step = "WAIT_RETRY";
    logger.info(`Aguardando ${NO_DEBTS_RETRY_DELAY_MS / 1000} segundos antes de reiniciar o fluxo.`);
    await sleep(NO_DEBTS_RETRY_DELAY_MS);
  }

  private isDataPolicyRequest(body: string): boolean {
    return includesAny(body, ["politica de uso de dados", "lgpd.equatorialenergia.com.br"]);
  }

  private isIdentificationRequest(body: string): boolean {
    return includesAny(body, [
      "cpf",
      "cnpj",
      "conta contrato",
      "unidade consumidora",
      "uc",
      "codigo unico"
    ]);
  }

  private isPropertyConfirmation(body: string): boolean {
    return includesAny(body, ["imovel", "endereco", "confirma", "correto", "encontrado", "sim"]);
  }

  private hasNoOpenDebts(body: string): boolean {
    return includesAny(body, ["nao possui debitos faturados em aberto", "nao mostro valores ainda nao faturados"]);
  }

  private isSatisfactionSurvey(body: string): boolean {
    return includesAny(body, ["muito satisfeito", "satisfeito", "insatisfeito", "nossa conversa"]);
  }

  private isResolutionSurvey(body: string): boolean {
    return includesAny(body, ["voce conseguiu resolver", "sua solicitacao", "parcialmente"]);
  }
}
