
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.productionRecord.findMany({
    take: 5
  });
  
  console.log('Sample Records:');
  records.forEach(r => {
    console.log(`- ID: ${r.id}, CompanyId: ${r.companyId}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
