import type { Request, Response } from "express";

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details: unknown;
}

export interface SuccessResponse<T> {
  data: T;
  meta: ResponseMeta;
  error: null;
}

export interface ErrorResponse {
  data: null;
  meta: ResponseMeta;
  error: ApiError;
}

const createMeta = (requestId: string): ResponseMeta => ({
  requestId,
  timestamp: new Date().toISOString(),
});

export const sendSuccess = <T>(
  req: Request,
  res: Response<SuccessResponse<T>>,
  data: T,
  statusCode = 200,
): Response<SuccessResponse<T>> => res.status(statusCode).json({
  data,
  meta: createMeta(req.requestId),
  error: null,
});

export const sendError = (
  req: Request,
  res: Response<ErrorResponse>,
  error: Omit<ApiError, "details"> & { details?: unknown },
  statusCode: number,
): Response<ErrorResponse> => res.status(statusCode).json({
  data: null,
  meta: createMeta(req.requestId),
  error: {
    code: error.code,
    message: error.message,
    details: error.details ?? null,
  },
});
