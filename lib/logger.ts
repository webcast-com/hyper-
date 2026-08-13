type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (/password|secret|token|key|authorization|cookie/i.test(key)) result[key] = "[redacted]";
    else result[key] = redact(val);
  }
  return result;
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    level,
    message,
    context: redact(context),
    service: "creator-connect",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  return entry;
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context)
};

export async function captureError(error: unknown, context: LogContext = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry = logger.error(err.message, { ...context, stack: err.stack, name: err.name });
  const webhook = process.env.MONITORING_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
    } catch (webhookError) {
      logger.warn("monitoring webhook failed", { error: (webhookError as Error).message });
    }
  }
}

export function requestContext(request?: Request) {
  if (!request) return {};
  return {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")
  };
}
