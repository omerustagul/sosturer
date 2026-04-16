import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Investigation ---');
  
  try {
    const totalRecords = await prisma.productionRecord.count();
    console.log('Total Production Records in DB:', totalRecords);

    if (totalRecords > 0) {
      const firstRecord = await prisma.productionRecord.findFirst();
      console.log('Sample Record companyId:', firstRecord?.companyId);
    }

    const companies = await prisma.company.findMany();
    console.log('Companies in DB:', companies.map(c => ({ id: c.id, name: c.name })));

    const medisolaris = await prisma.company.findFirst({
      where: {
        OR: [
          { id: 'medisolaris' },
          { name: { contains: 'Medisolaris', mode: 'insensitive' } }
        ]
      }
    });
    console.log('Medisolaris result:', medisolaris);

  } catch (err) {
    console.error('Investigation error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
