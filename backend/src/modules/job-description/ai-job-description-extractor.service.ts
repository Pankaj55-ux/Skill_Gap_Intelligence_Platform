import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus } from "../../generated/prisma/client.js";
import {
  skillNormalizerService,
  type SkillNormalizationInput,
} from "../resume/skill-normalizer.service.js";
import type { AuditContext } from "./job-description.service.js";

export const JOB_DESCRIPTION_AI_PROMPT_VERSION = "job-description-extractor-v1";
const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

const stringListSchema = z.array(z.string().trim().min(1).max(220)).max(300).default([]);

export const jobDescriptionStructuredDataSchema = z.object({
  roleTitle: z.string().trim().min(1).max(180),
  company: z.string().trim().min(1).max(180).nullable(),
  requiredSkills: stringListSchema,
  preferredSkills: stringListSchema,
  responsibilities: stringListSchema,
  experienceLevel: z.enum(["FRESHER", "JUNIOR", "MID", "SENIOR"]),
  minExperienceYears: z.coerce.number().min(0).max(60),
  educationRequirements: stringListSchema,
  tools: stringListSchema,
  keywords: stringListSchema,
}).strict();

export type JobDescriptionStructuredData = z.infer<typeof jobDescriptionStructuredDataSchema>;

interface AIProviderResult {
  text: string;
  model: string;
}

export interface AIJobDescriptionProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiJobDescriptionAIProvider implements AIJobDescriptionProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI job description extraction requires GEMINI_API_KEY",
      );
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to process the job description");
    }

    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AppError(502, "AI_PROVIDER_EMPTY_RESPONSE", "AI provider returned an empty response");
    }

    return { text, model: DEFAULT_AI_MODEL };
  }
}

const analysisSelect = {
  id: true,
  jobDescriptionId: true,
  structuredData: true,
  aiModel: true,
  promptVersion: true,
  executionTimeMs: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JobDescriptionAnalysisSelect;

const normalizedSkillSelect = {
  id: true,
  jobDescriptionId: true,
  originalSkill: true,
  normalizedSkill: true,
  category: true,
  confidence: true,
} satisfies Prisma.NormalizedSkillSelect;

const normalizeStringArray = (items: string[]): string[] => Array.from(new Set(
  items.map((item) => item.trim()).filter(Boolean),
));

const normalizeStructuredData = (data: JobDescriptionStructuredData): JobDescriptionStructuredData => ({
  roleTitle: data.roleTitle.trim(),
  company: data.company?.trim() || null,
  requiredSkills: normalizeStringArray(data.requiredSkills),
  preferredSkills: normalizeStringArray(data.preferredSkills),
  responsibilities: normalizeStringArray(data.responsibilities),
  experienceLevel: data.experienceLevel,
  minExperienceYears: data.minExperienceYears,
  educationRequirements: normalizeStringArray(data.educationRequirements),
  tools: normalizeStringArray(data.tools),
  keywords: normalizeStringArray(data.keywords),
});

const parseJsonOnly = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new AppError(422, "AI_RESPONSE_NOT_JSON", "AI response was not valid JSON");
    }
    return JSON.parse(match[0]);
  }
};

const calculateConfidence = (data: JobDescriptionStructuredData): number => {
  const fields: unknown[] = [
    data.roleTitle,
    data.company,
    data.requiredSkills,
    data.preferredSkills,
    data.responsibilities,
    data.experienceLevel,
    data.minExperienceYears,
    data.educationRequirements,
    data.tools,
    data.keywords,
  ];
  const populated = fields.filter((field) => {
    if (Array.isArray(field)) return field.length > 0;
    if (typeof field === "string") return field.trim().length > 0;
    return field !== null && field !== undefined;
  }).length;

  return Math.round((populated / fields.length) * 10000) / 100;
};

const skillInputsForStructuredData = (data: JobDescriptionStructuredData): SkillNormalizationInput[] => [
  ...data.requiredSkills.map((skill) => ({ originalSkill: skill, category: "requiredSkills" })),
  ...data.preferredSkills.map((skill) => ({ originalSkill: skill, category: "preferredSkills" })),
  ...data.tools.map((skill) => ({ originalSkill: skill, category: "tools" })),
  ...data.keywords.map((skill) => ({ originalSkill: skill, category: "keywords" })),
];

