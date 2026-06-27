import type { JobDescription } from "../jobs/jobs.types";
import type { Resume } from "../resume/resume.types";

export type InterviewType = "TECHNICAL" | "HR" | "MIXED";
export type InterviewDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface InterviewEvaluation {
  id: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  improvementPlan: string[];
  summary: string;
}

export interface InterviewSessionTurn {
  id: string;
  turnNumber: number;
  question: string;
  expectedTopics: string[];
  answerText: string | null;
  answerMode: string | null;
  transcript: string | null;
  askedAt: string;
  answeredAt: string | null;
  evaluation: InterviewEvaluation | null;
}

export interface InterviewFinalReport {
  targetRole: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  summary: string;
  transcript: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  resumeId: string | null;
  targetRole: string;
  status: "ACTIVE" | "PAUSED" | "ENDED" | string;
  durationMinutes: number;
  startedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  endedAt: string | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  expectedTopics: string[];
  finalReport: unknown;
  createdAt: string;
  turns: InterviewSessionTurn[];
}

export interface InterviewSetupFormValues {
  targetRole: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  questionCount: number;
  resumeId: string;
  jobDescriptionId: string;
  durationMinutes: number;
}

export interface InterviewSetupData {
  resumes: Resume[];
  jobDescriptions: JobDescription[];
}
