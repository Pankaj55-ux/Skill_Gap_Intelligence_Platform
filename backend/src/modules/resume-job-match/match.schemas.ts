import { z } from "zod";

export const runResumeJobMatchSchema = z.object({
  resumeId: z.string().uuid(),
  jobDescriptionId: z.string().uuid(),
}).strict();

export type RunResumeJobMatchInput = z.infer<typeof runResumeJobMatchSchema>;
