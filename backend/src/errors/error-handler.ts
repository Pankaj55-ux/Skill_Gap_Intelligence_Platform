import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { sendError } from "../common/response.js";
import { Prisma } from "../generated/prisma/client.js";
import { logger } from "../logging/logger.js";
import { AppError } from "./app-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    logger.error({ err: error, requestId: req.requestId }, "Error occurred after headers were sent");
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    sendError(req, res, {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.flatten(),
    }, 400);
    return;
  }

  if (error instanceof AppError) {
    sendError(req, res, {
      code: error.code,
      message: error.message,
      details: error.details,
    }, error.statusCode);
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    sendError(req, res, {
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON",
    }, 400);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "ECONNREFUSED") {
      sendError(req, res, {
        code: "DATABASE_CONNECTION_FAILED",
        message: "Database connection failed. Check DATABASE_URL and make sure PostgreSQL is reachable.",
      }, 503);
      return;
    }

    if (error.code === "P2028") {
      sendError(req, res, {
        code: "DATABASE_TRANSACTION_TIMEOUT",
        message: "The database operation timed out. Please retry the request.",
      }, 503);
      return;
    }

    if (error.code === "P2021") {
      sendError(req, res, {
        code: "DATABASE_SCHEMA_NOT_READY",
        message: "Database schema is not ready. Run Prisma migrations or db push before serving traffic.",
      }, 503);
      return;
    }

    if (error.code === "P2002") {
      sendError(req, res, {
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "The submitted value conflicts with an existing record",
      }, 409);
      return;
    }

    if (error.code === "P2025") {
      sendError(req, res, {
        code: "RECORD_NOT_FOUND",
        message: "The requested record was not found",
      }, 404);
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    sendError(req, res, {
      code: "DATABASE_QUERY_VALIDATION_ERROR",
      message: "Request parameters produced an invalid database query",
    }, 400);
    return;
  }

  logger.error({ err: error, requestId: req.requestId }, "Unhandled request error");
  sendError(req, res, {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  }, 500);
};
