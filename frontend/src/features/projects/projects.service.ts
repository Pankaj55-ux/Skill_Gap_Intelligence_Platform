import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { Roadmap } from "../roadmap/roadmap.types";
import type { ProjectRecommendationOutput, ProjectRecommendationRequest } from "./projects.types";

export const projectsService = {
  async listRoadmaps() {
    const response = await apiClient.get<ApiResponse<{ roadmaps: Roadmap[] }>>("/sgip/roadmap");
    return response.data.data.roadmaps;
  },

  async recommend(payload: ProjectRecommendationRequest) {
    const response = await apiClient.post<ApiResponse<ProjectRecommendationOutput>>("/sgip/projects/recommend", payload);
    return response.data.data;
  },
};
