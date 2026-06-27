import { apiClient } from "../../services/apiClient";
import type { ApiResponse } from "../../types/api";
import type { AdminItem, AdminListParams, AdminListResponse, AdminResourceSummary, AdminResourceKey, AdminRole } from "./admin.types";

export const adminService = {
  async listResources() {
    const response = await apiClient.get<ApiResponse<{ resources: AdminResourceSummary[] }>>("/sgip/admin/resources");
    return response.data.data.resources;
  },

  async list(resource: AdminResourceKey, params: AdminListParams) {
    const path = resource === "audit-history" ? "/sgip/admin/audit-history" : `/sgip/admin/${resource}`;
    const response = await apiClient.get<ApiResponse<AdminListResponse>>(path, {
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search || undefined,
        status: params.status || undefined,
        includeDeleted: params.includeDeleted || undefined,
        role: params.role || undefined,
        type: params.type || undefined,
        level: params.level || undefined,
        provider: params.provider || undefined,
        targetRole: params.targetRole || undefined,
      },
    });
    return response.data.data;
  },

  async create(resource: AdminResourceKey, body: Record<string, unknown>) {
    const response = await apiClient.post<ApiResponse<{ item: AdminItem }>>(`/sgip/admin/${resource}`, body);
    return response.data.data.item;
  },

  async update(resource: AdminResourceKey, id: string, body: Record<string, unknown>) {
    const response = await apiClient.patch<ApiResponse<{ item: AdminItem }>>(`/sgip/admin/${resource}/${id}`, body);
    return response.data.data.item;
  },

  async softDelete(resource: AdminResourceKey, id: string) {
    const response = await apiClient.delete<ApiResponse<{ item: AdminItem }>>(`/sgip/admin/${resource}/${id}`);
    return response.data.data.item;
  },

  async restore(resource: AdminResourceKey, id: string) {
    const response = await apiClient.patch<ApiResponse<{ item: AdminItem }>>(`/sgip/admin/${resource}/${id}/restore`);
    return response.data.data.item;
  },

  async updateUserRole(id: string, role: AdminRole) {
    const response = await apiClient.patch<ApiResponse<{ user: AdminItem }>>(`/sgip/admin/users/${id}/role`, { role });
    return response.data.data.user;
  },
};
