import { randomUUID } from "node:crypto";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus, UserRole } from "../../generated/prisma/client.js";
import type { AdminBody, AdminListQuery } from "./admin.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ResourceConfig {
  delegate: string;
  label: string;
  searchable: string[];
  filters?: Record<string, string>;
  allowedCreate?: string[];
  allowedUpdate?: string[];
  defaultData?: (body: AdminBody, actorId: string) => Record<string, unknown>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
}

const slugify = (value: string): string => value
  .toLocaleLowerCase("en-US")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 90) || "item";

const jsonFields = new Set([
  "requiredSkills",
  "niceToHaveSkills",
  "roadmapTags",
  "skillsCovered",
  "githubTopics",
  "questions",
  "expectedTopics",
  "metadata",
  "plan",
  "recommendations",
]);

const readonlyResources = new Set(["reports", "audit-history"]);

const resources: Record<string, ResourceConfig> = {
  "career-roles": {
    delegate: "careerRole",
    label: "CareerRole",
    searchable: ["title", "description", "industry"],
    filters: { level: "level", status: "status" },
    allowedCreate: ["title", "description", "level", "requiredSkills", "niceToHaveSkills", "minExperience", "roadmapTags", "industry", "status", "metadata"],
    allowedUpdate: ["title", "description", "level", "requiredSkills", "niceToHaveSkills", "minExperience", "roadmapTags", "industry", "status", "metadata"],
    defaultData: (body, actorId) => ({
      slug: `${slugify(String(body.title ?? "career-role"))}-${randomUUID().slice(0, 8)}`,
      createdBy: actorId,
      updatedBy: actorId,
    }),
  },
  "skill-dictionary": {
    delegate: "skill",
    label: "Skill",
    searchable: ["name", "normalizedName", "category", "description"],
    filters: { status: "status" },
    allowedCreate: ["name", "normalizedName", "category", "description", "status", "metadata"],
    allowedUpdate: ["name", "normalizedName", "category", "description", "status", "metadata"],
  },
  roadmaps: {
    delegate: "roadmap",
    label: "Roadmap",
    searchable: ["title", "description"],
    filters: { status: "status" },
    allowedCreate: ["userId", "careerRoleId", "gapReportId", "title", "description", "plan", "startsAt", "targetDate", "status", "metadata"],
    allowedUpdate: ["title", "description", "plan", "startsAt", "targetDate", "completedAt", "status", "metadata"],
  },
  courses: {
    delegate: "courseCatalogItem",
    label: "CourseCatalogItem",
    searchable: ["title", "provider", "description"],
    filters: { provider: "provider", level: "level", status: "status" },
    allowedCreate: ["title", "provider", "level", "duration", "url", "skillsCovered", "description", "status", "metadata"],
    allowedUpdate: ["title", "provider", "level", "duration", "url", "skillsCovered", "description", "status", "metadata"],
  },
  projects: {
    delegate: "projectCatalogItem",
    label: "ProjectCatalogItem",
    searchable: ["title", "description", "learningOutcome"],
    filters: { level: "difficulty", status: "status" },
    allowedCreate: ["title", "description", "difficulty", "estimatedWeeks", "skillsCovered", "githubTopics", "learningOutcome", "status", "metadata"],
    allowedUpdate: ["title", "description", "difficulty", "estimatedWeeks", "skillsCovered", "githubTopics", "learningOutcome", "status", "metadata"],
  },
  announcements: {
    delegate: "adminAnnouncement",
    label: "AdminAnnouncement",
    searchable: ["title", "message"],
    filters: { status: "status" },
    allowedCreate: ["title", "message", "targetRole", "startsAt", "expiresAt", "status", "metadata"],
    allowedUpdate: ["title", "message", "targetRole", "startsAt", "expiresAt", "status", "metadata"],
  },
  "interview-templates": {
    delegate: "interviewTemplate",
    label: "InterviewTemplate",
    searchable: ["title", "targetRole", "difficulty"],
    filters: { targetRole: "targetRole", level: "difficulty", status: "status" },
    allowedCreate: ["title", "targetRole", "difficulty", "questions", "expectedTopics", "status", "metadata"],
    allowedUpdate: ["title", "targetRole", "difficulty", "questions", "expectedTopics", "status", "metadata"],
  },
  "job-descriptions": {
    delegate: "jobDescription",
    label: "JobDescription",
    searchable: ["title", "company", "description"],
    filters: { status: "status" },
    allowedCreate: ["title", "company", "description", "requiredSkills", "preferredSkills", "experience", "location", "employmentType", "uploadedBy", "status", "metadata"],
    allowedUpdate: ["title", "company", "description", "requiredSkills", "preferredSkills", "experience", "location", "employmentType", "status", "metadata"],
  },
  users: {
    delegate: "user",
    label: "User",
    searchable: ["email", "displayName"],
    filters: { role: "role", status: "status" },
    allowedUpdate: ["displayName", "role", "status", "metadata"],
    canCreate: false,
  },
  permissions: {
    delegate: "permissionGrant",
    label: "PermissionGrant",
    searchable: ["permission", "scope"],
    filters: { status: "status" },
    allowedCreate: ["userId", "permission", "scope", "status", "metadata"],
    allowedUpdate: ["permission", "scope", "status", "metadata"],
  },
  reports: {
    delegate: "gapReport",
    label: "GapReport",
    searchable: ["explanation"],
    filters: { status: "status" },
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRestore: false,
  },
  "audit-history": {
    delegate: "auditEvent",
    label: "AuditEvent",
    searchable: ["action", "entityType"],
    filters: { status: "status" },
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRestore: false,
  },
};

