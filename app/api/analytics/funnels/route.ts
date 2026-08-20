import { prisma } from "@/lib/prisma";
import { json, rangeFrom, workspaceFrom } from "@/lib/http";
import { funnelQuery } from "@/lib/analytics/queries";
import { abandonedAtStep } from "@/lib/analytics/funnels";
import { getWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const range = rangeFrom(request);
  const url = new URL(request.url);
  const funnelId = url.searchParams.get("funnel") ?? "activation";
  const step = url.searchParams.get("abandonedStep");
  const data = await funnelQuery(prisma, workspaceId, funnelId, range, {
    channel: range.channel,
    device: range.device,
    segment: range.segment,
  });
  let abandoned: string[] = [];
  if (step !== null) {
    const workspace = getWorkspace(workspaceId);
    const funnel = workspace.funnels.find((item) => item.id === funnelId) ?? workspace.funnels[0];
    const people = await prisma.person.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const events = await prisma.event.findMany({
      where: { workspaceId, personId: { in: people.map((p) => p.id) } },
      select: { personId: true, eventName: true, timestamp: true },
    });
    abandoned = abandonedAtStep(events, funnel.steps, Number(step)).slice(0, 40);
  }
  return json({ ...data, abandoned });
}