const createPrompt = (jobDescriptionText: string, retry = false): string => `
You are extracting structured job description data for a skill matching engine.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "roleTitle": "",
  "company": null,
  "requiredSkills": [],
  "preferredSkills": [],
  "responsibilities": [],
  "experienceLevel": "FRESHER",
  "minExperienceYears": 0,
  "educationRequirements": [],
  "tools": [],
  "keywords": []
}

Rules:
- Every top-level key must be present.
- Use null for company if it is not explicitly present.
- experienceLevel must be one of: FRESHER, JUNIOR, MID, SENIOR.
- minExperienceYears must be a number. Use 0 when the posting asks for fresher/entry-level/no experience.
- requiredSkills, preferredSkills, responsibilities, educationRequirements, tools, and keywords must contain strings only.
- Never infer requirements that are not present in the job description text.
- Do not identify candidate gaps or make recommendations.
${retry ? "- Previous response failed schema validation. Return only a valid object matching the schema." : ""}

Job description text:
${jobDescriptionText.slice(0, 40_000)}
`;

const auditData = (
  context: AuditContext,
  options: {
    userId: string;
    jobDescriptionId: string;
    analysisId: string;
    confidence: number;
    aiModel: string;
  },
): Prisma.AuditEventCreateInput => ({
  action: "job_description_ai_processed",
  entityType: "JobDescriptionAnalysis",
  entityId: options.analysisId,
  payload: {
    jobDescriptionId: options.jobDescriptionId,
    confidence: options.confidence,
    aiModel: options.aiModel,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.userId,
  updatedBy: options.userId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.userId } },
});

export class AIJobDescriptionExtractorService {
  constructor(private readonly provider: AIJobDescriptionProvider = new GeminiJobDescriptionAIProvider()) {}

  async processJobDescription(input: {
    userId: string;
    jobDescriptionId: string;
    context: AuditContext;
  }) {
    const jobDescription = await database.jobDescription.findFirst({
      where: {
        id: input.jobDescriptionId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        description: true,
      },
    });

    if (!jobDescription) {
      throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description was not found");
    }

    if (!jobDescription.description.trim()) {
      throw new AppError(
        400,
        "JOB_DESCRIPTION_TEXT_REQUIRED",
        "Job description text is required before AI processing",
      );
    }

    const startedAt = performance.now();
    const firstAttempt = await this.tryExtract(jobDescription.description, false);
    const result = firstAttempt.success
      ? firstAttempt
      : await this.tryExtract(jobDescription.description, true);

    if (!result.success) {
      throw new AppError(
        422,
        "AI_RESPONSE_VALIDATION_FAILED",
        "AI response did not match the required job description schema",
        result.details,
      );
    }

    const executionTimeMs = Math.round(performance.now() - startedAt);
    const confidence = calculateConfidence(result.data);

    const analysis = await database.$transaction(async (transaction) => {
      const createdAnalysis = await transaction.jobDescriptionAnalysis.create({
        data: {
          jobDescriptionId: jobDescription.id,
          structuredData: result.data as Prisma.InputJsonValue,
          aiModel: result.model,
          promptVersion: JOB_DESCRIPTION_AI_PROMPT_VERSION,
          executionTimeMs,
          confidence,
          createdBy: input.userId,
          updatedBy: input.userId,
          metadata: {
            retryUsed: !firstAttempt.success,
          },
        },
        select: analysisSelect,
      });

      await skillNormalizerService.saveJobDescriptionNormalizedSkills({
        jobDescriptionId: jobDescription.id,
        userId: input.userId,
        skills: skillInputsForStructuredData(result.data),
        transaction,
      });

      await transaction.auditEvent.create({
        data: auditData(input.context, {
          userId: input.userId,
          jobDescriptionId: jobDescription.id,
          analysisId: createdAnalysis.id,
          confidence,
          aiModel: result.model,
        }),
      });

      const normalizedSkills = await transaction.normalizedSkill.findMany({
        where: {
          jobDescriptionId: jobDescription.id,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
        },
        select: normalizedSkillSelect,
        orderBy: [{ category: "asc" }, { normalizedSkill: "asc" }],
      });

      return {
        analysis: createdAnalysis,
        normalizedSkills,
      };
    });

    return {
      analysis: {
        ...analysis.analysis,
        confidence: Number(analysis.analysis.confidence),
      },
      normalizedSkills: analysis.normalizedSkills.map((skill) => ({
        ...skill,
        confidence: Number(skill.confidence),
      })),
    };
  }

  private async tryExtract(jobDescriptionText: string, retry: boolean): Promise<
    | { success: true; data: JobDescriptionStructuredData; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(jobDescriptionText, retry));
      const parsed = parseJsonOnly(response.text);
      const validated = jobDescriptionStructuredDataSchema.parse(parsed);
      return {
        success: true,
        data: normalizeStructuredData(validated),
        model: response.model,
      };
    } catch (error) {
      if (error instanceof AppError && error.code !== "AI_RESPONSE_NOT_JSON") throw error;
      if (error instanceof z.ZodError) {
        return { success: false, details: error.flatten() };
      }
      return { success: false, details: null };
    }
  }
}

export const aiJobDescriptionExtractorService = new AIJobDescriptionExtractorService();
