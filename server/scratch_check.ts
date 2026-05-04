import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const departments = await prisma.department.findMany({
    include: { machines: true, operators: true }
  });
  console.log('DEPARTMENTS:');
  console.dir(departments, { depth: null });

  const machines = await prisma.machine.findMany();
  console.log('MACHINES:');
  console.dir(machines, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
