import { useQuery, type QueryFunction, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import type { NormalizedApiError } from "../types/api";
import { queryTimes } from "../lib/queryConfig";

type ApiQueryOptions<TData, TQueryKey extends QueryKey> = Omit<
  UseQueryOptions<TData, NormalizedApiError, TData, TQueryKey>,
  "queryKey" | "queryFn"
> & {
  queryKey: TQueryKey;
  queryFn: QueryFunction<TData, TQueryKey>;
};

export function useApiQuery<TData, TQueryKey extends QueryKey>({
  staleTime = queryTimes.medium,
  gcTime = queryTimes.cache,
  ...options
}: ApiQueryOptions<TData, TQueryKey>) {
  return useQuery<TData, NormalizedApiError, TData, TQueryKey>({
    staleTime,
    gcTime,
    ...options,
  });
}
