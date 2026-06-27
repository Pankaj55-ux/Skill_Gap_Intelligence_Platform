import { randomUUID } from "node:crypto";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
  UserRole,
  type CareerRole,
} from "../../generated/prisma/client.js";
import type {
  CreateCareerRoleInput,
  ListCareerRolesQuery,
  UpdateCareerRoleInput,
} from "./career-role.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const careerRoleSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  level: true,
  requiredSkills: true,
  niceToHaveSkills: true,
  minExperience: true,
  roadmapTags: true,
  industry: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CareerRoleSelect;

type SelectedCareerRole = Pick<
  CareerRole,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "level"
  | "requiredSkills"
  | "niceToHaveSkills"
  | "minExperience"
  | "roadmapTags"
  | "industry"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

const writableStatuses = [
  RecordStatus.DRAFT,
  RecordStatus.ACTIVE,
  RecordStatus.ARCHIVED,
  RecordStatus.SUSPENDED,
] as const;

const isWritableStatus = (status: RecordStatus): boolean => writableStatuses.includes(
  status as (typeof writableStatuses)[number],
);

const normalizeJsonList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeCareerRole = (role: SelectedCareerRole) => ({
  ...role,
  requiredSkills: normalizeJsonList(role.requiredSkills),
  niceToHaveSkills: normalizeJsonList(role.niceToHaveSkills),
  roadmapTags: normalizeJsonList(role.roadmapTags),
});

const slugify = (title: string): string => {
  const slug = title
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug.length > 0 ? slug : "career-role";
};

const createSlug = (title: string): string => `${slugify(title)}-${randomUUID().slice(0, 8)}`;

const jsonArray = (value: string[] | undefined): Prisma.InputJsonValue | undefined => value;

const createDataFromInput = (
  input: CreateCareerRoleInput,
  actorId: string,
): Prisma.CareerRoleUncheckedCreateInput => {
  if (!isWritableStatus(input.status)) {
    throw new AppError(400, "INVALID_CAREER_ROLE_STATUS", "Status is not valid for a career role catalog item");
  }

  return {
    slug: createSlug(input.title),
    title: input.title,
    description: input.description,
    level: input.level,
    requiredSkills: input.requiredSkills,
    niceToHaveSkills: input.niceToHaveSkills,
    minExperience: input.minExperience,
    roadmapTags: input.roadmapTags,
    status: input.status,
    createdBy: actorId,
    updatedBy: actorId,
  };
};

const updateDataFromInput = (
  input: UpdateCareerRoleInput,
  actorId: string,
): Prisma.CareerRoleUncheckedUpdateInput => {
  if (input.status && !isWritableStatus(input.status)) {
    throw new AppError(400, "INVALID_CAREER_ROLE_STATUS", "Status is not valid for a career role catalog item");
  }

  return {
    title: input.title,
    description: input.description,
    level: input.level,
    requiredSkills: jsonArray(input.requiredSkills),
    niceToHaveSkills: jsonArray(input.niceToHaveSkills),
    minExperience: input.minExperience,
    roadmapTags: jsonArray(input.roadmapTags),
    status: input.status,
    updatedBy: actorId,
  };
};

const auditData = (
  context: AuditContext,
  action: string,
  options: { actorId: string; entityId: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "CareerRole",
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  actor: { connect: { id: options.actorId } },
});

const visibilityWhere = (requesterRole: UserRole): Prisma.CareerRoleWhereInput => {
  if (requesterRole === UserRole.STUDENT || requesterRole === UserRole.MENTOR) {
    return { status: RecordStatus.ACTIVE, deletedAt: null };
  }

  return { deletedAt: null };
};

const skillFilterWhere = (skill: string): Prisma.CareerRoleWhereInput => ({
  OR: [
    {
      requirements: {
        some: {
          skill: {
            OR: [
              { name: { contains: skill, mode: "insensitive" } },
              { normalizedName: { contains: skill.toLocaleLowerCase("en-US"), mode: "insensitive" } },
            ],
          },
        },
      },
    },
    { requiredSkills: { array_contains: [skill] } },
    { niceToHaveSkills: { array_contains: [skill] } },
  ],
});

const listWhere = (
  requesterRole: UserRole,
  query: ListCareerRolesQuery,
): Prisma.CareerRoleWhereInput => {
  const conditions: Prisma.CareerRoleWhereInput[] = [visibilityWhere(requesterRole)];
  const titleOrSearch = query.title ?? query.search;

  if (titleOrSearch) {
    conditions.push({ title: { contains: titleOrSearch, mode: "insensitive" } });
  }

  if (query.level) {
    conditions.push({ level: query.level });
  }

  if (query.skill) {
    conditions.push(skillFilterWhere(query.skill));
  }

  if (query.status && requesterRole !== UserRole.STUDENT && requesterRole !== UserRole.MENTOR) {
    conditions.push({ status: query.status });
  }

  return { AND: conditions };
};

export const createCareerRole = async (
  actorId: string,
  input: CreateCareerRoleInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const role = await transaction.careerRole.create({
    data: createDataFromInput(input, actorId),
    select: careerRoleSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "CAREER_ROLE_CREATED", {
      actorId,
      entityId: role.id,
      payload: { fields: Object.keys(input) },
    }),
  });

  return normalizeCareerRole(role);
});

export const listCareerRoles = async (
  requesterRole: UserRole,
  query: ListCareerRolesQuery,
) => {
  const page = query.page;
  const pageSize = query.pageSize;
  const where = listWhere(requesterRole, query);

  const [roles, total] = await database.$transaction([
    database.careerRole.findMany({
      where,
      select: careerRoleSelect,
      orderBy: [{ title: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    database.careerRole.count({ where }),
  ]);

  return {
    roles: roles.map(normalizeCareerRole),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getCareerRoleById = async (
  requesterRole: UserRole,
  id: string,
) => {
  const role = await database.careerRole.findFirst({
    where: { id, ...visibilityWhere(requesterRole) },
    select: careerRoleSelect,
  });

  if (!role) {
    throw new AppError(404, "CAREER_ROLE_NOT_FOUND", "Career role was not found");
  }

  return normalizeCareerRole(role);
};

export const updateCareerRole = async (
  actorId: string,
  id: string,
  input: UpdateCareerRoleInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existingRole = await transaction.careerRole.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!existingRole) {
    throw new AppError(404, "CAREER_ROLE_NOT_FOUND", "Career role was not found");
  }

  const role = await transaction.careerRole.update({
    where: { id },
    data: updateDataFromInput(input, actorId),
    select: careerRoleSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "CAREER_ROLE_UPDATED", {
      actorId,
      entityId: role.id,
      payload: { fields: Object.keys(input) },
    }),
  });

  return normalizeCareerRole(role);
});

export const deleteCareerRole = async (
  actorId: string,
  id: string,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existingRole = await transaction.careerRole.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!existingRole) {
    throw new AppError(404, "CAREER_ROLE_NOT_FOUND", "Career role was not found");
  }

  const role = await transaction.careerRole.update({
    where: { id },
    data: {
      status: RecordStatus.ARCHIVED,
      deletedAt: new Date(),
      updatedBy: actorId,
    },
    select: careerRoleSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "CAREER_ROLE_DELETED", {
      actorId,
      entityId: role.id,
    }),
  });

  return normalizeCareerRole(role);
});
