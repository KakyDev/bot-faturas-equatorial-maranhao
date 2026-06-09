import fs from "node:fs/promises";
import path from "node:path";

export interface InvoiceTarget {
  uc: string;
  reference: string;
  sourceFile: string;
  lineNumber: number;
}

interface CsvColumnIndexes {
  uc: number;
  reference: number;
}

export const parseInvoiceTargetsCsv = (content: string, sourceFile: string): InvoiceTarget[] => {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim().toUpperCase());
  const columns = getColumnIndexes(headers, sourceFile);

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const uc = values[columns.uc]?.trim();
    const reference = values[columns.reference]?.trim();
    const lineNumber = index + 2;

    if (!uc || !reference) {
      throw new Error(`Linha invalida em ${sourceFile}:${lineNumber}. TARGET_UC e TARGET_REFERENCE sao obrigatorios.`);
    }

    return {
      uc,
      reference,
      sourceFile,
      lineNumber
    };
  });
};

export const loadInvoiceTargetsFromCsvDir = async (csvDir: string): Promise<InvoiceTarget[]> => {
  const entries = await fs.readdir(csvDir, { withFileTypes: true });
  const csvFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(csvDir, entry.name))
    .sort();

  if (csvFiles.length === 0) {
    throw new Error(`Nenhum arquivo CSV encontrado em: ${csvDir}`);
  }

  const targets: InvoiceTarget[] = [];

  for (const filePath of csvFiles) {
    const content = await fs.readFile(filePath, "utf8");
    targets.push(...parseInvoiceTargetsCsv(content, filePath));
  }

  if (targets.length === 0) {
    throw new Error(`Nenhuma fatura encontrada nos CSVs de: ${csvDir}`);
  }

  return targets;
};

const getColumnIndexes = (headers: string[], sourceFile: string): CsvColumnIndexes => {
  const uc = headers.indexOf("TARGET_UC");
  const reference = headers.indexOf("TARGET_REFERENCE");

  if (uc === -1 || reference === -1) {
    throw new Error(`CSV invalido em ${sourceFile}. Cabecalho esperado: TARGET_UC;TARGET_REFERENCE`);
  }

  return {
    uc,
    reference
  };
};

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};
