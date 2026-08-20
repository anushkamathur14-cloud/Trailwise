import { prisma } from "@/lib/prisma";
import { rangeFrom, workspaceFrom } from "@/lib/http";
import { signalQuery } from "@/lib/analytics/queries";
import { withDemoDb } from "@/lib/api";

export async function GET(request: Request) {
  return withDemoDb(async () => {
    const workspaceId = workspaceFrom(request);
    const range = rangeFrom(request);
    const signals = await signalQuery(prisma, workspaceId, range);
    return {
      signals,
      warning:
        "These relationships are correlational. They are not evidence that changing the product will cause the same lift.",
    };
  });
}
