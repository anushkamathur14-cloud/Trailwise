import { prisma } from "@/lib/prisma";
import { json, workspaceFrom } from "@/lib/http";
import { parseJson } from "@/lib/utils";

export async function GET(request: Request) {
  const workspaceId = workspaceFrom(request);
  const settings = await prisma.settings.findUnique({ where: { workspaceId } });
  return json({
    settings: settings
      ? { ...settings, denylist: parseJson<string[]>(settings.denylistJson, []) }
      : null,
  });
}

export async function POST(request: Request) {
  const workspaceId = workspaceFrom(request);
  const body = (await request.json().catch(() => ({}))) as {
    retentionDays?: number;
    collectionEnabled?: boolean;
    denylist?: string[];
  };
  const current = await prisma.settings.findUnique({ where: { workspaceId } });
  const updated = await prisma.settings.upsert({
    where: { workspaceId },
    create: {
      id: `${workspaceId}-settings`,
      workspaceId,
      retentionDays: body.retentionDays ?? 90,
      collectionEnabled: body.collectionEnabled ?? true,
      denylistJson: JSON.stringify(body.denylist ?? []),
    },
    update: {
      retentionDays: body.retentionDays ?? current?.retentionDays,
      collectionEnabled: body.collectionEnabled ?? current?.collectionEnabled,
      denylistJson: body.denylist ? JSON.stringify(body.denylist) : current?.denylistJson,
    },
  });
  return json({ settings: { ...updated, denylist: parseJson(updated.denylistJson, []) } });
}
