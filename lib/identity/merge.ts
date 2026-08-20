import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import { parseJson } from "@/lib/utils";

export type IdentifyInput = {
  workspaceId: string;
  userId: string;
  anonymousId?: string;
  traits?: Record<string, unknown>;
  timestamp?: Date;
  platform?: "web" | "mobile";
};

export type IdentifyResult = {
  personId: string;
  merged: boolean;
  fromAnonymousId?: string;
};

export async function identifyPerson(db: PrismaClient, input: IdentifyInput): Promise<IdentifyResult> {
  const timestamp = input.timestamp ?? new Date();
  const identified = await db.person.findUnique({
    where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
  });
  const anonymous = input.anonymousId
    ? await db.person.findUnique({
        where: {
          workspaceId_anonymousId: {
            workspaceId: input.workspaceId,
            anonymousId: input.anonymousId,
          },
        },
      })
    : null;

  if (identified && anonymous && identified.id !== anonymous.id) {
    await mergePersons(db, identified.id, anonymous.id, input.anonymousId ?? anonymous.anonymousId ?? "", timestamp);
    const traits = {
      ...parseJson<Record<string, unknown>>(identified.propertiesJson, {}),
      ...(input.traits ?? {}),
    };
    await db.person.update({
      where: { id: identified.id },
      data: {
        propertiesJson: JSON.stringify(traits),
        displayName: (input.traits?.name as string | undefined) ?? identified.displayName,
        email: (input.traits?.email as string | undefined) ?? identified.email,
        lastSeenAt: timestamp,
      },
    });
    return { personId: identified.id, merged: true, fromAnonymousId: input.anonymousId };
  }

  if (anonymous && !identified) {
    const traits = {
      ...parseJson<Record<string, unknown>>(anonymous.propertiesJson, {}),
      ...(input.traits ?? {}),
    };
    await db.person.update({
      where: { id: anonymous.id },
      data: {
        userId: input.userId,
        propertiesJson: JSON.stringify(traits),
        displayName: (input.traits?.name as string | undefined) ?? anonymous.displayName,
        email: (input.traits?.email as string | undefined) ?? anonymous.email,
        lastSeenAt: timestamp,
      },
    });
    if (input.anonymousId) {
      await db.personAlias.create({
        data: {
          id: nanoid(),
          personId: anonymous.id,
          previousId: input.anonymousId,
          kind: "anonymous_to_identified",
        },
      });
    }
    return { personId: anonymous.id, merged: Boolean(input.anonymousId), fromAnonymousId: input.anonymousId };
  }

  if (identified) {
    const traits = {
      ...parseJson<Record<string, unknown>>(identified.propertiesJson, {}),
      ...(input.traits ?? {}),
    };
    await db.person.update({
      where: { id: identified.id },
      data: {
        propertiesJson: JSON.stringify(traits),
        displayName: (input.traits?.name as string | undefined) ?? identified.displayName,
        email: (input.traits?.email as string | undefined) ?? identified.email,
        lastSeenAt: timestamp,
      },
    });
    return { personId: identified.id, merged: false };
  }

  const created = await db.person.create({
    data: {
      id: nanoid(),
      workspaceId: input.workspaceId,
      userId: input.userId,
      anonymousId: input.anonymousId,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      propertiesJson: JSON.stringify(input.traits ?? {}),
      displayName: input.traits?.name as string | undefined,
      email: input.traits?.email as string | undefined,
    },
  });
  return { personId: created.id, merged: false };
}

export async function mergePersons(
  db: PrismaClient,
  canonicalId: string,
  sourceId: string,
  previousId: string,
  timestamp: Date,
) {
  await db.event.updateMany({ where: { personId: sourceId }, data: { personId: canonicalId } });
  await db.session.updateMany({ where: { personId: sourceId }, data: { personId: canonicalId } });
  await db.personAlias.updateMany({ where: { personId: sourceId }, data: { personId: canonicalId } });
  await db.personAlias.create({
    data: {
      id: nanoid(),
      personId: canonicalId,
      previousId,
      kind: "anonymous_to_identified",
    },
  });

  const [canonical, source] = await Promise.all([
    db.person.findUniqueOrThrow({ where: { id: canonicalId } }),
    db.person.findUniqueOrThrow({ where: { id: sourceId } }),
  ]);

  const mergedProps = {
    ...parseJson<Record<string, unknown>>(source.propertiesJson, {}),
    ...parseJson<Record<string, unknown>>(canonical.propertiesJson, {}),
  };

  await db.person.update({
    where: { id: canonicalId },
    data: {
      anonymousId: canonical.anonymousId ?? source.anonymousId,
      firstSeenAt: canonical.firstSeenAt < source.firstSeenAt ? canonical.firstSeenAt : source.firstSeenAt,
      lastSeenAt: timestamp,
      eventCount: canonical.eventCount + source.eventCount,
      sessionCount: canonical.sessionCount + source.sessionCount,
      activated: canonical.activated || source.activated,
      converted: canonical.converted || source.converted,
      propertiesJson: JSON.stringify(mergedProps),
      acquisitionChannel: canonical.acquisitionChannel ?? source.acquisitionChannel,
      deviceType: canonical.deviceType ?? source.deviceType,
      country: canonical.country ?? source.country,
      displayName: canonical.displayName ?? source.displayName,
      email: canonical.email ?? source.email,
      consentState: canonical.consentState === "unknown" ? source.consentState : canonical.consentState,
    },
  });

  await db.event.create({
    data: {
      id: nanoid(),
      eventId: `merge_${nanoid()}`,
      workspaceId: canonical.workspaceId,
      personId: canonicalId,
      eventName: "identity_merged",
      timestamp,
      platform: "web",
      source: "identity",
      propertiesJson: JSON.stringify({
        fromAnonymousId: previousId,
        intoUserId: canonical.userId,
      }),
      contextJson: "{}",
    },
  });

  await db.person.delete({ where: { id: sourceId } });
}
