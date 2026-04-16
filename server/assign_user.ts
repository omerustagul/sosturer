import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.update({
    where: { email: 'test@test.com' },
    data: { companyId: '260101', role: 'admin' }
  });
  console.log('User updated:', user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
