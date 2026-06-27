import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
} from "../../generated/prisma/client.js";
import type { UpdateProgressInput } from "./progress.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface RoadmapPlanItem {
  title?: string;
  orderNumber?: number;
  completionStatus?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}

interface RoadmapPlan {
  readinessScore?: number;
  phases?: RoadmapPlanItem[];
}

const progressLogSelect = {
  id: true,
  userId: true,
  roadmapId: true,
  roadmapItemId: true,
  completed: true,
  completionPercentage: true,
  completedAt: true,
  notes: true,
  loggedAt: true,
  createdAt: true,
  updatedAt: true,
  status: true,
} satisfies Prisma.ProgressLogSelect;

const roadmapProgressSelect = {
  id: true,
  userId: true,
  careerRoleId: true,
  gapReportId: true,
  title: true,
  plan: true,
  status: true,
  completedAt: true,
  metadata: true,
  gapReport: {
    select: {
      readinessScore: true,
    },
  },
} satisfies Prisma.RoadmapSelect;

type RoadmapForProgress = Prisma.RoadmapGetPayload<{ select: typeof roadmapProgressSelect }>;
type ProgressLogForResponse = Prisma.ProgressLogGetPayload<{ select: typeof progressLogSelect }>;

const toNumber = (value: Prisma.Decimal | number | null | undefined): number => value === null || value === undefined
  ? 0
  : Number(value);

const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const parsePlan = (value: Prisma.JsonValue): RoadmapPlan => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { phases: [] };
  return value as unknown as RoadmapPlan;
};

const itemIdsFromPlan = (plan: RoadmapPlan): string[] => Array.isArray(plan.phases)
  ? plan.phases
    .map((phase) => phase.orderNumber)
    .filter((orderNumber): orderNumber is number => typeof orderNumber === "number")
    .map(String)
  : [];

const mergePlanProgress = (
  plan: RoadmapPlan,
  progressByItemId: Map<string, ProgressLogForResponse>,
): RoadmapPlan => ({
  ...plan,
  phases: Array.isArray(plan.phases)
    ? plan.phases.map((phase) => {
      const itemId = String(phase.orderNumber);
      const progress = progressByItemId.get(itemId);
      const completionStatus = !progress || progress.completionPercentage === 0
        ? "NOT_STARTED"
        : progress.completed || progress.completionPercentage === 100 ? "COMPLETED" : "IN_PROGRESS";

      return {
        ...phase,
        completionStatus,
      };
    })
    : [],
});

const calculateSummary = (
  roadmap: RoadmapForProgress,
  progressLogs: ProgressLogForResponse[],
) => {
  const plan = parsePlan(roadmap.plan);
  const itemIds = itemIdsFromPlan(plan);
  const totalItems = itemIds.length;
  const progressByItemId = new Map(progressLogs.map((log) => [log.roadmapItemId, log]));
  const totalCompletion = itemIds.reduce(
    (sum, itemId) => sum + (progressByItemId.get(itemId)?.completionPercentage ?? 0),
    0,
  );
  const overallCompletionPercentage = totalItems > 0
    ? Math.round(totalCompletion / totalItems)
    : 0;
  const completedItems = itemIds.filter((itemId) => progressByItemId.get(itemId)?.completed).length;
  const baseReadinessScore = toNumber(roadmap.gapReport?.readinessScore) || Number(plan.readinessScore ?? 0);
  const projectedReadinessScore = Math.min(
    100,
    Math.round((baseReadinessScore + ((100 - baseReadinessScore) * (overallCompletionPercentage / 100) * 0.5)) * 100) / 100,
  );

  return {
    totalItems,
    completedItems,
    overallCompletionPercentage,
    baseReadinessScore,
    projectedReadinessScore,
    updatedPlan: mergePlanProgress(plan, progressByItemId),
  };
};

const auditData = (
  context: AuditContext,
  options: {
    userId: string;
    progressLogId: string;
    roadmapId: string;
    roadmapItemId: string;
    completionPercentage: number;
  },
): Prisma.AuditEventCreateInput => ({
  action: "progress_updated",
  entityType: "ProgressLog",
  entityId: options.progressLogId,
  payload: {
    roadmapId: options.roadmapId,
    roadmapItemId: options.roadmapItemId,
    completionPercentage: options.completionPercentage,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.userId,
  updatedBy: options.userId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.userId } },
});

const assertOwnedRoadmap = async (
  userId: string,
  roadmapId: string,
  transaction: Prisma.TransactionClient = database,
) => {
  const roadmap = await transaction.roadmap.findFirst({
    where: {
      id: roadmapId,
      userId,
      deletedAt: null,
    },
    select: roadmapProgressSelect,
  });

  if (!roadmap) {
    throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap was not found");
  }

  return roadmap;
};

