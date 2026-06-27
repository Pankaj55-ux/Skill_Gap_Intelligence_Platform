import { performance } from "node:perf_hooks";
import { z } from "zod";
import { env } from "../../config/environment.js";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus, UserRole } from "../../generated/prisma/client.js";
import {
  type AIInterviewEvaluation,
  type EvaluateInterviewAnswerInput,
  aiInterviewEvaluationSchema,
} from "./interview.schemas.js";

export const INTERVIEW_EVALUATION_PROMPT_VERSION = "interview-evaluation-v1";
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

interface AIInterviewEvaluationProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiInterviewEvaluationProvider implements AIInterviewEvaluationProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "AI interview evaluation requires GEMINI_API_KEY",
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
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to evaluate the interview answer");
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

const answerSelect = {
  id: true,
  userId: true,
  resumeId: true,
  question: true,
  answer: true,
  expectedTopics: true,
  answerType: true,
  submittedAt: true,
  createdAt: true,
  evaluation: {
    select: {
      id: true,
      score: true,
      strengths: true,
      weaknesses: true,
      missingConcepts: true,
      communicationScore: true,
      technicalScore: true,
      confidenceScore: true,
      improvementPlan: true,
      summary: true,
      aiModel: true,
      promptVersion: true,
      executionTimeMs: true,
      createdAt: true,
    },
  },
} satisfies Prisma.InterviewAnswerSelect;

type SelectedInterviewAnswer = Prisma.InterviewAnswerGetPayload<{ select: typeof answerSelect }>;

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

const normalizeEvaluation = (evaluation: AIInterviewEvaluation): AIInterviewEvaluation => ({
  strengths: uniqueStrings(evaluation.strengths),
  weaknesses: uniqueStrings(evaluation.weaknesses),
  missingConcepts: uniqueStrings(evaluation.missingConcepts),
  communicationScore: Math.round(evaluation.communicationScore * 100) / 100,
  technicalScore: Math.round(evaluation.technicalScore * 100) / 100,
  confidenceScore: Math.round(evaluation.confidenceScore * 100) / 100,
  improvementPlan: uniqueStrings(evaluation.improvementPlan),
  summary: evaluation.summary.trim(),
});

const calculateInterviewScore = (evaluation: AIInterviewEvaluation): number => Math.round((
  evaluation.technicalScore * 0.5
  + evaluation.communicationScore * 0.3
  + evaluation.confidenceScore * 0.2
) * 100) / 100;

const createPrompt = (input: {
  question: string;
  studentAnswer: string;
  expectedTopics: string[];
  resumeContext: string | null;
  retry: boolean;
}): string => `
You are evaluating a student's text interview answer.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "strengths": [],
  "weaknesses": [],
  "missingConcepts": [],
  "communicationScore": 0,
  "technicalScore": 0,
  "confidenceScore": 0,
  "improvementPlan": [],
  "summary": ""
}

Rules:
- Scores must be numbers from 0 to 100.
- Evaluate the answer, not the student personally.
- Compare against expectedTopics when provided.
- Use resume context only to understand background; do not invent experience.
- Voice, tone, and pronunciation are out of scope because this is text-only.
- Keep improvementPlan actionable and specific.
${input.retry ? "- Previous response failed schema validation. Return only valid JSON matching the schema." : ""}

Input:
{
  "question": ${JSON.stringify(input.question)},
  "studentAnswer": ${JSON.stringify(input.studentAnswer)},
  "expectedTopics": ${JSON.stringify(input.expectedTopics)},
  "resumeContext": ${JSON.stringify(input.resumeContext?.slice(0, 8_000) ?? null)}
}
`;

type EvaluationPromptInput = Omit<Parameters<typeof createPrompt>[0], "retry">;

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value * 100) / 100));

