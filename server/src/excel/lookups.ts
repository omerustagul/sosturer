import prisma from '../lib/prisma';

export async function loadProductionRecordLookups() {
  const [machines, shifts, products, operators] = await Promise.all([
    prisma.machine.findMany({ select: { id: true, code: true } }),
    prisma.shift.findMany({ select: { id: true, shiftCode: true } }),
    prisma.product.findMany({ select: { id: true, productCode: true } }),
    prisma.operator.findMany({ select: { id: true, employeeId: true, fullName: true } }),
  ]);

  const machinesByCode = new Map(machines.map((m) => [m.code, { id: m.id, code: m.code }]));
  const shiftsByCode = new Map(shifts.map((s) => [s.shiftCode, { id: s.id, shiftCode: s.shiftCode }]));
  const productsByCode = new Map(products.map((p) => [p.productCode, { id: p.id, productCode: p.productCode }]));

  const operatorsByEmployeeId = new Map(operators.map((o) => [o.employeeId, { id: o.id, employeeId: o.employeeId, fullName: o.fullName }]));
  const operatorsByFullName = new Map<string, { id: string; employeeId: string; fullName: string }[]>();
  for (const o of operators) {
    const key = o.fullName.trim();
    const list = operatorsByFullName.get(key) || [];
    list.push({ id: o.id, employeeId: o.employeeId, fullName: o.fullName });
    operatorsByFullName.set(key, list);
  }

  return {
    machines,
    shifts,
    products,
    operators,
    machinesByCode,
    shiftsByCode,
    productsByCode,
    operatorsByEmployeeId,
    operatorsByFullName,
  };
}

