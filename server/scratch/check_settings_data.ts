
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSettings() {
  try {
    const settings = await prisma.appSettings.findMany();
    console.log('Current AppSettings in DB:');
    settings.forEach(s => {
      console.log(`Company: ${s.companyId}`);
      console.log(`Dashboard Layout: ${s.dashboardLayout}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error checking settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
