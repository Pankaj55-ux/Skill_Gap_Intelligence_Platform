import "dotenv/config";
import { defineConfig } from "prisma/config";

const developmentDatabaseUrl = "postgresql://sgip:sgip@localhost:5432/sgip?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? developmentDatabaseUrl,
  },
});
