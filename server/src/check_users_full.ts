import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, companyId: true, role: true } });
  console.log(`Users total: ${users.length}`);
  users.forEach(u => console.log(`[${u.email}] companyId: [${u.companyId}]`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
