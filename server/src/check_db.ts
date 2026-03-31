import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const OLD_ID = 'medisolaris-main';
const NEW_ID = '260101';

async function main() {
  const models = [
    'user', 'machine', 'operator', 'shift', 'department', 
    'departmentRole', 'product', 'productionRecord', 
    'appSettings', 'importHistory', 'overtimePlan'
  ];

  console.log('--- DB Check ---');
  
  const company = await prisma.company.findUnique({ where: { id: NEW_ID } });
  console.log(`Company 260101 exists: ${!!company}`);
  if (company) console.log(`Company Name: ${company.name}`);

  for (const model of models) {
    try {
      const all = await (prisma as any)[model].findMany({});
      const oldMatch = all.filter((x: any) => x.companyId === OLD_ID).length;
      const newMatch = all.filter((x: any) => x.companyId === NEW_ID).length;
      const other = all.filter((x: any) => x.companyId !== OLD_ID && x.companyId !== NEW_ID && x.companyId).length;
      const nullId = all.filter((x: any) => !x.companyId).length;
      
      console.log(`[${model.padEnd(20)}] Old:${oldMatch} New:${newMatch} Other:${other} Null:${nullId} Total:${all.length}`);
    } catch (e: any) {
      console.log(`[${model.padEnd(20)}] ERROR: ${e.message}`);
    }
  }
}

main().catch(console.log).finally(() => prisma.$disconnect());
