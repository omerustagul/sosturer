const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { users: true, productionRecords: true } }
      }
    });
    console.log('COMPANIES:', JSON.stringify(companies, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
