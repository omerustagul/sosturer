import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const OLD_ID = 'medisolaris-main';
const NEW_ID = '260101';

async function main() {
  console.log(`Starting migration from ${OLD_ID} to ${NEW_ID}...`);

  // We have to disable foreign key checks to update the ID, or do it in order.
  // SQLite doesn't easily allow disabling FKs in a transaction for Prisma.
  // We'll create the new company first, update children, then delete the old company.
  
  const oldCompany = await prisma.company.findUnique({ where: { id: OLD_ID } });
  if (!oldCompany) {
    console.error(`Company ${OLD_ID} not found!`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create temporary company with new ID (copy data)
    const { id, ...data } = oldCompany;
    await tx.company.create({
      data: { ...data, id: NEW_ID }
    });

    console.log('New company created.');

    // 2. Update all child tables
    console.log('Updating users...');
    await tx.user.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating machines...');
    await tx.machine.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating operators...');
    await tx.operator.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating shifts...');
    await tx.shift.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating departments...');
    await tx.department.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating department roles...');
    await tx.departmentRole.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating products...');
    await tx.product.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating records...');
    await tx.productionRecord.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating settings...');
    await tx.appSettings.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating history...');
    await tx.importHistory.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    console.log('Updating plans...');
    await tx.overtimePlan.updateMany({ where: { companyId: OLD_ID }, data: { companyId: NEW_ID } });

    // 3. Delete old company
    await tx.company.delete({ where: { id: OLD_ID } });
    
    console.log('Old company deleted.');
  });

  console.log('Migration completed successfully!');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