export const evaluateDeterministicAnswer = (input: EvaluationPromptInput): AIInterviewEvaluation => {
  const answer = input.studentAnswer.trim();
  const normalizedAnswer = answer.toLocaleLowerCase("en-US");
  const words = answer.split(/\s+/).filter(Boolean);
  const expectedTopics = uniqueStrings(input.expectedTopics);
  const coveredTopics = expectedTopics.filter((topic) => normalizedAnswer.includes(topic.toLocaleLowerCase("en-US")));
  const missingTopics = expectedTopics.filter((topic) => !coveredTopics.includes(topic));
  const coverage = expectedTopics.length > 0 ? coveredTopics.length / expectedTopics.length : 0.5;
  const detailFactor = Math.min(1, words.length / 120);
  const hasStructuredExample = /\b(situation|task|action|result|for example|because|therefore|first|then)\b/i.test(answer);

  const technicalScore = clampScore(35 + coverage * 45 + detailFactor * 20);
  const communicationScore = clampScore(40 + detailFactor * 45 + (hasStructuredExample ? 15 : 0));
  const confidenceScore = clampScore(45 + Math.min(40, words.length * 0.5) + (hasStructuredExample ? 10 : 0));
  const strengths = [
    ...(coveredTopics.length > 0 ? [`Addressed: ${coveredTopics.slice(0, 4).join(", ")}`] : []),
    ...(words.length >= 40 ? ["Provided a reasonably detailed response"] : []),
    ...(hasStructuredExample ? ["Used a structured explanation"] : []),
  ];
  const weaknesses = [
    ...(words.length < 40 ? ["The answer is too brief to demonstrate depth"] : []),
    ...(missingTopics.length > 0 ? [`Did not clearly cover: ${missingTopics.slice(0, 4).join(", ")}`] : []),
    ...(!hasStructuredExample ? ["The reasoning would be clearer with a structured example"] : []),
  ];
  const improvementPlan = [
    ...(missingTopics.length > 0 ? [`Review and explicitly address ${missingTopics.slice(0, 3).join(", ")}.`] : []),
    ...(words.length < 40 ? ["Expand the answer with context, decisions, and measurable results."] : []),
    ...(!hasStructuredExample ? ["Use a clear structure such as Situation, Task, Action, and Result."] : []),
  ];

  return normalizeEvaluation({
    strengths: strengths.length > 0 ? strengths : ["Answered the question directly"],
    weaknesses,
    missingConcepts: missingTopics,
    communicationScore,
    technicalScore,
    confidenceScore,
    improvementPlan: improvementPlan.length > 0 ? improvementPlan : ["Keep practicing concise, evidence-based answers."],
    summary: technicalScore >= 75
      ? "Strong answer with good topic coverage; refine it with precise examples and trade-offs."
      : technicalScore >= 55
        ? "The answer shows a workable foundation but needs broader topic coverage and clearer evidence."
        : "The answer needs more technical depth, structure, and explicit coverage of the expected concepts.",
  });
};

const toApiAnswer = (answer: SelectedInterviewAnswer) => ({
  ...answer,
  expectedTopics: Array.isArray(answer.expectedTopics)
    ? answer.expectedTopics.filter((item): item is string => typeof item === "string")
    : [],
  evaluation: answer.evaluation
    ? {
        ...answer.evaluation,
        score: Number(answer.evaluation.score),
        communicationScore: Number(answer.evaluation.communicationScore),
        technicalScore: Number(answer.evaluation.technicalScore),
        confidenceScore: Number(answer.evaluation.confidenceScore),
      }
    : null,
});

