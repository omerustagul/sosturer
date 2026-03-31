import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkActualData() {
  const company = await prisma.company.findFirst();
  if (!company) return;

  const target = new Date('2026-03-18T00:00:00Z');
  const next = new Date(target);
  next.setDate(next.getDate() + 1);

  const records = await prisma.productionRecord.findMany({
    where: {
      companyId: company.id,
      productionDate: { gte: target, lt: next }
    },
    include: { machine: true }
  });

  console.log(`--- Real Data for ${company.name} (18.03.2026) ---`);
  records.forEach(r => {
    console.log(`${r.machine.code}: Qty=${r.producedQuantity}, Cycle=${r.cycleTimeSeconds}, Dur=${(r.producedQuantity * r.cycleTimeSeconds) / 60}, DT=${r.downtimeMinutes}`);
  });
}

checkActualData().catch(console.error).finally(() => prisma.$disconnect());
