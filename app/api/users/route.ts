import { prisma } from "@/lib/prisma";
import { json, workspaceFrom } from "@/lib/http";
import { parseJson } from "@/lib/utils";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 100);
  const testers = url.searchParams.get("testers") === "1";

  const people = await prisma.person.findMany({
    where: {
      workspaceId,
      ...(testers ? { isTester: true } : {}),
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

  return json({
    people: people.map((person) => ({
      ...person,
      properties: parseJson(person.propertiesJson, {}),
      traits: parseJson(person.traitsJson, {}),
    })),
    nextCursor: people.at(-1)?.lastSeenAt.toISOString() ?? null,
  });
}
