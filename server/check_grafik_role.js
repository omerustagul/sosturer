const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const user = await prisma.user.findUnique({
       where: { email: 'grafik@medisolaris.com' }
    });
    console.log('USER ROLE:', user ? user.role : 'NOT FOUND');
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
