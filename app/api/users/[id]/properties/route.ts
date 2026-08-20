import { prisma } from "@/lib/prisma";
import { userPropertiesSchema } from "@/lib/ingestion/schema";
import { redactRecord } from "@/lib/ingestion/redact";
import { json } from "@/lib/http";
import { parseJson } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = userPropertiesSchema.safeParse({ ...(body ?? {}), userId: id });
  if (!parsed.success) return json({ error: "Invalid properties" }, 400);
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) return json({ error: "Not found" }, 404);
  const settings = await prisma.settings.findUnique({ where: { workspaceId: person.workspaceId } });
  const denylist = settings ? parseJson<string[]>(settings.denylistJson, []) : [];
  const merged = {
    ...parseJson<Record<string, unknown>>(person.propertiesJson, {}),
    ...redactRecord(parsed.data.properties, denylist),
  };
  await prisma.person.update({
    where: { id },
    data: { propertiesJson: JSON.stringify(merged) },
  });
  return json({ properties: merged });
}
