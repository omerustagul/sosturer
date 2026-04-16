import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      companyId: true,
      role: true
    }
  });

  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });

  console.log('Users:', JSON.stringify(users, null, 2));
  console.log('Companies:', JSON.stringify(companies, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
