import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log('Companies:', companies);

  const users = await prisma.user.findMany({ select: { id: true, email: true, companyId: true, role: true } });
  console.log('Users:', users);

  const machines = await prisma.machine.findMany({ select: { id: true, name: true, companyId: true } });
  console.log('Machines count:', machines.length, 'Samples:', machines.slice(0, 3));

  const departments = await prisma.department.findMany({ select: { id: true, name: true, companyId: true } });
  console.log('Departments count:', departments.length, 'Samples:', departments.slice(0, 3));

  const products = await prisma.product.findMany({ select: { id: true, code: true, companyId: true } });
  console.log('Products count:', products.length, 'Samples:', products.slice(0, 3));
}

main().catch(console.error).finally(() => prisma.$disconnect());
