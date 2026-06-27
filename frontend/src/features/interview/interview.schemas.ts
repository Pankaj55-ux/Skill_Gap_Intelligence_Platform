import { z } from "zod";

export const interviewSetupSchema = z.object({
  targetRole: z.string().trim().min(2, "Choose or enter a target role").max(180),
  interviewType: z.enum(["TECHNICAL", "HR", "MIXED"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  questionCount: z.coerce.number().int().min(3, "Use at least 3 questions").max(25, "Use 25 questions or fewer"),
  resumeId: z.string(),
  jobDescriptionId: z.string(),
  durationMinutes: z.coerce.number().int().min(5, "Minimum duration is 5 minutes").max(180, "Maximum duration is 180 minutes"),
});

export type InterviewSetupSchemaValues = z.infer<typeof interviewSetupSchema>;
