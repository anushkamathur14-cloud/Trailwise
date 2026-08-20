import { prisma } from "@/lib/prisma";
import { json, workspaceFrom } from "@/lib/http";
import { productRecommendations, userRecommendation } from "@/lib/recommendations/engine";
import { enhanceRecommendation } from "@/lib/ai/provider";
import { parseJson } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const url = new URL(request.url);
  const personId = url.searchParams.get("personId");
  const product = productRecommendations(workspaceId);
  let user = null;
  if (personId) {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: { events: { select: { eventName: true } } },
    });
    if (person) {
      user = userRecommendation({
        workspaceId: person.workspaceId as WorkspaceId,
        activated: person.activated,
        converted: person.converted,
        eventNames: person.events.map((event) => event.eventName),
        traits: parseJson(person.traitsJson, {}),
        segment: person.segment,
      });
    }
  }
  return json({ product, user });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    kind?: "product" | "user";
    title?: string;
    evidence?: string;
    experiment?: string;
  } | null;
  if (!body?.title || !body.evidence) {
    return json({ error: "Missing recommendation fields" }, 400);
  }
  const result = await enhanceRecommendation(request.headers.get("cookie"), {
    kind: body.kind === "user" ? "user" : "product",
    title: body.title,
    evidence: body.evidence,
    experiment: body.experiment,
  });
  return json(result);
}
