import { z } from "zod";

export const roadmapIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();
