import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../lib/socket';

const router = Router();

// 1. Get notifications for current company
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.json([]);

    const notifications = await prisma.notification.findMany({
      where: { companyId },
      orderBy: [
        { createdAt: 'desc' }
      ],
      take: 50
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Bildirimler alınamadı' });
  }
});

// 2. Mark notification as read
router.put('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id: id as string },
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Okundu işaretleme başarısız' });
  }
});

// 3. Mark all as read
router.put('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    await prisma.notification.updateMany({
      where: { companyId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Tümünü okundu işaretleme başarısız' });
  }
});

// 4. Delete notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Bildirim silinemedi' });
  }
});

// 5. Delete all
router.delete('/delete-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    await prisma.notification.deleteMany({
      where: { companyId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Tümünü silme başarısız' });
  }
});

// 6. Handle notification action (Approval)
router.post('/:id/action', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve', 'cancel'

    const notification = await prisma.notification.findUnique({ where: { id: id as string } });
    if (!notification) return res.status(404).json({ error: 'Bildirim bulunamadı' });

    if (notification.metadata) {
      const metadata = JSON.parse(notification.metadata);
      if (metadata.type === 'overtime_approval') {
        const planId = metadata.planId;

        if (action === 'approve') {
          await prisma.overtimePlan.update({
            where: { id: planId },
            data: { status: 'planned' } // Already planned, maybe we just keep it or move to confirmed if we had that state. 
            // The user said: "evet basarsa o mesai planı otomatik şekilde ilerlemeli"
            // So we just mark the notification as action taken.
          });
        } else if (action === 'cancel') {
          await prisma.overtimePlan.update({
            where: { id: planId },
            data: { status: 'cancelled' }
          });
        }
      }
    }

    // Update notification state
    const updatedNotification = await prisma.notification.update({
      where: { id: id as string },
      data: { 
        actionTaken: true, 
        isPinned: false, 
        isRead: true 
      }
    });

    io?.to(notification.companyId).emit('notification_updated', updatedNotification);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Action error:', error);
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

export default router;