const getConfig = (resource: string): ResourceConfig => {
  const config = resources[resource];
  if (!config) {
    throw new AppError(404, "ADMIN_RESOURCE_NOT_FOUND", "Admin resource is not supported");
  }
  return config;
};

const delegateFor = (config: ResourceConfig) => {
  const delegate = (database as unknown as Record<string, unknown>)[config.delegate];
  if (!delegate || typeof delegate !== "object") {
    throw new AppError(500, "ADMIN_RESOURCE_MISCONFIGURED", "Admin resource delegate is not configured");
  }
  return delegate as {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
    count(args: unknown): Promise<number>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
};

const sanitizeData = (
  body: AdminBody,
  allowedFields: string[] | undefined,
  actorId: string,
  defaults?: (body: AdminBody, actorId: string) => Record<string, unknown>,
) => {
  if (!allowedFields) {
    throw new AppError(405, "ADMIN_RESOURCE_READ_ONLY", "This admin resource is read-only");
  }

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] === undefined) continue;
    data[field] = jsonFields.has(field) ? body[field] as Prisma.InputJsonValue : body[field];
  }

  return {
    ...(defaults ? defaults(body, actorId) : { createdBy: actorId, updatedBy: actorId }),
    ...data,
    updatedBy: actorId,
  };
};

const whereFor = (config: ResourceConfig, query: AdminListQuery): Record<string, unknown> => {
  const and: Record<string, unknown>[] = [];

  if (!query.includeDeleted) and.push({ deletedAt: null });
  if (query.status && config.filters?.status) and.push({ [config.filters.status]: query.status });
  if (query.role && config.filters?.role) and.push({ [config.filters.role]: query.role });
  if (query.type && config.filters?.type) and.push({ [config.filters.type]: query.type });
  if (query.level && config.filters?.level) and.push({ [config.filters.level]: query.level });
  if (query.provider && config.filters?.provider) and.push({ [config.filters.provider]: { contains: query.provider, mode: "insensitive" } });
  if (query.targetRole && config.filters?.targetRole) and.push({ [config.filters.targetRole]: { contains: query.targetRole, mode: "insensitive" } });

  if (query.search && config.searchable.length > 0) {
    and.push({
      OR: config.searchable.map((field) => ({
        [field]: { contains: query.search, mode: "insensitive" },
      })),
    });
  }

  return and.length > 0 ? { AND: and } : {};
};

const auditData = (
  context: AuditContext,
  options: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    payload?: Prisma.InputJsonValue;
  },
): Prisma.AuditEventCreateInput => ({
  action: options.action,
  entityType: options.entityType,
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  actor: { connect: { id: options.actorId } },
});

export class AdminConsoleService {
  listResources() {
    return {
      resources: Object.keys(resources).map((key) => ({
        key,
        label: resources[key].label,
        readonly: readonlyResources.has(key),
      })),
    };
  }

