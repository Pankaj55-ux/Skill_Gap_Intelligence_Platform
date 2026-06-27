import { database } from "../../database/index.js";
import {
  compactAnd,
  createPagination,
  createPaginationMeta,
  numberDesc,
  searchableResources,
  sortByCreatedAt,
  type SearchableResource,
  type SortOption,
} from "../../common/search.js";
import {
  EvidenceVerifiedStatus,
  Prisma,
  RecordStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import type { SearchQuery } from "./search.schemas.js";

export interface SearchContext {
  userId: string;
  role: UserRole;
}

interface SearchResultItem {
  type: SearchableResource;
  id: string;
  title: string;
  summary: string | null;
  status: string;
  createdAt: Date;
  score: number | null;
  completion: number | null;
  priority: number;
  data: unknown;
}

const staffRoles = [UserRole.MENTOR, UserRole.PLACEMENT_OFFICER, UserRole.ADMIN] as const;

const canSearchAcrossUsers = (role: UserRole): boolean => staffRoles.includes(role as (typeof staffRoles)[number]);

const normalizedSkill = (skill: string) => skill.toLocaleLowerCase("en-US");

const jsonArray = (value: string) => [value];

const requestedResources = (query: SearchQuery): SearchableResource[] => query.resources ?? [...searchableResources];

const maybeStatus = (status: RecordStatus | undefined) => status ? { status } : undefined;

const commonVisibility = (context: SearchContext) => canSearchAcrossUsers(context.role)
  ? { deletedAt: null }
  : { deletedAt: null, userId: context.userId };

const careerRoleWhere = (query: SearchQuery, context: SearchContext): Prisma.CareerRoleWhereInput => {
  const activeOnly = context.role === UserRole.STUDENT || context.role === UserRole.MENTOR
    ? { status: RecordStatus.ACTIVE }
    : undefined;

  return compactAnd<Prisma.CareerRoleWhereInput>([
    { deletedAt: null },
    activeOnly,
    maybeStatus(query.status),
    query.q ? {
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { industry: { contains: query.q, mode: "insensitive" } },
      ],
    } : undefined,
    query.role ? { title: { contains: query.role, mode: "insensitive" } } : undefined,
    query.level ? { level: query.level } : undefined,
    query.skill ? {
      OR: [
        { requiredSkills: { array_contains: jsonArray(query.skill) } },
        { niceToHaveSkills: { array_contains: jsonArray(query.skill) } },
        {
          requirements: {
            some: {
              skill: {
                OR: [
                  { name: { contains: query.skill, mode: "insensitive" } },
                  { normalizedName: { contains: normalizedSkill(query.skill), mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    } : undefined,
  ]);
};

const evidenceWhere = (query: SearchQuery, context: SearchContext): Prisma.SkillEvidenceWhereInput => compactAnd([
  commonVisibility(context),
  maybeStatus(query.status),
  query.q ? {
    OR: [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { skill: { name: { contains: query.q, mode: "insensitive" } } },
      { skill: { category: { contains: query.q, mode: "insensitive" } } },
    ],
  } : undefined,
  query.category ? { skill: { category: { contains: query.category, mode: "insensitive" } } } : undefined,
  query.skill ? {
    skill: {
      OR: [
        { name: { contains: query.skill, mode: "insensitive" } },
        { normalizedName: { contains: normalizedSkill(query.skill), mode: "insensitive" } },
      ],
    },
  } : undefined,
  query.level ? { proficiency: query.level } : undefined,
]);

const roadmapWhere = (query: SearchQuery, context: SearchContext): Prisma.RoadmapWhereInput => compactAnd([
  commonVisibility(context),
  maybeStatus(query.status),
  query.q ? {
    OR: [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { careerRole: { title: { contains: query.q, mode: "insensitive" } } },
    ],
  } : undefined,
  query.role ? { careerRole: { title: { contains: query.role, mode: "insensitive" } } } : undefined,
  query.level ? { careerRole: { level: query.level } } : undefined,
]);

const gapReportWhere = (query: SearchQuery, context: SearchContext): Prisma.GapReportWhereInput => compactAnd([
  commonVisibility(context),
  maybeStatus(query.status),
  query.q ? {
    OR: [
      { explanation: { contains: query.q, mode: "insensitive" } },
      { careerRole: { title: { contains: query.q, mode: "insensitive" } } },
    ],
  } : undefined,
  query.role ? { careerRole: { title: { contains: query.role, mode: "insensitive" } } } : undefined,
  query.level ? { careerRole: { level: query.level } } : undefined,
]);

const roadmapCompletion = (metadata: Prisma.JsonValue): number | null => {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const progress = (metadata as { progress?: { overallCompletionPercentage?: unknown } }).progress;
  return typeof progress?.overallCompletionPercentage === "number" ? progress.overallCompletionPercentage : null;
};

const priorityRank = (value: unknown): number => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
  const phases = (value as { phases?: Array<{ priority?: string }> }).phases ?? [];
  const priority = phases[0]?.priority;
  if (priority === "HIGH") return 4;
  if (priority === "MEDIUM") return 3;
  if (priority === "LOW") return 2;
  if (priority === "FINAL") return 1;
  return 0;
};

const globalComparator = (sort: SortOption) => (left: SearchResultItem, right: SearchResultItem) => {
  if (sort === "oldest") return left.createdAt.getTime() - right.createdAt.getTime();
  if (sort === "readiness") return numberDesc(right.score) - numberDesc(left.score);
  if (sort === "completion") return numberDesc(right.completion) - numberDesc(left.completion);
  if (sort === "priority") return right.priority - left.priority || right.createdAt.getTime() - left.createdAt.getTime();
  return right.createdAt.getTime() - left.createdAt.getTime();
};

export const searchAll = async (query: SearchQuery, context: SearchContext) => {
  const resources = requestedResources(query);
  const pagination = createPagination(query);
  const fetchLimit = pagination.page * pagination.limit;
  const items: SearchResultItem[] = [];
  let total = 0;

  if (resources.includes("careerRoles")) {
    const where = careerRoleWhere(query, context);
    const [count, roles] = await database.$transaction([
      database.careerRole.count({ where }),
      database.careerRole.findMany({
        where,
        take: fetchLimit,
        orderBy: sortByCreatedAt(query.sort),
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          status: true,
          requiredSkills: true,
          niceToHaveSkills: true,
          createdAt: true,
        },
      }),
    ]);
    total += count;
    items.push(...roles.map((role): SearchResultItem => ({
      type: "careerRoles",
      id: role.id,
      title: role.title,
      summary: role.description,
      status: role.status,
      createdAt: role.createdAt,
      score: null,
      completion: null,
      priority: role.level === "ADVANCED" ? 3 : role.level === "INTERMEDIATE" ? 2 : 1,
      data: role,
    })));
  }

  if (resources.includes("skillEvidence")) {
    const where = evidenceWhere(query, context);
    const [count, evidence] = await database.$transaction([
      database.skillEvidence.count({ where }),
      database.skillEvidence.findMany({
        where,
        take: fetchLimit,
        orderBy: sortByCreatedAt(query.sort),
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          proficiency: true,
          verifiedStatus: true,
          status: true,
          createdAt: true,
          skill: { select: { name: true, category: true } },
          user: { select: { id: true, displayName: true } },
        },
      }),
    ]);
    total += count;
    items.push(...evidence.map((item): SearchResultItem => ({
      type: "skillEvidence",
      id: item.id,
      title: item.title,
      summary: item.description,
      status: item.verifiedStatus,
      createdAt: item.createdAt,
      score: item.verifiedStatus === EvidenceVerifiedStatus.VERIFIED ? 100 : item.verifiedStatus === EvidenceVerifiedStatus.PENDING ? 50 : 0,
      completion: null,
      priority: item.verifiedStatus === EvidenceVerifiedStatus.PENDING ? 3 : 1,
      data: item,
    })));
  }

  if (resources.includes("roadmaps")) {
    const where = roadmapWhere(query, context);
    const [count, roadmaps] = await database.$transaction([
      database.roadmap.count({ where }),
      database.roadmap.findMany({
        where,
        take: fetchLimit,
        orderBy: sortByCreatedAt(query.sort),
        select: {
          id: true,
          title: true,
          description: true,
          plan: true,
          metadata: true,
          status: true,
          createdAt: true,
          careerRole: { select: { id: true, title: true, level: true } },
          gapReport: { select: { readinessScore: true } },
        },
      }),
    ]);
    total += count;
    items.push(...roadmaps.map((roadmap): SearchResultItem => ({
      type: "roadmaps",
      id: roadmap.id,
      title: roadmap.title,
      summary: roadmap.description,
      status: roadmap.status,
      createdAt: roadmap.createdAt,
      score: roadmap.gapReport ? Number(roadmap.gapReport.readinessScore) : null,
      completion: roadmapCompletion(roadmap.metadata),
      priority: priorityRank(roadmap.plan),
      data: roadmap,
    })));
  }

  if (resources.includes("gapReports")) {
    const where = gapReportWhere(query, context);
    const [count, reports] = await database.$transaction([
      database.gapReport.count({ where }),
      database.gapReport.findMany({
        where,
        take: fetchLimit,
        orderBy: query.sort === "readiness" ? { readinessScore: "desc" } : sortByCreatedAt(query.sort),
        select: {
          id: true,
          explanation: true,
          readinessScore: true,
          evidenceCoverage: true,
          status: true,
          createdAt: true,
          generatedAt: true,
          careerRole: { select: { id: true, title: true, level: true } },
        },
      }),
    ]);
    total += count;
    items.push(...reports.map((report): SearchResultItem => ({
      type: "gapReports",
      id: report.id,
      title: `${report.careerRole.title} Gap Report`,
      summary: report.explanation,
      status: report.status,
      createdAt: report.createdAt,
      score: Number(report.readinessScore),
      completion: report.evidenceCoverage === null ? null : Number(report.evidenceCoverage),
      priority: Number(report.readinessScore) < 50 ? 3 : Number(report.readinessScore) < 75 ? 2 : 1,
      data: report,
    })));
  }

  const sortedItems = items.sort(globalComparator(query.sort));
  const paginatedItems = sortedItems.slice(pagination.skip, pagination.skip + pagination.take);

  return {
    items: paginatedItems,
    metadata: createPaginationMeta(query, total),
    resources,
  };
};
