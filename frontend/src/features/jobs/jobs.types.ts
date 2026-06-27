export type CareerRoleLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface CareerRole {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: CareerRoleLevel;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minExperience: number;
  roadmapTags: string[];
  industry: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareerRoleListResponse {
  roles: CareerRole[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CareerRoleQuery {
  page: number;
  pageSize: number;
  search?: string;
  title?: string;
  level?: CareerRoleLevel;
  skill?: string;
  status?: string;
}

export interface NormalizedSkill {
  id: string;
  originalSkill: string;
  normalizedSkill: string;
  category: string;
  confidence: number;
}

export interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experience: string | null;
  location: string | null;
  employmentType: string | null;
  uploadedBy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: unknown;
  normalizedSkills: NormalizedSkill[];
}
