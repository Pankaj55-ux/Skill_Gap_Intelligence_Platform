import { z } from "zod";

const skillListSchema = z.array(z.string().trim().min(1).max(120)).max(200).default([]);
const jobDescriptionBodyKeys = [
  "title",
  "company",
  "description",
  "requiredSkills",
  "preferredSkills",
  "experience",
  "location",
  "employmentType",
] as const;

const parseSkillList = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to comma-separated form parsing.
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const optionalText = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const nullableText = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const createJobDescriptionSchema = z.object({
  title: z.string().trim().min(2).max(180),
  company: z.string().trim().min(1).max(180),
  description: z.string().trim().min(20).max(50_000).optional(),
  requiredSkills: skillListSchema,
  preferredSkills: skillListSchema,
  experience: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(180).nullable().optional(),
  employmentType: z.string().trim().max(80).nullable().optional(),
}).strict();

export const updateJobDescriptionSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  company: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().min(20).max(50_000).optional(),
  requiredSkills: skillListSchema.optional(),
  preferredSkills: skillListSchema.optional(),
  experience: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(180).nullable().optional(),
  employmentType: z.string().trim().max(80).nullable().optional(),
}).strict();

export const jobDescriptionIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const normalizeJobDescriptionBody = (body: unknown): Record<string, unknown> => {
  const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const normalized: Record<string, unknown> = {};

  for (const key of jobDescriptionBodyKeys) {
    const value = source[key];
    if (value === undefined) continue;

    if (key === "requiredSkills" || key === "preferredSkills") {
      normalized[key] = parseSkillList(value);
    } else if (key === "experience" || key === "location" || key === "employmentType") {
      normalized[key] = nullableText(value);
    } else {
      normalized[key] = optionalText(value);
    }
  }

  return normalized;
};

export const hasJobDescriptionUpdateFields = (body: UpdateJobDescriptionInput): boolean => (
  Object.values(body).some((value) => value !== undefined)
);

export type CreateJobDescriptionInput = z.infer<typeof createJobDescriptionSchema>;
export type UpdateJobDescriptionInput = z.infer<typeof updateJobDescriptionSchema>;
