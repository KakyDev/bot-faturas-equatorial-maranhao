import { normalizeText } from "../utils/text";

export interface InvoiceOption {
  option: string;
  reference: string;
  amount?: string;
}

const invoiceLineRegex =
  /(?:^|\n)\s*(?<option>\d+)\s*(?:[-.)]|-)\s*(?:refer[eê]ncia|ref\.?)\s*:?\s*(?<reference>\d{2}\/\d{4})(?:.*?(?:valor|r\$)\s*:?\s*r?\$?\s*(?<amount>\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}))?/giu;

export const parseInvoiceOptions = (message: string): InvoiceOption[] => {
  const options: InvoiceOption[] = [];

  for (const match of message.matchAll(invoiceLineRegex)) {
    const groups = match.groups;

    if (!groups?.option || !groups.reference) {
      continue;
    }

    options.push({
      option: groups.option,
      reference: groups.reference,
      amount: groups.amount
    });
  }

  return options;
};

export const findInvoiceOptionByReference = (
  options: InvoiceOption[],
  targetReference: string
): InvoiceOption | undefined => {
  const normalizedTarget = normalizeText(targetReference);

  return options.find((option) => normalizeText(option.reference) === normalizedTarget);
};