  async list(resource: string, query: AdminListQuery) {
    const config = getConfig(resource);
    const delegate = delegateFor(config);
    const where = whereFor(config, query);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      delegate.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(resource: string, id: string) {
    const config = getConfig(resource);
    const item = await delegateFor(config).findFirst({
      where: { id },
    });

    if (!item) {
      throw new AppError(404, "ADMIN_RESOURCE_ITEM_NOT_FOUND", "Admin resource item was not found");
    }

    return { item };
  }

  async create(resource: string, actorId: string, body: AdminBody, context: AuditContext) {
    const config = getConfig(resource);
    if (config.canCreate === false) {
      throw new AppError(405, "ADMIN_RESOURCE_CREATE_NOT_ALLOWED", "This admin resource cannot be created here");
    }
    const delegate = delegateFor(config);
    const item = await delegate.create({
      data: sanitizeData(body, config.allowedCreate, actorId, config.defaultData),
    }) as { id?: string };

    await database.auditEvent.create({
      data: auditData(context, {
        actorId,
        action: "admin_resource_created",
        entityType: config.label,
        entityId: item.id,
        payload: { resource },
      }),
    });

    return { item };
  }

  async update(resource: string, id: string, actorId: string, body: AdminBody, context: AuditContext) {
    const config = getConfig(resource);
    if (config.canUpdate === false) {
      throw new AppError(405, "ADMIN_RESOURCE_UPDATE_NOT_ALLOWED", "This admin resource cannot be updated here");
    }
    await this.ensureExists(config, id);
    const item = await delegateFor(config).update({
      where: { id },
      data: sanitizeData(body, config.allowedUpdate, actorId),
    }) as { id?: string };

    await database.auditEvent.create({
      data: auditData(context, {
        actorId,
        action: "admin_resource_updated",
        entityType: config.label,
        entityId: item.id ?? id,
        payload: { resource, fields: Object.keys(body) },
      }),
    });

    return { item };
  }

  async softDelete(resource: string, id: string, actorId: string, context: AuditContext) {
    const config = getConfig(resource);
    if (config.canDelete === false) {
      throw new AppError(405, "ADMIN_RESOURCE_DELETE_NOT_ALLOWED", "This admin resource cannot be deleted here");
    }
    await this.ensureExists(config, id);
    const item = await delegateFor(config).update({
      where: { id },
      data: {
        status: RecordStatus.ARCHIVED,
        deletedAt: new Date(),
        updatedBy: actorId,
      },
    }) as { id?: string };

    await database.auditEvent.create({
      data: auditData(context, {
        actorId,
        action: "admin_resource_deleted",
        entityType: config.label,
        entityId: item.id ?? id,
        payload: { resource },
      }),
    });

    return { item };
  }

  async restore(resource: string, id: string, actorId: string, context: AuditContext) {
    const config = getConfig(resource);
    if (config.canRestore === false) {
      throw new AppError(405, "ADMIN_RESOURCE_RESTORE_NOT_ALLOWED", "This admin resource cannot be restored here");
    }
    await this.ensureExists(config, id);
    const item = await delegateFor(config).update({
      where: { id },
      data: {
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        updatedBy: actorId,
      },
    }) as { id?: string };

    await database.auditEvent.create({
      data: auditData(context, {
        actorId,
        action: "admin_resource_restored",
        entityType: config.label,
        entityId: item.id ?? id,
        payload: { resource },
      }),
    });

    return { item };
  }

  async updateUserRole(userId: string, role: UserRole, actorId: string, context: AuditContext) {
    const user = await database.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, role: true } });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
    const updated = await database.user.update({
      where: { id: userId },
      data: { role, updatedBy: actorId },
      select: { id: true, email: true, displayName: true, role: true, status: true, updatedAt: true },
    });
    await database.auditEvent.create({
      data: auditData(context, {
        actorId,
        action: "admin_user_role_updated",
        entityType: "User",
        entityId: userId,
        payload: { previousRole: user.role, role },
      }),
    });
    return { user: updated };
  }

  async auditHistory(query: AdminListQuery) {
    return this.list("audit-history", query);
  }

  private async ensureExists(config: ResourceConfig, id: string) {
    const existing = await delegateFor(config).findFirst({ where: { id } });
    if (!existing) {
      throw new AppError(404, "ADMIN_RESOURCE_ITEM_NOT_FOUND", "Admin resource item was not found");
    }
  }
}

export const adminConsoleService = new AdminConsoleService();
