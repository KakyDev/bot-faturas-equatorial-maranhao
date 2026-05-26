import { Message } from "whatsapp-web.js";

export interface DownloadedPdf {
  data: Buffer;
  mimeType: string;
  filename?: string;
}

const hasPdfSignature = (data: Buffer): boolean => data.subarray(0, 4).toString("utf8") === "%PDF";

export const downloadPdfFromMessage = async (message: Message): Promise<DownloadedPdf> => {
  if (!message.hasMedia) {
    throw new Error("Mensagem recebida nao possui midia.");
  }

  const media = await message.downloadMedia();

  if (!media) {
    throw new Error("Nao foi possivel baixar a midia recebida.");
  }

  const data = Buffer.from(media.data, "base64");
  const filename = media.filename ?? undefined;
  const mimeType = media.mimetype;
  const filenameLooksPdf = filename ? filename.toLowerCase().endsWith(".pdf") : false;
  const mimeLooksPdf = mimeType.toLowerCase().includes("pdf");

  if (!mimeLooksPdf && !filenameLooksPdf && !hasPdfSignature(data)) {
    throw new Error(`Midia recebida nao parece ser PDF. MIME: ${mimeType}`);
  }

  return {
    data,
    mimeType,
    filename
  };
};
