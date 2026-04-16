
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({ select: { email: true, companyId: true, role: true } });
    console.log('Users in DB:');
    users.forEach(u => {
      console.log(`Email: ${u.email}, Company: ${u.companyId}, Role: ${u.role}`);
    });
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
