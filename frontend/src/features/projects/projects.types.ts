export type ProjectDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface RecommendedProject {
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  estimatedWeeks: number;
  skillsCovered: string[];
  githubTopics: string[];
  learningOutcome: string;
}

export interface ProjectRecommendationOutput {
  beginnerProjects: RecommendedProject[];
  intermediateProjects: RecommendedProject[];
  advancedProjects: RecommendedProject[];
}

export interface ProjectRecommendationRequest {
  targetRole: string;
  resumeAnalysisId: string;
  roadmapId: string;
}
