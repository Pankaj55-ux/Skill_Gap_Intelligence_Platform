import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus } from "../../generated/prisma/client.js";
import { resumeStructuredDataSchema } from "../resume/ai-resume-extractor.service.js";
import {
  type ProjectRecommendationOutput,
  type ProjectRecommendationRequest,
  type RecommendedProject,
  projectRecommendationOutputSchema,
} from "./project-recommendation.schemas.js";

export const PROJECT_RECOMMENDATION_PROMPT_VERSION = "project-recommendation-v1";
const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AIProviderResult {
  text: string;
  model: string;
}

interface AIProjectRecommendationProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiProjectRecommendationProvider implements AIProjectRecommendationProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI project recommendations require GEMINI_API_KEY",
      );
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to generate project recommendations");
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

const parseJsonOnly = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(422, "AI_RESPONSE_NOT_JSON", "AI response was not valid JSON");
    return JSON.parse(match[0]);
  }
};

const uniqueStrings = (items: string[]): string[] => Array.from(new Set(
  items.map((item) => item.trim()).filter(Boolean),
));

const jsonStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
);

const skillNameFromGapItem = (item: unknown): string | null => {
  if (!item || typeof item !== "object") return null;
  const record = item as { skillName?: unknown; skill?: unknown; normalizedSkill?: unknown };
  const value = record.skillName ?? record.skill ?? record.normalizedSkill;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const gapSkillsFromJson = (value: unknown): string[] => (
  Array.isArray(value)
    ? uniqueStrings(value.map(skillNameFromGapItem).filter((item): item is string => Boolean(item)))
    : []
);

const normalizeKey = (value: string): string => value.trim().toLocaleLowerCase("en-US");

const coversMissingSkill = (project: RecommendedProject, missingSkills: string[]): boolean => {
  const covered = new Set(project.skillsCovered.map(normalizeKey));
  return missingSkills.some((skill) => covered.has(normalizeKey(skill)));
};

const normalizeProject = (
  project: RecommendedProject,
  difficulty: RecommendedProject["difficulty"],
): RecommendedProject => ({
  title: project.title.trim(),
  description: project.description.trim(),
  difficulty,
  estimatedWeeks: project.estimatedWeeks,
  skillsCovered: uniqueStrings(project.skillsCovered),
  githubTopics: uniqueStrings(project.githubTopics)
    .map((topic) => topic.toLocaleLowerCase("en-US").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean),
  learningOutcome: project.learningOutcome.trim(),
});

const enforceRecommendationRules = (
  data: ProjectRecommendationOutput,
  missingSkills: string[],
): ProjectRecommendationOutput => {
  const seenTitles = new Set<string>();

  const filterProjects = (
    projects: RecommendedProject[],
    difficulty: RecommendedProject["difficulty"],
  ): RecommendedProject[] => {
    const kept: RecommendedProject[] = [];

    for (const project of projects) {
      const normalized = normalizeProject(project, difficulty);
      const titleKey = normalizeKey(normalized.title);
      if (seenTitles.has(titleKey)) continue;
      if (!coversMissingSkill(normalized, missingSkills)) continue;
      seenTitles.add(titleKey);
      kept.push(normalized);
    }

    return kept;
  };

  const recommendations = {
    beginnerProjects: filterProjects(data.beginnerProjects, "BEGINNER"),
    intermediateProjects: filterProjects(data.intermediateProjects, "INTERMEDIATE"),
    advancedProjects: filterProjects(data.advancedProjects, "ADVANCED"),
  };

  const totalProjects = recommendations.beginnerProjects.length
    + recommendations.intermediateProjects.length
    + recommendations.advancedProjects.length;
  if (totalProjects === 0) {
    throw new AppError(
      422,
      "PROJECT_RECOMMENDATIONS_INVALID",
      "AI did not return any unique project that addresses at least one missing skill",
    );
  }

  return recommendations;
};

const calculateConfidence = (recommendations: ProjectRecommendationOutput): number => {
  const counts = [
    recommendations.beginnerProjects.length,
    recommendations.intermediateProjects.length,
    recommendations.advancedProjects.length,
  ];
  const populatedBuckets = counts.filter((count) => count > 0).length;
  const totalProjects = counts.reduce((sum, count) => sum + count, 0);
  const bucketScore = populatedBuckets / 3;
  const volumeScore = Math.min(totalProjects / 9, 1);
  return Math.round(((bucketScore * 0.6) + (volumeScore * 0.4)) * 10000) / 100;
};

const roadmapPlanSummary = (plan: unknown): string => {
  try {
    return JSON.stringify(plan).slice(0, 5_000);
  } catch {
    return "";
  }
};

const createPrompt = (input: {
  targetRole: string;
  studentSkills: string[];
  missingSkills: string[];
  weakSkills: string[];
  roadmapPlan: unknown;
  resumeSummary: unknown;
  latestMatch: { matchScore: number; roleFitSummary: string | null } | null;
  retry: boolean;
}): string => `
You are recommending real-world portfolio projects for a skill gap intelligence platform.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "beginnerProjects": [
    {
      "title": "",
      "description": "",
      "difficulty": "BEGINNER",
      "estimatedWeeks": 1,
      "skillsCovered": [],
      "githubTopics": [],
      "learningOutcome": ""
    }
  ],
  "intermediateProjects": [],
  "advancedProjects": []
}

Rules:
- AI only recommends projects. Do not calculate scores.
- Recommend practical real-world projects for the target role.
- Every project must include at least one skill from missingSkills in skillsCovered.
- Do not duplicate project titles.
- Use difficulty exactly as BEGINNER, INTERMEDIATE, or ADVANCED.
- githubTopics must be lowercase topic-like strings.
- Keep each description implementation-focused and specific.
${input.retry ? "- Previous response failed validation. Return only valid JSON that satisfies every rule." : ""}

Context:
{
  "targetRole": ${JSON.stringify(input.targetRole)},
  "studentSkills": ${JSON.stringify(input.studentSkills.slice(0, 80))},
  "missingSkills": ${JSON.stringify(input.missingSkills.slice(0, 30))},
  "weakSkills": ${JSON.stringify(input.weakSkills.slice(0, 30))},
  "latestMatch": ${JSON.stringify(input.latestMatch)},
  "roadmapPlan": ${JSON.stringify(roadmapPlanSummary(input.roadmapPlan))},
  "resumeAnalysisSummary": ${JSON.stringify(input.resumeSummary)}
}
`;

const auditData = (
  context: AuditContext,
  options: {
    userId: string;
    recommendationId: string;
    resumeAnalysisId: string;
    roadmapId: string;
    aiModel: string;
  },
): Prisma.AuditEventCreateInput => ({
  action: "project_recommendation_generated",
  entityType: "ProjectRecommendation",
  entityId: options.recommendationId,
  payload: {
    resumeAnalysisId: options.resumeAnalysisId,
    roadmapId: options.roadmapId,
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

export class AIProjectRecommendationService {
  constructor(private readonly provider: AIProjectRecommendationProvider = new GeminiProjectRecommendationProvider()) {}

  async recommendForStudent(
    userId: string,
    input: ProjectRecommendationRequest,
    context: AuditContext,
  ): Promise<ProjectRecommendationOutput> {
    const [resumeAnalysis, roadmap] = await Promise.all([
      database.resumeAnalysis.findFirst({
        where: {
          id: input.resumeAnalysisId,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          resume: {
            userId,
            status: RecordStatus.ACTIVE,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          resumeId: true,
          structuredData: true,
        },
      }),
      database.roadmap.findFirst({
        where: {
          id: input.roadmapId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          plan: true,
          gapReport: {
            select: {
              missingSkills: true,
              weakSkills: true,
            },
          },
        },
      }),
    ]);

    if (!resumeAnalysis) {
      throw new AppError(404, "RESUME_ANALYSIS_NOT_FOUND", "Resume analysis was not found for this student");
    }

    if (!roadmap) {
      throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap was not found for this student");
    }

    const latestMatch = await database.resumeJobMatch.findFirst({
      where: {
        userId,
        resumeId: resumeAnalysis.resumeId,
        status: RecordStatus.COMPLETED,
        deletedAt: null,
      },
      orderBy: { generatedAt: "desc" },
      select: {
        matchScore: true,
        missingSkills: true,
        weakSkills: true,
        matchedSkills: true,
        roleFitSummary: true,
      },
    });

    const resumeData = resumeStructuredDataSchema.parse(resumeAnalysis.structuredData);
    const studentSkills = uniqueStrings([
      ...resumeData.technicalSkills,
      ...resumeData.frameworks,
      ...resumeData.databases,
      ...resumeData.cloud,
      ...resumeData.tools,
      ...resumeData.programmingLanguages,
      ...resumeData.softSkills,
      ...resumeData.certifications,
    ]);
    const missingSkills = uniqueStrings([
      ...jsonStringArray(latestMatch?.missingSkills),
      ...gapSkillsFromJson(roadmap.gapReport?.missingSkills),
    ]);
    const weakSkills = uniqueStrings([
      ...jsonStringArray(latestMatch?.weakSkills),
      ...gapSkillsFromJson(roadmap.gapReport?.weakSkills),
    ]);

    if (missingSkills.length === 0) {
      throw new AppError(
        400,
        "MISSING_SKILLS_REQUIRED",
        "Project recommendations require at least one missing skill from a job match or roadmap gap report",
      );
    }

    const startedAt = performance.now();
    const firstAttempt = await this.tryGenerate({
      targetRole: input.targetRole,
      studentSkills,
      missingSkills,
      weakSkills,
      roadmapPlan: roadmap.plan,
      resumeSummary: {
        projects: resumeData.projects,
        internships: resumeData.internships,
        education: resumeData.education,
        achievements: resumeData.achievements,
      },
      latestMatch: latestMatch
        ? {
            matchScore: Number(latestMatch.matchScore),
            roleFitSummary: latestMatch.roleFitSummary,
          }
        : null,
      retry: false,
    }, missingSkills);

    const result = firstAttempt.success
      ? firstAttempt
      : await this.tryGenerate({
          targetRole: input.targetRole,
          studentSkills,
          missingSkills,
          weakSkills,
          roadmapPlan: roadmap.plan,
          resumeSummary: {
            projects: resumeData.projects,
            internships: resumeData.internships,
            education: resumeData.education,
            achievements: resumeData.achievements,
          },
          latestMatch: latestMatch
            ? {
                matchScore: Number(latestMatch.matchScore),
                roleFitSummary: latestMatch.roleFitSummary,
              }
            : null,
          retry: true,
        }, missingSkills);

    if (!result.success) {
      throw new AppError(
        422,
        "PROJECT_RECOMMENDATION_VALIDATION_FAILED",
        "AI response did not match the required project recommendation schema",
        result.details,
      );
    }

    const executionTimeMs = Math.round(performance.now() - startedAt);
    const confidence = calculateConfidence(result.data);

    await database.$transaction(async (transaction) => {
      const saved = await transaction.projectRecommendation.create({
        data: {
          userId,
          resumeAnalysisId: resumeAnalysis.id,
          roadmapId: roadmap.id,
          targetRole: input.targetRole,
          recommendations: result.data as Prisma.InputJsonValue,
          aiModel: result.model,
          promptVersion: PROJECT_RECOMMENDATION_PROMPT_VERSION,
          executionTimeMs,
          confidence,
          createdBy: userId,
          updatedBy: userId,
          metadata: {
            retryUsed: !firstAttempt.success,
            missingSkills,
            weakSkills,
            latestMatchUsed: Boolean(latestMatch),
          },
        },
        select: { id: true },
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          recommendationId: saved.id,
          resumeAnalysisId: resumeAnalysis.id,
          roadmapId: roadmap.id,
          aiModel: result.model,
        }),
      });
    });

    return result.data;
  }

  private async tryGenerate(
    promptInput: Parameters<typeof createPrompt>[0],
    missingSkills: string[],
  ): Promise<
    | { success: true; data: ProjectRecommendationOutput; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(promptInput));
      const parsed = parseJsonOnly(response.text);
      const validated = projectRecommendationOutputSchema.parse(parsed);
      return {
        success: true,
        data: enforceRecommendationRules(validated, missingSkills),
        model: response.model,
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode >= 500) throw error;
      if (error instanceof AppError) {
        return { success: false, details: error.details };
      }
      if (error instanceof z.ZodError) {
        return { success: false, details: error.flatten() };
      }
      return { success: false, details: null };
    }
  }
}

export const aiProjectRecommendationService = new AIProjectRecommendationService();
