import { prisma } from "@/lib/prisma";
import { json, rangeFrom, workspaceFrom } from "@/lib/http";
import { signalQuery } from "@/lib/analytics/queries";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const range = rangeFrom(request);
  const signals = await signalQuery(prisma, workspaceId, range);
  return json({
    signals,
    warning: "These relationships are correlational. They are not evidence that changing the product will cause the same lift.",
  });
}
