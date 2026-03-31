import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: { contains: 'Medisolaris' } }
  });
  console.log('Company:', JSON.stringify(company, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
