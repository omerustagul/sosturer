import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDateTimes() {
  const records = await prisma.productionRecord.findMany({
    select: { productionDate: true },
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- Production Date Times ---');
  records.forEach(r => {
    console.log(r.productionDate.toISOString());
  });
}

checkDateTimes().catch(console.error).finally(() => prisma.$disconnect());
