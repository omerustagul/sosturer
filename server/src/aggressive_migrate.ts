import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_ID = '260101';

async function main() {
  console.log(`Starting aggressive migration to ${NEW_ID}...`);
  
  const company = await prisma.company.findUnique({ where: { id: NEW_ID } });
  if (!company) {
    console.error(`ERROR: Company ${NEW_ID} does not exist! Run seed or restore it first.`);
    return;
  }

  const models = [
    'user', 'machine', 'operator', 'shift', 'department', 
    'departmentRole', 'product', 'productionRecord', 
    'appSettings', 'importHistory', 'overtimePlan'
  ];

  for (const model of models) {
    try {
      const records = await (prisma as any)[model].findMany({});
      console.log(`Model [${model}] has ${records.length} records.`);
      
      const toUpdate = records.filter((r: any) => r.companyId !== NEW_ID);
      if (toUpdate.length > 0) {
        console.log(`Updating ${toUpdate.length} records in ${model}...`);
        await (prisma as any)[model].updateMany({
           where: { companyId: { not: NEW_ID } },
           data: { companyId: NEW_ID }
        });
        
        // Also update those with NULL companyId
        await (prisma as any)[model].updateMany({
          where: { companyId: null },
          data: { companyId: NEW_ID }
        });
      }
    } catch (e: any) {
      console.error(`Error updating ${model}: ${e.message}`);
    }
  }

  console.log('Aggressive migration complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
