import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/environment.js";
import { PrismaClient } from "../generated/prisma/client.js";

const globalDatabase = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createDatabaseClient = (): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["error"],
  });
};

export const database = globalDatabase.prisma ?? createDatabaseClient();

if (env.NODE_ENV !== "production") {
  globalDatabase.prisma = database;
}

export const connectDatabase = async (): Promise<void> => {
  await database.$connect();
};

export const disconnectDatabase = async (): Promise<void> => {
  await database.$disconnect();
};
