import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { JobDescription } from "../jobs/jobs.types";
import type { Resume } from "../resume/resume.types";
import type { InterviewFinalReport, InterviewSession, InterviewSetupFormValues } from "./interview.types";

const expectedTopicsFor = (
  values: InterviewSetupFormValues,
  jobDescription?: JobDescription,
): string[] => {
  const topics = [
    `Interview type: ${values.interviewType}`,
    `Difficulty: ${values.difficulty}`,
    `Question count target: ${values.questionCount}`,
  ];

  if (jobDescription) {
    topics.push(`Job description: ${jobDescription.title} at ${jobDescription.company}`);
    topics.push(...jobDescription.requiredSkills.slice(0, 12));
    topics.push(...jobDescription.preferredSkills.slice(0, 8));
  }

  if (values.interviewType === "HR" || values.interviewType === "MIXED") {
    topics.push("communication", "behavioral examples", "strengths and weaknesses", "career motivation");
  }

  if (values.interviewType === "TECHNICAL" || values.interviewType === "MIXED") {
    topics.push("technical fundamentals", "problem solving", "project explanation");
  }

  return Array.from(new Set(topics)).slice(0, 50);
};

export const interviewService = {
  async listResumes() {
    const response = await apiClient.get<ApiResponse<{ resumes: Resume[] }>>("/sgip/resume/me");
    return response.data.data.resumes;
  },

  async listJobDescriptions() {
    const response = await apiClient.get<ApiResponse<{ jobDescriptions: JobDescription[] }>>("/sgip/job-description");
    return response.data.data.jobDescriptions;
  },

  async listSessions() {
    const response = await apiClient.get<ApiResponse<{ sessions: InterviewSession[] }>>("/sgip/interview/sessions");
    return response.data.data.sessions;
  },

  async startSession(values: InterviewSetupFormValues, jobDescription?: JobDescription) {
    const response = await apiClient.post<ApiResponse<{ session: InterviewSession }>>("/sgip/interview/sessions", {
      targetRole: values.targetRole,
      resumeId: values.resumeId || undefined,
      durationMinutes: values.durationMinutes,
      questionCount: values.questionCount,
      expectedTopics: expectedTopicsFor(values, jobDescription),
    });
    return response.data.data.session;
  },

  async getSession(sessionId: string) {
    const response = await apiClient.get<ApiResponse<{ session: InterviewSession }>>(`/sgip/interview/sessions/${sessionId}`);
    return response.data.data.session;
  },

  async getSessionReport(sessionId: string) {
    const response = await apiClient.get<ApiResponse<{ report: InterviewFinalReport }>>(`/sgip/interview/sessions/${sessionId}/report`);
    return response.data.data.report;
  },

  async submitTextAnswer(sessionId: string, answer: string) {
    const response = await apiClient.post<ApiResponse<{ session: InterviewSession; nextQuestion: unknown; evaluation?: unknown }>>(
      `/sgip/interview/sessions/${sessionId}/answer`,
      { answer },
    );
    return response.data.data;
  },

  async pauseSession(sessionId: string) {
    const response = await apiClient.post<ApiResponse<{ session: InterviewSession }>>(`/sgip/interview/sessions/${sessionId}/pause`);
    return response.data.data.session;
  },

  async resumeSession(sessionId: string) {
    const response = await apiClient.post<ApiResponse<{ session: InterviewSession }>>(`/sgip/interview/sessions/${sessionId}/resume`);
    return response.data.data.session;
  },

  async endSession(sessionId: string) {
    const response = await apiClient.post<ApiResponse<{ session: InterviewSession; report: unknown }>>(`/sgip/interview/sessions/${sessionId}/end`);
    return response.data.data;
  },
};
