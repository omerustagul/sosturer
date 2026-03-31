import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/departments - Tüm departmanları listele
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const departments = await prisma.department.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { displayOrder: 'asc' }
    });
    res.json(departments);
  } catch (error: any) {
    console.error('[Departments] List error:', error);
    res.status(500).json({ error: 'Departmanlar getirilemedi: ' + error.message });
  }
});

// POST /api/departments - Yeni departman oluştur
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: 'Şirket bilgisi bulunamadı' });

    const { name, code, status, displayOrder } = req.body;
    
    const department = await prisma.department.create({
      data: {
        companyId,
        name,
        code,
        status: status || 'active',
        displayOrder: displayOrder || 0
      }
    });

    res.status(201).json(department);
  } catch (error: any) {
    console.error('[Departments] Create error:', error);
    res.status(500).json({ error: 'Departman oluşturulamadı: ' + error.message });
  }
});

// PUT /api/departments/:id - Departman güncelle
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, status, displayOrder } = req.body;
    const department = await prisma.department.update({
      where: { id: req.params.id as string },
      data: {
        name,
        code,
        status,
        displayOrder: displayOrder !== undefined ? displayOrder : undefined
      }
    });
    res.json(department);
  } catch (error: any) {
    console.error('[Departments] Update error:', error);
    res.status(500).json({ error: 'Departman güncellenemedi: ' + error.message });
  }
});

// DELETE /api/departments/:id - Departman sil
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.department.delete({
      where: { id: req.params.id as string }
    });
    res.json({ success: true, message: 'Departman silindi.' });
  } catch (error: any) {
    console.error('[Departments] Delete error:', error);
    res.status(500).json({ error: 'Departman silinemedi (bu departmana bağlı personeller olabilir): ' + error.message });
  }
});

// POST /api/departments/reorder - Sıralamayı güncelle
router.post('/reorder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Geçersiz veri' });

    await Promise.all(
      ids.map((id, index) =>
        prisma.department.update({
          where: { id },
          data: { displayOrder: index }
        })
      )
    );

    res.json({ success: true, message: 'Sıralama güncellendi.' });
  } catch (error: any) {
    console.error('[Departments] Reorder error:', error);
    res.status(500).json({ error: 'Sıralama güncellenemedi.' });
  }
});

export default router;
