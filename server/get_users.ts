import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, companyId: true, role: true } });
  fs.writeFileSync('u.json', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
