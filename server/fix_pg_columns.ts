import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding missing columns to PostgreSQL...');

  try {
    // Add columns to notifications if they don't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "link" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "metadata" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN DEFAULT FALSE;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action_taken" BOOLEAN DEFAULT FALSE;
    `);
    console.log('Checked notifications columns');

    // Add columns to departments if they don't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'office';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "address" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "working_hours" TEXT;
    `);
    console.log('Checked departments columns');

    console.log('Schema sync completed successfully.');
  } catch (error) {
    console.error('Error syncing individual columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
