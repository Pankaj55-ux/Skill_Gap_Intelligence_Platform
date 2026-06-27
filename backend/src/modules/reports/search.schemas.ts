import { z } from "zod";
import {
  paginationQuerySchema,
  searchableResources,
  sortOptions,
} from "../../common/search.js";
import {
  ProficiencyLevel,
  RecordStatus,
} from "../../generated/prisma/client.js";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  resources: z.string()
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(z.enum(searchableResources)).min(1))
    .optional(),
  sort: z.enum(sortOptions).default("newest"),
  role: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(RecordStatus).optional(),
  skill: z.string().trim().min(1).max(120).optional(),
  level: z.nativeEnum(ProficiencyLevel).optional(),
  ...paginationQuerySchema,
}).strict();

export type SearchQuery = z.infer<typeof searchQuerySchema>;
