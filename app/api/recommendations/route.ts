import { prisma } from "@/lib/prisma";
import { withDemoDb } from "@/lib/api";
import { productRecommendations, userRecommendation } from "@/lib/recommendations/engine";
import { enhanceRecommendation } from "@/lib/ai/provider";
import { parseJson } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/workspace";
import { workspaceFrom, json } from "@/lib/http";
import { ensureDemoData } from "@/lib/prisma";

export async function GET(request: Request) {
  return withDemoDb(async () => {
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
    return { product, user };
  });
}

export async function POST(request: Request) {
  try {
    await ensureDemoData();
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return json({ error: message }, 500);
  }
}
