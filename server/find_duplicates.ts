import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function findDuplicates() {
  const records = await prisma.productionRecord.findMany({
    select: {
      id: true,
      productionDate: true,
      machineId: true,
      shiftId: true,
      companyId: true,
      producedQuantity: true,
      cycleTimeSeconds: true,
      downtimeMinutes: true
    }
  });

  const groups: Record<string, typeof records> = {};
  records.forEach(r => {
    const key = `${r.productionDate.toISOString()}_${r.machineId}_${r.shiftId}_${r.companyId}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  console.log('--- Duplicates Audit ---');
  Object.keys(groups).forEach(key => {
    if (groups[key].length > 1) {
      console.log(`Key: ${key}`);
      console.log(`Count: ${groups[key].length}`);
      groups[key].forEach(r => {
        console.log(`  - ID: ${r.id}, Qty: ${r.producedQuantity}, Cycle: ${r.cycleTimeSeconds}, Dur: ${(r.producedQuantity * r.cycleTimeSeconds) / 60}, DB_Downtime: ${r.downtimeMinutes}`);
      });
      const totalDur = groups[key].reduce((acc, r) => acc + (r.producedQuantity * r.cycleTimeSeconds) / 60, 0);
      console.log(`  TOTAL Duration: ${totalDur}`);
    }
  });
}

findDuplicates().catch(console.error).finally(() => prisma.$disconnect());
