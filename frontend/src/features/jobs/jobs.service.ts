import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { CareerRole, CareerRoleListResponse, CareerRoleQuery, JobDescription } from "./jobs.types";

const compactParams = (query: Partial<CareerRoleQuery>) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""),
);

export const jobsService = {
  async listCareerRoles(query: CareerRoleQuery) {
    const response = await apiClient.get<ApiResponse<CareerRoleListResponse>>("/sgip/career-roles", {
      params: compactParams(query),
    });
    return response.data.data;
  },

  async getCareerRole(id: string) {
    const response = await apiClient.get<ApiResponse<{ role: CareerRole }>>(`/sgip/career-roles/${id}`);
    return response.data.data.role;
  },

  async listJobDescriptions() {
    const response = await apiClient.get<ApiResponse<{ jobDescriptions: JobDescription[] }>>("/sgip/job-description");
    return response.data.data.jobDescriptions;
  },

  async getJobDescription(id: string) {
    const response = await apiClient.get<ApiResponse<{ jobDescription: JobDescription }>>(`/sgip/job-description/${id}`);
    return response.data.data.jobDescription;
  },

  async runGapAnalysis(targetCareerRoleId: string) {
    const response = await apiClient.post<ApiResponse<unknown>>("/sgip/gap-analysis/run", { targetCareerRoleId });
    return response.data.data;
  },

  async generateRoadmap() {
    const response = await apiClient.post<ApiResponse<unknown>>("/sgip/roadmap/generate");
    return response.data.data;
  },
};
