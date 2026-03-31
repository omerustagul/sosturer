import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCNC13() {
  const records = await prisma.productionRecord.findMany({
    where: {
      machine: { code: 'CNC-13' },
      productionDate: {
        gte: new Date('2026-03-18T00:00:00Z'),
        lt: new Date('2026-03-19T00:00:00Z')
      }
    },
    include: { shift: true }
  });

  console.log('--- CNC-13 Records for 18.03.2026 ---');
  records.forEach(r => {
    console.log(JSON.stringify(r, null, 2));
  });
}

checkCNC13().catch(console.error).finally(() => prisma.$disconnect());
