import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom, json } from "@/lib/http";
import { behaviorCompare } from "@/lib/analytics/behavior";
import { withDemoDb } from "@/lib/api";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    const url = new URL(request.url);
    const device = url.searchParams.get("device") || url.searchParams.get("ecosystem") || undefined;
    const screen = url.searchParams.get("screen") || undefined;
    const previewId = url.searchParams.get("previewId") || undefined;
    const data = await behaviorCompare(prisma, workspaceId, range, { device, screen, previewId });
    return json(data);
  });
}
