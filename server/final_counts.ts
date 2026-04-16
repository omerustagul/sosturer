import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'medisolaris';
  console.log(`--- DB STATS FOR: ${companyId} ---`);
  
  const models = [
    'machine', 
    'operator', 
    'product', 
    'shift', 
    'department',
    'productionRecord',
    'overtimePlan',
    'notification'
  ];

  for (const m of models) {
    try {
      const count = await (prisma as any)[m].count({ where: { companyId } });
      console.log(`${m}: ${count}`);
    } catch (e: any) {
      console.log(`${m}: ERR (${e.message})`);
    }
  }

  // Check if any departments/roles exist
  const depts = await prisma.department.findMany({ where: { companyId } });
  console.log(`Department Details: ${depts.map(d => d.name).join(', ')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
