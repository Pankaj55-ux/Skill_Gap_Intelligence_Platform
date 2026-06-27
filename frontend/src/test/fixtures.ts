import type { AuthUser } from "../types/auth";
import type { StudentDashboard } from "../features/dashboard/dashboard.types";

export const studentUser: AuthUser = {
  id: "user-1",
  email: "student@example.com",
  displayName: "Demo Student",
  role: "STUDENT",
  status: "ACTIVE",
};

export const studentDashboard: StudentDashboard = {
  profile: {
    id: "profile-1",
    email: studentUser.email,
    displayName: studentUser.displayName,
    profile: {
      fullName: "Demo Student",
      college: "SGIP College",
      branch: "Computer Science",
      graduationYear: 2026,
      targetRole: "Frontend Developer",
      profileCompletionPercentage: 85,
    },
  },
  currentReadinessScore: 72,
  roadmapProgress: {
    roadmapId: "roadmap-1",
    title: "Frontend Developer Roadmap",
    status: "ACTIVE",
    totalItems: 5,
    completedItems: 2,
    overallCompletionPercentage: 40,
    projectedReadinessScore: 86,
  },
  completedSkills: ["HTML", "CSS"],
  pendingSkills: [{ skillName: "Testing", category: "Frontend" }],
  verifiedSkills: [{ skillName: "React", category: "Frontend", verifiedStatus: "VERIFIED" }],
  gapAnalysisSummary: {
    reportId: "gap-1",
    readinessScore: 72,
    matchedSkillsCount: 4,
    weakSkillsCount: 2,
    missingSkillsCount: 1,
    explanation: "Good fundamentals with testing gaps.",
    generatedAt: "2026-06-26T10:00:00.000Z",
  },
  recentActivities: [{
    id: "activity-1",
    action: "GAP_ANALYSIS_RUN",
    entityType: "GapReport",
    entityId: "gap-1",
    createdAt: "2026-06-26T10:00:00.000Z",
  }],
  latestNotifications: [{
    id: "notification-1",
    type: "INFO",
    message: "Roadmap updated",
    createdAt: "2026-06-26T10:00:00.000Z",
  }],
  upcomingGoals: [{
    roadmapItemId: "item-1",
    title: "Practice component tests",
    priority: "HIGH",
    estimatedWeeks: 1,
    estimatedHours: 6,
    skillsCovered: ["React Testing Library"],
    practiceGoals: ["Write form tests"],
  }],
  weeklyProgress: [{
    date: "2026-06-26",
    completedItems: 2,
    averageCompletionPercentage: 40,
  }],
  careerRole: {
    id: "role-1",
    title: "Frontend Developer",
    level: "ENTRY",
  },
  profileCompletion: 85,
  analytics: {
    metrics: {
      currentReadiness: 72,
      averageInterviewScore: 68,
      latestInterviewScore: 74,
      resumeScore: 80,
      roadmapProgress: 40,
      projectsCompleted: 1,
      coursesCompleted: 2,
      verifiedSkillsCount: 3,
      weakSkillsCount: 2,
      strongSkillsCount: 4,
      monthlyImprovement: 12,
      weeklyImprovement: 5,
    },
    skillDistribution: [{ category: "Frontend", count: 4 }],
    weakSkills: ["Testing", "Accessibility"],
    strongSkills: ["React", "CSS"],
    trends: {
      monthlyImprovement: [{ month: "2026-06", readinessScore: 72 }],
      weeklyImprovement: [{ week: "2026-06-26", averageInterviewScore: 74, roadmapCompletion: 40 }],
      placementReadiness: [{ date: "2026-06-26", score: 72, source: "gap-analysis" }],
    },
    charts: {
      progress: [{ label: "Readiness", value: 72 }],
      interviewPerformance: [{
        date: "2026-06-26",
        score: 74,
        technicalScore: 76,
        communicationScore: 70,
        confidenceScore: 72,
      }],
      skillCategories: [{ category: "Frontend", count: 4 }],
      roadmapCompletion: [{
        roadmapItemId: "item-1",
        title: "Practice component tests",
        completionPercentage: 40,
        completed: false,
      }],
    },
  },
};

export const apiEnvelope = <T,>(data: T) => ({
  data: {
    data,
    error: null,
    meta: {
      requestId: "test-request-id",
      timestamp: "2026-06-26T10:00:00.000Z",
    },
  },
});
