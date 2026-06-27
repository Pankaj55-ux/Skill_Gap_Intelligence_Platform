import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
} from "../../generated/prisma/client.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

type SkillGapItem = {
  skillName?: string;
  skill?: string;
  requiredLevel?: string;
  currentLevel?: string;
  status?: string;
};

type RoadmapDifficulty = "FOUNDATIONAL" | "ACCELERATED" | "PLACEMENT_READY";

export interface RoadmapItem {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | "FINAL";
  estimatedWeeks: number;
  estimatedHours: number;
  skillsCovered: string[];
  completionStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  orderNumber: number;
  recommendedProjects: string[];
  practiceGoals: string[];
}

export interface GeneratedRoadmapPlan {
  difficulty: RoadmapDifficulty;
  readinessScore: number;
  phases: RoadmapItem[];
}

const roadmapSelect = {
  id: true,
  userId: true,
  careerRoleId: true,
  gapReportId: true,
  title: true,
  description: true,
  plan: true,
  startsAt: true,
  targetDate: true,
  completedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  careerRole: {
    select: {
      id: true,
      title: true,
      level: true,
    },
  },
  gapReport: {
    select: {
      id: true,
      readinessScore: true,
      generatedAt: true,
    },
  },
} satisfies Prisma.RoadmapSelect;

type SelectedRoadmap = Prisma.RoadmapGetPayload<{ select: typeof roadmapSelect }>;

const toNumber = (value: Prisma.Decimal | number): number => Number(value);

const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const parseGapItems = (value: Prisma.JsonValue): SkillGapItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SkillGapItem => typeof item === "object" && item !== null);
};

const skillNameFrom = (item: SkillGapItem): string => item.skillName ?? item.skill ?? "Unnamed Skill";

const uniqueSkills = (items: SkillGapItem[]): string[] => Array.from(new Set(
  items.map(skillNameFrom).filter((skill) => skill.trim().length > 0),
));

const difficultyFromScore = (readinessScore: number): RoadmapDifficulty => {
  if (readinessScore < 50) return "FOUNDATIONAL";
  if (readinessScore < 75) return "ACCELERATED";
  return "PLACEMENT_READY";
};

const estimatesFor = (difficulty: RoadmapDifficulty, priority: RoadmapItem["priority"], skillCount: number) => {
  const safeSkillCount = Math.max(skillCount, 1);
  const multiplier = difficulty === "FOUNDATIONAL" ? 1.4 : difficulty === "ACCELERATED" ? 1.1 : 0.85;
  const baseWeeks = priority === "HIGH" ? 4 : priority === "MEDIUM" ? 3 : priority === "LOW" ? 2 : 2;
  const estimatedWeeks = Math.max(1, Math.ceil((baseWeeks + safeSkillCount - 1) * multiplier));
  return {
    estimatedWeeks,
    estimatedHours: estimatedWeeks * (difficulty === "PLACEMENT_READY" ? 8 : 10),
  };
};

const projectFor = (skills: string[], phaseName: string): string[] => {
  const skillText = skills.slice(0, 3).join(", ") || "target role fundamentals";
  return [
    `Build a ${phaseName.toLowerCase()} portfolio task using ${skillText}.`,
    `Document decisions, trade-offs, and measurable outcomes for ${skillText}.`,
  ];
};

const goalsFor = (skills: string[], difficulty: RoadmapDifficulty): string[] => {
  const cadence = difficulty === "FOUNDATIONAL"
    ? "5 focused practice sessions per week"
    : difficulty === "ACCELERATED"
      ? "4 focused practice sessions per week"
      : "3 timed placement-style practice sessions per week";

  return [
    cadence,
    `Create evidence for ${skills.slice(0, 3).join(", ") || "the covered skills"}.`,
    "Review progress weekly and update skill evidence before rerunning gap analysis.",
  ];
};

const makeItem = (
  args: {
    title: string;
    description: string;
    priority: RoadmapItem["priority"];
    skills: string[];
    difficulty: RoadmapDifficulty;
    orderNumber: number;
  },
): RoadmapItem => {
  const estimates = estimatesFor(args.difficulty, args.priority, args.skills.length);

  return {
    title: args.title,
    description: args.description,
    priority: args.priority,
    estimatedWeeks: estimates.estimatedWeeks,
    estimatedHours: estimates.estimatedHours,
    skillsCovered: args.skills,
    completionStatus: "NOT_STARTED",
    orderNumber: args.orderNumber,
    recommendedProjects: projectFor(args.skills, args.title),
    practiceGoals: goalsFor(args.skills, args.difficulty),
  };
};

