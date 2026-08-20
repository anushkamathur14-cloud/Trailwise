import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom } from "@/lib/http";
import { calculateRetention, newVsReturning } from "@/lib/analytics/retention";
import { withDemoDb } from "@/lib/api";
import { getWorkspace, MOBILE_EVENTS, WEB_EVENTS } from "@/lib/workspace";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    const workspace = getWorkspace(workspaceId);
    const people = await prisma.person.findMany({
      where: { workspaceId, firstSeenAt: { lte: range.to } },
      select: { id: true, firstSeenAt: true, segment: true },
    });
    const retentionActivityWhere =
      workspaceId === "web-demo"
        ? { eventName: WEB_EVENTS.practiceCompleted }
        : {
            OR: [{ eventName: MOBILE_EVENTS.appOpened }, { eventName: MOBILE_EVENTS.returnedNextDay }],
          };
    const events = await prisma.event.findMany({
      where: {
        workspaceId,
        personId: { in: people.map((p) => p.id) },
        ...retentionActivityWhere,
      },
      select: { personId: true, timestamp: true },
    });
    const retention = calculateRetention(
      people.map((p) => ({ personId: p.id, firstSeenAt: p.firstSeenAt })),
      events,
      {
        asOf: range.to,
        retentionEvent: workspace.retentionEvent.name,
        definition: workspace.retentionEvent.description,
      },
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
        name: "Experience Studio testers",
        description: "Created in Experience Studio rather than the seed",
      },
    ];
    return { retention, split, cohorts, definition: workspace.retentionEvent.description };
  });
}
