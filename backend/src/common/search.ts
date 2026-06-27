import { z } from "zod";

export const sortOptions = ["newest", "oldest", "readiness", "completion", "priority"] as const;
export const searchableResources = ["careerRoles", "skillEvidence", "roadmaps", "gapReports"] as const;

export type SortOption = (typeof sortOptions)[number];
export type SearchableResource = (typeof searchableResources)[number];

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PaginationInput {
  total: number;
  totalPages: number;
}

export const paginationQuerySchema = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const createPagination = ({ page, limit }: PaginationInput) => ({
  page,
  limit,
  skip: (page - 1) * limit,
  take: limit,
});

export const createPaginationMeta = (
  { page, limit }: PaginationInput,
  total: number,
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const csvEnumArray = <T extends readonly [string, ...string[]]>(values: T) => z.string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.enum(values)).min(1))
  .optional();

export const compactAnd = <T>(filters: Array<T | undefined | false | null>) => {
  const compacted = filters.filter(Boolean) as T[];
  return compacted.length > 0 ? { AND: compacted } : {};
};

export const keywordContains = (keyword: string | undefined, fields: string[]) => {
  if (!keyword) return undefined;
  return {
    OR: fields.map((field) => ({ [field]: { contains: keyword, mode: "insensitive" } })),
  };
};

export const sortByCreatedAt = (sort: SortOption) => sort === "oldest"
  ? { createdAt: "asc" as const }
  : { createdAt: "desc" as const };

export const numberDesc = (value: unknown): number => {
  if (value === null || value === undefined) return Number.NEGATIVE_INFINITY;
  return Number(value);
};
