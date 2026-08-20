import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";

type ResolveInput = {
  workspaceId: string;
  anonymousId?: string;
  userId?: string;
  timestamp: Date;
  context: Record<string, unknown>;
  properties: Record<string, unknown>;
  platform: string;
};

export async function resolvePerson(db: PrismaClient, input: ResolveInput) {
  if (input.userId) {
    const identified = await db.person.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
    });
    if (identified) {
      return identified;
    }
  }

  if (input.anonymousId) {
    const anonymous = await db.person.findUnique({
      where: {
        workspaceId_anonymousId: { workspaceId: input.workspaceId, anonymousId: input.anonymousId },
      },
    });
    if (anonymous) return anonymous;
  }

  const channel =
    typeof input.properties.channel === "string"
      ? input.properties.channel
      : typeof input.context.referrer === "string"
        ? String(input.context.referrer)
        : undefined;

  return db.person.create({
    data: {
      id: nanoid(),
      workspaceId: input.workspaceId,
      anonymousId: input.anonymousId,
      userId: input.userId,
      firstSeenAt: input.timestamp,
      lastSeenAt: input.timestamp,
      deviceType: typeof input.context.deviceType === "string" ? input.context.deviceType : undefined,
      country: typeof input.context.country === "string" ? input.context.country : undefined,
      acquisitionChannel: channel,
      consentState:
        typeof input.properties.consent === "string" ? input.properties.consent : "unknown",
    },
  });
}
