import { isApiError } from "../services/apiClient";

export const queryTimes = {
  realtime: 10_000,
  short: 30_000,
  medium: 60_000,
  long: 5 * 60_000,
  cache: 15 * 60_000,
} as const;

export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (isApiError(error)) {
    if ([400, 401, 403, 404, 409, 422].includes(error.status ?? 0)) return false;
    return failureCount < 2;
  }

  return failureCount < 2;
};
