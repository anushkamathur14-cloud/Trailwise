import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import path from "path";
import { ingestEvent } from "@/lib/ingestion/ingest";
import { identifyPerson } from "@/lib/identity/merge";

const dbPath = path.join(process.cwd(), "prisma", "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function reset() {
  await prisma.event.deleteMany();
  await prisma.session.deleteMany();
  await prisma.personAlias.deleteMany();
  await prisma.person.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.workspace.create({
    data: { id: "web-demo", name: "Aurelia Web", platform: "web", productName: "Aurelia" },
  });
  await prisma.settings.create({
    data: { id: "web-settings", workspaceId: "web-demo", collectionEnabled: true },
  });
}

describe("ingestion and identity", () => {
  beforeAll(async () => {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "inherit",
    });
    await reset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects duplicate event ids", async () => {
    await reset();
    const payload = {
      eventId: "evt_dup_1",
      eventName: "landing_viewed",
      anonymousId: "anon_dup",
      platform: "web" as const,
      timestamp: "2026-08-18T10:00:00.000Z",
    };
    const first = await ingestEvent(prisma, "web-demo", payload, { skipLive: true });
    const second = await ingestEvent(prisma, "web-demo", payload, { skipLive: true });
    expect(first.accepted).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(await prisma.event.count()).toBe(1);
  });

  it("merges anonymous profiles into identified users", async () => {
    await reset();
    await ingestEvent(
      prisma,
      "web-demo",
      {
        eventName: "landing_viewed",
        anonymousId: "anon_merge",
        platform: "web",
        timestamp: "2026-08-18T10:00:00.000Z",
      },
      { skipLive: true },
    );
    const result = await identifyPerson(prisma, {
      workspaceId: "web-demo",
      anonymousId: "anon_merge",
      userId: "user_merge",
      timestamp: new Date("2026-08-18T10:05:00.000Z"),
    });
    expect(result.merged).toBe(true);
    const person = await prisma.person.findFirst({ where: { userId: "user_merge" }, include: { aliases: true, events: true } });
    expect(person?.aliases.some((alias) => alias.previousId === "anon_merge")).toBe(true);
    expect(person?.events.some((event) => event.eventName === "landing_viewed")).toBe(true);
  });

  it("emits tester interactions as stored events", async () => {
    await reset();
    const result = await ingestEvent(
      prisma,
      "web-demo",
      {
        eventName: "practice_plan_created",
        anonymousId: "tester_anon",
        platform: "web",
        source: "tester",
        timestamp: "2026-08-18T10:00:00.000Z",
      },
      { skipLive: true },
    );
    expect(result.accepted).toBe(true);
    const stored = await prisma.event.findUnique({ where: { eventId: result.eventId } });
    expect(stored?.source).toBe("tester");
    expect(stored?.eventName).toBe("practice_plan_created");
  });
});
