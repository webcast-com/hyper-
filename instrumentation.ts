import { captureError, logger } from "./lib/logger";

export async function register() {
  logger.info("instrumentation registered", { runtime: process.env.NEXT_RUNTIME || "nodejs" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      captureError(reason, { source: "unhandledRejection" });
    });
    process.on("uncaughtException", (error) => {
      captureError(error, { source: "uncaughtException" });
    });
  }
}
