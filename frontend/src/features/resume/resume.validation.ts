import { z } from "zod";

export const ACCEPTED_RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

export const resumeFileSchema = z
  .instanceof(File, { message: "Choose a resume file" })
  .refine((file) => file.size <= MAX_RESUME_SIZE_BYTES, "Resume must be 10 MB or smaller")
  .refine((file) => ACCEPTED_RESUME_TYPES.includes(file.type as (typeof ACCEPTED_RESUME_TYPES)[number]), "Only PDF and DOCX files are supported");

export const validateResumeFile = (file: File) => resumeFileSchema.safeParse(file);
