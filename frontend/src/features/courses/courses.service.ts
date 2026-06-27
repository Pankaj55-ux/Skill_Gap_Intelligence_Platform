import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { Roadmap } from "../roadmap/roadmap.types";
import type { CourseRecommendationRecord } from "./courses.types";

export const courseKeyFor = (course: { provider: string; title: string; url: string }) => (
  `${course.provider}:${course.title}:${course.url}`.toLowerCase()
);

export const coursesService = {
  async listRoadmaps() {
    const response = await apiClient.get<ApiResponse<{ roadmaps: Roadmap[] }>>("/sgip/roadmap");
    return response.data.data.roadmaps;
  },

  async listRecommendations() {
    const response = await apiClient.get<ApiResponse<{ recommendations: CourseRecommendationRecord[] }>>("/sgip/courses/recommendations");
    return response.data.data.recommendations;
  },

  async generate(roadmapId: string) {
    const response = await apiClient.post<ApiResponse<{ recommendations: CourseRecommendationRecord["recommendations"]["recommendations"] }>>(
      "/sgip/courses/recommend",
      { roadmapId },
    );
    return response.data.data;
  },

  async updateItemState(input: {
    recommendationId: string;
    courseKey: string;
    bookmarked?: boolean;
    completed?: boolean;
    progressPercentage?: number;
  }) {
    const response = await apiClient.patch<ApiResponse<{ recommendation: CourseRecommendationRecord }>>(
      `/sgip/courses/recommendations/${input.recommendationId}/items/state`,
      {
        courseKey: input.courseKey,
        bookmarked: input.bookmarked,
        completed: input.completed,
        progressPercentage: input.progressPercentage,
      },
    );
    return response.data.data.recommendation;
  },
};
