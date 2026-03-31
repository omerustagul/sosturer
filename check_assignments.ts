import prisma from './server/src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, fullName: true, companyId: true } });
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  
  console.log('RESULTS:', JSON.stringify({ users, companies }, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
