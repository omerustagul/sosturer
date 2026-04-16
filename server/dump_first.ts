import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.productionRecord.findFirst();
  console.log('RECORD:', JSON.stringify(r, null, 2));

  const u = await prisma.user.findFirst({ where: { email: 'omerustagul@mail.com' } });
  console.log('USER:', JSON.stringify(u, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
