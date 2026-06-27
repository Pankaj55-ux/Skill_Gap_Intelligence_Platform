export type ProficiencyLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type EvidenceType = "PROJECT" | "CERTIFICATE" | "COURSE" | "CODING_PROFILE" | "INTERNSHIP" | "OTHER";
export type EvidenceVerifiedStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface StudentProfile {
  id: string;
  userId: string;
  fullName: string | null;
  college: string | null;
  branch: string | null;
  graduationYear: number | null;
  targetRole: string | null;
  currentSkills: string[] | null;
  preferredCompanies: string[] | null;
  resumeUrl: string | null;
  profileCompletionPercentage: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
}

export interface StudentProfilePayload {
  fullName?: string | null;
  college?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  targetRole?: string | null;
  currentSkills?: string[] | null;
  preferredCompanies?: string[] | null;
  resumeUrl?: string | null;
}

export interface SkillEvidence {
  id: string;
  userId: string;
  skillName: string;
  category: string;
  proficiencyLevel?: ProficiencyLevel;
  proficiency?: ProficiencyLevel;
  evidenceType: EvidenceType;
  evidenceUrl: string | null;
  description: string;
  verifiedStatus: EvidenceVerifiedStatus;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
  parsingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
  updatedAt: string;
}
