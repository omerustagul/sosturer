import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLast() {
  const r = await prisma.productionRecord.findFirst({
    include: { shift: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!r) {
    console.log('No records found');
    return;
  }

  console.log('--- Last Record Raw ---');
  console.log(`ID: ${r.id}`);
  console.log(`ProductionDate: ${r.productionDate.toISOString()}`);
  console.log(`ProducedQty: ${r.producedQuantity}`);
  console.log(`CycleTime: ${r.cycleTimeSeconds}`);
  console.log(`ActualDurationMinutes: ${r.actualDurationMinutes}`);
  console.log(`DowntimeMinutes: ${r.downtimeMinutes}`);
  console.log(`UnplannedDowntimeMinutes: ${r.unplannedDowntimeMinutes}`);
  console.log(`PlannedDowntimeMinutes: ${r.plannedDowntimeMinutes}`);
  console.log(`ShiftDuration: ${r.shift.durationMinutes}`);
  
  const actualCalculated = (r.producedQuantity * r.cycleTimeSeconds) / 60;
  console.log(`Calculated Actual: ${actualCalculated}`);
  console.log(`Diff (Shift - Actual): ${r.shift.durationMinutes - actualCalculated}`);
}

checkLast().catch(console.error).finally(() => prisma.$disconnect());
