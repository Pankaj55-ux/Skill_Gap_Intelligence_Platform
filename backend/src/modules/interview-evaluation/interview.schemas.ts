import { z } from "zod";

export const evaluateInterviewAnswerSchema = z.object({
  question: z.string().trim().min(5).max(5_000),
  studentAnswer: z.string().trim().min(1).max(20_000),
  resumeId: z.string().uuid().optional(),
  expectedTopics: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
}).strict();

export const interviewAnswerIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

const stringListSchema = z.array(z.string().trim().min(1).max(500)).max(30).default([]);

export const aiInterviewEvaluationSchema = z.object({
  strengths: stringListSchema,
  weaknesses: stringListSchema,
  missingConcepts: stringListSchema,
  communicationScore: z.coerce.number().min(0).max(100),
  technicalScore: z.coerce.number().min(0).max(100),
  confidenceScore: z.coerce.number().min(0).max(100),
  improvementPlan: stringListSchema,
  summary: z.string().trim().min(1).max(2_000),
}).strict();

export type EvaluateInterviewAnswerInput = z.infer<typeof evaluateInterviewAnswerSchema>;
export type AIInterviewEvaluation = z.infer<typeof aiInterviewEvaluationSchema>;
