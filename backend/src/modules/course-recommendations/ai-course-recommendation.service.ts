import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  type CourseRecommendationItem,
  type CourseRecommendationOutput,
  type CourseRecommendationRequest,
  type UpdateCourseRecommendationItemState,
  courseRecommendationOutputSchema,
} from "./course-recommendation.schemas.js";

export const COURSE_RECOMMENDATION_PROMPT_VERSION = "course-recommendation-v1";
const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

const FREE_PROVIDER_RANK = new Map<string, number>([
  ["freeCodeCamp", 0],
  ["Microsoft Learn", 1],
  ["AWS Skill Builder", 2],
  ["Google Cloud Skills Boost", 3],
  ["NPTEL", 4],
  ["YouTube", 5],
  ["Coursera", 6],
  ["Udemy", 7],
]);

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AIProviderResult {
  text: string;
  model: string;
}

interface AICourseRecommendationProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiCourseRecommendationProvider implements AICourseRecommendationProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI course recommendations require GEMINI_API_KEY",
      );
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to generate course recommendations");
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

type RoadmapPlanItem = {
  priority?: string;
  skillsCovered?: unknown;
  orderNumber?: number;
};

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

const normalizeKey = (value: string): string => value.trim().toLocaleLowerCase("en-US");

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

const roadmapPhasesFromPlan = (plan: unknown): RoadmapPlanItem[] => {
  if (!plan || typeof plan !== "object") return [];
  const phases = (plan as { phases?: unknown }).phases;
  return Array.isArray(phases)
    ? phases.filter((item): item is RoadmapPlanItem => typeof item === "object" && item !== null)
    : [];
};

const priorityRankFor = (priority: string | undefined): number => {
  switch (priority) {
    case "HIGH": return 0;
    case "MEDIUM": return 1;
    case "LOW": return 2;
    case "FINAL": return 3;
    default: return 4;
  }
};

const roadmapSkillPriority = (plan: unknown): Map<string, number> => {
  const priority = new Map<string, number>();
  for (const phase of roadmapPhasesFromPlan(plan)) {
    const skills = jsonStringArray(phase.skillsCovered);
    const rank = priorityRankFor(phase.priority) * 100 + (phase.orderNumber ?? 0);
    for (const skill of skills) {
      const key = normalizeKey(skill);
      const existing = priority.get(key);
      if (existing === undefined || rank < existing) priority.set(key, rank);
    }
  }
  return priority;
};

const bestSkillPriorityFor = (course: CourseRecommendationItem, priority: Map<string, number>): number => {
  const ranks = course.skillsCovered
    .map((skill) => priority.get(normalizeKey(skill)))
    .filter((rank): rank is number => typeof rank === "number");
  return ranks.length > 0 ? Math.min(...ranks) : 999;
};

const normalizeCourse = (course: CourseRecommendationItem): CourseRecommendationItem => ({
  title: course.title.trim(),
  provider: course.provider,
  level: course.level,
  duration: course.duration.trim(),
  url: course.url.trim(),
  skillsCovered: uniqueStrings(course.skillsCovered),
  reason: course.reason.trim(),
});

const enforceRecommendationRules = (
  data: CourseRecommendationOutput,
  skillPriority: Map<string, number>,
): CourseRecommendationOutput => {
  const seen = new Set<string>();
  const courses: CourseRecommendationItem[] = [];

  for (const item of data.recommendations) {
    const course = normalizeCourse(item);
    const key = `${normalizeKey(course.provider)}:${normalizeKey(course.title)}`;
    const urlKey = normalizeKey(course.url);
    if (seen.has(key) || seen.has(urlKey)) continue;
    seen.add(key);
    seen.add(urlKey);
    courses.push(course);
  }

  courses.sort((a, b) => {
    const skillRank = bestSkillPriorityFor(a, skillPriority) - bestSkillPriorityFor(b, skillPriority);
    if (skillRank !== 0) return skillRank;
    const providerRank = (FREE_PROVIDER_RANK.get(a.provider) ?? 99) - (FREE_PROVIDER_RANK.get(b.provider) ?? 99);
    if (providerRank !== 0) return providerRank;
    return a.title.localeCompare(b.title);
  });

  if (courses.length === 0) {
    throw new AppError(
      422,
      "COURSE_RECOMMENDATIONS_INVALID",
      "AI did not return any valid unique course recommendations",
    );
  }

  return { recommendations: courses };
};

