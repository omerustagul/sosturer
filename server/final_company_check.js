
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.company.findFirst({ where: { name: { contains: 'Medisolaris' } } });
  console.log('Medisolaris in DB:', c);
}

main().finally(() => prisma.$disconnect());
