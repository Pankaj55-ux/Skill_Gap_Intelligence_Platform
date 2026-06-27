export type CourseProvider =
  | "YouTube"
  | "Coursera"
  | "Udemy"
  | "freeCodeCamp"
  | "NPTEL"
  | "Microsoft Learn"
  | "AWS Skill Builder"
  | "Google Cloud Skills Boost";

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface CourseRecommendationItem {
  title: string;
  provider: CourseProvider;
  level: CourseLevel;
  duration: string;
  url: string;
  skillsCovered: string[];
  reason: string;
}

export interface CourseItemState {
  bookmarked?: boolean;
  completed?: boolean;
  progressPercentage?: number;
  updatedAt?: string;
}

export interface CourseRecommendationRecord {
  id: string;
  userId: string;
  roadmapId: string;
  targetRole: string;
  recommendations: {
    recommendations: CourseRecommendationItem[];
  };
  aiModel: string;
  promptVersion: string;
  executionTimeMs: number;
  confidence: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  metadata: unknown;
  itemStates: Record<string, CourseItemState>;
  roadmap: {
    id: string;
    title: string;
    status: string;
  };
}
