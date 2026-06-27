import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";
import { queryTimes, shouldRetryQuery } from "../lib/queryConfig";

export const createAppQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: queryTimes.medium,
      gcTime: queryTimes.cache,
      retry: shouldRetryQuery,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const appQueryClient = createAppQueryClient();

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => appQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
