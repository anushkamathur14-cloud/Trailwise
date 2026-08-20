import { prisma } from "@/lib/prisma";
import { json, rangeFrom, workspaceFrom } from "@/lib/http";
import { journeyQuery } from "@/lib/analytics/queries";
import { getWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const range = rangeFrom(request);
  const url = new URL(request.url);
  const workspace = getWorkspace(workspaceId);
  const start = url.searchParams.get("start") ?? workspace.defaultJourney.start;
  const end = url.searchParams.get("end") ?? workspace.defaultJourney.end;
  const maxSteps = Math.min(Number(url.searchParams.get("maxSteps") ?? 10), 12);
  const graph = await journeyQuery(prisma, workspaceId, range, start, end, maxSteps, {
    channel: range.channel,
    device: range.device,
    segment: range.segment,
  });
  return json(graph);
}
