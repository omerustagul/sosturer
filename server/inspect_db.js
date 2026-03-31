const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();
  console.log('COMPANIES:', JSON.stringify(companies, null, 2));
  
  const users = await prisma.user.findMany({ select: { id: true, email: true, companyId: true } });
  console.log('USERS:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
