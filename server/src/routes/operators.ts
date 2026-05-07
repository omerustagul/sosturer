import { Router } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const getCompanyId = (req: AuthRequest) => req.user?.companyId;

router.get('/', async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.json([]);

    const { is_operator } = req.query;
    const where: any = { companyId };
    
    if (is_operator === 'true') {
      where.isOperator = true;
    } else if (is_operator === 'false') {
      where.isOperator = false;
    }

    const operators = await prisma.operator.findMany({
      where,
      include: { 
        department: true,
        role: true 
      },
      orderBy: [{ displayOrder: 'asc' }, { fullName: 'asc' }],
    });
    res.json(operators);
  } catch (error) { 
    console.error('[Operators] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch operators' }); 
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const operator = await prisma.operator.findFirst({ where: { id: req.params.id as string, companyId: getCompanyId(req) } });
    if (!operator) return res.status(404).json({ error: 'Operator not found' });
    res.json(operator);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch operator' }); }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { departmentId, roleId, department, role, company, companyId, createdAt, updatedAt, ...rest } = req.body;
    
    // Type casting
    if (rest.hireDate) rest.hireDate = new Date(rest.hireDate);
    if (rest.experienceYears !== undefined) rest.experienceYears = rest.experienceYears === '' ? null : Number(rest.experienceYears);

    const operator = await prisma.operator.create({ 
      data: { 
        ...rest, 
        departmentId: departmentId || null,
        roleId: roleId || null,
        companyId: getCompanyId(req) as string
      },
      include: { department: true, role: true }
    });
    res.status(201).json(operator);
  } catch (error: any) { 
    console.error('[Operator] Create error:', error);
    res.status(500).json({ error: 'Failed to create operator: ' + error.message }); 
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id: _id, companyId, departmentId, roleId, department, role, company, createdAt, updatedAt, ...rest } = req.body;
    
    // Type casting
    if (rest.hireDate) rest.hireDate = new Date(rest.hireDate);
    if (rest.experienceYears !== undefined) rest.experienceYears = rest.experienceYears === '' ? null : Number(rest.experienceYears);

    const operator = await prisma.operator.update({ 
      where: { id: req.params.id as string }, 
      data: {
        ...rest,
        departmentId: departmentId || null,
        roleId: roleId || null
      },
      include: { department: true, role: true }
    });
    res.json(operator);
  } catch (error: any) { 
    console.error('[Operator] Update error:', error);
    res.status(500).json({ error: 'Failed to update operator: ' + error.message }); 
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.operator.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed to delete operator' }); }
});

router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    await prisma.$transaction(ids.map((id: string, index: number) => prisma.operator.update({ where: { id: id as string }, data: { displayOrder: index } })));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reorder operators' }); }
});

router.post('/bulk-delete', async (req: AuthRequest, res) => {
  const { ids } = req.body;
  try {
    await prisma.operator.deleteMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu silme başarısız' }); }
});

router.post('/bulk-update-status', async (req: AuthRequest, res) => {
  const { ids, status } = req.body;
  try {
    await prisma.operator.updateMany({ where: { id: { in: ids as string[] }, companyId: getCompanyId(req) }, data: { status } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu güncelleme başarısız' }); }
});

router.post('/bulk-update', async (req: AuthRequest, res) => {
  const { updates } = req.body;
  try {
    await prisma.$transaction(updates.map((u: any) => {
      const { id, data: originalData } = u;
      const data: any = { ...originalData };
      if (data.hireDate !== undefined) { data.hireDate = data.hireDate ? new Date(data.hireDate as string) : null; }
      if (data.experienceYears !== undefined) { const num = parseInt(data.experienceYears as string); if (!isNaN(num)) { data.experienceYears = num; } else { delete data.experienceYears; } }
      delete data.companyId;
      return prisma.operator.update({ where: { id: id as string }, data });
    }));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Toplu düzenleme başarısız' }); }
});

export default router;
