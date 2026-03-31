import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCNC13Fields() {
  const records = await prisma.productionRecord.findMany({
    where: {
      machine: { code: 'CNC-13' },
      productionDate: {
        gte: new Date('2026-03-18T00:00:00Z'),
        lt: new Date('2026-03-19T00:00:00Z')
      }
    }
  });

  records.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Downtime: ${r.downtimeMinutes}`);
    console.log(`Unplanned: ${r.unplannedDowntimeMinutes}`);
    console.log(`ActualDur: ${r.actualDurationMinutes}`);
    console.log(`OEE: ${r.oee}`);
    console.log(`Availability: ${r.availability}`);
    console.log('---');
  });
}

checkCNC13Fields().catch(console.error).finally(() => prisma.$disconnect());
