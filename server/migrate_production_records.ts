import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'medisolaris';

  // 1. Find the CNC department
  const cncDept = await prisma.department.findFirst({
    where: { companyId, code: 'IM-03' }
  });

  if (cncDept) {
    console.log(`Found CNC Department: ${cncDept.name} (${cncDept.id})`);

    // 2. Update department for tracking
    await prisma.department.update({
      where: { id: cncDept.id },
      data: {
        trackProductionRecords: true,
        productionRecordSlug: 'cnc-uretim'
      }
    });
    console.log('Updated CNC Department for tracking.');

    // 3. Assign CNC machines to this department
    const machines = await prisma.machine.findMany({
      where: { companyId, code: { startsWith: 'CNC-' } }
    });

    for (const machine of machines) {
      await prisma.machine.update({
        where: { id: machine.id },
        data: { departmentId: cncDept.id }
      });
    }
    console.log(`Assigned ${machines.length} machines to ${cncDept.name}`);

    // 4. Update existing production records
    const records = await prisma.productionRecord.findMany({
      where: { companyId, machine: { code: { startsWith: 'CNC-' } } }
    });

    let updatedCount = 0;
    for (const record of records) {
      await prisma.productionRecord.update({
        where: { id: record.id },
        data: { departmentId: cncDept.id }
      });
      updatedCount++;
    }
    console.log(`Updated ${updatedCount} production records with departmentId.`);
  } else {
    console.log('CNC Department (IM-03) not found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
