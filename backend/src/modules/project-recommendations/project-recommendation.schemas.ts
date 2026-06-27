import { z } from "zod";

export const projectRecommendationRequestSchema = z.object({
  targetRole: z.string().trim().min(2).max(180),
  resumeAnalysisId: z.string().uuid(),
  roadmapId: z.string().uuid(),
}).strict();

const projectSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(20).max(1_500),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  estimatedWeeks: z.coerce.number().int().min(1).max(52),
  skillsCovered: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  githubTopics: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  learningOutcome: z.string().trim().min(10).max(1_000),
}).strict();

export const projectRecommendationOutputSchema = z.object({
  beginnerProjects: z.array(projectSchema).max(8).default([]),
  intermediateProjects: z.array(projectSchema).max(8).default([]),
  advancedProjects: z.array(projectSchema).max(8).default([]),
}).strict();

export type ProjectRecommendationRequest = z.infer<typeof projectRecommendationRequestSchema>;
export type ProjectRecommendationOutput = z.infer<typeof projectRecommendationOutputSchema>;
export type RecommendedProject = z.infer<typeof projectSchema>;
