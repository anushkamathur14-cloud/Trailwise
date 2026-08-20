import { prisma } from "@/lib/prisma";
import { json, rangeFrom, workspaceFrom } from "@/lib/http";
import { overviewMetrics } from "@/lib/analytics/queries";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const range = rangeFrom(request);
  const data = await overviewMetrics(prisma, workspaceId, range, {
    channel: range.channel,
    device: range.device,
    segment: range.segment,
  });
  return json(data);
}
