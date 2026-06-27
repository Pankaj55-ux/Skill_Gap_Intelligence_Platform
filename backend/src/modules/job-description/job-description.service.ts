import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
  UserRole,
  type JobDescription,
} from "../../generated/prisma/client.js";
import { resumeParserService } from "../resume/resume-parser.service.js";
import {
  skillNormalizerService,
  type SkillNormalizationInput,
} from "../resume/skill-normalizer.service.js";
import type {
  CreateJobDescriptionInput,
  UpdateJobDescriptionInput,
} from "./job-description.schemas.js";
import { validateJobDescriptionSignature } from "./job-description.validation.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadedJobDescriptionFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const PARSING_TIMEOUT_MS = 30_000;

const jobDescriptionSelect = {
  id: true,
  title: true,
  company: true,
  description: true,
  requiredSkills: true,
  preferredSkills: true,
  experience: true,
  location: true,
  employmentType: true,
  uploadedBy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
  normalizedSkills: {
    where: { status: RecordStatus.ACTIVE, deletedAt: null },
    select: {
      id: true,
      originalSkill: true,
      normalizedSkill: true,
      category: true,
      confidence: true,
    },
    orderBy: [{ category: "asc" }, { normalizedSkill: "asc" }],
  },
} satisfies Prisma.JobDescriptionSelect;

type SelectedJobDescription = Prisma.JobDescriptionGetPayload<{
  select: typeof jobDescriptionSelect;
}>;

const jsonArray = (value: string[]): Prisma.InputJsonValue => value;

const normalizeJsonList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeJobDescription = (jobDescription: SelectedJobDescription) => ({
  ...jobDescription,
  requiredSkills: normalizeJsonList(jobDescription.requiredSkills),
  preferredSkills: normalizeJsonList(jobDescription.preferredSkills),
  normalizedSkills: jobDescription.normalizedSkills.map((skill) => ({
    ...skill,
    confidence: Number(skill.confidence),
  })),
});

const auditData = (
  context: AuditContext,
  action: string,
  options: { actorId: string; entityId: string; payload?: Prisma.InputJsonValue },
): Prisma.AuditEventCreateInput => ({
  action,
  entityType: "JobDescription",
  entityId: options.entityId,
  payload: options.payload,
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  actor: { connect: { id: options.actorId } },
});

const visibilityWhere = (requesterRole: UserRole): Prisma.JobDescriptionWhereInput => {
  if (requesterRole === UserRole.STUDENT || requesterRole === UserRole.MENTOR) {
    return { status: RecordStatus.ACTIVE, deletedAt: null };
  }

  return { deletedAt: null };
};

