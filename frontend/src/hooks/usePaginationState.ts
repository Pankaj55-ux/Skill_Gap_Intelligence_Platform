import { useSearchParams } from "react-router-dom";

export const readPositivePage = (value: string | null | undefined, fallback = 1) => {
  const page = Number(value ?? fallback);
  return Number.isFinite(page) && page > 0 ? page : fallback;
};

export function usePaginationState(paramName = "page") {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = readPositivePage(searchParams.get(paramName));

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set(paramName, String(Math.max(1, nextPage)));
    setSearchParams(next);
  };

  const updateParams = (updates: Record<string, string | number | boolean | undefined | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "" || value === undefined || value === null || value === false) next.delete(key);
      else next.set(key, String(value));
    });
    if (!(paramName in updates)) next.set(paramName, "1");
    setSearchParams(next);
  };

  return {
    page,
    searchParams,
    setSearchParams,
    setPage,
    updateParams,
  };
}
