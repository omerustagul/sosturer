import prisma from './server/src/lib/prisma';

async function main() {
  const companyId = 'test-company';
  
  const stats = {
    machines: await prisma.machine.count({ where: { companyId } }),
    operators: await prisma.operator.count({ where: { companyId } }),
    records: await prisma.productionRecord.count({ where: { companyId } }),
  };
  
  console.log('STATS for Test Şirketi 2:', stats);
}

main().catch(console.error).finally(() => prisma.$disconnect());
