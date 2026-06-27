import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus } from "../../generated/prisma/client.js";
import { skillNormalizerService } from "./skill-normalizer.service.js";

export const RESUME_AI_PROMPT_VERSION = "resume-extractor-v1";
const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

const stringListSchema = z.array(z.string().trim().min(1).max(200)).default([]);
const objectListSchema = z.array(z.record(z.unknown())).default([]);

export const resumeStructuredDataSchema = z.object({
  technicalSkills: stringListSchema,
  frameworks: stringListSchema,
  databases: stringListSchema,
  cloud: stringListSchema,
  tools: stringListSchema,
  programmingLanguages: stringListSchema,
  softSkills: stringListSchema,
  certifications: stringListSchema,
  projects: objectListSchema,
  internships: objectListSchema,
  education: objectListSchema,
  achievements: stringListSchema,
  summary: z.string().trim().max(2_000).default(""),
  improvementSuggestions: stringListSchema,
}).strict();

export type ResumeStructuredData = z.infer<typeof resumeStructuredDataSchema>;

interface AIProviderResult {
  text: string;
  model: string;
}

interface AIProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiResumeAIProvider implements AIProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI resume extraction requires GEMINI_API_KEY",
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
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to process the resume");
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

const emptyStructuredData = (): ResumeStructuredData => ({
  technicalSkills: [],
  frameworks: [],
  databases: [],
  cloud: [],
  tools: [],
  programmingLanguages: [],
  softSkills: [],
  certifications: [],
  projects: [],
  internships: [],
  education: [],
  achievements: [],
  summary: "",
  improvementSuggestions: [],
});

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsTerm = (text: string, term: string): boolean => {
  if (term.trim().length <= 2) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`, "i").test(text);
};

const sectionHeadings = [
  "education",
  "projects",
  "internships",
  "experience",
  "work experience",
  "technical skills",
  "skills",
  "certifications",
  "certifications & achievements",
  "achievements",
] as const;

const cleanResumeLine = (line: string): string => line
  .replace(/^[•–—-]\s*/, "")
  .replace(/\s+/g, " ")
  .trim();

const sectionLines = (resumeText: string, heading: string): string[] => {
  const lines = resumeText.split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) => line.toLocaleLowerCase("en-US") === heading);
  if (start < 0) return [];

  const endOffset = lines.slice(start + 1).findIndex((line) => (
    sectionHeadings.includes(line.toLocaleLowerCase("en-US") as (typeof sectionHeadings)[number])
  ));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;

  return lines
    .slice(start + 1, end)
    .map(cleanResumeLine)
    .filter((line) => line.length > 0 && !/^-{1,2}\s*\d+ of \d+\s*-{1,2}$/.test(line));
};

const extractProjects = (resumeText: string): Array<Record<string, unknown>> => {
  const lines = sectionLines(resumeText, "projects");
  const projects: Array<{ name: string; period?: string; highlights: string[] }> = [];

  for (const line of lines) {
    const isProjectHeader = line.includes("|") && !line.startsWith("Integrated ") && !line.startsWith("Implemented ");
    if (isProjectHeader) {
      const [namePart, ...rest] = line.split("|");
      const details = rest.join("|").replace(/\bGitHub\b/i, "").trim();
      projects.push({
        name: namePart.trim(),
        ...(details ? { period: details } : {}),
        highlights: [],
      });
      continue;
    }

    projects.at(-1)?.highlights.push(line);
  }

  return projects;
};

const extractEducation = (resumeText: string): Array<Record<string, unknown>> => {
  const lines = sectionLines(resumeText, "education");
  if (lines.length === 0) return [];

  const periodPattern = /\b\d{4}\s*[–—-]\s*(?:\d{4}|present)\b/i;
  const period = lines[0].match(periodPattern)?.[0];
  const institution = lines[0].replace(periodPattern, "").trim();

  return [{
    institution,
    ...(period ? { period } : {}),
    ...(lines[1] ? { degree: lines[1] } : {}),
    ...(lines.length > 2 ? { details: lines.slice(2) } : {}),
  }];
};

const extractCredentialsAndAchievements = (resumeText: string) => {
  const combined = [
    ...sectionLines(resumeText, "certifications & achievements"),
    ...sectionLines(resumeText, "certifications"),
    ...sectionLines(resumeText, "achievements"),
  ];
  const merged = combined.reduce<string[]>((items, line) => {
    if (/^[a-z]/.test(line) && items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
    } else {
      items.push(line);
    }
    return items;
  }, []);
  const unique = Array.from(new Set(merged));

  return {
    certifications: unique.filter((line) => /certification|certified|job simulation|course/i.test(line)),
    achievements: unique.filter((line) => !/certification|certified|job simulation|course/i.test(line)),
  };
};

export const extractDeterministicStructuredData = (resumeText: string): ResumeStructuredData => {
  const result = emptyStructuredData();
  const skillCategories = new Set([
    "technicalSkills",
    "frameworks",
    "databases",
    "cloud",
    "tools",
    "programmingLanguages",
  ]);

  for (const entry of skillNormalizerService.getDictionary()) {
    if (!skillCategories.has(entry.category)) continue;
    const terms = [entry.canonical, ...entry.aliases];
    if (terms.some((term) => containsTerm(resumeText, term))) {
      (result[entry.category as keyof Pick<
        ResumeStructuredData,
        "technicalSkills" | "frameworks" | "databases" | "cloud" | "tools" | "programmingLanguages"
      >] as string[]).push(entry.canonical);
    }
  }

  const softSkills = [
    ["Communication", ["communication", "communicator"]],
    ["Leadership", ["leadership", "team lead"]],
    ["Problem Solving", ["problem solving", "problem-solving"]],
    ["Teamwork", ["teamwork", "team player", "collaboration"]],
    ["Time Management", ["time management"]],
  ] as const;

  for (const [canonical, aliases] of softSkills) {
    if (aliases.some((alias) => containsTerm(resumeText, alias))) {
      result.softSkills.push(canonical);
    }
  }

  result.projects = extractProjects(resumeText);
  result.education = extractEducation(resumeText);
  const credentials = extractCredentialsAndAchievements(resumeText);
  result.certifications = credentials.certifications;
  result.achievements = credentials.achievements;

  const candidateName = resumeText.split(/\r?\n/).map(cleanResumeLine).find(Boolean) ?? "The candidate";
  const highlightedSkills = [
    ...result.programmingLanguages,
    ...result.frameworks,
    ...result.databases,
    ...result.cloud,
  ].slice(0, 6);
  const degree = typeof result.education[0]?.degree === "string"
    ? result.education[0].degree
    : null;
  result.summary = [
    `${candidateName} presents ${result.projects.length} software project${result.projects.length === 1 ? "" : "s"}`,
    degree ? `and is pursuing ${degree}` : null,
    highlightedSkills.length > 0 ? `with experience in ${highlightedSkills.join(", ")}` : null,
  ].filter(Boolean).join(" ") + ".";

  if (!/\b(summary|profile|objective)\b/i.test(resumeText)) {
    result.improvementSuggestions.push("Add a concise professional summary tailored to the target role.");
  }
  if (result.internships.length === 0) {
    result.improvementSuggestions.push("Add internship, freelance, or relevant work experience when available.");
  }
  if (result.certifications.some((item) => !/https?:\/\/|credential|verify/i.test(item))) {
    result.improvementSuggestions.push("Include credential IDs or verification links for certifications.");
  }
  if (!/\b(deployed|deployment|live demo|https?:\/\/)\b/i.test(resumeText)) {
    result.improvementSuggestions.push("Add live demo or deployment links for the strongest projects.");
  }

  return result;
};

class DeterministicResumeProvider implements AIProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    const resumeText = prompt.split("Resume text:\n").at(-1) ?? prompt;
    return {
      text: JSON.stringify(extractDeterministicStructuredData(resumeText)),
      model: "deterministic-local-v1",
    };
  }
}

class FallbackResumeProvider implements AIProvider {
  constructor(
    private readonly primary: AIProvider | null,
    private readonly fallback: AIProvider,
  ) {}

  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (this.primary) {
      try {
        return await this.primary.generateJson(prompt);
      } catch {
        // Keep resume analysis available when the external provider is unavailable.
      }
    }
    return this.fallback.generateJson(prompt);
  }
}

const createDefaultProvider = (): AIProvider => new FallbackResumeProvider(
  env.GEMINI_API_KEY ? new GeminiResumeAIProvider() : null,
  new DeterministicResumeProvider(),
);

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const analysisSelect = {
  id: true,
  resumeId: true,
  structuredData: true,
  aiModel: true,
  promptVersion: true,
  executionTimeMs: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResumeAnalysisSelect;

const normalizedSkillSelect = {
  id: true,
  resumeId: true,
  originalSkill: true,
  normalizedSkill: true,
  category: true,
  confidence: true,
} satisfies Prisma.NormalizedSkillSelect;

const normalizeStringArray = (items: string[]): string[] => Array.from(new Set(
  items.map((item) => item.trim()).filter(Boolean),
));

const normalizeStructuredData = (data: ResumeStructuredData): ResumeStructuredData => ({
  technicalSkills: normalizeStringArray(data.technicalSkills),
  frameworks: normalizeStringArray(data.frameworks),
  databases: normalizeStringArray(data.databases),
  cloud: normalizeStringArray(data.cloud),
  tools: normalizeStringArray(data.tools),
  programmingLanguages: normalizeStringArray(data.programmingLanguages),
  softSkills: normalizeStringArray(data.softSkills),
  certifications: normalizeStringArray(data.certifications),
  projects: data.projects,
  internships: data.internships,
  education: data.education,
  achievements: normalizeStringArray(data.achievements),
  summary: data.summary.trim(),
  improvementSuggestions: normalizeStringArray(data.improvementSuggestions),
});

const parseJsonOnly = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(422, "AI_RESPONSE_NOT_JSON", "AI response was not valid JSON");
    return JSON.parse(match[0]);
  }
};

const calculateConfidence = (data: ResumeStructuredData): number => {
  const categories = Object.values(data);
  const populated = categories.filter((value) => Array.isArray(value) && value.length > 0).length;
  return Math.round((populated / categories.length) * 10000) / 100;
};

const createPrompt = (resumeText: string, retry = false): string => `
You are extracting structured resume data.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "technicalSkills": [],
  "frameworks": [],
  "databases": [],
  "cloud": [],
  "tools": [],
  "programmingLanguages": [],
  "softSkills": [],
  "certifications": [],
  "projects": [],
  "internships": [],
  "education": [],
  "achievements": [],
  "summary": "",
  "improvementSuggestions": []
}

