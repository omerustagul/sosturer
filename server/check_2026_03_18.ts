import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDate() {
  const target = new Date('2026-03-18T00:00:00Z');
  const next = new Date(target);
  next.setDate(next.getDate() + 1);

  const records = await prisma.productionRecord.findMany({
    where: {
      productionDate: { gte: target, lt: next }
    },
    include: { machine: true, shift: true }
  });

  console.log(`--- Records for 2026-03-18 (${records.length} total) ---`);
  records.forEach(r => {
    console.log(`Machine: ${r.machine.code}, Qty: ${r.producedQuantity}, Cycle: ${r.cycleTimeSeconds}, Dur: ${(r.producedQuantity * r.cycleTimeSeconds) / 60}, Downtime: ${r.downtimeMinutes}`);
  });
}

checkDate().catch(console.error).finally(() => prisma.$disconnect());
