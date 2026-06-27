import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { Roadmap, RoadmapProgress, UpdateProgressResponse } from "./roadmap.types";

export const roadmapService = {
  async generate() {
    const response = await apiClient.post<ApiResponse<{ roadmap: Roadmap }>>("/sgip/roadmap/generate");
    return response.data.data.roadmap;
  },

  async listRoadmaps() {
    const response = await apiClient.get<ApiResponse<{ roadmaps: Roadmap[] }>>("/sgip/roadmap");
    return response.data.data.roadmaps;
  },

  async getRoadmap(id: string) {
    const response = await apiClient.get<ApiResponse<{ roadmap: Roadmap }>>(`/sgip/roadmap/${id}`);
    return response.data.data.roadmap;
  },

  async listProgress() {
    const response = await apiClient.get<ApiResponse<{ progress: RoadmapProgress[] }>>("/sgip/progress");
    return response.data.data.progress;
  },

  async getProgress(roadmapId: string) {
    const response = await apiClient.get<ApiResponse<{ progress: RoadmapProgress }>>(`/sgip/progress/${roadmapId}`);
    return response.data.data.progress;
  },

  async updateProgress(input: {
    roadmapId: string;
    roadmapItemId: string;
    completed?: boolean;
    completionPercentage?: number;
    notes?: string | null;
  }) {
    const response = await apiClient.post<ApiResponse<UpdateProgressResponse>>("/sgip/progress/update", input);
    return response.data.data;
  },
};
