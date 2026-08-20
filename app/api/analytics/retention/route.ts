import { prisma } from "@/lib/prisma";
import { json, rangeFrom, workspaceFrom } from "@/lib/http";
import { calculateRetention, newVsReturning } from "@/lib/analytics/retention";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const range = rangeFrom(request);
  const people = await prisma.person.findMany({
    where: { workspaceId },
    select: { id: true, firstSeenAt: true, segment: true },
  });
  const events = await prisma.event.findMany({
    where: { workspaceId, timestamp: { gte: range.from, lte: range.to } },
    select: { personId: true, timestamp: true },
  });
  const retention = calculateRetention(
    people.map((p) => ({ personId: p.id, firstSeenAt: p.firstSeenAt })),
    events,
  );
  const split = newVsReturning(
    people.map((p) => ({ personId: p.id, firstSeenAt: p.firstSeenAt })),
    range,
  );
  const cohorts = [
    {
      id: "activated",
      name: "Activated users",
      description: "Reached the workspace primary goal",
    },
    {
      id: "converted",
      name: "Converted users",
      description: "Reached the paid or trial goal",
    },
    {
      id: "testers",
      name: "Tester mode users",
      description: "Created from Tester Mode rather than the seed",
    },
  ];
  return json({ retention, split, cohorts });
}
