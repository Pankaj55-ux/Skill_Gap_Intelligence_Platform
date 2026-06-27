import { database } from "../../database/index.js";
import {
  EvidenceVerifiedStatus,
  Prisma,
  RecordStatus,
} from "../../generated/prisma/client.js";

const DASHBOARD_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  expiresAt: number;
  dashboard: StudentDashboard;
}

interface RoadmapPlanItem {
  title?: string;
  orderNumber?: number;
  priority?: string;
  estimatedWeeks?: number;
  estimatedHours?: number;
  skillsCovered?: string[];
  completionStatus?: string;
  practiceGoals?: string[];
}

interface RoadmapPlan {
  difficulty?: string;
  readinessScore?: number;
  phases?: RoadmapPlanItem[];
}

interface DashboardSkill {
  skillName: string;
  category: string | null;
  proficiencyLevel?: string | null;
  verifiedStatus?: string;
}

interface StudentDashboard {
  profile: unknown;
  currentReadinessScore: number | null;
  roadmapProgress: {
    roadmapId: string | null;
    title: string | null;
    status: RecordStatus | null;
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
    generatedAt: Date | null;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: Date;
  }>;
  latestNotifications: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date;
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
  analytics: AnalyticsDashboard;
}

interface AnalyticsDashboard {
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
  skillDistribution: Array<{
    category: string;
    count: number;
  }>;
  weakSkills: string[];
  strongSkills: string[];
  recentActivity: StudentDashboard["recentActivities"];
  trends: {
    monthlyImprovement: Array<{ month: string; readinessScore: number }>;
    weeklyImprovement: Array<{ week: string; averageInterviewScore: number | null; roadmapCompletion: number }>;
    placementReadiness: Array<{ date: string; score: number; source: string }>;
  };
  charts: {
    progress: Array<{ label: string; value: number }>;
    interviewPerformance: Array<{ date: string; score: number; technicalScore: number; communicationScore: number; confidenceScore: number }>;
    skillCategories: Array<{ category: string; count: number }>;
    roadmapCompletion: Array<{ roadmapItemId: string; title: string; completionPercentage: number; completed: boolean }>;
  };
  dataAvailability: {
    projectsCompleted: string;
    coursesCompleted: string;
  };
}

const dashboardCache = new Map<string, CacheEntry>();

const toNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const parsePlan = (value: Prisma.JsonValue): RoadmapPlan => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { phases: [] };
  return value as unknown as RoadmapPlan;
};

const parseArray = (value: Prisma.JsonValue | null | undefined): unknown[] => Array.isArray(value) ? value : [];

const skillNameFrom = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return null;
  const item = value as { skillName?: unknown; skill?: unknown };
  if (typeof item.skillName === "string") return item.skillName;
  if (typeof item.skill === "string") return item.skill;
  return null;
};

const unique = (values: string[]): string[] => Array.from(new Set(
  values.map((value) => value.trim()).filter(Boolean),
));

const roadmapItemIdFrom = (phase: RoadmapPlanItem): string | null => typeof phase.orderNumber === "number"
  ? String(phase.orderNumber)
  : null;

const progressSummary = (
  roadmap: { plan: Prisma.JsonValue; gapReport?: { readinessScore: Prisma.Decimal } | null } | null,
  progressLogs: Array<{ roadmapItemId: string; completed: boolean; completionPercentage: number }>,
) => {
  if (!roadmap) {
    return {
      totalItems: 0,
      completedItems: 0,
      overallCompletionPercentage: 0,
      projectedReadinessScore: null as number | null,
    };
  }

  const plan = parsePlan(roadmap.plan);
  const itemIds = Array.isArray(plan.phases)
    ? plan.phases.map(roadmapItemIdFrom).filter((id): id is string => id !== null)
    : [];
  const logsByItemId = new Map(progressLogs.map((log) => [log.roadmapItemId, log]));
  const totalCompletion = itemIds.reduce(
    (sum, itemId) => sum + (logsByItemId.get(itemId)?.completionPercentage ?? 0),
    0,
  );
  const overallCompletionPercentage = itemIds.length > 0
    ? Math.round(totalCompletion / itemIds.length)
    : 0;
  const completedItems = itemIds.filter((itemId) => logsByItemId.get(itemId)?.completed).length;
  const baseReadinessScore = toNumber(roadmap.gapReport?.readinessScore) ?? Number(plan.readinessScore ?? 0);
  const projectedReadinessScore = Math.min(
    100,
    Math.round((baseReadinessScore + ((100 - baseReadinessScore) * (overallCompletionPercentage / 100) * 0.5)) * 100) / 100,
  );

  return {
    totalItems: itemIds.length,
    completedItems,
    overallCompletionPercentage,
    projectedReadinessScore,
  };
};

