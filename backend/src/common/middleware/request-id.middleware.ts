import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const VALID_REQUEST_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const suppliedRequestId = req.header(REQUEST_ID_HEADER)?.trim();
  const requestId = suppliedRequestId && VALID_REQUEST_ID.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
