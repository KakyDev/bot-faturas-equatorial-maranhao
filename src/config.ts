import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  equatorialPhoneNumber: string;
  registeredEmail: string;
  csvDir: string;
  downloadDir: string;
  sessionDir: string;
  messageTimeoutMs: number;
  minDelayMs: number;
  maxDelayMs: number;
}

const requiredString = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
};

const numberFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Variavel de ambiente invalida: ${name} deve ser um numero positivo`);
  }

  return value;
};

const resolveProjectPath = (value: string): string => {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(process.cwd(), value);
};

export const loadConfig = (): AppConfig => {
  const minDelayMs = numberFromEnv("MIN_DELAY_MS", 2000);
  const maxDelayMs = numberFromEnv("MAX_DELAY_MS", 5000);

  if (minDelayMs > maxDelayMs) {
    throw new Error("MIN_DELAY_MS nao pode ser maior que MAX_DELAY_MS");
  }

  return {
    equatorialPhoneNumber: requiredString("EQUATORIAL_PHONE_NUMBER"),
    registeredEmail: requiredString("REGISTERED_EMAIL"),
    csvDir: resolveProjectPath(process.env.CSV_DIR?.trim() || "./csvs"),
    downloadDir: resolveProjectPath(process.env.DOWNLOAD_DIR?.trim() || "./downloads"),
    sessionDir: resolveProjectPath(process.env.SESSION_DIR?.trim() || "./sessions"),
    messageTimeoutMs: numberFromEnv("MESSAGE_TIMEOUT_MS", 90000),
    minDelayMs,
    maxDelayMs
  };
};