const calculateConfidence = (recommendations: CourseRecommendationOutput): number => {
  const providers = new Set(recommendations.recommendations.map((item) => item.provider)).size;
  const total = recommendations.recommendations.length;
  const providerDiversity = Math.min(providers / 5, 1);
  const volume = Math.min(total / 12, 1);
  return Math.round(((providerDiversity * 0.45) + (volume * 0.55)) * 10000) / 100;
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
  missingSkills: string[];
  weakSkills: string[];
  roadmapPlan: unknown;
  retry: boolean;
}): string => `
You are recommending learning resources for a skill gap intelligence platform.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "recommendations": [
    {
      "title": "",
      "provider": "freeCodeCamp",
      "level": "BEGINNER",
      "duration": "",
      "url": "",
      "skillsCovered": [],
      "reason": ""
    }
  ]
}

Allowed providers only:
- YouTube
- Coursera
- Udemy
- freeCodeCamp
- NPTEL
- Microsoft Learn
- AWS Skill Builder
- Google Cloud Skills Boost

Rules:
- AI recommends courses/resources only.
- Prefer free resources first when suitable.
- Include official provider URLs when possible.
- Every recommendation must cover at least one skill from missingSkills or weakSkills.
- Sort recommendations according to roadmap priority: high-priority skills first.
- Do not duplicate title/provider or URLs.
- level must be BEGINNER, INTERMEDIATE, or ADVANCED.
${input.retry ? "- Previous response failed validation. Return only valid JSON that satisfies the schema and provider list." : ""}

Context:
{
  "targetRole": ${JSON.stringify(input.targetRole)},
  "missingSkills": ${JSON.stringify(input.missingSkills.slice(0, 40))},
  "weakSkills": ${JSON.stringify(input.weakSkills.slice(0, 40))},
  "roadmapPlan": ${JSON.stringify(roadmapPlanSummary(input.roadmapPlan))}
}
`;

const auditData = (
  context: AuditContext,
  options: {
    userId: string;
    recommendationId: string;
    roadmapId: string;
    aiModel: string;
  },
): Prisma.AuditEventCreateInput => ({
  action: "course_recommendation_generated",
  entityType: "CourseRecommendation",
  entityId: options.recommendationId,
  payload: {
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

export class AICourseRecommendationService {
  constructor(private readonly provider: AICourseRecommendationProvider = new GeminiCourseRecommendationProvider()) {}

  async recommendForStudent(
    userId: string,
    input: CourseRecommendationRequest,
    context: AuditContext,
  ): Promise<CourseRecommendationOutput> {
    const roadmap = await database.roadmap.findFirst({
      where: {
        id: input.roadmapId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        plan: true,
        careerRole: {
          select: {
            title: true,
          },
        },
        gapReport: {
          select: {
            missingSkills: true,
            weakSkills: true,
          },
        },
      },
    });

    if (!roadmap) {
      throw new AppError(404, "ROADMAP_NOT_FOUND", "Roadmap was not found for this student");
    }

    const skillPriority = roadmapSkillPriority(roadmap.plan);
    const missingSkills = uniqueStrings([
      ...gapSkillsFromJson(roadmap.gapReport?.missingSkills),
      ...Array.from(skillPriority.keys()),
    ]);
    const weakSkills = gapSkillsFromJson(roadmap.gapReport?.weakSkills);

    if (missingSkills.length === 0 && weakSkills.length === 0) {
      throw new AppError(
        400,
        "SKILL_GAPS_REQUIRED",
        "Course recommendations require roadmap skills or gap report skills",
      );
    }

    const startedAt = performance.now();
    const firstAttempt = await this.tryGenerate({
      targetRole: roadmap.careerRole.title,
      missingSkills,
      weakSkills,
      roadmapPlan: roadmap.plan,
      retry: false,
    }, skillPriority);
    const result = firstAttempt.success
      ? firstAttempt
      : await this.tryGenerate({
          targetRole: roadmap.careerRole.title,
          missingSkills,
          weakSkills,
          roadmapPlan: roadmap.plan,
          retry: true,
        }, skillPriority);

    if (!result.success) {
      throw new AppError(
        422,
        "COURSE_RECOMMENDATION_VALIDATION_FAILED",
        "AI response did not match the required course recommendation schema",
        result.details,
      );
    }

    const executionTimeMs = Math.round(performance.now() - startedAt);
    const confidence = calculateConfidence(result.data);

    await database.$transaction(async (transaction) => {
      const saved = await transaction.courseRecommendation.create({
        data: {
          userId,
          roadmapId: roadmap.id,
          targetRole: roadmap.careerRole.title,
          recommendations: result.data as Prisma.InputJsonValue,
          aiModel: result.model,
          promptVersion: COURSE_RECOMMENDATION_PROMPT_VERSION,
          executionTimeMs,
          confidence,
          createdBy: userId,
          updatedBy: userId,
          metadata: {
            retryUsed: !firstAttempt.success,
            missingSkills,
            weakSkills,
            prioritizedFreeProviders: true,
          },
        },
        select: { id: true },
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          recommendationId: saved.id,
          roadmapId: roadmap.id,
          aiModel: result.model,
        }),
      });
    });

    return result.data;
  }

  private async tryGenerate(
    promptInput: Parameters<typeof createPrompt>[0],
    skillPriority: Map<string, number>,
  ): Promise<
    | { success: true; data: CourseRecommendationOutput; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(promptInput));
      const parsed = parseJsonOnly(response.text);
      const validated = courseRecommendationOutputSchema.parse(parsed);
      return {
        success: true,
        data: enforceRecommendationRules(validated, skillPriority),
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

export const aiCourseRecommendationService = new AICourseRecommendationService();

const courseRecommendationSelect = {
  id: true,
  userId: true,
  roadmapId: true,
  targetRole: true,
  recommendations: true,
  aiModel: true,
  promptVersion: true,
  executionTimeMs: true,
  confidence: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  metadata: true,
  roadmap: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
} satisfies Prisma.CourseRecommendationSelect;

type SelectedCourseRecommendation = Prisma.CourseRecommendationGetPayload<{
  select: typeof courseRecommendationSelect;
}>;

const itemStatesFromMetadata = (metadata: Prisma.JsonValue | null) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const itemStates = (metadata as { itemStates?: unknown }).itemStates;
  return itemStates && typeof itemStates === "object" && !Array.isArray(itemStates)
    ? itemStates as Record<string, unknown>
    : {};
};

const normalizeRecommendationRecord = (recommendation: SelectedCourseRecommendation) => ({
  ...recommendation,
  confidence: Number(recommendation.confidence),
  recommendations: courseRecommendationOutputSchema.parse(recommendation.recommendations),
  itemStates: itemStatesFromMetadata(recommendation.metadata),
});

export const listOwnCourseRecommendations = async (userId: string) => {
  const recommendations = await database.courseRecommendation.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: courseRecommendationSelect,
    orderBy: { generatedAt: "desc" },
  });

  return recommendations.map(normalizeRecommendationRecord);
};

