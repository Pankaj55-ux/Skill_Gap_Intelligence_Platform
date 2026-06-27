import { z } from "zod";
import { NotificationType } from "../../generated/prisma/client.js";

const queryNumber = (defaultValue: number, options: { min: number; max: number }) => z.coerce
  .number()
  .int()
  .min(options.min)
  .max(options.max)
  .default(defaultValue);

export const listNotificationsQuerySchema = z.object({
  page: queryNumber(1, { min: 1, max: 10_000 }),
  limit: queryNumber(20, { min: 1, max: 100 }),
  unreadOnly: z.coerce.boolean().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  search: z.string().trim().min(1).max(120).optional(),
}).strict();

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
