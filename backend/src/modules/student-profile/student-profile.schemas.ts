import { z } from "zod";

const optionalTrimmedString = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

const stringListSchema = z.array(
  z.string().trim().min(1).max(120),
)
  .max(50)
  .transform((values) => Array.from(new Set(values)));

const profileBodySchema = z.object({
  fullName: optionalTrimmedString(160),
  college: optionalTrimmedString(200),
  branch: optionalTrimmedString(160),
  graduationYear: z.number().int().min(1950).max(2200).nullable().optional(),
  targetRole: optionalTrimmedString(160),
  currentSkills: z.union([stringListSchema, z.null()]).optional(),
  preferredCompanies: z.union([stringListSchema, z.null()]).optional(),
  resumeUrl: z.string().trim().url().max(2048).nullable().optional(),
}).strict();

const hasAtLeastOneProfileField = (body: z.infer<typeof profileBodySchema>) => Object.values(body)
  .some((value) => value !== undefined);

export const createStudentProfileSchema = profileBodySchema.refine(
  hasAtLeastOneProfileField,
  "At least one student profile field is required",
);

export const updateStudentProfileSchema = profileBodySchema.refine(
  hasAtLeastOneProfileField,
  "At least one student profile field is required",
);

export const studentUserParamsSchema = z.object({
  userId: z.string().uuid(),
}).strict();

export type CreateStudentProfileInput = z.infer<typeof createStudentProfileSchema>;
export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
