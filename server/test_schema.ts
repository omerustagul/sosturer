import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.appSettings.count();
  console.log("appSettings OK");
  await prisma.notification.count();
  console.log("notifications OK");
  await prisma.department.count();
  console.log("department OK");
  await prisma.unit.count().catch(console.log);
  console.log("ALL GOOD");
}

main().catch(console.error).finally(() => prisma.$disconnect());
