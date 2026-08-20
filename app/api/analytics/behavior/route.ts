import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom, json } from "@/lib/http";
import { behaviorCompare, type Ecosystem } from "@/lib/analytics/behavior";
import { withDemoDb } from "@/lib/api";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    const url = new URL(request.url);
    const ecosystem = (url.searchParams.get("ecosystem") || "all") as Ecosystem;
    const data = await behaviorCompare(prisma, workspaceId, range, ecosystem);
    return json(data);
  });
}
