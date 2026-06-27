import { z } from "zod";

export const resumeIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();
