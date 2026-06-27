import { describe, expect, it } from "vitest";
import {
  compactAnd,
  createPagination,
  createPaginationMeta,
  sortByCreatedAt,
} from "./search.js";

describe("reusable search helpers", () => {
  it("creates pagination values and metadata", () => {
    expect(createPagination({ page: 3, limit: 10 })).toMatchObject({
      page: 3,
      limit: 10,
      skip: 20,
      take: 10,
    });
    expect(createPaginationMeta({ page: 3, limit: 10 }, 25)).toMatchObject({
      page: 3,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("compacts filters and maps common sort options", () => {
    expect(compactAnd([{ status: "ACTIVE" }, undefined, null])).toEqual({
      AND: [{ status: "ACTIVE" }],
    });
    expect(sortByCreatedAt("oldest")).toEqual({ createdAt: "asc" });
    expect(sortByCreatedAt("newest")).toEqual({ createdAt: "desc" });
  });
});
