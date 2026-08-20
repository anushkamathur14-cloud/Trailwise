import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/demo/seed";

const prisma = new PrismaClient();

async function main() {
  await seedDatabase(prisma);
  const people = await prisma.person.count();
  const events = await prisma.event.count();
  console.log(`Seeded ${people} people and ${events} events.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
