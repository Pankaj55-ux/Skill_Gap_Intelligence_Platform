import { z } from "zod";

export const startInterviewSessionSchema = z.object({
  targetRole: z.string().trim().min(2).max(180),
  resumeId: z.string().uuid().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(180).default(30),
  questionCount: z.coerce.number().int().min(1).max(25).optional(),
  expectedTopics: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
}).strict();

export const submitTextAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(20_000),
}).strict();

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
}).strict();

export const liveQuestionSchema = z.object({
  question: z.string().trim().min(5).max(2_000),
  expectedTopics: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
}).strict();

export type StartInterviewSessionInput = z.infer<typeof startInterviewSessionSchema>;
export type SubmitTextAnswerInput = z.infer<typeof submitTextAnswerSchema>;
export type LiveQuestion = z.infer<typeof liveQuestionSchema>;
