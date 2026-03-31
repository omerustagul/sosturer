import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function countRecords() {
  const target = new Date('2026-03-18T00:00:00Z');
  const next = new Date(target);
  next.setDate(next.getDate() + 1);

  const stats = await prisma.productionRecord.groupBy({
    by: ['machineId', 'shiftId'],
    where: {
      productionDate: { gte: target, lt: next }
    },
    _count: { _all: true },
    _sum: {
      producedQuantity: true,
      downtimeMinutes: true
    }
  });

  console.log('--- Statistics for 2026-03-18 ---');
  for (const s of stats) {
    const machine = await prisma.machine.findUnique({ where: { id: s.machineId } });
    console.log(`Machine: ${machine?.code}, Records: ${s._count._all}, SumQty: ${s._sum.producedQuantity}, SumDowntime: ${s._sum.downtimeMinutes}`);
  }
}

countRecords().catch(console.error).finally(() => prisma.$disconnect());
