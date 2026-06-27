import { z } from "zod";

export const updateProgressSchema = z.object({
  roadmapId: z.string().uuid(),
  roadmapItemId: z.union([
    z.string().trim().min(1).max(80),
    z.number().int().min(1).max(10_000).transform(String),
  ]),
  completed: z.boolean().optional(),
  completionPercentage: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
}).strict().refine(
  (body) => body.completed !== undefined || body.completionPercentage !== undefined || body.notes !== undefined,
  "At least one progress field is required",
);

export const roadmapProgressParamsSchema = z.object({
  roadmapId: z.string().uuid(),
}).strict();

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
