import prisma from './server/src/lib/prisma';

async function main() {
  const companies = await prisma.company.findMany();
  console.log('Available companies:', companies.map(c => ({ id: c.id, name: c.name })));
  
  const target = companies.find(c => c.name === 'Test Şirketi 2');
  if (!target) {
    console.log('Company not found by name');
    return;
  }
  
  console.log('Deleting target:', target.id);
  
  // Unassign users
  await prisma.user.updateMany({
    where: { companyId: target.id },
    data: { companyId: null }
  });
  
  // Delete app settings (just in case cascade is being weird)
  await prisma.appSettings.deleteMany({
    where: { companyId: target.id }
  });

  await prisma.company.delete({
    where: { id: target.id }
  });
  
  console.log('Done');
}

main().catch(console.error).finally(() => prisma.$disconnect());
