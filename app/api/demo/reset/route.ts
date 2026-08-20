import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { seedDatabase } from "@/lib/demo/seed";

export async function POST() {
  await seedDatabase(prisma);
  const [people, events] = await Promise.all([prisma.person.count(), prisma.event.count()]);
  return json({ ok: true, people, events });
}
