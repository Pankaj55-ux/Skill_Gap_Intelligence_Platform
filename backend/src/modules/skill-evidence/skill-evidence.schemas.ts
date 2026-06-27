import { z } from "zod";
import {
  EvidenceType,
  EvidenceVerifiedStatus,
  ProficiencyLevel,
} from "../../generated/prisma/client.js";

const skillEvidenceFields = {
  skillName: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  proficiencyLevel: z.nativeEnum(ProficiencyLevel),
  evidenceType: z.enum([
    EvidenceType.PROJECT,
    EvidenceType.CERTIFICATE,
    EvidenceType.COURSE,
    EvidenceType.CODING_PROFILE,
    EvidenceType.INTERNSHIP,
    EvidenceType.OTHER,
  ]),
  evidenceUrl: z.string().trim().url().max(2048).nullable().optional(),
  description: z.string().trim().min(1).max(5_000),
};

export const createSkillEvidenceSchema = z.object(skillEvidenceFields).strict();

export const updateOwnSkillEvidenceSchema = z.object({
  skillName: skillEvidenceFields.skillName.optional(),
  category: skillEvidenceFields.category.optional(),
  proficiencyLevel: skillEvidenceFields.proficiencyLevel.optional(),
  evidenceType: skillEvidenceFields.evidenceType.optional(),
  evidenceUrl: skillEvidenceFields.evidenceUrl,
  description: skillEvidenceFields.description.optional(),
}).strict().refine(
  (body) => Object.values(body).some((value) => value !== undefined),
  "At least one skill evidence field is required",
);

export const reviewSkillEvidenceSchema = z.object({
  verifiedStatus: z.enum([
    EvidenceVerifiedStatus.VERIFIED,
    EvidenceVerifiedStatus.REJECTED,
  ]),
}).strict();

export const skillEvidenceIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export type CreateSkillEvidenceInput = z.infer<typeof createSkillEvidenceSchema>;
export type UpdateOwnSkillEvidenceInput = z.infer<typeof updateOwnSkillEvidenceSchema>;
export type ReviewSkillEvidenceInput = z.infer<typeof reviewSkillEvidenceSchema>;
