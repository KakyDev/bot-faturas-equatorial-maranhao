type LogLevel = "info" | "warn" | "error" | "debug";

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }

  return String(error);
};

const write = (level: LogLevel, message: string, meta?: unknown): void => {
  const timestamp = new Date().toISOString();
  const suffix = meta === undefined ? "" : ` ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  info: (message: string, meta?: unknown): void => write("info", message, meta),
  warn: (message: string, meta?: unknown): void => write("warn", message, meta),
  debug: (message: string, meta?: unknown): void => write("debug", message, meta),
  error: (message: string, error?: unknown): void => write("error", message, error === undefined ? undefined : formatError(error))
};
