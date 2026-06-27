import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { DashboardResponse } from "./dashboard.types";

export const dashboardService = {
  async getStudentDashboard() {
    const response = await apiClient.get<ApiResponse<DashboardResponse>>("/sgip/dashboard");
    return response.data.data.dashboard;
  },
};
