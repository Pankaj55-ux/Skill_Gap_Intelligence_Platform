import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "dist/**",
        "src/generated/**",
        "src/**/*.d.ts",
        "src/server.ts",
        "src/database/seed.ts",
      ],
    },
  },
});
