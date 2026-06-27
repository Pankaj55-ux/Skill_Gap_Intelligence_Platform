import type { Express } from "express";
import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, RecordStatus, UserRole } from "../../generated/prisma/client.js";
import { interviewEvaluationService } from "../interview-evaluation/interview-evaluation.service.js";
import type { SubmitTextAnswerInput, StartInterviewSessionInput } from "./live-interview.schemas.js";
import { questionGeneratorService } from "./question-generator.service.js";
import { speechService } from "./speech.service.js";
import { transcriptService } from "./transcript.service.js";
import { validateAudioSignature } from "./voice-answer-upload.middleware.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const sessionSelect = {
  id: true,
  userId: true,
  resumeId: true,
  targetRole: true,
  status: true,
  durationMinutes: true,
  startedAt: true,
  pausedAt: true,
  resumedAt: true,
  endedAt: true,
  elapsedSeconds: true,
  expectedTopics: true,
  metadata: true,
  finalReport: true,
  createdAt: true,
  turns: {
    orderBy: { turnNumber: "asc" },
    select: {
      id: true,
      turnNumber: true,
      question: true,
      expectedTopics: true,
      questionAudio: true,
      answerText: true,
      answerMode: true,
      answerAudio: true,
      transcript: true,
      askedAt: true,
      answeredAt: true,
      interviewAnswer: {
        select: {
          id: true,
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
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InterviewSessionSelect;

type SelectedSession = Prisma.InterviewSessionGetPayload<{ select: typeof sessionSelect }>;

const expectedTopicsFromJson = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const questionCountFrom = (session: {
  metadata: unknown;
  expectedTopics: unknown;
}): number => {
  if (
    typeof session.metadata === "object"
    && session.metadata !== null
    && !Array.isArray(session.metadata)
  ) {
    const configured = (session.metadata as { questionCount?: unknown }).questionCount;
    if (typeof configured === "number" && Number.isInteger(configured) && configured > 0) {
      return Math.min(configured, 25);
    }
  }

  const legacyTopic = expectedTopicsFromJson(session.expectedTopics)
    .find((topic) => topic.startsWith("Question count target:"));
  const legacyCount = Number(legacyTopic?.replace("Question count target:", "").trim());
  return Number.isInteger(legacyCount) && legacyCount > 0 ? Math.min(legacyCount, 25) : 8;
};

const toApiSession = (session: SelectedSession) => ({
  ...session,
  expectedTopics: expectedTopicsFromJson(session.expectedTopics),
  elapsedSeconds: elapsedSecondsFor(session),
  remainingSeconds: Math.max(0, session.durationMinutes * 60 - elapsedSecondsFor(session)),
  turns: session.turns.map((turn) => ({
    ...turn,
    expectedTopics: expectedTopicsFromJson(turn.expectedTopics),
    evaluation: turn.interviewAnswer?.evaluation
      ? {
          ...turn.interviewAnswer.evaluation,
          score: Number(turn.interviewAnswer.evaluation.score),
          communicationScore: Number(turn.interviewAnswer.evaluation.communicationScore),
          technicalScore: Number(turn.interviewAnswer.evaluation.technicalScore),
          confidenceScore: Number(turn.interviewAnswer.evaluation.confidenceScore),
        }
      : null,
  })),
});

const elapsedSecondsFor = (session: {
  status: string;
  startedAt: Date;
  resumedAt: Date | null;
  elapsedSeconds: number;
  endedAt: Date | null;
}): number => {
  if (session.status === "PAUSED" || session.status === "ENDED") return session.elapsedSeconds;
  const anchor = session.resumedAt ?? session.startedAt;
  return session.elapsedSeconds + Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 1000));
};

const auditData = (
  context: AuditContext,
  options: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Prisma.InputJsonValue;
  },
): Prisma.AuditEventCreateInput => ({
  action: options.action,
  entityType: options.entityType,
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

const resumeContextFor = async (userId: string, resumeId?: string): Promise<{
  resumeId?: string;
  context: string | null;
}> => {
  if (!resumeId) return { context: null };

  const resume = await database.resume.findFirst({
    where: {
      id: resumeId,
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
  });

  if (!resume) {
    throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found for this student");
  }

  return {
    resumeId: resume.id,
    context: JSON.stringify({
      extractedText: resume.resumeText?.extractedText?.slice(0, 6_000) ?? null,
      structuredData: resume.analyses[0]?.structuredData ?? null,
    }),
  };
};

const transcriptTurnsFromSession = (session: SelectedSession) => session.turns.map((turn) => ({
  turnNumber: turn.turnNumber,
  question: turn.question,
  answerText: turn.answerText,
  answerMode: turn.answerMode,
  evaluation: turn.interviewAnswer?.evaluation ?? null,
}));

const buildFinalReport = (session: SelectedSession) => {
  const evaluatedTurns = session.turns
    .map((turn) => turn.interviewAnswer?.evaluation)
    .filter((evaluation): evaluation is NonNullable<typeof evaluation> => Boolean(evaluation));
  const averageScore = evaluatedTurns.length === 0
    ? 0
    : Math.round((evaluatedTurns.reduce((sum, evaluation) => sum + Number(evaluation.score), 0) / evaluatedTurns.length) * 100) / 100;
  const strengths = evaluatedTurns.flatMap((evaluation) => expectedTopicsFromJson(evaluation.strengths)).slice(0, 12);
  const weaknesses = evaluatedTurns.flatMap((evaluation) => expectedTopicsFromJson(evaluation.weaknesses)).slice(0, 12);
  const missingConcepts = evaluatedTurns.flatMap((evaluation) => expectedTopicsFromJson(evaluation.missingConcepts)).slice(0, 12);

  return {
    targetRole: session.targetRole,
    status: "COMPLETED",
    totalQuestions: session.turns.length,
    answeredQuestions: session.turns.filter((turn) => Boolean(turn.answerText)).length,
    averageScore,
    strengths,
    weaknesses,
    missingConcepts,
    summary: averageScore >= 75
      ? "Strong interview performance with focused areas for polish."
      : averageScore >= 55
        ? "Moderate interview performance; improve missing concepts and answer structure."
        : "Foundational preparation needed before a live placement interview.",
    transcript: transcriptService.buildTranscript(transcriptTurnsFromSession(session)),
  };
};

export class InterviewSessionService {
  async startSession(userId: string, input: StartInterviewSessionInput, context: AuditContext) {
    const resume = await resumeContextFor(userId, input.resumeId);
    const question = await questionGeneratorService.generateNextQuestion({
      targetRole: input.targetRole,
      expectedTopics: input.expectedTopics,
      resumeContext: resume.context,
      transcript: "",
      previousAnswer: null,
      questionCount: 0,
    });
    const questionAudio = await speechService.synthesizeQuestion(question.question);

    const session = await database.$transaction(async (transaction) => {
      const created = await transaction.interviewSession.create({
        data: {
          userId,
          resumeId: resume.resumeId,
          targetRole: input.targetRole,
          durationMinutes: input.durationMinutes,
          expectedTopics: input.expectedTopics,
          status: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
          metadata: {
            questionModel: question.aiModel,
            speechProvider: questionAudio.provider,
            questionCount: input.questionCount ?? questionCountFrom({
              metadata: null,
              expectedTopics: input.expectedTopics,
            }),
          },
        },
        select: { id: true },
      });

      await transaction.interviewTurn.create({
        data: {
          sessionId: created.id,
          turnNumber: 1,
          question: question.question,
          expectedTopics: question.expectedTopics,
          questionAudio: questionAudio as unknown as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
          metadata: {
            difficulty: question.difficulty,
            questionModel: question.aiModel,
          },
        },
      });

      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          action: "live_interview_started",
          entityType: "InterviewSession",
          entityId: created.id,
          payload: { targetRole: input.targetRole },
        }),
      });

      return transaction.interviewSession.findUniqueOrThrow({
        where: { id: created.id },
        select: sessionSelect,
      });
    });

    return { session: toApiSession(session) };
  }

  async submitTextAnswer(userId: string, sessionId: string, input: SubmitTextAnswerInput, context: AuditContext) {
    return this.submitAnswer(userId, sessionId, {
      answerText: input.answer,
      answerMode: "TEXT",
      answerAudio: null,
    }, context);
  }

  async submitVoiceAnswer(userId: string, sessionId: string, file: Express.Multer.File | undefined, context: AuditContext) {
    if (!file) {
      throw new AppError(400, "VOICE_ANSWER_REQUIRED", "Upload an audio file using the multipart field 'audio'");
    }

    validateAudioSignature({ buffer: file.buffer, mimetype: file.mimetype });

    const transcription = await speechService.transcribeAnswer(file);
    return this.submitAnswer(userId, sessionId, {
      answerText: transcription.text,
      answerMode: "VOICE",
      answerAudio: {
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        transcriptionProvider: transcription.provider,
        transcriptionConfidence: transcription.confidence,
        durationMs: transcription.durationMs,
      },
    }, context);
  }

  async pauseSession(userId: string, sessionId: string, context: AuditContext) {
    const session = await this.getOwnedRawSession(userId, sessionId);
    if (session.status !== "ACTIVE") {
      throw new AppError(400, "INTERVIEW_NOT_ACTIVE", "Only active interviews can be paused");
    }

    const elapsedSeconds = elapsedSecondsFor(session);
    const updated = await database.$transaction(async (transaction) => {
      await transaction.interviewSession.update({
        where: { id: session.id },
        data: {
          status: "PAUSED",
          pausedAt: new Date(),
          elapsedSeconds,
          updatedBy: userId,
        },
      });
      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          action: "live_interview_paused",
          entityType: "InterviewSession",
          entityId: session.id,
        }),
      });
      return transaction.interviewSession.findUniqueOrThrow({ where: { id: session.id }, select: sessionSelect });
    });

    return { session: toApiSession(updated) };
  }

  async resumeSession(userId: string, sessionId: string, context: AuditContext) {
    const session = await this.getOwnedRawSession(userId, sessionId);
    if (session.status !== "PAUSED") {
      throw new AppError(400, "INTERVIEW_NOT_PAUSED", "Only paused interviews can be resumed");
    }

    const updated = await database.$transaction(async (transaction) => {
      await transaction.interviewSession.update({
        where: { id: session.id },
        data: {
          status: "ACTIVE",
          resumedAt: new Date(),
          pausedAt: null,
          updatedBy: userId,
        },
      });
      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          action: "live_interview_resumed",
          entityType: "InterviewSession",
          entityId: session.id,
        }),
      });
      return transaction.interviewSession.findUniqueOrThrow({ where: { id: session.id }, select: sessionSelect });
    });

    return { session: toApiSession(updated) };
  }

  async endSession(userId: string, sessionId: string, context: AuditContext) {
    const session = await this.getOwnedRawSession(userId, sessionId);
    if (session.status === "ENDED") {
      return { session: toApiSession(session), report: session.finalReport };
    }

    const elapsedSeconds = elapsedSecondsFor(session);
    const report = buildFinalReport(session);
    const updated = await database.$transaction(async (transaction) => {
      await transaction.interviewSession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          elapsedSeconds,
          finalReport: report as Prisma.InputJsonValue,
          recordStatus: RecordStatus.COMPLETED,
          updatedBy: userId,
        },
      });
      await transaction.auditEvent.create({
        data: auditData(context, {
          userId,
          action: "live_interview_ended",
          entityType: "InterviewSession",
          entityId: session.id,
          payload: { averageScore: report.averageScore },
        }),
      });
      return transaction.interviewSession.findUniqueOrThrow({ where: { id: session.id }, select: sessionSelect });
    });

    return { session: toApiSession(updated), report };
  }

  async listSessions(actor: { id: string; role: UserRole }) {
    const sessions = await database.interviewSession.findMany({
      where: {
        deletedAt: null,
        ...(actor.role === UserRole.STUDENT ? { userId: actor.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: sessionSelect,
    });

    return { sessions: sessions.map(toApiSession) };
  }

  async getSession(actor: { id: string; role: UserRole }, sessionId: string) {
    const session = await database.interviewSession.findFirst({
      where: {
        id: sessionId,
        deletedAt: null,
        ...(actor.role === UserRole.STUDENT ? { userId: actor.id } : {}),
      },
      select: sessionSelect,
    });

    if (!session) {
      throw new AppError(404, "INTERVIEW_SESSION_NOT_FOUND", "Interview session was not found");
    }

    return { session: toApiSession(session) };
  }

  async getReport(actor: { id: string; role: UserRole }, sessionId: string) {
    const result = await this.getSession(actor, sessionId);
    return { report: result.session.finalReport ?? buildFinalReport(result.session as unknown as SelectedSession) };
  }

  private async submitAnswer(
    userId: string,
    sessionId: string,
    input: {
      answerText: string;
      answerMode: "TEXT" | "VOICE";
      answerAudio: Prisma.InputJsonValue | null;
    },
    context: AuditContext,
  ) {
    const session = await this.getOwnedRawSession(userId, sessionId);
    if (session.status !== "ACTIVE") {
      throw new AppError(400, "INTERVIEW_NOT_ACTIVE", "Answers can only be submitted while the interview is active");
    }

    const pendingTurn = session.turns.find((turn) => !turn.answerText);
    if (!pendingTurn) {
      throw new AppError(400, "NO_PENDING_INTERVIEW_QUESTION", "There is no pending interview question to answer");
    }

    const expectedTopics = expectedTopicsFromJson(pendingTurn.expectedTopics);
    const evaluation = await interviewEvaluationService.evaluateTextAnswer(userId, {
      question: pendingTurn.question,
      studentAnswer: input.answerText,
      resumeId: session.resumeId ?? undefined,
      expectedTopics,
    }, context);

    const elapsedSeconds = elapsedSecondsFor(session);
    const shouldEnd = elapsedSeconds >= session.durationMinutes * 60;
    const updatedTurn = await database.interviewTurn.update({
      where: { id: pendingTurn.id },
      data: {
        interviewAnswerId: evaluation.answer.id,
        answerText: input.answerText,
        answerMode: input.answerMode,
        answerAudio: input.answerAudio ?? undefined,
        transcript: input.answerText,
        answeredAt: new Date(),
        updatedBy: userId,
      },
      select: { id: true },
    });

    await database.auditEvent.create({
      data: auditData(context, {
        userId,
        action: "live_interview_answer_submitted",
        entityType: "InterviewTurn",
        entityId: updatedTurn.id,
        payload: { sessionId, answerMode: input.answerMode, score: evaluation.score },
      }),
    });

    const refreshed = await this.getOwnedRawSession(userId, sessionId);
    const answeredQuestionCount = refreshed.turns.filter((turn) => Boolean(turn.answerText)).length;
    const reachedQuestionLimit = answeredQuestionCount >= questionCountFrom(refreshed);
    if (shouldEnd || reachedQuestionLimit) {
      const ended = await this.endSession(userId, sessionId, context);
      return { ...ended, evaluation, nextQuestion: null };
    }

    const transcript = transcriptService.buildTranscript(transcriptTurnsFromSession(refreshed));
    const resume = await resumeContextFor(userId, refreshed.resumeId ?? undefined);
    const nextQuestion = await questionGeneratorService.generateNextQuestion({
      targetRole: refreshed.targetRole,
      expectedTopics: expectedTopicsFromJson(refreshed.expectedTopics),
      resumeContext: resume.context,
      transcript,
      previousAnswer: input.answerText,
      questionCount: refreshed.turns.length,
    });
    const questionAudio = await speechService.synthesizeQuestion(nextQuestion.question);

    const nextTurn = await database.interviewTurn.create({
      data: {
        sessionId: refreshed.id,
        turnNumber: refreshed.turns.length + 1,
        question: nextQuestion.question,
        expectedTopics: nextQuestion.expectedTopics,
        questionAudio: questionAudio as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
        metadata: {
          difficulty: nextQuestion.difficulty,
          questionModel: nextQuestion.aiModel,
        },
      },
      select: {
        id: true,
        turnNumber: true,
        question: true,
        expectedTopics: true,
        questionAudio: true,
        askedAt: true,
      },
    });

    const finalSession = await this.getOwnedRawSession(userId, sessionId);

    return {
      session: toApiSession(finalSession),
      evaluation,
      nextQuestion: {
        ...nextTurn,
        expectedTopics: expectedTopicsFromJson(nextTurn.expectedTopics),
      },
    };
  }

  private async getOwnedRawSession(userId: string, sessionId: string): Promise<SelectedSession> {
    const session = await database.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      select: sessionSelect,
    });

    if (!session) {
      throw new AppError(404, "INTERVIEW_SESSION_NOT_FOUND", "Interview session was not found");
    }

    return session;
  }
}

export const interviewSessionService = new InterviewSessionService();
