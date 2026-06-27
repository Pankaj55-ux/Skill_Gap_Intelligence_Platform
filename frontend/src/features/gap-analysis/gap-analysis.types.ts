export type SkillGapStatus = "matched" | "weak" | "missing";
export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "MISSING";
export type EvidenceStatus = "PENDING" | "VERIFIED" | "REJECTED" | "NONE";

export interface GapSkillEntry {
  skillId?: string;
  skillName: string;
  requiredLevel: SkillLevel;
  currentLevel: SkillLevel;
  evidenceStatus: EvidenceStatus;
  weight: number;
  isMandatory: boolean;
  levelCompatibility: number;
  status: SkillGapStatus;
}

export interface GapReport {
  id: string;
  userId: string;
  careerRoleId: string;
  readinessScore: number;
  evidenceCoverage: number | null;
  matchedSkills: GapSkillEntry[];
  weakSkills: GapSkillEntry[];
  missingSkills: GapSkillEntry[];
  explanation: string;
  recommendations: Array<{
    skillName: string;
    requiredLevel: SkillLevel;
    reason: string;
  }>;
  generatedAt: string;
  createdAt: string;
  careerRole: {
    id: string;
    title: string;
    level: string;
  };
}

export interface GapAnalysisResult {
  report: GapReport;
  analysis: {
    targetCareerRole: {
      id: string;
      title: string;
    };
    matchedSkills: GapSkillEntry[];
    missingSkills: GapSkillEntry[];
    weakSkills: GapSkillEntry[];
    readinessScore: number;
    evidenceCoverage: number;
    explanation: string;
    componentScores: {
      profileCompletion: number;
      requiredSkillMatch: number;
      evidenceStrength: number;
      skillLevelCompatibility: number;
    };
    weights: {
      profileCompletion: number;
      requiredSkillMatch: number;
      evidenceStrength: number;
      skillLevelCompatibility: number;
    };
  };
}

export interface GapHistoryItem {
  type: "gapReports";
  id: string;
  title: string;
  summary: string | null;
  status: string;
  createdAt: string;
  score: number | null;
  completion: number | null;
  priority: number;
  data: {
    id: string;
    explanation: string;
    readinessScore: string | number;
    evidenceCoverage: string | number | null;
    status: string;
    createdAt: string;
    generatedAt: string;
    careerRole: {
      id: string;
      title: string;
      level: string;
    };
  };
}

export interface GapHistoryResponse {
  items: GapHistoryItem[];
  metadata: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  resources: string[];
}
