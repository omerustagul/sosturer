import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLast() {
  const r = await prisma.productionRecord.findFirst({
    include: { shift: { select: { durationMinutes: true } } },
    orderBy: { createdAt: 'desc' }
  });

  if (!r) {
    console.log('No records found');
    return;
  }

  console.log('--- START ---');
  console.log(JSON.stringify(r, null, 2));
  console.log('--- END ---');
}

checkLast().catch(console.error).finally(() => prisma.$disconnect());
