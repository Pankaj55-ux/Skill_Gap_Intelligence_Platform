import { z } from "zod";
import { ProficiencyLevel, RecordStatus } from "../../generated/prisma/client.js";

const normalizedListSchema = z.array(
  z.string().trim().min(1).max(120),
)
  .max(100)
  .transform((values) => Array.from(new Set(values)));

const mutableCareerRoleFields = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5_000).nullable().optional(),
  level: z.nativeEnum(ProficiencyLevel).default(ProficiencyLevel.INTERMEDIATE),
  requiredSkills: normalizedListSchema.default([]),
  niceToHaveSkills: normalizedListSchema.default([]),
  minExperience: z.number().int().min(0).max(60).default(0),
  roadmapTags: normalizedListSchema.default([]),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
};

export const createCareerRoleSchema = z.object(mutableCareerRoleFields).strict();

export const updateCareerRoleSchema = z.object({
  title: mutableCareerRoleFields.title.optional(),
  description: mutableCareerRoleFields.description,
  level: z.nativeEnum(ProficiencyLevel).optional(),
  requiredSkills: normalizedListSchema.optional(),
  niceToHaveSkills: normalizedListSchema.optional(),
  minExperience: z.number().int().min(0).max(60).optional(),
  roadmapTags: normalizedListSchema.optional(),
  status: z.nativeEnum(RecordStatus).optional(),
}).strict().refine(
  (body) => Object.values(body).some((value) => value !== undefined),
  "At least one career role field is required",
);

export const careerRoleIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

const queryNumber = (defaultValue: number, options: { min: number; max: number }) => z.coerce
  .number()
  .int()
  .min(options.min)
  .max(options.max)
  .default(defaultValue);

export const listCareerRolesQuerySchema = z.object({
  page: queryNumber(1, { min: 1, max: 10_000 }),
  pageSize: queryNumber(20, { min: 1, max: 100 }),
  title: z.string().trim().min(1).max(160).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  level: z.nativeEnum(ProficiencyLevel).optional(),
  skill: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(RecordStatus).optional(),
}).strict();

export type CreateCareerRoleInput = z.infer<typeof createCareerRoleSchema>;
export type UpdateCareerRoleInput = z.infer<typeof updateCareerRoleSchema>;
export type ListCareerRolesQuery = z.infer<typeof listCareerRolesQuerySchema>;
