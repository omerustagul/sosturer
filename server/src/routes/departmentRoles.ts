import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const getCompanyId = (req: AuthRequest) => req.user?.companyId || '';

// Get all roles for the company (including their departments)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const roles = await prisma.departmentRole.findMany({
      where: { companyId: getCompanyId(req) },
      include: { department: true },
      orderBy: { displayOrder: 'asc' }
    });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Create a new role in a department
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { departmentId, department, company, companyId, id, createdAt, updatedAt, ...data } = req.body;
    const role = await prisma.departmentRole.create({
      data: {
        ...data,
        departmentId,
        companyId: getCompanyId(req)
      },
      include: { department: true }
    });
    res.status(201).json(role);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create role: ' + error.message });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id: _id, companyId, department, company, createdAt, updatedAt, ...data } = req.body;
    const role = await prisma.departmentRole.update({
      where: { id: req.params.id as string },
      data,
      include: { department: true }
    });
    res.json(role);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.departmentRole.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Reorder functionality
router.post('/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    await Promise.all(
      ids.map((id: string, index: number) =>
        prisma.departmentRole.update({
          where: { id },
          data: { displayOrder: index }
        })
      )
    );
    res.json({ message: 'Reordered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder roles' });
  }
});

export default router;
