import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { json, workspaceFrom } from "@/lib/http";
import { getWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  const workspaceId = workspaceFrom(request);
  const workspace = getWorkspace(workspaceId);
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    personId?: string;
  };
  const now = new Date();

  if (body.action === "select" && body.personId) {
    const person = await prisma.person.findUnique({ where: { id: body.personId } });
    return json({ person });
  }

  if (body.action === "clear" && body.personId) {
    await prisma.session.deleteMany({ where: { personId: body.personId } });
    return json({ ok: true });
  }

  const anonymousId = `tester_${nanoid(8)}`;
  const person = await prisma.person.create({
    data: {
      id: nanoid(),
      workspaceId,
      anonymousId,
      displayName: `Tester ${anonymousId.slice(-4).toUpperCase()}`,
      firstSeenAt: now,
      lastSeenAt: now,
      isTester: true,
      segment: "tester",
      acquisitionChannel: "tester-mode",
      deviceType: workspace.platform === "web" ? "desktop" : "iphone",
      country: "US",
      consentState: "granted",
      propertiesJson: JSON.stringify({ tester: true }),
    },
  });
  return json({ person });
}
