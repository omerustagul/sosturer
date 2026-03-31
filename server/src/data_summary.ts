import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.productionRecord.count();
  const products = await prisma.product.count();
  const machine = await prisma.machine.count();
  const user = await prisma.user.count();

  console.log(`Summary: Users:${user}, Machines:${machine}, Products:${products}, Records:${records}`);
  
  if (records > 0) {
    const first = await prisma.productionRecord.findFirst({ select: { companyId: true } });
    console.log(`First record companyId: [${first?.companyId}]`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
