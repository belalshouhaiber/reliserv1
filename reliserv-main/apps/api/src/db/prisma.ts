import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

// Prevent hot-reload from creating too many clients in dev
export const prisma = global.__prisma ?? prismaClient;

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

export async function disconnectPrisma() {
  await prisma.$disconnect();
  await pool.end();

  if (process.env.NODE_ENV !== "production") {
    global.__prisma = undefined;
  }
}
