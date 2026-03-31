import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_ID = '260101';

async function main() {
  console.log(`Checking data for companyId: ${NEW_ID}`);
  
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$') && k !== 'company');
  
  for (const model of models) {
    try {
      const records = await (prisma as any)[model].findMany({
        where: { companyId: { not: NEW_ID } }
      });
      if (records.length > 0) {
        console.log(`Model [${model}] has ${records.length} records with WRONG companyId! Examples:`, records.slice(0, 2).map((r: any) => r.companyId));
        
        await (prisma as any)[model].updateMany({
           where: { companyId: { not: NEW_ID } },
           data: { companyId: NEW_ID }
        });
        console.log(`  Fixed.`)
      } else {
        const total = await (prisma as any)[model].count({ where: { companyId: NEW_ID } });
        console.log(`Model [${model}] OK. Count: ${total}`);
      }
    } catch (e) {
      // Skip models without companyId
    }
  }
  
  console.log('Database sync complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
