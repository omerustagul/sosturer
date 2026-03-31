import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const models = [
    'company', 'user', 'machine', 'operator', 'shift', 'department', 
    'departmentRole', 'product', 'productionRecord', 
    'appSettings', 'importHistory', 'overtimePlan'
  ];

  console.log('--- ALL COMPANY IDS IN DB ---');
  for (const model of models) {
    try {
      const all: any[] = await (prisma as any)[model].findMany({ select: { companyId: true, id: true, name: true, fullName: true, email: true } });
      const ids = new Set(all.map(x => x.companyId || x.id)); // Model ID for Company
      console.log(`${model.padEnd(20)}: ${Array.from(ids).join(', ')}`);
    } catch (e) {
      // For models without companyId (like Company itself)
      if (model === 'company') {
        const all = await prisma.company.findMany({ select: { id: true, name: true } });
        console.log(`company             : ${all.map(x => `${x.name}(${x.id})`).join(', ')}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
