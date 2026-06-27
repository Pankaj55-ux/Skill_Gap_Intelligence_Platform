import { describe, expect, it } from "vitest";
import { clearDashboardCacheForUser } from "./dashboard.service.js";

describe("dashboard module", () => {
  it("allows dashboard cache invalidation by user", () => {
    expect(() => clearDashboardCacheForUser("6c671faf-3a76-4a11-90ca-698ac0ba8c54")).not.toThrow();
  });
});
