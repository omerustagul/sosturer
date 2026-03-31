import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  const records = await prisma.productionRecord.findMany({
    include: {
      shift: true,
      machine: true,
      product: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- Production Records ---');
  records.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Date: ${r.productionDate.toISOString()}`);
    console.log(`Machine: ${r.machine.code}`);
    console.log(`Shift: ${r.shift.shiftCode} (Duration: ${r.shift.durationMinutes})`);
    console.log(`Produced: ${r.producedQuantity}`);
    console.log(`CycleTime: ${r.cycleTimeSeconds}`);
    console.log(`Downtime: ${r.downtimeMinutes}`);
    console.log(`OEE: ${r.oee}`);
    console.log('---');
  });

  const shifts = await prisma.shift.findMany();
  console.log('--- Shifts ---');
  shifts.forEach(s => {
    console.log(`${s.shiftCode}: ${s.durationMinutes} min`);
  });
}

checkData().catch(console.error).finally(() => prisma.$disconnect());
