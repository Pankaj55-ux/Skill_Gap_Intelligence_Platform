import type { AxiosProgressEvent } from "axios";
import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { Resume, ResumeAnalysisResult } from "./resume.types";

export const resumeService = {
  async listResumes() {
    const response = await apiClient.get<ApiResponse<{ resumes: Resume[] }>>("/sgip/resume/me");
    return response.data.data.resumes;
  },

  async uploadResume(file: File, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await apiClient.post<ApiResponse<{ resume: Resume }>>(
      "/sgip/resume/upload",
      formData,
      { onUploadProgress },
    );

    return response.data.data.resume;
  },

  async deleteResume(id: string) {
    const response = await apiClient.delete<ApiResponse<{ resume: Resume }>>(`/sgip/resume/${id}`);
    return response.data.data.resume;
  },

  async analyzeResume(id: string) {
    const response = await apiClient.post<ApiResponse<ResumeAnalysisResult>>(`/sgip/resume/${id}/analyze`);
    return response.data.data;
  },

  async getLatestAnalysis(id: string) {
    const response = await apiClient.get<ApiResponse<{ result: ResumeAnalysisResult | null }>>(
      `/sgip/resume/${id}/analysis`,
    );
    return response.data.data.result;
  },
};