export const generateRoadmapPlan = (
  input: { missingSkills: SkillGapItem[]; weakSkills: SkillGapItem[]; readinessScore: number },
): GeneratedRoadmapPlan => {
  const difficulty = difficultyFromScore(input.readinessScore);
  const missingSkills = uniqueSkills(input.missingSkills);
  const weakSkills = uniqueSkills(input.weakSkills);
  const highPrioritySkills = missingSkills.slice(0, 5);
  const mediumPrioritySkills = [
    ...missingSkills.slice(5),
    ...weakSkills.slice(0, 5),
  ];
  const lowPrioritySkills = weakSkills.slice(5);
  const allGapSkills = uniqueSkills([...input.missingSkills, ...input.weakSkills]);

  const phases: RoadmapItem[] = [
    makeItem({
      title: "Phase 1 - High Priority Skill Recovery",
      description: "Close the most important missing skill gaps before deeper specialization.",
      priority: "HIGH",
      skills: highPrioritySkills.length > 0 ? highPrioritySkills : allGapSkills.slice(0, 3),
      difficulty,
      orderNumber: 1,
    }),
    makeItem({
      title: "Phase 2 - Skill Strengthening",
      description: "Improve weak skills and connect them through small integrated exercises.",
      priority: "MEDIUM",
      skills: mediumPrioritySkills.length > 0 ? mediumPrioritySkills : allGapSkills.slice(0, 3),
      difficulty,
      orderNumber: 2,
    }),
    makeItem({
      title: "Phase 3 - Portfolio Integration",
      description: "Combine learned skills into portfolio-ready proof of work.",
      priority: "LOW",
      skills: lowPrioritySkills.length > 0 ? lowPrioritySkills : allGapSkills.slice(0, 4),
      difficulty,
      orderNumber: 3,
    }),
    makeItem({
      title: "Final Placement Preparation",
      description: "Prepare interview stories, timed practice, and final evidence updates.",
      priority: "FINAL",
      skills: allGapSkills.length > 0 ? allGapSkills.slice(0, 6) : ["Interview readiness", "Portfolio review"],
      difficulty,
      orderNumber: 4,
    }),
  ];

  return {
    difficulty,
    readinessScore: input.readinessScore,
    phases,
  };
};

const auditData = (
  context: AuditContext,
  options: { userId: string; roadmapId: string; gapReportId: string; careerRoleId: string },
): Prisma.AuditEventCreateInput => ({
  action: "roadmap_generated",
  entityType: "Roadmap",
  entityId: options.roadmapId,
  payload: {
    gapReportId: options.gapReportId,
    careerRoleId: options.careerRoleId,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.userId,
  updatedBy: options.userId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.userId } },
});

const toApiRoadmap = (roadmap: SelectedRoadmap) => ({
  ...roadmap,
  gapReport: roadmap.gapReport ? {
    ...roadmap.gapReport,
    readinessScore: toNumber(roadmap.gapReport.readinessScore),
  } : null,
});

export const generateRoadmap = async (userId: string, context: AuditContext) => {
  const latestGapReport = await database.gapReport.findFirst({
    where: {
      userId,
      status: RecordStatus.COMPLETED,
      deletedAt: null,
    },
    orderBy: { generatedAt: "desc" },
    select: {
      id: true,
      careerRoleId: true,
      readinessScore: true,
      missingSkills: true,
      weakSkills: true,
      careerRole: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!latestGapReport) {
    throw new AppError(
      400,
      "GAP_REPORT_REQUIRED",
      "Run gap analysis before generating a roadmap",
    );
  }

  const readinessScore = toNumber(latestGapReport.readinessScore);
  const plan = generateRoadmapPlan({
    missingSkills: parseGapItems(latestGapReport.missingSkills),
    weakSkills: parseGapItems(latestGapReport.weakSkills),
    readinessScore,
  });

  const totalWeeks = plan.phases.reduce((sum, phase) => sum + phase.estimatedWeeks, 0);
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + totalWeeks * 7);

  const roadmap = await database.$transaction(async (transaction) => {
    await transaction.roadmap.updateMany({
      where: {
        userId,
        careerRoleId: latestGapReport.careerRoleId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      data: {
        status: RecordStatus.ARCHIVED,
        updatedBy: userId,
      },
    });

    const createdRoadmap = await transaction.roadmap.create({
      data: {
        userId,
        careerRoleId: latestGapReport.careerRoleId,
        gapReportId: latestGapReport.id,
        title: `${latestGapReport.careerRole.title} Learning Roadmap`,
        description: `Deterministic roadmap generated from readiness score ${readinessScore}/100.`,
        plan: toJson(plan),
        startsAt: new Date(),
        targetDate,
        status: RecordStatus.ACTIVE,
        createdBy: userId,
        updatedBy: userId,
        metadata: {
          source: "deterministic-gap-report",
          readinessScore,
          difficulty: plan.difficulty,
        },
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: auditData(context, {
        userId,
        roadmapId: createdRoadmap.id,
        gapReportId: latestGapReport.id,
        careerRoleId: latestGapReport.careerRoleId,
      }),
    });

    return transaction.roadmap.findUniqueOrThrow({
      where: { id: createdRoadmap.id },
      select: roadmapSelect,
    });
  });

  return toApiRoadmap(roadmap);
};

export const listOwnRoadmaps = async (userId: string) => {
  const roadmaps = await database.roadmap.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: roadmapSelect,
  });

  return roadmaps.map(toApiRoadmap);
};

export const getOwnRoadmapById = async (userId: string, id: string) => {
  const roadmap = await database.roadmap.findFirst({
    where: {
      id,
      userId,
      deletedAt: null,
    },
    select: roadmapSelect,
  });

  if (!roadmap) {
    throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap was not found");
  }

  return toApiRoadmap(roadmap);
};
