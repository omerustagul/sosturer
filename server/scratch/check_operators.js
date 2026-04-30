const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const operators = await prisma.operator.findMany({
    select: {
      id: true,
      fullName: true,
      companyId: true,
      employeeId: true
    }
  });
  console.log('Total operators:', operators.length);
  const byCompany = operators.reduce((acc, op) => {
    acc[op.companyId] = (acc[op.companyId] || 0) + 1;
    return acc;
  }, {});
  console.log('Operators by company:', JSON.stringify(byCompany, null, 2));
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      companyId: true
    }
  });
  console.log('Users by company:', JSON.stringify(users.reduce((acc, u) => {
    acc[u.companyId] = (acc[u.companyId] || 0) + 1;
    return acc;
  }, {}), null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