const latestNotificationsFrom = (
  input: {
    profileCompletion: number;
    latestGapReport: { id: string; readinessScore: Prisma.Decimal; createdAt: Date } | null;
    activeRoadmap: { id: string; createdAt: Date } | null;
    pendingEvidenceCount: number;
  },
) => {
  const notifications: StudentDashboard["latestNotifications"] = [];

  if (input.profileCompletion < 100) {
    notifications.push({
      id: "profile-completion",
      type: "PROFILE",
      message: `Profile completion is ${input.profileCompletion}%. Complete your profile to improve analysis quality.`,
      createdAt: new Date(),
    });
  }

  if (!input.latestGapReport) {
    notifications.push({
      id: "gap-analysis-needed",
      type: "GAP_ANALYSIS",
      message: "Run gap analysis to unlock readiness score and roadmap recommendations.",
      createdAt: new Date(),
    });
  }

  if (input.latestGapReport && !input.activeRoadmap) {
    notifications.push({
      id: "roadmap-needed",
      type: "ROADMAP",
      message: "Generate a roadmap from your latest gap report.",
      createdAt: input.latestGapReport.createdAt,
    });
  }

  if (input.pendingEvidenceCount > 0) {
    notifications.push({
      id: "pending-evidence-review",
      type: "EVIDENCE",
      message: `${input.pendingEvidenceCount} skill evidence item(s) are pending review.`,
      createdAt: new Date(),
    });
  }

  return notifications.slice(0, 5);
};

const weeklyProgressFrom = (logs: Array<{
  updatedAt: Date;
  completed: boolean;
  completionPercentage: number;
}>) => {
  const today = new Date();
  const dayBuckets = new Map<string, { completedItems: number; totalPercentage: number; count: number }>();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    dayBuckets.set(key, { completedItems: 0, totalPercentage: 0, count: 0 });
  }

  for (const log of logs) {
    const key = log.updatedAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    bucket.completedItems += log.completed ? 1 : 0;
    bucket.totalPercentage += log.completionPercentage;
    bucket.count += 1;
  }

  return Array.from(dayBuckets.entries()).map(([date, bucket]) => ({
    date,
    completedItems: bucket.completedItems,
    averageCompletionPercentage: bucket.count > 0 ? Math.round(bucket.totalPercentage / bucket.count) : 0,
  }));
};

const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

const weekKey = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = normalized.getDate() - day + (day === 0 ? -6 : 1);
  normalized.setDate(diff);
  return normalized.toISOString().slice(0, 10);
};

const numericDelta = (values: number[]): number | null => {
  if (values.length < 2) return null;
  return Math.round((values[values.length - 1] - values[0]) * 100) / 100;
};

const roadmapCompletionChartFrom = (
  roadmap: { plan: Prisma.JsonValue } | null,
  progressLogs: Array<{ roadmapItemId: string; completed: boolean; completionPercentage: number }>,
) => {
  if (!roadmap) return [];

  const logsByItemId = new Map(progressLogs.map((log) => [log.roadmapItemId, log]));
  return (parsePlan(roadmap.plan).phases ?? []).map((phase) => {
    const roadmapItemId = roadmapItemIdFrom(phase) ?? "";
    const progress = logsByItemId.get(roadmapItemId);
    return {
      roadmapItemId,
      title: phase.title ?? "Roadmap item",
      completionPercentage: progress?.completionPercentage ?? 0,
      completed: progress?.completed ?? false,
    };
  });
};

