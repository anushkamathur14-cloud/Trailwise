import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { parseJson } from "@/lib/utils";
import { userRecommendation } from "@/lib/recommendations/engine";
import { getWorkspace, type WorkspaceId } from "@/lib/workspace";
import { groupEventsIntoSessions } from "@/lib/identity/sessions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      aliases: true,
      events: { orderBy: { timestamp: "asc" } },
      sessions: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!person) return json({ error: "Not found" }, 404);
  const workspace = getWorkspace(person.workspaceId);
  const rec = userRecommendation({
    workspaceId: person.workspaceId as WorkspaceId,
    activated: person.activated,
    converted: person.converted,
    eventNames: person.events.map((event) => event.eventName),
    traits: parseJson(person.traitsJson, {}),
    segment: person.segment,
  });
  const sessions = groupEventsIntoSessions(
    person.events.map((event) => ({
      timestamp: event.timestamp,
      eventName: event.eventName,
      eventId: event.eventId,
      properties: parseJson(event.propertiesJson, {}),
      context: parseJson(event.contextJson, {}),
    })),
  );
  return json({
    person: {
      ...person,
      properties: parseJson(person.propertiesJson, {}),
      traits: parseJson(person.traitsJson, {}),
    },
    workspace,
    recommendation: rec,
    sessions,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.event.deleteMany({ where: { personId: id } });
  await prisma.session.deleteMany({ where: { personId: id } });
  await prisma.personAlias.deleteMany({ where: { personId: id } });
  await prisma.person.delete({ where: { id } }).catch(() => null);
  return json({ deleted: true });
}
