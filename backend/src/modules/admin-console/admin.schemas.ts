import { z } from "zod";
import { RecordStatus, UserRole } from "../../generated/prisma/client.js";

export const adminResourceParamsSchema = z.object({
  resource: z.string().trim().min(2).max(80),
}).strict();

export const adminResourceIdParamsSchema = z.object({
  resource: z.string().trim().min(2).max(80),
  id: z.string().uuid(),
}).strict();

const queryNumber = (defaultValue: number, options: { min: number; max: number }) => z.coerce
  .number()
  .int()
  .min(options.min)
  .max(options.max)
  .default(defaultValue);

export const adminListQuerySchema = z.object({
  page: queryNumber(1, { min: 1, max: 10_000 }),
  limit: queryNumber(20, { min: 1, max: 100 }),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(RecordStatus).optional(),
  includeDeleted: z.coerce.boolean().default(false),
  role: z.nativeEnum(UserRole).optional(),
  type: z.string().trim().min(1).max(120).optional(),
  level: z.string().trim().min(1).max(120).optional(),
  provider: z.string().trim().min(1).max(120).optional(),
  targetRole: z.string().trim().min(1).max(180).optional(),
}).strict();

export const adminBodySchema = z.record(z.unknown());

export const adminUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
}).strict();

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminBody = z.infer<typeof adminBodySchema>;
