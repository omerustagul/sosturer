import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const departments = await prisma.department.findMany();
  const companies = await prisma.company.findMany();
  const shifts = await prisma.shift.findMany();
  const operators = await prisma.operator.findMany({ include: { department: true } });
  console.log('Operators:', JSON.stringify(operators.map(o => ({ fullName: o.fullName, employeeId: o.employeeId, dept: o.department?.name, deptCode: o.department?.code })), null, 2));
  console.log('Departments:', JSON.stringify(departments.map(d => ({ id: d.id, name: d.name, code: d.code })), null, 2));
  console.log('Shifts:', JSON.stringify(shifts.map(s => ({ id: s.id, name: s.shiftName, code: s.shiftCode })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
