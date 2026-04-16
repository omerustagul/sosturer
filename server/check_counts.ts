import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'medisolaris';
  console.log(`Checking data for company: ${companyId}`);
  
  const models = [
    'machine', 
    'operator', 
    'product', 
    'shift', 
    'department',
    'productionRecord',
    'overtimePlan'
  ];

  for (const model of models) {
    try {
      const count = await (prisma as any)[model].count({
        where: { companyId }
      });
      console.log(`- ${model}: ${count} records`);
    } catch (e: any) {
      console.log(`- ${model}: Error checking - ${e.message}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