export const updateProgress = async (
  userId: string,
  input: UpdateProgressInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const roadmap = await assertOwnedRoadmap(userId, input.roadmapId, transaction);
  const plan = parsePlan(roadmap.plan);
  const roadmapItemIds = itemIdsFromPlan(plan);
  const roadmapItemId = String(input.roadmapItemId);

  if (!roadmapItemIds.includes(roadmapItemId)) {
    throw new AppError(
      400,
      "ROADMAP_ITEM_NOT_FOUND",
      "Roadmap item was not found in this roadmap",
      { roadmapItemId },
    );
  }

  const completionPercentage = input.completed
    ? 100
    : input.completionPercentage ?? 0;
  const completed = input.completed ?? completionPercentage === 100;
  const completedAt = completed ? new Date() : null;

  const progressLog = await transaction.progressLog.upsert({
    where: {
      userId_roadmapId_roadmapItemId: {
        userId,
        roadmapId: input.roadmapId,
        roadmapItemId,
      },
    },
    create: {
      userId,
      roadmapId: input.roadmapId,
      roadmapItemId,
      completed,
      completionPercentage,
      completedAt,
      notes: input.notes,
      progressPercent: completionPercentage,
      note: input.notes,
      loggedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      completed,
      completionPercentage,
      completedAt,
      notes: input.notes,
      progressPercent: completionPercentage,
      note: input.notes,
      loggedAt: new Date(),
      updatedBy: userId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: progressLogSelect,
  });

  const progressLogs = await transaction.progressLog.findMany({
    where: {
      userId,
      roadmapId: input.roadmapId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: progressLogSelect,
  });
  const summary = calculateSummary(roadmap, progressLogs);
  const roadmapStatus = summary.overallCompletionPercentage === 100
    ? RecordStatus.COMPLETED
    : summary.overallCompletionPercentage > 0 ? RecordStatus.IN_PROGRESS : RecordStatus.ACTIVE;

  const updatedRoadmap = await transaction.roadmap.update({
    where: { id: input.roadmapId },
    data: {
      plan: toJson(summary.updatedPlan),
      status: roadmapStatus,
      completedAt: roadmapStatus === RecordStatus.COMPLETED ? new Date() : null,
      updatedBy: userId,
      metadata: toJson({
        progress: {
          totalItems: summary.totalItems,
          completedItems: summary.completedItems,
          overallCompletionPercentage: summary.overallCompletionPercentage,
          baseReadinessScore: summary.baseReadinessScore,
          projectedReadinessScore: summary.projectedReadinessScore,
          updatedAt: new Date().toISOString(),
        },
      }),
    },
    select: roadmapProgressSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, {
      userId,
      progressLogId: progressLog.id,
      roadmapId: input.roadmapId,
      roadmapItemId,
      completionPercentage,
    }),
  });

  return {
    progress: progressLog,
    roadmap: {
      id: updatedRoadmap.id,
      status: updatedRoadmap.status,
      metadata: updatedRoadmap.metadata,
    },
    summary,
  };
});

export const listProgress = async (userId: string) => {
  const roadmaps = await database.roadmap.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: roadmapProgressSelect,
    orderBy: { createdAt: "desc" },
  });
  const logs = await database.progressLog.findMany({
    where: {
      userId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: progressLogSelect,
    orderBy: { updatedAt: "desc" },
  });
  const logsByRoadmapId = new Map<string, ProgressLogForResponse[]>();
  for (const log of logs) {
    const items = logsByRoadmapId.get(log.roadmapId) ?? [];
    items.push(log);
    logsByRoadmapId.set(log.roadmapId, items);
  }

  return roadmaps.map((roadmap) => {
    const progressLogs = logsByRoadmapId.get(roadmap.id) ?? [];
    const summary = calculateSummary(roadmap, progressLogs);
    return {
      roadmapId: roadmap.id,
      title: roadmap.title,
      status: roadmap.status,
      progress: progressLogs,
      summary: {
        totalItems: summary.totalItems,
        completedItems: summary.completedItems,
        overallCompletionPercentage: summary.overallCompletionPercentage,
        baseReadinessScore: summary.baseReadinessScore,
        projectedReadinessScore: summary.projectedReadinessScore,
      },
    };
  });
};

export const getProgressByRoadmap = async (userId: string, roadmapId: string) => {
  const roadmap = await assertOwnedRoadmap(userId, roadmapId);
  const progress = await database.progressLog.findMany({
    where: {
      userId,
      roadmapId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: progressLogSelect,
    orderBy: { roadmapItemId: "asc" },
  });
  const summary = calculateSummary(roadmap, progress);

  return {
    roadmapId: roadmap.id,
    title: roadmap.title,
    status: roadmap.status,
    progress,
    summary: {
      totalItems: summary.totalItems,
      completedItems: summary.completedItems,
      overallCompletionPercentage: summary.overallCompletionPercentage,
      baseReadinessScore: summary.baseReadinessScore,
      projectedReadinessScore: summary.projectedReadinessScore,
    },
  };
};
