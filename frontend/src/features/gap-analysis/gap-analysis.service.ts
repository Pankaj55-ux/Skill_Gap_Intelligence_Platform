import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { CareerRoleListResponse } from "../jobs/jobs.types";
import type { GapAnalysisResult, GapHistoryResponse } from "./gap-analysis.types";

export const gapAnalysisService = {
  async listCareerRoles(search?: string) {
    const response = await apiClient.get<ApiResponse<CareerRoleListResponse>>("/sgip/career-roles", {
      params: {
        page: 1,
        pageSize: 50,
        search: search || undefined,
      },
    });
    return response.data.data.roles;
  },

  async run(targetCareerRoleId: string) {
    const response = await apiClient.post<ApiResponse<GapAnalysisResult>>("/sgip/gap-analysis/run", {
      targetCareerRoleId,
    });
    return response.data.data;
  },

  async history(page = 1, limit = 10) {
    const response = await apiClient.get<ApiResponse<GapHistoryResponse>>("/sgip/search", {
      params: {
        resources: "gapReports",
        sort: "newest",
        page,
        limit,
      },
    });
    return response.data.data;
  },
};
