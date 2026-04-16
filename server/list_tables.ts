import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
  console.log('TABLES:', JSON.stringify(tables, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
