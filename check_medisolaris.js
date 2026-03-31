const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'grafik@medisolaris.com' },
      include: { company: true }
    });
    console.log('USER INFO:', JSON.stringify(user, null, 2));

    const companies = await prisma.company.findMany();
    console.log('ALL COMPANIES:', JSON.stringify(companies, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
