import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
  ResumeParsingStatus,
} from "../../generated/prisma/client.js";
import { localFileStorage } from "../../storage/local-file.storage.js";
import type { FileStorage } from "../../storage/storage.service.js";
import {
  extensionForMimeType,
  validateResumeSignature,
} from "./resume.validation.js";
import { resumeParserService } from "./resume-parser.service.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const resumeSelect = {
  id: true,
  userId: true,
  originalFileName: true,
  storedFileName: true,
  mimeType: true,
  fileSize: true,
  fileUrl: true,
  uploadedAt: true,
  parsingStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResumeSelect;

const auditData = (
  context: AuditContext,
  action: string,
  options: { userId: string; entityId: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "Resume",
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.userId,
  updatedBy: options.userId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.userId } },
});

const storageKeyFor = (storedFileName: string): string => `resumes/${storedFileName}`;

export const uploadResume = async (
  userId: string,
  file: Express.Multer.File | undefined,
  context: AuditContext,
  storage: FileStorage = localFileStorage,
) => {
  if (!file) {
    throw new AppError(400, "RESUME_FILE_REQUIRED", "Upload a resume file using the 'resume' field");
  }

  const extension = extensionForMimeType(file.mimetype);
  if (!extension) {
    throw new AppError(400, "UNSUPPORTED_RESUME_FILE_TYPE", "Only PDF, DOC, and DOCX resumes are supported");
  }

  validateResumeSignature({ buffer: file.buffer, mimetype: file.mimetype });

  const storedFile = await storage.save({
    buffer: file.buffer,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    extension,
  });

  try {
    const resume = await database.$transaction(async (transaction) => {
      const resume = await transaction.resume.create({
        data: {
          userId,
          originalFileName: file.originalname,
          storedFileName: storedFile.storedFileName,
          mimeType: file.mimetype,
          fileSize: file.size,
          fileUrl: storedFile.fileUrl,
          parsingStatus: ResumeParsingStatus.PENDING,
          createdBy: userId,
          updatedBy: userId,
          metadata: { storageKey: storedFile.storageKey },
        },
        select: resumeSelect,
      });

      await transaction.auditEvent.create({
        data: auditData(context, "resume_uploaded", {
          userId,
          entityId: resume.id,
          payload: {
            originalFileName: resume.originalFileName,
            mimeType: resume.mimeType,
            fileSize: resume.fileSize,
          },
        }),
      });

      return resume;
    });

    const resumeText = await resumeParserService.parseAndStore({
      resumeId: resume.id,
      userId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const parsedResume = await database.resume.findUniqueOrThrow({
      where: { id: resume.id },
      select: resumeSelect,
    });

    return {
      resume: parsedResume,
      resumeText,
    };
  } catch (error) {
    const resumeExists = await database.resume.findUnique({
      where: { storedFileName: storedFile.storedFileName },
      select: { id: true },
    });
    if (!resumeExists) {
      await storage.delete(storedFile.storageKey);
    }
    throw error;
  }
};

export const listOwnResumes = async (userId: string) => database.resume.findMany({
  where: {
    userId,
    status: RecordStatus.ACTIVE,
    deletedAt: null,
  },
  select: resumeSelect,
  orderBy: { uploadedAt: "desc" },
});

export const deleteOwnResume = async (
  userId: string,
  resumeId: string,
  context: AuditContext,
  storage: FileStorage = localFileStorage,
) => {
  const resume = await database.resume.findFirst({
    where: {
      id: resumeId,
      userId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      storedFileName: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      metadata: true,
    },
  });

  if (!resume) {
    throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found");
  }

  const storageKey = typeof resume.metadata === "object"
    && resume.metadata !== null
    && !Array.isArray(resume.metadata)
    && typeof (resume.metadata as { storageKey?: unknown }).storageKey === "string"
    ? (resume.metadata as { storageKey: string }).storageKey
    : storageKeyFor(resume.storedFileName);

  await storage.delete(storageKey);

  return database.$transaction(async (transaction) => {
    const deletedResume = await transaction.resume.update({
      where: { id: resume.id },
      data: {
        status: RecordStatus.ARCHIVED,
        deletedAt: new Date(),
        updatedBy: userId,
      },
      select: resumeSelect,
    });

    await transaction.auditEvent.create({
      data: auditData(context, "resume_deleted", {
        userId,
        entityId: resume.id,
        payload: {
          originalFileName: resume.originalFileName,
          mimeType: resume.mimeType,
          fileSize: resume.fileSize,
        },
      }),
    });

    return deletedResume;
  });
};