const extractKnownSkillsFromText = (description: string): SkillNormalizationInput[] => {
  const normalizedText = ` ${description.toLocaleLowerCase("en-US").replace(/[^a-z0-9+#.]+/g, " ")} `;
  const skills: SkillNormalizationInput[] = [];

  for (const entry of skillNormalizerService.getDictionary()) {
    const matchedAlias = [entry.canonical, ...entry.aliases].find((alias) => {
      const normalizedAlias = alias.toLocaleLowerCase("en-US").replace(/[^a-z0-9+#.]+/g, " ").trim();
      return normalizedAlias.length > 0 && normalizedText.includes(` ${normalizedAlias} `);
    });

    if (matchedAlias) {
      skills.push({ originalSkill: matchedAlias, category: entry.category });
    }
  }

  return skills;
};

const skillInputsForJobDescription = (input: {
  requiredSkills: string[];
  preferredSkills: string[];
  description: string;
}): SkillNormalizationInput[] => [
  ...input.requiredSkills.map((skill) => ({ originalSkill: skill, category: "requiredSkills" })),
  ...input.preferredSkills.map((skill) => ({ originalSkill: skill, category: "preferredSkills" })),
  ...extractKnownSkillsFromText(input.description),
];

const extractDescriptionFromFile = async (file: UploadedJobDescriptionFile): Promise<{
  description: string;
  metadata: Prisma.InputJsonObject;
}> => {
  validateJobDescriptionSignature(file);

  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new AppError(
        408,
        "JOB_DESCRIPTION_PARSING_TIMEOUT",
        "Job description parsing exceeded the 30 second timeout",
      ));
    }, PARSING_TIMEOUT_MS);
  });

  try {
    const parsed = await Promise.race([
      resumeParserService.extractPlainText(file.buffer, file.mimetype),
      timeoutPromise,
    ]);

    if (parsed.extractedText.length === 0) {
      throw new AppError(
        422,
        "JOB_DESCRIPTION_TEXT_EMPTY",
        "No extractable text was found in the job description file",
      );
    }

    return {
      description: parsed.extractedText,
      metadata: {
        source: "file",
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        pageCount: parsed.pageCount,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      422,
      "JOB_DESCRIPTION_PARSING_FAILED",
      "Job description file could not be parsed. It may be corrupt, encrypted, or unsupported.",
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const resolveDescription = async (
  input: { description?: string },
  file?: UploadedJobDescriptionFile,
): Promise<{ description: string; metadata: Prisma.InputJsonObject }> => {
  if (file) return extractDescriptionFromFile(file);

  if (!input.description || input.description.trim().length === 0) {
    throw new AppError(
      400,
      "JOB_DESCRIPTION_TEXT_REQUIRED",
      "Provide manual description text or upload a PDF/DOCX file",
    );
  }

  return {
    description: resumeParserService.normalizeWhitespace(input.description),
    metadata: { source: "manual" },
  };
};

export const createJobDescription = async (
  actorId: string,
  input: CreateJobDescriptionInput,
  context: AuditContext,
  file?: UploadedJobDescriptionFile,
) => {
  const resolved = await resolveDescription(input, file);

  return database.$transaction(async (transaction) => {
    const created = await transaction.jobDescription.create({
      data: {
        title: input.title,
        company: input.company,
        description: resolved.description,
        requiredSkills: jsonArray(input.requiredSkills),
        preferredSkills: jsonArray(input.preferredSkills),
        experience: input.experience,
        location: input.location,
        employmentType: input.employmentType,
        uploadedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
        metadata: resolved.metadata,
      },
      select: { id: true },
    });

    await skillNormalizerService.saveJobDescriptionNormalizedSkills({
      jobDescriptionId: created.id,
      userId: actorId,
      skills: skillInputsForJobDescription({
        requiredSkills: input.requiredSkills,
        preferredSkills: input.preferredSkills,
        description: resolved.description,
      }),
      transaction,
    });

    await transaction.auditEvent.create({
      data: auditData(context, "JOB_DESCRIPTION_CREATED", {
        actorId,
        entityId: created.id,
        payload: { fields: Object.keys(input), source: resolved.metadata.source },
      }),
    });

    const jobDescription = await transaction.jobDescription.findUniqueOrThrow({
      where: { id: created.id },
      select: jobDescriptionSelect,
    });

    return normalizeJobDescription(jobDescription);
  });
};

export const listJobDescriptions = async (requesterRole: UserRole) => {
  const jobDescriptions = await database.jobDescription.findMany({
    where: visibilityWhere(requesterRole),
    select: jobDescriptionSelect,
    orderBy: { createdAt: "desc" },
  });

  return { jobDescriptions: jobDescriptions.map(normalizeJobDescription) };
};

export const getJobDescriptionById = async (
  requesterRole: UserRole,
  id: string,
) => {
  const jobDescription = await database.jobDescription.findFirst({
    where: { id, ...visibilityWhere(requesterRole) },
    select: jobDescriptionSelect,
  });

  if (!jobDescription) {
    throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description was not found");
  }

  return normalizeJobDescription(jobDescription);
};

export const updateJobDescription = async (
  actorId: string,
  id: string,
  input: UpdateJobDescriptionInput,
  context: AuditContext,
  file?: UploadedJobDescriptionFile,
) => {
  const existing = await database.jobDescription.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      description: true,
      requiredSkills: true,
      preferredSkills: true,
      metadata: true,
    },
  });

  if (!existing) {
    throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description was not found");
  }

  const resolved = file || input.description
    ? await resolveDescription(input, file)
    : {
        description: existing.description,
        metadata: existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? existing.metadata as Prisma.InputJsonObject
          : { source: "manual" },
      };

  const requiredSkills = input.requiredSkills ?? normalizeJsonList(existing.requiredSkills);
  const preferredSkills = input.preferredSkills ?? normalizeJsonList(existing.preferredSkills);

  return database.$transaction(async (transaction) => {
    const updated = await transaction.jobDescription.update({
      where: { id },
      data: {
        title: input.title,
        company: input.company,
        description: resolved.description,
        requiredSkills: jsonArray(requiredSkills),
        preferredSkills: jsonArray(preferredSkills),
        experience: input.experience,
        location: input.location,
        employmentType: input.employmentType,
        updatedBy: actorId,
        metadata: resolved.metadata,
      },
      select: { id: true },
    });

    await skillNormalizerService.saveJobDescriptionNormalizedSkills({
      jobDescriptionId: updated.id,
      userId: actorId,
      skills: skillInputsForJobDescription({
        requiredSkills,
        preferredSkills,
        description: resolved.description,
      }),
      transaction,
    });

    await transaction.auditEvent.create({
      data: auditData(context, "JOB_DESCRIPTION_UPDATED", {
        actorId,
        entityId: updated.id,
        payload: { fields: Object.keys(input), replacedFile: Boolean(file) },
      }),
    });

    const jobDescription = await transaction.jobDescription.findUniqueOrThrow({
      where: { id: updated.id },
      select: jobDescriptionSelect,
    });

    return normalizeJobDescription(jobDescription);
  });
};

export const deleteJobDescription = async (
  actorId: string,
  id: string,
  context: AuditContext,
) => database.$transaction(async (transaction) => {
  const existing = await transaction.jobDescription.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description was not found");
  }

  const jobDescription = await transaction.jobDescription.update({
    where: { id },
    data: {
      status: RecordStatus.ARCHIVED,
      deletedAt: new Date(),
      updatedBy: actorId,
    },
    select: jobDescriptionSelect,
  });

  await transaction.normalizedSkill.updateMany({
    where: {
      jobDescriptionId: id,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    data: {
      status: RecordStatus.ARCHIVED,
      deletedAt: new Date(),
      updatedBy: actorId,
    },
  });

  await transaction.auditEvent.create({
    data: auditData(context, "JOB_DESCRIPTION_DELETED", {
      actorId,
      entityId: id,
    }),
  });

  return normalizeJobDescription(jobDescription);
});

export const canReadJobDescriptions = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.PLACEMENT_OFFICER,
  UserRole.ADMIN,
] as const;

export const canWriteJobDescriptions = [
  UserRole.ADMIN,
  UserRole.PLACEMENT_OFFICER,
] as const;
