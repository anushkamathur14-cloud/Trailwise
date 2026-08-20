import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom } from "@/lib/http";
import { overviewMetrics } from "@/lib/analytics/queries";
import { withDemoDb } from "@/lib/api";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    return overviewMetrics(prisma, workspaceId, range, {
      channel: range.channel,
      device: range.device,
      segment: range.segment,
    });
  });
}
