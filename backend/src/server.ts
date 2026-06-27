import type { Server } from "node:http";
import { app } from "./app.js";
import { env } from "./config/environment.js";
import { connectDatabase, disconnectDatabase } from "./database/index.js";
import { logger } from "./logging/logger.js";

let server: Server | undefined;

let isShuttingDown = false;

const closeServer = async (): Promise<void> => new Promise((resolve, reject) => {
  if (!server) {
    resolve();
    return;
  }

  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

const shutdown = (signal: NodeJS.Signals): void => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  const finishShutdown = async (error?: Error): Promise<void> => {
    clearTimeout(forceExitTimer);
    if (error) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exit(1);
    }

    await disconnectDatabase();
    logger.info("HTTP server stopped");
    process.exit(0);
  };

  void closeServer()
    .then(() => finishShutdown())
    .catch((error: Error) => finishShutdown(error));
};

const fatalShutdown = (source: "unhandledRejection" | "uncaughtException", error: unknown): void => {
  logger.fatal({ err: error, source }, "Fatal process error");

  const forceExitTimer = setTimeout(() => process.exit(1), env.SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  void closeServer()
    .catch((closeError: Error) => logger.error({ err: closeError }, "HTTP server shutdown failed after fatal error"))
    .finally(() => disconnectDatabase().finally(() => process.exit(1)));
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => fatalShutdown("unhandledRejection", reason));
process.on("uncaughtException", (error) => fatalShutdown("uncaughtException", error));

const start = async (): Promise<void> => {
  await connectDatabase();
  logger.info("PostgreSQL connection established");

  server = app.listen(env.PORT, () => {
    logger.info(
      { environment: env.NODE_ENV, port: env.PORT },
      `${env.APP_NAME} is listening`,
    );
  });

  server.on("error", (error) => {
    logger.fatal({ err: error }, "HTTP server failed");
    process.exitCode = 1;
  });
};

void start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Application startup failed");
  process.exitCode = 1;
});
