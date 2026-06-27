import { z } from "zod";

const passwordSchema = z.string()
  .min(12, "Password must contain at least 12 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes");

const emailSchema = z.string().trim().email().max(320).transform((email) => email.toLowerCase());

export const registerSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(160),
  password: passwordSchema,
  role: z.literal("STUDENT").default("STUDENT"),
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
}).strict();

const studentProfileSchema = z.object({
  headline: z.string().trim().max(200).nullable().optional(),
  bio: z.string().trim().max(5_000).nullable().optional(),
  institution: z.string().trim().max(200).nullable().optional(),
  department: z.string().trim().max(160).nullable().optional(),
  graduationYear: z.number().int().min(1950).max(2200).nullable().optional(),
  targetCareerRoleId: z.string().uuid().nullable().optional(),
}).strict();

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(2).max(160).optional(),
  studentProfile: studentProfileSchema.optional(),
}).strict().refine(
  (body) => body.displayName !== undefined || body.studentProfile !== undefined,
  "At least one profile field is required",
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