export const updateCourseRecommendationItemState = async (
  userId: string,
  recommendationId: string,
  input: UpdateCourseRecommendationItemState,
  context: AuditContext,
) => {
  const recommendation = await database.courseRecommendation.findFirst({
    where: {
      id: recommendationId,
      userId,
      deletedAt: null,
    },
    select: courseRecommendationSelect,
  });

  if (!recommendation) {
    throw new AppError(404, "COURSE_RECOMMENDATION_NOT_FOUND", "Course recommendation was not found");
  }

  const existingMetadata = recommendation.metadata
    && typeof recommendation.metadata === "object"
    && !Array.isArray(recommendation.metadata)
    ? recommendation.metadata as Prisma.JsonObject
    : {};
  const existingStates = itemStatesFromMetadata(recommendation.metadata);
  const previousState = existingStates[input.courseKey]
    && typeof existingStates[input.courseKey] === "object"
    && !Array.isArray(existingStates[input.courseKey])
    ? existingStates[input.courseKey] as Record<string, unknown>
    : {};
  const completed = input.completed ?? (typeof previousState.completed === "boolean" ? previousState.completed : false);
  const progressPercentage = input.progressPercentage ?? (completed ? 100 : (
    typeof previousState.progressPercentage === "number" ? previousState.progressPercentage : 0
  ));
  const nextState = {
    ...previousState,
    bookmarked: input.bookmarked ?? (typeof previousState.bookmarked === "boolean" ? previousState.bookmarked : false),
    completed,
    progressPercentage: completed ? 100 : progressPercentage,
    updatedAt: new Date().toISOString(),
  };
  const itemStates = {
    ...existingStates,
    [input.courseKey]: nextState,
  } as Prisma.InputJsonObject;
  const metadata: Prisma.InputJsonObject = {
    ...existingMetadata,
    itemStates,
  };

  const updated = await database.$transaction(async (transaction) => {
    await transaction.courseRecommendation.update({
      where: { id: recommendation.id },
      data: {
        metadata,
        updatedBy: userId,
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: {
        action: "course_recommendation_item_state_updated",
        entityType: "CourseRecommendation",
        entityId: recommendation.id,
        payload: {
          courseKey: input.courseKey,
          state: nextState,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { requestId: context.requestId },
        createdBy: userId,
        updatedBy: userId,
        user: { connect: { id: userId } },
        actor: { connect: { id: userId } },
      },
    });

    return transaction.courseRecommendation.findUniqueOrThrow({
      where: { id: recommendation.id },
      select: courseRecommendationSelect,
    });
  });

  return normalizeRecommendationRecord(updated);
};
