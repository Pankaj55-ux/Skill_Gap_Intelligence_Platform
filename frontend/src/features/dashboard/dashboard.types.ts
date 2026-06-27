export interface DashboardSkill {
  skillName: string;
  category: string | null;
  proficiencyLevel?: string | null;
  verifiedStatus?: string;
}

export interface StudentDashboard {
  profile: {
    id: string;
    email: string;
    displayName: string;
    profile: {
      fullName?: string | null;
      college?: string | null;
      branch?: string | null;
      graduationYear?: number | null;
      targetRole?: string | null;
      profileCompletionPercentage?: number | null;
    } | null;
  } | null;
  currentReadinessScore: number | null;
  roadmapProgress: {
    roadmapId: string | null;
    title: string | null;
    status: string | null;
    totalItems: number;
    completedItems: number;
    overallCompletionPercentage: number;
    projectedReadinessScore: number | null;
  };
  completedSkills: string[];
  pendingSkills: DashboardSkill[];
  verifiedSkills: DashboardSkill[];
  gapAnalysisSummary: {
    reportId: string | null;
    readinessScore: number | null;
    matchedSkillsCount: number;
    weakSkillsCount: number;
    missingSkillsCount: number;
    explanation: string | null;
    generatedAt: string | null;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }>;
  latestNotifications: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
  upcomingGoals: Array<{
    roadmapItemId: string;
    title: string;
    priority: string | null;
    estimatedWeeks: number | null;
    estimatedHours: number | null;
    skillsCovered: string[];
    practiceGoals: string[];
  }>;
  weeklyProgress: Array<{
    date: string;
    completedItems: number;
    averageCompletionPercentage: number;
  }>;
  careerRole: {
    id: string;
    title: string;
    level: string;
  } | null;
  profileCompletion: number;
  analytics: {
    metrics: {
      currentReadiness: number | null;
      averageInterviewScore: number | null;
      latestInterviewScore: number | null;
      resumeScore: number | null;
      roadmapProgress: number;
      projectsCompleted: number;
      coursesCompleted: number;
      verifiedSkillsCount: number;
      weakSkillsCount: number;
      strongSkillsCount: number;
      monthlyImprovement: number | null;
      weeklyImprovement: number | null;
    };
    skillDistribution: Array<{ category: string; count: number }>;
    weakSkills: string[];
    strongSkills: string[];
    trends: {
      monthlyImprovement: Array<{ month: string; readinessScore: number }>;
      weeklyImprovement: Array<{ week: string; averageInterviewScore: number | null; roadmapCompletion: number }>;
      placementReadiness: Array<{ date: string; score: number; source: string }>;
    };
    charts: {
      progress: Array<{ label: string; value: number }>;
      interviewPerformance: Array<{
        date: string;
        score: number;
        technicalScore: number;
        communicationScore: number;
        confidenceScore: number;
      }>;
      skillCategories: Array<{ category: string; count: number }>;
      roadmapCompletion: Array<{
        roadmapItemId: string;
        title: string;
        completionPercentage: number;
        completed: boolean;
      }>;
    };
  };
}

export interface DashboardResponse {
  dashboard: StudentDashboard;
}
