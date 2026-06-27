import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
  UserRole,
  type StudentProfile,
} from "../../generated/prisma/client.js";
import type {
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
} from "./student-profile.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

type ProfileWritableFields = Pick<
  StudentProfile,
  | "fullName"
  | "college"
  | "branch"
  | "graduationYear"
  | "targetRole"
  | "resumeUrl"
> & {
  currentSkills: unknown;
  preferredCompanies: unknown;
};

const profileSelect = {
  id: true,
  userId: true,
  fullName: true,
  college: true,
  branch: true,
  graduationYear: true,
  targetRole: true,
  currentSkills: true,
  preferredCompanies: true,
  resumeUrl: true,
  profileCompletionPercentage: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  },
} satisfies Prisma.StudentProfileSelect;

const completionFields = [
  "fullName",
  "college",
  "branch",
  "graduationYear",
  "targetRole",
  "currentSkills",
  "preferredCompanies",
  "resumeUrl",
] as const;

const isFilled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined;
};

export const calculateProfileCompletionPercentage = (profile: Partial<ProfileWritableFields>): number => {
  const filledCount = completionFields.filter((field) => isFilled(profile[field])).length;
  return Math.round((filledCount / completionFields.length) * 100);
};

const toStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : null;
};

const normalizeProfile = <T extends { currentSkills: unknown; preferredCompanies: unknown }>(profile: T) => ({
  ...profile,
  currentSkills: toStringArray(profile.currentSkills),
  preferredCompanies: toStringArray(profile.preferredCompanies),
});

const hasUserManagedProfileFields = (profile: Pick<
  StudentProfile,
  | "fullName"
  | "college"
  | "branch"
  | "graduationYear"
  | "targetRole"
  | "currentSkills"
  | "preferredCompanies"
  | "resumeUrl"
  | "profileCompletionPercentage"
>): boolean => profile.profileCompletionPercentage > 0
  || completionFields.some((field) => isFilled(profile[field]));

const jsonValueOrNull = (value: string[] | null | undefined) => {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
};

const buildProfileData = (
  input: CreateStudentProfileInput | UpdateStudentProfileInput,
  mergedProfile: Partial<ProfileWritableFields>,
  actorId: string,
): Prisma.StudentProfileUncheckedUpdateInput => ({
  fullName: input.fullName,
  college: input.college,
  branch: input.branch,
  graduationYear: input.graduationYear,
  targetRole: input.targetRole,
  currentSkills: jsonValueOrNull(input.currentSkills),
  preferredCompanies: jsonValueOrNull(input.preferredCompanies),
  resumeUrl: input.resumeUrl,
  profileCompletionPercentage: calculateProfileCompletionPercentage(mergedProfile),
  updatedBy: actorId,
});

const buildCreateProfileData = (
  userId: string,
  input: CreateStudentProfileInput,
): Prisma.StudentProfileUncheckedCreateInput => ({
  userId,
  fullName: input.fullName,
  college: input.college,
  branch: input.branch,
  graduationYear: input.graduationYear,
  targetRole: input.targetRole,
  currentSkills: jsonValueOrNull(input.currentSkills),
  preferredCompanies: jsonValueOrNull(input.preferredCompanies),
  resumeUrl: input.resumeUrl,
  profileCompletionPercentage: calculateProfileCompletionPercentage(input),
  createdBy: userId,
  updatedBy: userId,
});

const auditData = (
  context: AuditContext,
  action: string,
  options: { userId: string; actorId: string; entityId?: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "StudentProfile",
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

export const createOwnStudentProfile = async (
  userId: string,
  input: CreateStudentProfileInput,
  context: AuditContext,
) => {
  const existingProfile = await database.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
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
  });

  if (existingProfile && hasUserManagedProfileFields(existingProfile)) {
    throw new AppError(409, "STUDENT_PROFILE_ALREADY_EXISTS", "Student profile already exists");
  }

  return database.$transaction(async (transaction) => {
    const profile = existingProfile
      ? await transaction.studentProfile.update({
        where: { userId },
        data: buildProfileData(input, input, userId),
        select: profileSelect,
      })
      : await transaction.studentProfile.create({
        data: buildCreateProfileData(userId, input),
        select: profileSelect,
      });

    await transaction.auditEvent.create({
      data: auditData(context, "STUDENT_PROFILE_CREATED", {
        userId,
        actorId: userId,
        entityId: profile.id,
        payload: { fields: Object.keys(input) },
      }),
    });

    return normalizeProfile(profile);
  });
};

export const getOwnStudentProfile = async (userId: string) => {
  const profile = await database.studentProfile.findFirst({
    where: { userId, status: RecordStatus.ACTIVE, deletedAt: null },
    select: profileSelect,
  });

  if (!profile) {
    throw new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Student profile was not found");
  }

  return normalizeProfile(profile);
};

export const getPermittedStudentProfile = async (
  requesterRole: UserRole,
  requesterId: string,
  studentUserId: string,
) => {
  if (requesterRole === UserRole.STUDENT && requesterId !== studentUserId) {
    throw new AppError(403, "INSUFFICIENT_PERMISSIONS", "Students can only read their own profile");
  }

  const profile = await database.studentProfile.findFirst({
    where: {
      userId: studentUserId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
      user: {
        role: UserRole.STUDENT,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: profileSelect,
  });

  if (!profile) {
    throw new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Student profile was not found");
  }

  return normalizeProfile(profile);
};

export const updateOwnStudentProfile = async (
  userId: string,
  input: UpdateStudentProfileInput,
  context: AuditContext,
) => {
  const existingProfile = await database.studentProfile.findFirst({
    where: { userId, status: RecordStatus.ACTIVE, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      college: true,
      branch: true,
      graduationYear: true,
      targetRole: true,
      currentSkills: true,
      preferredCompanies: true,
      resumeUrl: true,
    },
  });

  if (!existingProfile) {
    throw new AppError(404, "STUDENT_PROFILE_NOT_FOUND", "Student profile was not found");
  }

  const mergedProfile = {
    fullName: input.fullName !== undefined ? input.fullName : existingProfile.fullName,
    college: input.college !== undefined ? input.college : existingProfile.college,
    branch: input.branch !== undefined ? input.branch : existingProfile.branch,
    graduationYear: input.graduationYear !== undefined ? input.graduationYear : existingProfile.graduationYear,
    targetRole: input.targetRole !== undefined ? input.targetRole : existingProfile.targetRole,
    currentSkills: input.currentSkills !== undefined ? input.currentSkills : toStringArray(existingProfile.currentSkills),
    preferredCompanies: input.preferredCompanies !== undefined
      ? input.preferredCompanies
      : toStringArray(existingProfile.preferredCompanies),
    resumeUrl: input.resumeUrl !== undefined ? input.resumeUrl : existingProfile.resumeUrl,
  };

  return database.$transaction(async (transaction) => {
    const profile = await transaction.studentProfile.update({
      where: { userId },
      data: buildProfileData(input, mergedProfile, userId),
      select: profileSelect,
    });

    await transaction.auditEvent.create({
      data: auditData(context, "STUDENT_PROFILE_UPDATED", {
        userId,
        actorId: userId,
        entityId: profile.id,
        payload: { fields: Object.keys(input) },
      }),
    });

    return normalizeProfile(profile);
  });
};
