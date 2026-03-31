
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.productionRecord.count();
  const machines = await prisma.machine.count();
  const operators = await prisma.operator.count();
  const products = await prisma.product.count();
  
  console.log({
    records,
    machines,
    operators,
    products
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
