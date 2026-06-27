import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import {
  RecordStatus,
  UserRole,
  type Prisma,
} from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
import type { LoginInput, RegisterInput, UpdateMeInput } from "./auth.schemas.js";

const DUMMY_PASSWORD_HASH = "$2b$12$X3JZL8GJ7eR3w3Jf3QJ5hOcVn/YCZk8YxjVIxq8S8Qb/F5DUMaL5G";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: {
    select: {
      fullName: true,
      college: true,
      branch: true,
      targetRole: true,
      currentSkills: true,
      preferredCompanies: true,
      resumeUrl: true,
      profileCompletionPercentage: true,
      headline: true,
      bio: true,
      institution: true,
      department: true,
      graduationYear: true,
      targetCareerRoleId: true,
    },
  },
} satisfies Prisma.UserSelect;

const auditData = (
  context: AuditContext,
  action: string,
  options: { userId?: string; actorId?: string; entityId?: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "User",
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  user: options.userId ? { connect: { id: options.userId } } : undefined,
  actor: options.actorId ? { connect: { id: options.actorId } } : undefined,
});

const writeAuthAuditEvent = async (
  context: AuditContext,
  action: string,
  options: { userId?: string; actorId?: string; entityId?: string; payload?: Prisma.InputJsonValue },
) => {
  try {
    await database.auditEvent.create({ data: auditData(context, action, options) });
  } catch {
    // Authentication success/failure should not depend on audit log availability.
  }
};

export const registerUser = async (input: RegisterInput, context: AuditContext) => {
  const existingUser = await database.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  return database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        id,
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        role: UserRole.STUDENT,
        createdBy: id,
        updatedBy: id,
        studentProfile: { create: { createdBy: id, updatedBy: id } },
      },
      select: publicUserSelect,
    });

    await transaction.auditEvent.create({
      data: auditData(context, "AUTH_REGISTERED", { userId: id, actorId: id, entityId: id }),
    });

    return user;
  }, { timeout: 15_000 });
};

export const loginUser = async (input: LoginInput, context: AuditContext) => {
  const user = await database.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      deletedAt: true,
    },
  });

  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const accountIsActive = user?.status === RecordStatus.ACTIVE && user.deletedAt === null;

  if (!user || !passwordMatches || !accountIsActive) {
    await writeAuthAuditEvent(context, "AUTH_LOGIN_FAILED", {
      userId: user?.id,
      entityId: user?.id,
      payload: { reason: "INVALID_CREDENTIALS_OR_ACCOUNT" },
    });
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  await writeAuthAuditEvent(context, "AUTH_LOGIN_SUCCEEDED", {
    userId: user.id,
    actorId: user.id,
    entityId: user.id,
  });

  const publicUser = await database.user.findUniqueOrThrow({
    where: { id: user.id },
    select: publicUserSelect,
  });

  return publicUser;
};

export const getCurrentUser = async (userId: string) => database.user.findFirstOrThrow({
  where: { id: userId, status: RecordStatus.ACTIVE, deletedAt: null },
  select: publicUserSelect,
});

export const updateCurrentUser = async (
  userId: string,
  role: UserRole,
  input: UpdateMeInput,
  context: AuditContext,
) => {
  if (input.studentProfile && role !== UserRole.STUDENT) {
    throw new AppError(403, "STUDENT_PROFILE_FORBIDDEN", "Only students can update student profile fields");
  }

  const targetRoleId = input.studentProfile?.targetCareerRoleId;
  if (targetRoleId) {
    const targetRoleExists = await database.careerRole.findFirst({
      where: { id: targetRoleId, status: RecordStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!targetRoleExists) {
      throw new AppError(400, "CAREER_ROLE_NOT_FOUND", "The selected career role does not exist");
    }
  }

  return database.$transaction(async (transaction) => {
    if (input.displayName !== undefined) {
      await transaction.user.update({
        where: { id: userId },
        data: { displayName: input.displayName, updatedBy: userId },
      });
    }

    if (input.studentProfile) {
      await transaction.studentProfile.upsert({
        where: { userId },
        update: { ...input.studentProfile, updatedBy: userId },
        create: { ...input.studentProfile, userId, createdBy: userId, updatedBy: userId },
      });
    }

    await transaction.auditEvent.create({
      data: auditData(context, "AUTH_PROFILE_UPDATED", {
        userId,
        actorId: userId,
        entityId: userId,
        payload: { fields: Object.keys(input) },
      }),
    });

    return transaction.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  });
};
