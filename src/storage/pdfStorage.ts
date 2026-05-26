import fs from "node:fs/promises";
import path from "node:path";

export const buildPdfFileName = (uc: string, reference: string): string => {
  const safeUc = uc.replace(/[^\dA-Za-z_-]/g, "");
  const safeReference = reference.replace(/[^\dA-Za-z_-]/g, "-");

  return `${safeUc}_${safeReference}.pdf`;
};

export const savePdf = async (
  downloadDir: string,
  uc: string,
  reference: string,
  data: Buffer
): Promise<string> => {
  await fs.mkdir(downloadDir, { recursive: true });

  const filePath = path.join(downloadDir, buildPdfFileName(uc, reference));
  await fs.writeFile(filePath, data);

  return filePath;
};
