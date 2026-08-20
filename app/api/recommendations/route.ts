import { prisma } from "@/lib/prisma";
import { withDemoDb } from "@/lib/api";
import { productRecommendations, userRecommendation } from "@/lib/recommendations/engine";
import { recommendFromHeatmapSession, withHeatmapLinkage } from "@/lib/recommendations/heatmap";
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
    const product = withHeatmapLinkage(productRecommendations(workspaceId), workspaceId);
    let user = null;
    let fromHeatmap = null;
    if (personId) {
      const person = await prisma.person.findUnique({
        where: { id: personId },
        include: {
          events: {
            select: { eventName: true, propertiesJson: true },
            orderBy: { timestamp: "desc" },
            take: 200,
          },
        },
      });
      if (person) {
        const eventNames = person.events.map((event) => event.eventName);
        user = userRecommendation({
          workspaceId: person.workspaceId as WorkspaceId,
          activated: person.activated,
          converted: person.converted,
          eventNames,
          traits: parseJson(person.traitsJson, {}),
          segment: person.segment,
        });

        const screenCounts = new Map<string, number>();
        for (const event of person.events) {
          if (event.eventName !== "ui_click") continue;
          const props = parseJson<Record<string, unknown>>(event.propertiesJson, {});
          const screen = typeof props.screen === "string" ? props.screen : null;
          if (!screen) continue;
          screenCounts.set(screen, (screenCounts.get(screen) ?? 0) + 1);
        }
        fromHeatmap = recommendFromHeatmapSession({
          workspaceId: person.workspaceId as WorkspaceId,
          screens: [...screenCounts.entries()].map(([name, count]) => ({ name, count })),
          events: eventNames,
        });
      }
    }
    return { product, user, fromHeatmap };
  });
}

export async function POST(request: Request) {
  try {
    await ensureDemoData();
    const body = (await request.json().catch(() => null)) as {
      kind?: "product" | "user" | "heatmap";
      title?: string;
      evidence?: string;
      experiment?: string;
      workspaceId?: WorkspaceId;
      screens?: Array<{ name: string; count: number }>;
      events?: string[];
    } | null;

    if (body?.kind === "heatmap") {
      const workspaceId = body.workspaceId ?? workspaceFrom(request);
      const linked = recommendFromHeatmapSession({
        workspaceId,
        screens: body.screens ?? [],
        events: body.events ?? [],
      });
      return json({ fromHeatmap: linked });
    }

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
