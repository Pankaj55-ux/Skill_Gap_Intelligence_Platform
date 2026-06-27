import { z } from "zod";

export const runGapAnalysisSchema = z.object({
  targetCareerRoleId: z.string().uuid(),
}).strict();

export type RunGapAnalysisInput = z.infer<typeof runGapAnalysisSchema>;
