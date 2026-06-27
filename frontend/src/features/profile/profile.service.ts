import { apiClient } from "../../services/apiClient";
import type { ApiFailure, ApiResponse } from "../../types/api";
import type { SkillEvidence, StudentProfile, StudentProfilePayload, Resume } from "./profile.types";

export const profileService = {
  async getOwnProfile() {
    const response = await apiClient.get<ApiResponse<{ profile: StudentProfile }> | ApiFailure>(
      "/sgip/student-profile/me",
      { validateStatus: (status) => (status >= 200 && status < 300) || status === 404 },
    );

    if (response.status === 404) return null;
    return (response.data as ApiResponse<{ profile: StudentProfile }>).data.profile;
  },

  async saveProfile(payload: StudentProfilePayload, exists: boolean) {
    const response = exists
      ? await apiClient.patch<ApiResponse<{ profile: StudentProfile }>>("/sgip/student-profile/me", payload)
      : await apiClient.post<ApiResponse<{ profile: StudentProfile }>>("/sgip/student-profile", payload);

    return response.data.data.profile;
  },

  async listEvidence() {
    const response = await apiClient.get<ApiResponse<{ evidence: SkillEvidence[] }>>("/sgip/skill-evidence/me");
    return response.data.data.evidence;
  },

  async createEvidence(payload: {
    skillName: string;
    category: string;
    proficiencyLevel: string;
    evidenceType: string;
    evidenceUrl?: string | null;
    description: string;
  }) {
    const response = await apiClient.post<ApiResponse<{ evidence: SkillEvidence }>>("/sgip/skill-evidence", payload);
    return response.data.data.evidence;
  },

  async listResumes() {
    const response = await apiClient.get<ApiResponse<{ resumes: Resume[] }>>("/sgip/resume/me");
    return response.data.data.resumes;
  },

  async uploadResume(file: File) {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await apiClient.post<ApiResponse<{ resume: Resume }>>("/sgip/resume/upload", formData);

    return response.data.data.resume;
  },

  async deleteResume(id: string) {
    const response = await apiClient.delete<ApiResponse<{ resume: Resume }>>(`/sgip/resume/${id}`);
    return response.data.data.resume;
  },
};
