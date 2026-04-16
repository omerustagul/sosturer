import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.update({
    where: { email: 'test@test.com' },
    data: { password: hashedPassword, companyId: '260101', role: 'admin' }
  });
  console.log('User updated with known password:', user.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
