import type { UserRole as PrismaUserRole } from "./generated/prisma/client.js";
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { id: string; role: PrismaUserRole; email: string };
    }
  }
}
export {};
