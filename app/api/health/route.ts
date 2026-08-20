import { prisma, ensureDemoData } from "@/lib/prisma";
import { json } from "@/lib/http";

export async function GET() {
  try {
    await ensureDemoData();
    const [people, events] = await Promise.all([prisma.person.count(), prisma.event.count()]);
    return json({ ok: true, people, events, time: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unavailable";
    return json({ ok: false, error: message }, 503);
  }
}
