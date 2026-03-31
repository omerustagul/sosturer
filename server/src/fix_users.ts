import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_ID = '260101';

async function main() {
  console.log(`Aggressively setting ALL users to companyId: ${NEW_ID}`);
  await prisma.user.updateMany({
    data: { companyId: NEW_ID }
  });
  console.log(`Success.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
