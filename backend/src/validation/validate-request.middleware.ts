import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export const validateRequest = (schema: RequestValidationSchema): RequestHandler => (
  req,
  _res,
  next,
) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.params) Object.assign(req.params, schema.params.parse(req.params));
    if (schema.query) {
      Object.defineProperty(req, "query", {
        value: schema.query.parse(req.query),
        configurable: true,
        enumerable: true,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
