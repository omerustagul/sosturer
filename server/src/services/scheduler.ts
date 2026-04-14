import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { io } from '../lib/socket';

/**
 * Periodically checks for overtime plans and updates their status
 * and generates notifications for upcoming plans.
 */
export async function startScheduler() {
  logger.info('[Scheduler] Starting background tasks...');
  
  // Run every 5 minutes
  setInterval(async () => {
    try {
      await updateOvertimeStatuses();
      await checkUpcomingOvertimePlans();
    } catch (error) {
      logger.error('[Scheduler] Error in background tasks:', error);
    }
  }, 5 * 60 * 1000);

  // Initial run
  await updateOvertimeStatuses();
  await checkUpcomingOvertimePlans();
}

async function updateOvertimeStatuses() {
  const now = new Date();
  
  // 1. planned -> active (if start date <= now)
  const plansToActivate = await prisma.overtimePlan.findMany({
    where: {
      status: 'planned',
      startDate: { lte: now }
    }
  });

  for (const plan of plansToActivate) {
    try {
      const notification = await prisma.$transaction(async (tx) => {
        // Unpin approval notification
        await tx.notification.updateMany({
          where: {
            companyId: plan.companyId,
            metadata: { contains: `"planId":"${plan.id}"` },
            title: { contains: 'Onayı' }
          },
          data: {
            isPinned: false,
            isRead: true,
            actionTaken: true
          }
        });

        const p = await tx.overtimePlan.update({
          where: { id: plan.id },
          data: { status: 'active' }
        });

        const n = await tx.notification.create({
          data: {
            companyId: p.companyId,
            type: 'info',
            title: 'Mesai Başladı',
            message: `"${p.planName}" isimli mesai planı şu an aktif durumda.`,
            isPinned: true,
            metadata: JSON.stringify({ planId: p.id, type: 'overtime_started' })
          }
        });
        return n;
      });

      logger.info(`[Scheduler] Plan ${plan.id} activated and notification created`);
      io?.to(plan.companyId).emit('new_notification', notification);
      io?.to(plan.companyId).emit('overtime_status_updated');
    } catch (err) {
      logger.error(`[Scheduler] Failed to activate plan ${plan.id}:`, err);
    }
  }

  // 2. active -> completed (if end date <= now)
  const plansToComplete = await prisma.overtimePlan.findMany({
    where: {
      status: 'active',
      endDate: { lte: now }
    }
  });

  for (const plan of plansToComplete) {
    try {
      await prisma.$transaction([
        prisma.overtimePlan.update({ where: { id: plan.id }, data: { status: 'completed' } }),
        prisma.notification.updateMany({
          where: {
            metadata: { contains: `"planId":"${plan.id}"` },
            title: { contains: 'Başladı' }
          },
          data: { isPinned: false }
        })
      ]);
      logger.info(`[Scheduler] Plan ${plan.id} completed and notification unpinned`);
    } catch (err) {
      logger.error(`[Scheduler] Failed to complete plan ${plan.id}:`, err);
    }
  }

  if (plansToComplete.length > 0) {
    logger.info(`[Scheduler] Updated ${plansToComplete.length} plans to COMPLETED`);
    io?.emit('overtime_status_updated');
  }
}

async function checkUpcomingOvertimePlans() {
  const now = new Date();
  const twoDaysLater = new Date();
  twoDaysLater.setDate(now.getDate() + 2);

  // Find planned or active plans starting soon that don't have an action notification yet
  const upcomingPlans = await prisma.overtimePlan.findMany({
    where: {
      status: 'planned',
      notificationSent: false,
      startDate: {
        gte: now,
        lte: twoDaysLater
      }
    },
    include: { company: true }
  });

  for (const plan of upcomingPlans) {
    logger.info(`[Scheduler] Creating approval notification for plan: ${plan.planName}`);
    
    const notification = await prisma.$transaction(async (tx) => {
      const n = await tx.notification.create({
        data: {
          companyId: plan.companyId,
          type: 'action_required',
          title: 'Mesai Planı Onayı',
          message: `"${plan.planName}" isimli mesai planı başlamak üzere. Hâlâ onaylıyor musunuz?`,
          isPinned: true,
          metadata: JSON.stringify({ planId: plan.id, type: 'overtime_approval' })
        }
      });

      await tx.overtimePlan.update({
        where: { id: plan.id },
        data: { notificationSent: true }
      });

      return n;
    });

    // Emit to socket for real-time update
    io?.to(plan.companyId).emit('new_notification', notification);
  }
}
