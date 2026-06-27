import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const splitList = (value: string) => Array.from(new Set(
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
));

export const profileFormSchema = z.object({
  fullName: optionalText(160),
  college: optionalText(200),
  branch: optionalText(160),
  graduationYear: z.coerce
    .number({ invalid_type_error: "Graduation year must be a number" })
    .int("Graduation year must be a whole number")
    .min(1950, "Graduation year is too early")
    .max(2200, "Graduation year is too far in the future")
    .or(z.literal(""))
    .optional(),
  targetRole: optionalText(160),
  currentSkillsText: z.string().max(4_000).optional(),
  preferredCompaniesText: z.string().max(4_000).optional(),
  resumeUrl: z.string().trim().url("Enter a valid resume URL").or(z.literal("")).optional(),
});

export const evidenceFormSchema = z.object({
  skillName: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1, "Category is required").max(120),
  proficiencyLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  evidenceType: z.enum(["PROJECT", "CERTIFICATE", "COURSE", "CODING_PROFILE", "INTERNSHIP", "OTHER"]),
  evidenceUrl: z.string().trim().url("Enter a valid URL").or(z.literal("")).optional(),
  description: z.string().trim().min(1, "Description is required").max(5_000),
});

export const resumeUploadSchema = z.object({
  resume: z
    .custom<FileList>()
    .refine((files) => files instanceof FileList && files.length === 1, "Choose one resume file")
    .refine((files) => {
      const file = files?.[0];
      return !file || file.size <= 10 * 1024 * 1024;
    }, "Resume must be 10 MB or smaller")
    .refine((files) => {
      const file = files?.[0];
      return !file || [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.type);
    }, "Only PDF, DOC, and DOCX files are supported"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type EvidenceFormValues = z.infer<typeof evidenceFormSchema>;
export type ResumeUploadValues = z.infer<typeof resumeUploadSchema>;

export const toProfilePayload = (values: ProfileFormValues) => ({
  fullName: values.fullName?.trim() || null,
  college: values.college?.trim() || null,
  branch: values.branch?.trim() || null,
  graduationYear: values.graduationYear === "" || values.graduationYear === undefined ? null : values.graduationYear,
  targetRole: values.targetRole?.trim() || null,
  currentSkills: values.currentSkillsText ? splitList(values.currentSkillsText) : null,
  preferredCompanies: values.preferredCompaniesText ? splitList(values.preferredCompaniesText) : null,
  resumeUrl: values.resumeUrl?.trim() || null,
});
