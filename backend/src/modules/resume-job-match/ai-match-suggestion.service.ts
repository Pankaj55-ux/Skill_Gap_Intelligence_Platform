import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { AuditContext } from "./match.service.js";

export const AI_MATCH_SUGGESTION_PROMPT_VERSION = "match-suggestion-v1";
const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "deterministic-fallback";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

const stringListSchema = z.array(z.string().trim().min(1).max(300)).max(20).default([]);

export const aiMatchSuggestionSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  priorityActions: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    reason: z.string().trim().min(1).max(500),
    estimatedTime: z.string().trim().min(1).max(80),
    relatedSkills: stringListSchema,
  }).strict()).max(8).default([]),
  resumeFixes: stringListSchema,
  projectSuggestions: stringListSchema,
  interviewPreparationTips: stringListSchema,
}).strict();

export type AIMatchSuggestion = z.infer<typeof aiMatchSuggestionSchema>;

interface AIProviderResult {
  text: string;
  model: string;
}

interface AIMatchSuggestionProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiMatchSuggestionProvider implements AIMatchSuggestionProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new Error("AI provider failed");
    }

    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI provider returned an empty response");

    return { text, model: DEFAULT_AI_MODEL };
  }
}

export interface GenerateMatchSuggestionInput {
  actorId: string;
  userId: string;
  matchId: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  weakSkills: string[];
  targetRole: string;
  jobDescriptionSummary: string;
  context: AuditContext;
}

const parseJsonOnly = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response was not valid JSON");
    return JSON.parse(match[0]);
  }
};

const uniqueStrings = (items: string[]): string[] => Array.from(new Set(
  items.map((item) => item.trim()).filter(Boolean),
));

const normalizeSuggestion = (suggestion: AIMatchSuggestion): AIMatchSuggestion => ({
  summary: suggestion.summary.trim(),
  priorityActions: suggestion.priorityActions.map((action) => ({
    title: action.title.trim(),
    reason: action.reason.trim(),
    estimatedTime: action.estimatedTime.trim(),
    relatedSkills: uniqueStrings(action.relatedSkills),
  })),
  resumeFixes: uniqueStrings(suggestion.resumeFixes),
  projectSuggestions: uniqueStrings(suggestion.projectSuggestions),
  interviewPreparationTips: uniqueStrings(suggestion.interviewPreparationTips),
});

const calculateConfidence = (suggestion: AIMatchSuggestion, fallbackUsed: boolean): number => {
  if (fallbackUsed) return 65;
  const populated = [
    suggestion.summary,
    suggestion.priorityActions,
    suggestion.resumeFixes,
    suggestion.projectSuggestions,
    suggestion.interviewPreparationTips,
  ].filter((value) => Array.isArray(value) ? value.length > 0 : value.trim().length > 0).length;

  return Math.round((populated / 5) * 10000) / 100;
};

const fallbackSuggestion = (input: GenerateMatchSuggestionInput): AIMatchSuggestion => {
  const focusSkills = input.missingSkills.length > 0
    ? input.missingSkills
    : input.weakSkills.length > 0
      ? input.weakSkills
      : input.matchedSkills.slice(0, 3);

  return {
    summary: input.matchScore >= 75
      ? `You are close to the ${input.targetRole} requirements. Improve evidence quality and make matched skills easier to spot.`
      : `Focus first on the largest skill gaps for ${input.targetRole}, then add resume proof through projects and interview examples.`,
    priorityActions: [
      {
        title: "Close the highest-impact skill gaps",
        reason: input.missingSkills.length > 0
          ? "Missing required skills reduce the deterministic match score the most."
          : "Your core skills are present, so the next gain comes from stronger proof.",
        estimatedTime: "1-3 weeks",
        relatedSkills: focusSkills.slice(0, 5),
      },
      {
        title: "Add evidence-backed resume bullets",
        reason: "The matcher rewards clear projects, internships, certifications, and education support.",
        estimatedTime: "2-4 hours",
        relatedSkills: uniqueStrings([...input.weakSkills, ...input.matchedSkills]).slice(0, 5),
      },
    ],
    resumeFixes: [
      "Add a dedicated skills section using the same wording as the job description where truthful.",
      "Rewrite project bullets to include role-relevant tools, measurable outcomes, and ownership.",
      "Move the most relevant projects and internships closer to the top of the resume.",
    ],
    projectSuggestions: focusSkills.length > 0
      ? [`Build or improve one project that demonstrates ${focusSkills.slice(0, 3).join(", ")} together.`]
      : ["Add a compact project that demonstrates the target role responsibilities end-to-end."],
    interviewPreparationTips: [
      "Prepare one STAR-format story for each matched core skill.",
      "Practice explaining trade-offs, debugging decisions, and measurable project impact.",
    ],
  };
};

