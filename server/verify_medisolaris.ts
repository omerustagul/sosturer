import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- Checking Database Enpoint: Postgres ---");
  
  const users = await prisma.user.findMany({
    select: { email: true, companyId: true, role: true }
  });
  console.log("Users in DB:", users);

  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });
  console.log("Companies in DB:", companies);

  const productionRecordCount = await prisma.productionRecord.count();
  console.log("Total Production Records in DB:", productionRecordCount);

  const medisolarisPR = await prisma.productionRecord.count({
    where: { companyId: 'medisolaris' }
  });
  console.log("Production Records for 'medisolaris':", medisolarisPR);

  const samplePR = await prisma.productionRecord.findFirst({
    where: { companyId: 'medisolaris' }
  });
  console.log("Sample Production Record for 'medisolaris':", samplePR);
}

main().catch(console.error).finally(() => prisma.$disconnect());
