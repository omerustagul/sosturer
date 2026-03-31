const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const OLD_ID = 'medisolaris-id'; // If there's an old ID lying around
  const NEW_ID = '260101';
  
  // Tables with companyId
  const tables = [
    'machine',
    'operator',
    'shift',
    'product',
    'productionRecord',
    'importHistory',
    'overtimePlan',
    'department',
    'departmentRole',
    'user'
  ];

  for (const table of tables) {
    const records = await prisma[table].findMany();
    console.log(`Table ${table} has ${records.length} records.`);
    
    // Update any record that doesn't have the new ID if it's the only company in the DB
    const result = await prisma[table].updateMany({
      data: { companyId: NEW_ID }
    });
    console.log(`Updated ${result.count} records in ${table} to companyId: ${NEW_ID}`);
  }

  // Ensure the company itself exists with the correct ID
  const company = await prisma.company.findUnique({ where: { id: NEW_ID } });
  if (!company) {
    console.log(`Company ${NEW_ID} not found. Creating it...`);
    await prisma.company.create({
      data: {
        id: NEW_ID,
        name: 'Medisolaris Sağlık',
        companyEmail: 'info@medisolaris.com'
      }
    });
  } else {
    console.log(`Company ${NEW_ID} exists.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
