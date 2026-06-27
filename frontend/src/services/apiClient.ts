import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/auth.store";
import type { ApiFailure, ApiResponse, NormalizedApiError } from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "/api/v1";
const refreshTokenPath = import.meta.env.VITE_AUTH_REFRESH_PATH as string | undefined;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const createApiError = ({
  code,
  message,
  details = null,
  status,
  requestId,
  timestamp,
}: {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
  requestId?: string;
  timestamp?: string;
}): NormalizedApiError => Object.assign(new Error(message), {
  name: "ApiError" as const,
  code,
  message,
  details,
  status,
  requestId,
  timestamp,
  isApiError: true as const,
});

export const isApiError = (error: unknown): error is NormalizedApiError => (
  typeof error === "object" && error !== null && "isApiError" in error
);

export const normalizeApiError = (error: unknown): NormalizedApiError => {
  if (isApiError(error)) return error;

  if (axios.isAxiosError<ApiFailure>(error)) {
    const failure = error.response?.data;
    const backendError = failure?.error;

    if (backendError) {
      return createApiError({
        code: backendError.code,
        message: backendError.message,
        details: backendError.details,
        status: error.response?.status,
        requestId: failure?.meta?.requestId,
        timestamp: failure?.meta?.timestamp,
      });
    }

    if (error.response) {
      return createApiError({
        code: `HTTP_${error.response.status}`,
        message: error.response.statusText || "Request failed",
        details: error.response.data ?? null,
        status: error.response.status,
      });
    }

    return createApiError({
      code: error.code ?? "NETWORK_ERROR",
      message: error.message || "Unable to reach the backend",
      details: null,
    });
  }

  if (error instanceof Error) {
    return createApiError({
      code: "CLIENT_ERROR",
      message: error.message || "Unexpected client error",
      details: null,
    });
  }

  return createApiError({
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
    details: error,
  });
};

export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong") => (
  normalizeApiError(error).message || fallback
);

export const unwrapApiResponse = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

const tryRefreshAccessToken = async () => {
  if (!refreshTokenPath) return null;

  const response = await axios.post<ApiResponse<{ accessToken: string }>>(
    refreshTokenPath,
    null,
    { baseURL: apiBaseUrl, withCredentials: true } satisfies AxiosRequestConfig,
  );
  return response.data.data.accessToken;
};

const expireSession = () => {
  const { isAuthenticated, clearSession } = useAuthStore.getState();
  if (!isAuthenticated) return;

  clearSession();
  toast.error("Your session has expired. Please sign in again.", { id: "session-expired" });
  const loginUrl = new URL("/login", window.location.origin);
  loginUrl.searchParams.set("reason", "session-expired");
  window.location.assign(loginUrl.toString());
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshedToken = await tryRefreshAccessToken();
        if (refreshedToken) {
          const { user, rememberMe, setSession } = useAuthStore.getState();
          if (user) setSession({ user, accessToken: refreshedToken, rememberMe });
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Fall through to the visible session-expired logout flow below.
      }

      expireSession();
    }

    const normalizedError = normalizeApiError(error);
    if (normalizedError.status !== 401) {
      toast.error(normalizedError.message, { id: normalizedError.requestId ?? normalizedError.code });
    }
    return Promise.reject(normalizedError);
  },
);
