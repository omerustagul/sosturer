import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  const records = await prisma.productionRecord.findMany({
    include: {
      shift: { select: { durationMinutes: true } }
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  console.log(JSON.stringify(records, null, 2));
}

checkData().catch(console.error).finally(() => prisma.$disconnect());
