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

export interface ResumeStructuredData {
  technicalSkills: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  tools: string[];
  programmingLanguages: string[];
  softSkills: string[];
  certifications: string[];
  projects: Array<Record<string, unknown>>;
  internships: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  achievements: string[];
  summary: string;
  improvementSuggestions: string[];
}

export interface ResumeAnalysis {
  id: string;
  resumeId: string;
  structuredData: ResumeStructuredData;
  aiModel: string;
  promptVersion: string;
  executionTimeMs: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedSkill {
  id: string;
  resumeId: string;
  originalSkill: string;
  normalizedSkill: string;
  category: string;
  confidence: number;
}

export interface ResumeAnalysisResult {
  analysis: ResumeAnalysis;
  normalizedSkills: NormalizedSkill[];
}
