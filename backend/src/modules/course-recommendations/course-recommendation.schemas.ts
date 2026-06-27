import { z } from "zod";

export const courseRecommendationRequestSchema = z.object({
  roadmapId: z.string().uuid(),
}).strict();

const providerSchema = z.enum([
  "YouTube",
  "Coursera",
  "Udemy",
  "freeCodeCamp",
  "NPTEL",
  "Microsoft Learn",
  "AWS Skill Builder",
  "Google Cloud Skills Boost",
]);

const courseSchema = z.object({
  title: z.string().trim().min(3).max(220),
  provider: providerSchema,
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  duration: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(2_048),
  skillsCovered: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
  reason: z.string().trim().min(10).max(1_000),
}).strict();

export const courseRecommendationOutputSchema = z.object({
  recommendations: z.array(courseSchema).min(1).max(30),
}).strict();

export const courseRecommendationIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const updateCourseRecommendationItemStateSchema = z.object({
  courseKey: z.string().trim().min(3).max(600),
  bookmarked: z.boolean().optional(),
  completed: z.boolean().optional(),
  progressPercentage: z.number().int().min(0).max(100).optional(),
}).strict().refine(
  (body) => body.bookmarked !== undefined || body.completed !== undefined || body.progressPercentage !== undefined,
  "At least one course state field is required",
);

export type CourseRecommendationRequest = z.infer<typeof courseRecommendationRequestSchema>;
export type CourseRecommendationOutput = z.infer<typeof courseRecommendationOutputSchema>;
export type CourseRecommendationItem = z.infer<typeof courseSchema>;
export type UpdateCourseRecommendationItemState = z.infer<typeof updateCourseRecommendationItemStateSchema>;
