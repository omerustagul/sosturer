import prisma from './server/src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: true, companyId: true } });
  console.log('Total Users:', users.length);
  console.log('Users Data:', JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
