import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { ListNotificationsParams, ListNotificationsResponse, Notification } from "./notifications.types";

export const notificationsService = {
  async list(params: ListNotificationsParams) {
    const response = await apiClient.get<ApiResponse<ListNotificationsResponse>>("/sgip/notifications", {
      params: {
        page: params.page,
        limit: params.limit,
        type: params.type || undefined,
        search: params.search || undefined,
        unreadOnly: params.unreadOnly || undefined,
      },
    });
    return response.data.data;
  },

  async getById(id: string) {
    const response = await apiClient.get<ApiResponse<{ notification: Notification }>>(`/sgip/notifications/${id}`);
    return response.data.data.notification;
  },

  async markRead(id: string) {
    const response = await apiClient.patch<ApiResponse<{ notification: Notification }>>(`/sgip/notifications/${id}/read`);
    return response.data.data.notification;
  },

  async markAllRead() {
    const response = await apiClient.patch<ApiResponse<{ updatedCount: number }>>("/sgip/notifications/read-all");
    return response.data.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete<ApiResponse<{ notification: Notification }>>(`/sgip/notifications/${id}`);
    return response.data.data.notification;
  },
};