Rules:
- Every top-level key must be present.
- String categories must contain strings only.
- projects, internships, and education must contain plain JSON objects only.
- summary must be a concise evidence-based overview of the candidate.
- improvementSuggestions must contain specific resume-quality improvements based only on the supplied text.
- Never infer facts that are not present in the resume text.
- Do not identify skill gaps or make recommendations.
${retry ? "- Previous response failed schema validation. Return only a valid object matching the schema." : ""}

Resume text:
${resumeText.slice(0, 40_000)}
`;

const auditData = (
  context: AuditContext,
  options: { userId: string; resumeId: string; analysisId: string; confidence: number; aiModel: string },
): Prisma.AuditEventCreateInput => ({
  action: "resume_ai_processed",
  entityType: "ResumeAnalysis",
  entityId: options.analysisId,
  payload: {
    resumeId: options.resumeId,
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

export class AIResumeExtractorService {
  constructor(private readonly provider: AIProvider = createDefaultProvider()) {}

  async processResumeText(input: {
    userId: string;
    resumeId: string;
    context: AuditContext;
  }) {
    const resume = await database.resume.findFirst({
      where: {
        id: input.resumeId,
        userId: input.userId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        resumeText: {
          select: {
            id: true,
            extractedText: true,
          },
        },
      },
    });

    if (!resume) {
      throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found");
    }

    if (!resume.resumeText?.extractedText) {
      throw new AppError(400, "RESUME_TEXT_REQUIRED", "Resume text must be extracted before AI processing");
    }

    const startedAt = performance.now();
    const firstAttempt = await this.tryExtract(resume.resumeText.extractedText, false);
    const result = firstAttempt.success
      ? firstAttempt
      : await this.tryExtract(resume.resumeText.extractedText, true);

    if (!result.success) {
      throw new AppError(
        422,
        "AI_RESPONSE_VALIDATION_FAILED",
        "AI response did not match the required resume analysis schema",
        result.details,
      );
    }

    const executionTimeMs = Math.round(performance.now() - startedAt);
    const confidence = calculateConfidence(result.data);

    const analysis = await database.$transaction(async (transaction) => {
      const createdAnalysis = await transaction.resumeAnalysis.create({
        data: {
          resumeId: resume.id,
          resumeTextId: resume.resumeText!.id,
          structuredData: result.data as Prisma.InputJsonValue,
          aiModel: result.model,
          promptVersion: RESUME_AI_PROMPT_VERSION,
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

      await skillNormalizerService.saveResumeNormalizedSkills({
        resumeId: resume.id,
        userId: input.userId,
        structuredData: result.data,
        transaction,
      });

      await transaction.auditEvent.create({
        data: auditData(input.context, {
          userId: input.userId,
          resumeId: resume.id,
          analysisId: createdAnalysis.id,
          confidence,
          aiModel: result.model,
        }),
      });

      const normalizedSkills = await transaction.normalizedSkill.findMany({
        where: {
          resumeId: resume.id,
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

  private async tryExtract(resumeText: string, retry: boolean): Promise<
    | { success: true; data: ResumeStructuredData; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(resumeText, retry));
      const parsed = parseJsonOnly(response.text);
      const validated = resumeStructuredDataSchema.parse(parsed);
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

export const getLatestResumeAnalysis = async (userId: string, resumeId: string) => {
  const resume = await database.resume.findFirst({
    where: {
      id: resumeId,
      userId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!resume) {
    throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found");
  }

  const analysis = await database.resumeAnalysis.findFirst({
    where: {
      resumeId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: analysisSelect,
    orderBy: { createdAt: "desc" },
  });

  if (!analysis) return null;

  const normalizedSkills = await database.normalizedSkill.findMany({
    where: {
      resumeId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: normalizedSkillSelect,
    orderBy: [{ category: "asc" }, { normalizedSkill: "asc" }],
  });

  return {
    analysis: {
      ...analysis,
      confidence: Number(analysis.confidence),
    },
    normalizedSkills: normalizedSkills.map((skill) => ({
      ...skill,
      confidence: Number(skill.confidence),
    })),
  };
};

export const aiResumeExtractorService = new AIResumeExtractorService();
