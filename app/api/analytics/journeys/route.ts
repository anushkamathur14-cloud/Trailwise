import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom } from "@/lib/http";
import { journeyQuery } from "@/lib/analytics/queries";
import { getWorkspace } from "@/lib/workspace";
import { withDemoDb } from "@/lib/api";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    const url = new URL(request.url);
    const workspace = getWorkspace(workspaceId);
    const start = url.searchParams.get("start") ?? workspace.defaultJourney.start;
    const end = url.searchParams.get("end") ?? workspace.defaultJourney.end;
    const maxSteps = Math.min(Number(url.searchParams.get("maxSteps") ?? 7), 8);
    const windowDays = Math.min(Number(url.searchParams.get("windowDays") ?? 7), 30);
    return journeyQuery(
      prisma,
      workspaceId,
      range,
      start,
      end,
      maxSteps,
      {
        channel: range.channel,
        device: range.device,
        segment: range.segment,
      },
      windowDays,
    );
  });
}
