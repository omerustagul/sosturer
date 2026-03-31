import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCNC10() {
  const records = await prisma.productionRecord.findMany({
    where: {
      machine: { code: 'CNC-10' }
    },
    include: {
      shift: true,
      product: true
    },
    orderBy: { productionDate: 'desc' }
  });

  console.log('--- CNC-10 Records ---');
  records.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Date: ${r.productionDate.toISOString()}`);
    console.log(`Shift: ${r.shift.shiftCode} (${r.shift.durationMinutes} min)`);
    console.log(`Product: ${r.product.productCode}`);
    console.log(`Produced: ${r.producedQuantity}`);
    console.log(`CycleTime: ${r.cycleTimeSeconds}`);
    console.log(`Downtime: ${r.downtimeMinutes}`);
    console.log(`ActualDur: ${r.actualDurationMinutes}`);
    console.log('---');
  });
}

checkCNC10().catch(console.error).finally(() => prisma.$disconnect());