const createPrompt = (input: GenerateMatchSuggestionInput, retry = false): string => `
You are generating improvement suggestions for a resume-to-job match.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "summary": "",
  "priorityActions": [
    {
      "title": "",
      "reason": "",
      "estimatedTime": "",
      "relatedSkills": []
    }
  ],
  "resumeFixes": [],
  "projectSuggestions": [],
  "interviewPreparationTips": []
}

Rules:
- Do not calculate, alter, reinterpret, or mention a different match score.
- Use the given matchScore only as context for tone and prioritization.
- Suggest concrete actions based only on provided matched/missing/weak skills and job summary.
- Do not claim the candidate has skills that are listed as missing.
- Every array must contain strings, except priorityActions which must contain action objects.
${retry ? "- Previous response failed schema validation. Return only a valid object matching the schema." : ""}

Input:
{
  "matchScore": ${input.matchScore},
  "targetRole": ${JSON.stringify(input.targetRole)},
  "matchedSkills": ${JSON.stringify(input.matchedSkills)},
  "missingSkills": ${JSON.stringify(input.missingSkills)},
  "weakSkills": ${JSON.stringify(input.weakSkills)},
  "jobDescriptionSummary": ${JSON.stringify(input.jobDescriptionSummary.slice(0, 4_000))}
}
`;

const auditData = (
  context: AuditContext,
  options: {
    actorId: string;
    userId: string;
    suggestionId: string;
    matchId: string;
    aiModel: string;
    fallbackUsed: boolean;
  },
): Prisma.AuditEventCreateInput => ({
  action: "ai_match_suggestions_generated",
  entityType: "AIMatchSuggestion",
  entityId: options.suggestionId,
  payload: {
    matchId: options.matchId,
    aiModel: options.aiModel,
    fallbackUsed: options.fallbackUsed,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.actorId } },
});

export class AIMatchSuggestionService {
  constructor(private readonly provider: AIMatchSuggestionProvider = new GeminiMatchSuggestionProvider()) {}

  async generateAndStore(input: GenerateMatchSuggestionInput) {
    const startedAt = performance.now();
    const firstAttempt = await this.tryGenerate(input, false);
    const result = firstAttempt.success
      ? firstAttempt
      : await this.tryGenerate(input, true);
    const fallbackUsed = !result.success;
    const suggestion = fallbackUsed
      ? fallbackSuggestion(input)
      : result.data;
    const aiModel = fallbackUsed ? FALLBACK_MODEL : result.model;
    const executionTimeMs = Math.round(performance.now() - startedAt);
    const confidence = calculateConfidence(suggestion, fallbackUsed);

    const saved = await database.$transaction(async (transaction) => {
      const createdSuggestion = await transaction.aIMatchSuggestion.create({
        data: {
          matchId: input.matchId,
          suggestion: suggestion as Prisma.InputJsonValue,
          aiModel,
          promptVersion: AI_MATCH_SUGGESTION_PROMPT_VERSION,
          executionTimeMs,
          confidence,
          createdBy: input.actorId,
          updatedBy: input.actorId,
          metadata: {
            fallbackUsed,
            validationRetryUsed: !firstAttempt.success && !fallbackUsed,
          },
        },
        select: {
          id: true,
          matchId: true,
          suggestion: true,
          aiModel: true,
          promptVersion: true,
          executionTimeMs: true,
          confidence: true,
          generatedAt: true,
        },
      });

      await transaction.auditEvent.create({
        data: auditData(input.context, {
          actorId: input.actorId,
          userId: input.userId,
          suggestionId: createdSuggestion.id,
          matchId: input.matchId,
          aiModel,
          fallbackUsed,
        }),
      });

      return createdSuggestion;
    });

    return {
      ...saved,
      suggestion,
      confidence: Number(saved.confidence),
      fallbackUsed,
    };
  }

  private async tryGenerate(input: GenerateMatchSuggestionInput, retry: boolean): Promise<
    | { success: true; data: AIMatchSuggestion; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(input, retry));
      const parsed = parseJsonOnly(response.text);
      const validated = aiMatchSuggestionSchema.parse(parsed);
      return {
        success: true,
        data: normalizeSuggestion(validated),
        model: response.model,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, details: error.flatten() };
      }
      return { success: false, details: null };
    }
  }
}

export const aiMatchSuggestionService = new AIMatchSuggestionService();
