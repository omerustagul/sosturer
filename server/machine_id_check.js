
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const machines = await prisma.machine.findMany({
    where: { companyId: 'medisolaris-main' }
  });
  
  console.log('Machines for medisolaris-main:', machines.length);
  machines.forEach(m => {
    console.log(`- ${m.code} (ID: ${m.id})`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
