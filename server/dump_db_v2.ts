import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.count();
  const companies = await prisma.company.count();
  const records = await prisma.productionRecord.count();
  console.log('USERS COUNT:', users);
  console.log('COMPANIES COUNT:', companies);
  console.log('RECORDS COUNT:', records);
  
  if (companies > 0) {
    const companyList = await prisma.company.findMany();
    console.log('COMPANIES:', JSON.stringify(companyList, null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
