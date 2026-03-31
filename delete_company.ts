import prisma from './server/src/lib/prisma';

async function main() {
  const companyId = 'test-company';
  
  // Find users in the company
  const users = await prisma.user.findMany({ where: { companyId } });
  console.log(`Unassigning ${users.length} users from the company...`);
  
  // Unassign users (optional, but safer if deleting company)
  await prisma.user.updateMany({
    where: { companyId },
    data: { companyId: null }
  });

  console.log(`Deleting company: ${companyId}...`);
  await prisma.company.delete({ where: { id: companyId } });
  
  console.log('Successfully deleted Test Şirketi 2');
}

main().catch(console.error).finally(() => prisma.$disconnect());
