import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "@/lib/demo/seed";

declare global {
  // eslint-disable-next-line no-var
  var __trailwisePrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __trailwiseDbReady: Promise<void> | undefined;
}

function bundledDemoDbPath() {
  return path.join(process.cwd(), "prisma", "demo.db");
}

function resolveDatabaseUrl(): string {
  const existing = process.env.DATABASE_URL;
  if (existing && (existing.startsWith("postgres") || existing.startsWith("prisma+"))) {
    return existing;
  }

  // Vercel serverless FS is read-only except /tmp. Copy the seeded demo DB there.
  if (process.env.VERCEL || process.env.TRAILWISE_USE_TMP_DB === "1") {
    const tmpDir = "/tmp";
    const tmpDb = path.join(tmpDir, "trailwise.db");
    const source = bundledDemoDbPath();
    if (!existsSync(tmpDb) && existsSync(source)) {
      mkdirSync(tmpDir, { recursive: true });
      copyFileSync(source, tmpDb);
    }
    return `file:${tmpDb}`;
  }

  return existing || "file:./dev.db";
}

process.env.DATABASE_URL = resolveDatabaseUrl();

export const prisma =
  globalThis.__trailwisePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production" || process.env.VERCEL) {
  globalThis.__trailwisePrisma = prisma;
}

/** Ensure the demo database is available (copy bundled SQLite on Vercel cold start). */
export async function ensureDemoData() {
  if (!globalThis.__trailwiseDbReady) {
    globalThis.__trailwiseDbReady = (async () => {
      try {
        const people = await prisma.person.count();
        if (people > 0) return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "database unavailable";
        if (process.env.VERCEL) {
          throw new Error(
            `Demo database is not ready (${message}). Ensure prisma/demo.db is included in the deploy, or unset DATABASE_URL so Trailwise can use /tmp.`,
          );
        }
      }

      // Local/empty DB: seed. Skip on Vercel — seeding 1k users exceeds serverless timeouts.
      if (process.env.VERCEL) {
        throw new Error(
          "Demo database is empty on Vercel. Redeploy after npm run build (creates prisma/demo.db) and do not set DATABASE_URL unless using Postgres.",
        );
      }

      try {
        await seedDatabase(prisma);
      } catch (error) {
        console.error("[trailwise] ensureDemoData failed", error);
        throw error;
      }
    })();
  }
  return globalThis.__trailwiseDbReady;
}