const auditData = (
  context: AuditContext,
  options: { userId: string; answerId: string; evaluationId: string; score: number; aiModel: string },
): Prisma.AuditEventCreateInput => ({
  action: "interview_answer_evaluated",
  entityType: "InterviewEvaluation",
  entityId: options.evaluationId,
  payload: {
    answerId: options.answerId,
    score: options.score,
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

export class InterviewEvaluationService {
  constructor(private readonly provider: AIInterviewEvaluationProvider = new GeminiInterviewEvaluationProvider()) {}

  async evaluateTextAnswer(
    userId: string,
    input: EvaluateInterviewAnswerInput,
    context: AuditContext,
  ) {
    const resume = input.resumeId
      ? await database.resume.findFirst({
          where: {
            id: input.resumeId,
            userId,
            status: RecordStatus.ACTIVE,
            deletedAt: null,
          },
          select: {
            id: true,
            resumeText: { select: { extractedText: true } },
            analyses: {
              where: { status: RecordStatus.ACTIVE, deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { structuredData: true },
            },
          },
        })
      : null;

    if (input.resumeId && !resume) {
      throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found for this student");
    }

    const resumeContext = resume
      ? JSON.stringify({
          extractedText: resume.resumeText?.extractedText?.slice(0, 6_000) ?? null,
          structuredData: resume.analyses[0]?.structuredData ?? null,
        })
      : null;

    const startedAt = performance.now();
    const promptInput = {
      question: input.question,
      studentAnswer: input.studentAnswer,
      expectedTopics: input.expectedTopics,
      resumeContext,
    };
    const generated = await this.evaluateWithFallback(promptInput);
    const result = generated.result;

    const executionTimeMs = Math.round(performance.now() - startedAt);
    const score = calculateInterviewScore(result.data);

    const saved = await database.$transaction(async (transaction) => {
      const answer = await transaction.interviewAnswer.create({
        data: {
          userId,
          resumeId: resume?.id,
          question: input.question,
          answer: input.studentAnswer,
          expectedTopics: input.expectedTopics,
          answerType: "TEXT",
          createdBy: userId,
          updatedBy: userId,
        },
        select: { id: true },
      });

      const evaluation = await transaction.interviewEvaluation.create({
        data: {
          answerId: answer.id,
          score,
          strengths: result.data.strengths as Prisma.InputJsonValue,
          weaknesses: result.data.weaknesses as Prisma.InputJsonValue,
          missingConcepts: result.data.missingConcepts as Prisma.InputJsonValue,
          communicationScore: result.data.communicationScore,
          technicalScore: result.data.technicalScore,
          confidenceScore: result.data.confidenceScore,
          improvementPlan: result.data.improvementPlan as Prisma.InputJsonValue,
          summary: result.data.summary,
          aiModel: result.model,
          promptVersion: INTERVIEW_EVALUATION_PROMPT_VERSION,
          executionTimeMs,
          createdBy: userId,
          updatedBy: userId,
          metadata: {
            retryUsed: generated.retryUsed,
            fallbackUsed: generated.fallbackUsed,
            scoreFormula: "technicalScore*0.5 + communicationScore*0.3 + confidenceScore*0.2",
          },
        },
        select: { id: true },
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          answerId: answer.id,
          evaluationId: evaluation.id,
          score,
          aiModel: result.model,
        }),
      });

      return transaction.interviewAnswer.findUniqueOrThrow({
        where: { id: answer.id },
        select: answerSelect,
      });
    });

    const apiAnswer = toApiAnswer(saved);

    return {
      score,
      strengths: result.data.strengths,
      weaknesses: result.data.weaknesses,
      missingConcepts: result.data.missingConcepts,
      communicationScore: result.data.communicationScore,
      technicalScore: result.data.technicalScore,
      confidenceScore: result.data.confidenceScore,
      improvementPlan: result.data.improvementPlan,
      summary: result.data.summary,
      answer: apiAnswer,
    };
  }

  async listHistory(actor: { id: string; role: UserRole }) {
    const where: Prisma.InterviewAnswerWhereInput = {
      deletedAt: null,
      ...(actor.role === UserRole.STUDENT ? { userId: actor.id } : {}),
    };

    const answers = await database.interviewAnswer.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 100,
      select: answerSelect,
    });

    return { history: answers.map(toApiAnswer) };
  }

  async getHistoryById(actor: { id: string; role: UserRole }, id: string) {
    const answer = await database.interviewAnswer.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(actor.role === UserRole.STUDENT ? { userId: actor.id } : {}),
      },
      select: answerSelect,
    });

    if (!answer) {
      throw new AppError(404, "INTERVIEW_ANSWER_NOT_FOUND", "Interview answer was not found");
    }

    return { answer: toApiAnswer(answer) };
  }

  private async tryEvaluate(promptInput: Parameters<typeof createPrompt>[0]): Promise<
    | { success: true; data: AIInterviewEvaluation; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(promptInput));
      const parsed = parseJsonOnly(response.text);
      const validated = aiInterviewEvaluationSchema.parse(parsed);
      return {
        success: true,
        data: normalizeEvaluation(validated),
        model: response.model,
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode >= 500) throw error;
      if (error instanceof z.ZodError) {
        return { success: false, details: error.flatten() };
      }
      return { success: false, details: null };
    }
  }

  private async evaluateWithFallback(input: EvaluationPromptInput): Promise<{
    result: { success: true; data: AIInterviewEvaluation; model: string };
    retryUsed: boolean;
    fallbackUsed: boolean;
  }> {
    try {
      const firstAttempt = await this.tryEvaluate({ ...input, retry: false });
      if (firstAttempt.success) {
        return { result: firstAttempt, retryUsed: false, fallbackUsed: false };
      }

      const secondAttempt = await this.tryEvaluate({ ...input, retry: true });
      if (secondAttempt.success) {
        return { result: secondAttempt, retryUsed: true, fallbackUsed: false };
      }
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw error;
    }

    return {
      result: {
        success: true,
        data: evaluateDeterministicAnswer(input),
        model: "deterministic-interview-evaluator-v1",
      },
      retryUsed: false,
      fallbackUsed: true,
    };
  }
}

export const interviewEvaluationService = new InterviewEvaluationService();
