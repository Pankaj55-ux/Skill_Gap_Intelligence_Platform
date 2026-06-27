export type RoadmapPriority = "HIGH" | "MEDIUM" | "LOW" | "FINAL";
export type RoadmapCompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface RoadmapItem {
  title: string;
  description: string;
  priority: RoadmapPriority;
  estimatedWeeks: number;
  estimatedHours: number;
  skillsCovered: string[];
  completionStatus: RoadmapCompletionStatus;
  orderNumber: number;
  recommendedProjects: string[];
  practiceGoals: string[];
}

export interface RoadmapPlan {
  difficulty: "FOUNDATIONAL" | "ACCELERATED" | "PLACEMENT_READY";
  readinessScore: number;
  phases: RoadmapItem[];
}

export interface Roadmap {
  id: string;
  userId: string;
  careerRoleId: string;
  gapReportId: string;
  title: string;
  description: string | null;
  plan: RoadmapPlan;
  startsAt: string;
  targetDate: string;
  completedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  careerRole: {
    id: string;
    title: string;
    level: string;
  };
  gapReport: {
    id: string;
    readinessScore: number;
    generatedAt: string;
  } | null;
}

export interface ProgressLog {
  id: string;
  userId: string;
  roadmapId: string;
  roadmapItemId: string;
  completed: boolean;
  completionPercentage: number;
  completedAt: string | null;
  notes: string | null;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface RoadmapProgress {
  roadmapId: string;
  title: string;
  status: string;
  progress: ProgressLog[];
  summary: {
    totalItems: number;
    completedItems: number;
    overallCompletionPercentage: number;
    baseReadinessScore: number;
    projectedReadinessScore: number;
  };
}

export interface UpdateProgressResponse {
  progress: ProgressLog;
  roadmap: {
    id: string;
    status: string;
    metadata: unknown;
  };
  summary: RoadmapProgress["summary"] & {
    updatedPlan?: RoadmapPlan;
  };
}
