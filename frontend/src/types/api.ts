export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
  error: null;
}

export interface ApiFailure {
  data: null;
  meta: ApiMeta;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiResponse<T> | ApiFailure;

export interface NormalizedApiError extends Error {
  name: "ApiError";
  code: string;
  message: string;
  details: unknown;
  status?: number;
  requestId?: string;
  timestamp?: string;
  isApiError: true;
}
