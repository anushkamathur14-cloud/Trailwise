import { prisma } from "@/lib/prisma";
import { workspaceFrom } from "@/lib/http";
import { withDemoDb } from "@/lib/api";
import { parseJson } from "@/lib/utils";
import { deviceTypesForFilter } from "@/lib/analytics/behavior";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 100);
    const testers = url.searchParams.get("testers") === "1";
    const segment = url.searchParams.get("segment") || undefined;
    const device = url.searchParams.get("device") || undefined;
    const devices = deviceTypesForFilter(device);

    const people = await prisma.person.findMany({
      where: {
        workspaceId,
        ...(testers ? { isTester: true } : {}),
        ...(segment ? { segment } : {}),
        ...(devices ? { deviceType: { in: devices } } : {}),
        ...(q
          ? {
              OR: [
                { displayName: { contains: q } },
                { email: { contains: q } },
                { userId: { contains: q } },
                { anonymousId: { contains: q } },
                { id: { contains: q } },
              ],
            }
          : {}),
        ...(cursor ? { lastSeenAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });

    return {
      people: people.map((person) => ({
        ...person,
        properties: parseJson(person.propertiesJson, {}),
        traits: parseJson(person.traitsJson, {}),
      })),
      nextCursor: people.at(-1)?.lastSeenAt.toISOString() ?? null,
    };
  });
}