const skillDistributionFrom = (skills: DashboardSkill[]) => {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    const category = skill.category ?? "Uncategorized";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
};

const skillNamesFromGapJson = (value: Prisma.JsonValue | null | undefined): string[] => unique(
  parseArray(value)
    .map(skillNameFrom)
    .filter((skill): skill is string => Boolean(skill)),
);

const latestResumeScoreFrom = (
  latestResumeAnalysis: { confidence: Prisma.Decimal; createdAt: Date } | null,
  latestMatch: { matchScore: Prisma.Decimal; createdAt: Date } | null,
): number | null => {
  if (latestMatch) return toNumber(latestMatch.matchScore);
  if (latestResumeAnalysis) return toNumber(latestResumeAnalysis.confidence);
  return null;
};

const analyticsFrom = (input: {
  latestGapReport: {
    readinessScore: Prisma.Decimal;
    matchedSkills: Prisma.JsonValue;
    weakSkills: Prisma.JsonValue;
    generatedAt: Date;
  } | null;
  gapReports: Array<{ readinessScore: Prisma.Decimal; generatedAt: Date }>;
  activeRoadmap: { plan: Prisma.JsonValue } | null;
  activeRoadmapProgressLogs: Array<{ roadmapItemId: string; completed: boolean; completionPercentage: number; updatedAt: Date }>;
  allProgressLogs: Array<{ roadmapItemId: string; completed: boolean; completionPercentage: number; updatedAt: Date }>;
  verifiedSkills: DashboardSkill[];
  recentActivities: StudentDashboard["recentActivities"];
  latestResumeAnalysis: { confidence: Prisma.Decimal; createdAt: Date } | null;
  latestMatch: { matchScore: Prisma.Decimal; createdAt: Date } | null;
  interviewEvaluations: Array<{
    score: Prisma.Decimal;
    technicalScore: Prisma.Decimal;
    communicationScore: Prisma.Decimal;
    confidenceScore: Prisma.Decimal;
    createdAt: Date;
  }>;
  roadmapProgressPercentage: number;
}): AnalyticsDashboard => {
  const sortedGapReports = [...input.gapReports].sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());
  const monthlyMap = new Map<string, number>();
  for (const report of sortedGapReports) {
    monthlyMap.set(monthKey(report.generatedAt), Number(report.readinessScore));
  }
  const monthlyImprovement = Array.from(monthlyMap.entries()).map(([month, readinessScore]) => ({ month, readinessScore }));

  const weeklyInterviewMap = new Map<string, { totalScore: number; count: number }>();
  for (const evaluation of input.interviewEvaluations) {
    const key = weekKey(evaluation.createdAt);
    const bucket = weeklyInterviewMap.get(key) ?? { totalScore: 0, count: 0 };
    bucket.totalScore += Number(evaluation.score);
    bucket.count += 1;
    weeklyInterviewMap.set(key, bucket);
  }
  const weeklyRoadmapMap = new Map<string, number>();
  for (const log of input.allProgressLogs) {
    weeklyRoadmapMap.set(weekKey(log.updatedAt), log.completionPercentage);
  }
  const allWeeks = Array.from(new Set([...weeklyInterviewMap.keys(), ...weeklyRoadmapMap.keys()])).sort();
  const weeklyImprovement = allWeeks.map((week) => {
    const interview = weeklyInterviewMap.get(week);
    return {
      week,
      averageInterviewScore: interview ? Math.round((interview.totalScore / interview.count) * 100) / 100 : null,
      roadmapCompletion: weeklyRoadmapMap.get(week) ?? 0,
    };
  });

  const interviewPerformance = input.interviewEvaluations
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((evaluation) => ({
      date: evaluation.createdAt.toISOString(),
      score: Number(evaluation.score),
      technicalScore: Number(evaluation.technicalScore),
      communicationScore: Number(evaluation.communicationScore),
      confidenceScore: Number(evaluation.confidenceScore),
    }));

  const placementReadiness = [
    ...sortedGapReports.map((report) => ({
      date: report.generatedAt.toISOString(),
      score: Number(report.readinessScore),
      source: "gap_report",
    })),
    ...input.interviewEvaluations.map((evaluation) => ({
      date: evaluation.createdAt.toISOString(),
      score: Number(evaluation.score),
      source: "interview",
    })),
    ...(input.latestMatch ? [{
      date: input.latestMatch.createdAt.toISOString(),
      score: Number(input.latestMatch.matchScore),
      source: "resume_job_match",
    }] : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const interviewScores = input.interviewEvaluations.map((evaluation) => Number(evaluation.score));
  const skillDistribution = skillDistributionFrom(input.verifiedSkills);
  const roadmapCompletion = roadmapCompletionChartFrom(input.activeRoadmap, input.activeRoadmapProgressLogs);
  const strongSkills = unique([
    ...skillNamesFromGapJson(input.latestGapReport?.matchedSkills),
    ...input.verifiedSkills.map((skill) => skill.skillName),
  ]);
  const weakSkills = skillNamesFromGapJson(input.latestGapReport?.weakSkills);
  const monthlyReadinessValues = monthlyImprovement.map((point) => point.readinessScore);
  const weeklyReadinessValues = weeklyImprovement
    .map((point) => point.averageInterviewScore ?? point.roadmapCompletion)
    .filter((value) => typeof value === "number");

  return {
    metrics: {
      currentReadiness: toNumber(input.latestGapReport?.readinessScore),
      averageInterviewScore: interviewScores.length > 0
        ? Math.round((interviewScores.reduce((sum, score) => sum + score, 0) / interviewScores.length) * 100) / 100
        : null,
      latestInterviewScore: interviewScores.length > 0 ? interviewScores[0] : null,
      resumeScore: latestResumeScoreFrom(input.latestResumeAnalysis, input.latestMatch),
      roadmapProgress: input.roadmapProgressPercentage,
      projectsCompleted: roadmapCompletion.filter((item) => item.completed && /project/i.test(item.title)).length,
      coursesCompleted: 0,
      verifiedSkillsCount: input.verifiedSkills.length,
      weakSkillsCount: weakSkills.length,
      strongSkillsCount: strongSkills.length,
      monthlyImprovement: numericDelta(monthlyReadinessValues),
      weeklyImprovement: numericDelta(weeklyReadinessValues),
    },
    skillDistribution,
    weakSkills,
    strongSkills,
    recentActivity: input.recentActivities,
    trends: {
      monthlyImprovement,
      weeklyImprovement,
      placementReadiness,
    },
    charts: {
      progress: [
        { label: "Readiness", value: toNumber(input.latestGapReport?.readinessScore) ?? 0 },
        { label: "Roadmap", value: input.roadmapProgressPercentage },
        { label: "Resume", value: latestResumeScoreFrom(input.latestResumeAnalysis, input.latestMatch) ?? 0 },
        { label: "Interview", value: interviewScores.length > 0 ? interviewScores[0] : 0 },
      ],
      interviewPerformance,
      skillCategories: skillDistribution,
      roadmapCompletion,
    },
    dataAvailability: {
      projectsCompleted: "Derived from completed roadmap items whose titles reference projects; no dedicated project completion table exists yet.",
      coursesCompleted: "No dedicated course completion tracking table exists yet, so this remains 0 until course progress is implemented.",
    },
  };
};

const upcomingGoalsFrom = (
  roadmap: { plan: Prisma.JsonValue } | null,
  progressLogs: Array<{ roadmapItemId: string; completed: boolean; completionPercentage: number }>,
) => {
  if (!roadmap) return [];

  const logsByItemId = new Map(progressLogs.map((log) => [log.roadmapItemId, log]));
  const phases = parsePlan(roadmap.plan).phases ?? [];

  return phases
    .filter((phase) => {
      const itemId = roadmapItemIdFrom(phase);
      if (!itemId) return false;
      const progress = logsByItemId.get(itemId);
      return !progress || !progress.completed;
    })
    .slice(0, 5)
    .map((phase) => ({
      roadmapItemId: roadmapItemIdFrom(phase) ?? "",
      title: phase.title ?? "Roadmap item",
      priority: phase.priority ?? null,
      estimatedWeeks: phase.estimatedWeeks ?? null,
      estimatedHours: phase.estimatedHours ?? null,
      skillsCovered: Array.isArray(phase.skillsCovered) ? phase.skillsCovered : [],
      practiceGoals: Array.isArray(phase.practiceGoals) ? phase.practiceGoals : [],
    }));
};

export const clearDashboardCacheForUser = (userId: string): void => {
  dashboardCache.delete(userId);
};

export const getStudentDashboard = async (
  userId: string,
): Promise<{ dashboard: StudentDashboard; cacheStatus: "HIT" | "MISS"; maxAgeSeconds: number }> => {
  const cached = dashboardCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { dashboard: cached.dashboard, cacheStatus: "HIT", maxAgeSeconds: DASHBOARD_CACHE_TTL_MS / 1_000 };
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    user,
    latestGapReport,
    activeRoadmap,
    allEvidence,
    recentProgressLogs,
    recentActivities,
    gapReports,
    latestResumeAnalysis,
    latestMatch,
    interviewEvaluations,
  ] = await Promise.all([
    database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        studentProfile: {
          select: {
            fullName: true,
            college: true,
            branch: true,
            graduationYear: true,
            targetRole: true,
            currentSkills: true,
            preferredCompanies: true,
            resumeUrl: true,
            profileCompletionPercentage: true,
          },
        },
      },
    }),
    database.gapReport.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { generatedAt: "desc" },
      select: {
        id: true,
        readinessScore: true,
        matchedSkills: true,
        weakSkills: true,
        missingSkills: true,
        explanation: true,
        generatedAt: true,
        createdAt: true,
        careerRole: {
          select: {
            id: true,
            title: true,
            level: true,
          },
        },
      },
    }),
    database.roadmap.findFirst({
      where: {
        userId,
        status: { in: [RecordStatus.ACTIVE, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED] },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        plan: true,
        metadata: true,
        createdAt: true,
        gapReport: {
          select: {
            readinessScore: true,
          },
        },
        careerRole: {
          select: {
            id: true,
            title: true,
            level: true,
          },
        },
      },
    }),
    database.skillEvidence.findMany({
      where: { userId, status: RecordStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        proficiency: true,
        verifiedStatus: true,
        createdAt: true,
        skill: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    database.progressLog.findMany({
      where: {
        userId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        roadmapId: true,
        roadmapItemId: true,
        completed: true,
        completionPercentage: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    database.auditEvent.findMany({
      where: {
        OR: [{ userId }, { actorId: userId }],
        deletedAt: null,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    database.gapReport.findMany({
      where: {
        userId,
        status: RecordStatus.COMPLETED,
        deletedAt: null,
      },
      select: {
        readinessScore: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: "asc" },
      take: 24,
    }),
    database.resumeAnalysis.findFirst({
      where: {
        resume: {
          userId,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
        },
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        confidence: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    database.resumeJobMatch.findFirst({
      where: {
        userId,
        status: RecordStatus.COMPLETED,
        deletedAt: null,
      },
      select: {
        matchScore: true,
        createdAt: true,
      },
      orderBy: { generatedAt: "desc" },
    }),
    database.interviewEvaluation.findMany({
      where: {
        answer: {
          userId,
          deletedAt: null,
        },
        status: RecordStatus.COMPLETED,
        deletedAt: null,
      },
      select: {
        score: true,
        technicalScore: true,
        communicationScore: true,
        confidenceScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const activeRoadmapProgressLogs = activeRoadmap
    ? recentProgressLogs.filter((log) => log.roadmapId === activeRoadmap.id)
    : [];
  const roadmapSummary = progressSummary(activeRoadmap, activeRoadmapProgressLogs);
  const verifiedEvidence = allEvidence.filter((item) => item.verifiedStatus === EvidenceVerifiedStatus.VERIFIED);
  const pendingEvidence = allEvidence.filter((item) => item.verifiedStatus === EvidenceVerifiedStatus.PENDING);
  const verifiedSkills = verifiedEvidence.map((item) => ({
    skillName: item.skill.name,
    category: item.skill.category,
    proficiencyLevel: item.proficiency,
    verifiedStatus: item.verifiedStatus,
  }));
  const pendingSkills = pendingEvidence.map((item) => ({
    skillName: item.skill.name,
    category: item.skill.category,
    proficiencyLevel: item.proficiency,
    verifiedStatus: item.verifiedStatus,
  }));
  const completedSkills = activeRoadmap
    ? unique(
      (parsePlan(activeRoadmap.plan).phases ?? [])
        .filter((phase) => {
          const itemId = roadmapItemIdFrom(phase);
          return itemId ? activeRoadmapProgressLogs.find((log) => log.roadmapItemId === itemId)?.completed : false;
        })
        .flatMap((phase) => Array.isArray(phase.skillsCovered) ? phase.skillsCovered : []),
    )
    : [];
  const profileCompletion = user?.studentProfile?.profileCompletionPercentage ?? 0;
  const careerRole = latestGapReport?.careerRole ?? activeRoadmap?.careerRole ?? null;
  const dashboard: StudentDashboard = {
    profile: user ? {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      profile: user.studentProfile,
    } : null,
    currentReadinessScore: toNumber(latestGapReport?.readinessScore),
    roadmapProgress: {
      roadmapId: activeRoadmap?.id ?? null,
      title: activeRoadmap?.title ?? null,
      status: activeRoadmap?.status ?? null,
      totalItems: roadmapSummary.totalItems,
      completedItems: roadmapSummary.completedItems,
      overallCompletionPercentage: roadmapSummary.overallCompletionPercentage,
      projectedReadinessScore: roadmapSummary.projectedReadinessScore,
    },
    completedSkills,
    pendingSkills,
    verifiedSkills,
    gapAnalysisSummary: {
      reportId: latestGapReport?.id ?? null,
      readinessScore: toNumber(latestGapReport?.readinessScore),
      matchedSkillsCount: parseArray(latestGapReport?.matchedSkills).length,
      weakSkillsCount: parseArray(latestGapReport?.weakSkills).length,
      missingSkillsCount: parseArray(latestGapReport?.missingSkills).length,
      explanation: latestGapReport?.explanation ?? null,
      generatedAt: latestGapReport?.generatedAt ?? null,
    },
    recentActivities,
    latestNotifications: latestNotificationsFrom({
      profileCompletion,
      latestGapReport,
      activeRoadmap,
      pendingEvidenceCount: pendingEvidence.length,
    }),
    upcomingGoals: upcomingGoalsFrom(activeRoadmap, activeRoadmapProgressLogs),
    weeklyProgress: weeklyProgressFrom(recentProgressLogs.filter((log) => log.updatedAt >= sevenDaysAgo)),
    careerRole: careerRole ? {
      id: careerRole.id,
      title: careerRole.title,
      level: careerRole.level,
    } : null,
    profileCompletion,
    analytics: analyticsFrom({
      latestGapReport,
      gapReports,
      activeRoadmap,
      activeRoadmapProgressLogs,
      allProgressLogs: recentProgressLogs,
      verifiedSkills,
      recentActivities,
      latestResumeAnalysis,
      latestMatch,
      interviewEvaluations,
      roadmapProgressPercentage: roadmapSummary.overallCompletionPercentage,
    }),
  };

  dashboardCache.set(userId, {
    dashboard,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  });

  return { dashboard, cacheStatus: "MISS", maxAgeSeconds: DASHBOARD_CACHE_TTL_MS / 1_000 };
};
