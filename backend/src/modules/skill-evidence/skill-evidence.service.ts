import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  EvidenceVerifiedStatus,
  Prisma,
  RecordStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import type {
  CreateSkillEvidenceInput,
  ReviewSkillEvidenceInput,
  UpdateOwnSkillEvidenceInput,
} from "./skill-evidence.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const evidenceSelect = {
  id: true,
  userId: true,
  title: true,
  type: true,
  description: true,
  url: true,
  proficiency: true,
  verifiedStatus: true,
  verifiedAt: true,
  verifiedBy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  skill: {
    select: {
      id: true,
      name: true,
      category: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  },
} satisfies Prisma.SkillEvidenceSelect;

type SelectedEvidence = Prisma.SkillEvidenceGetPayload<{ select: typeof evidenceSelect }>;

const reviewerRoles = [
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const canReviewSkillEvidence = (role: UserRole): boolean => reviewerRoles.includes(
  role as (typeof reviewerRoles)[number],
);

const normalizeSkillName = (skillName: string): string => skillName
  .trim()
  .toLocaleLowerCase("en-US");

const toApiEvidence = (evidence: SelectedEvidence) => ({
  id: evidence.id,
  userId: evidence.userId,
  skillName: evidence.skill.name,
  category: evidence.skill.category,
  proficiencyLevel: evidence.proficiency,
  evidenceType: evidence.type,
  evidenceUrl: evidence.url,
  description: evidence.description,
  verifiedStatus: evidence.verifiedStatus,
  verifiedAt: evidence.verifiedAt,
  verifiedBy: evidence.verifiedBy,
  status: evidence.status,
  createdAt: evidence.createdAt,
  updatedAt: evidence.updatedAt,
  student: evidence.user,
});

const auditData = (
  context: AuditContext,
  action: string,
  options: { userId: string; actorId: string; entityId: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "SkillEvidence",
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.actorId } },
});

const upsertSkill = async (
  transaction: Prisma.TransactionClient,
  input: { skillName: string; category: string },
  actorId: string,
) => transaction.skill.upsert({
  where: { normalizedName: normalizeSkillName(input.skillName) },
  update: {
    name: input.skillName,
    category: input.category,
    updatedBy: actorId,
  },
  create: {
    name: input.skillName,
    normalizedName: normalizeSkillName(input.skillName),
    category: input.category,
    createdBy: actorId,
    updatedBy: actorId,
  },
  select: { id: true },
});

const findVisibleEvidence = async (
  id: string,
  requester: { id: string; role: UserRole },
): Promise<SelectedEvidence> => {
  const evidence = await database.skillEvidence.findFirst({
    where: {
      id,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: evidenceSelect,
  });

  if (!evidence) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }

  if (requester.role === UserRole.STUDENT && evidence.userId !== requester.id) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }

  return evidence;
};

const assertPendingOwnedEvidence = (evidence: Pick<SelectedEvidence, "userId" | "verifiedStatus">, userId: string) => {
  if (evidence.userId !== userId) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }

  if (evidence.verifiedStatus !== EvidenceVerifiedStatus.PENDING) {
    throw new AppError(409, "SKILL_EVIDENCE_LOCKED", "Only pending evidence can be changed by the student");
  }
};

export const createSkillEvidence = async (
  userId: string,
  input: CreateSkillEvidenceInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const skill = await upsertSkill(transaction, input, userId);

  const evidence = await transaction.skillEvidence.create({
    data: {
      userId,
      skillId: skill.id,
      title: input.skillName,
      type: input.evidenceType,
      description: input.description,
      url: input.evidenceUrl,
      proficiency: input.proficiencyLevel,
      verifiedStatus: EvidenceVerifiedStatus.PENDING,
      createdBy: userId,
      updatedBy: userId,
    },
    select: evidenceSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "SKILL_EVIDENCE_CREATED", {
      userId,
      actorId: userId,
      entityId: evidence.id,
      payload: { skillName: input.skillName, evidenceType: input.evidenceType },
    }),
  });

  return toApiEvidence(evidence);
});

export const listOwnSkillEvidence = async (userId: string) => {
  const evidence = await database.skillEvidence.findMany({
    where: {
      userId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: evidenceSelect,
    orderBy: { createdAt: "desc" },
  });

  return evidence.map(toApiEvidence);
};

export const getSkillEvidenceById = async (
  requester: { id: string; role: UserRole },
  id: string,
) => toApiEvidence(await findVisibleEvidence(id, requester));

export const updateOwnSkillEvidence = async (
  userId: string,
  id: string,
  input: UpdateOwnSkillEvidenceInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existingEvidence = await transaction.skillEvidence.findFirst({
    where: {
      id,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      verifiedStatus: true,
      skill: { select: { name: true, category: true } },
    },
  });

  if (!existingEvidence) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }
  assertPendingOwnedEvidence(existingEvidence, userId);

  const skill = input.skillName || input.category
    ? await upsertSkill(transaction, {
      skillName: input.skillName ?? existingEvidence.skill.name,
      category: input.category ?? existingEvidence.skill.category ?? "General",
    }, userId)
    : undefined;

  const evidence = await transaction.skillEvidence.update({
    where: { id },
    data: {
      skillId: skill?.id,
      title: input.skillName,
      type: input.evidenceType,
      description: input.description,
      url: input.evidenceUrl,
      proficiency: input.proficiencyLevel,
      updatedBy: userId,
    },
    select: evidenceSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "SKILL_EVIDENCE_UPDATED", {
      userId,
      actorId: userId,
      entityId: evidence.id,
      payload: { fields: Object.keys(input) },
    }),
  });

  return toApiEvidence(evidence);
});

export const reviewSkillEvidence = async (
  reviewerId: string,
  id: string,
  input: ReviewSkillEvidenceInput,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existingEvidence = await transaction.skillEvidence.findFirst({
    where: {
      id,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true, userId: true },
  });

  if (!existingEvidence) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }

  const evidence = await transaction.skillEvidence.update({
    where: { id },
    data: {
      verifiedStatus: input.verifiedStatus,
      verifiedAt: new Date(),
      verifiedBy: reviewerId,
      updatedBy: reviewerId,
    },
    select: evidenceSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "SKILL_EVIDENCE_REVIEWED", {
      userId: existingEvidence.userId,
      actorId: reviewerId,
      entityId: evidence.id,
      payload: { verifiedStatus: input.verifiedStatus },
    }),
  });

  return toApiEvidence(evidence);
});

export const deleteOwnSkillEvidence = async (
  userId: string,
  id: string,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existingEvidence = await transaction.skillEvidence.findFirst({
    where: {
      id,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true, userId: true, verifiedStatus: true },
  });

  if (!existingEvidence) {
    throw new AppError(404, "SKILL_EVIDENCE_NOT_FOUND", "Skill evidence was not found");
  }
  assertPendingOwnedEvidence(existingEvidence, userId);

  const evidence = await transaction.skillEvidence.update({
    where: { id },
    data: {
      status: RecordStatus.ARCHIVED,
      deletedAt: new Date(),
      updatedBy: userId,
    },
    select: evidenceSelect,
  });

  await transaction.auditEvent.create({
    data: auditData(context, "SKILL_EVIDENCE_DELETED", {
      userId,
      actorId: userId,
      entityId: evidence.id,
    }),
  });

  return toApiEvidence(evidence);
});
