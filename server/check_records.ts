import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.productionRecord.findMany({ take: 5 });
  console.log('RECORDS:', JSON.stringify(records, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
