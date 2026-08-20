import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";

export async function GET() {
  try {
    const [people, events] = await Promise.all([prisma.person.count(), prisma.event.count()]);
    return json({ ok: true, people, events, time: new Date().toISOString() });
  } catch {
    return json({ ok: false }, 503);
  }
}
