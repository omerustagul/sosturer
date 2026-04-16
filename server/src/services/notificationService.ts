import prisma from '../lib/prisma';
import { io } from '../lib/socket';

export type NotificationType = 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS' | 'ACTION';

export class NotificationService {
  /**
   * Yeni bir bildirim oluşturur ve bağlanan tüm istemcilere (ilgili şirketteki) socket ile iletir.
   */
  static async create({
    companyId,
    type,
    title,
    message,
    link,
    metadata,
    isPinned = false
  }: {
    companyId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: any;
    isPinned?: boolean;
  }) {
    try {
      const notification = await prisma.notification.create({
        data: {
          companyId,
          type,
          title,
          message,
          link,
          metadata: metadata ? JSON.stringify(metadata) : null,
          isPinned,
          isRead: false,
          actionTaken: false
        }
      });

      // Socket.io ile anlık bildir
      if (io) {
        console.log(`[Notification] Emitting to company ${companyId}: ${title}`);
        io.to(companyId).emit('new_notification', notification);
      }

      return notification;
    } catch (error) {
      console.error('Notification creation failed:', error);
      return null;
    }
  }

  /**
   * Belirli bir şirket için genel bildirim gönderir
   */
  static async notifyCompany(companyId: string, title: string, message: string, type: NotificationType = 'INFO') {
    return this.create({ companyId, type, title, message });
  }

  /**
   * Yeni bir üretim emri bildirimi
   */
  static async notifyNewProductionOrder(companyId: string, lotNumber: string, productName: string) {
    return this.create({
      companyId,
      type: 'SUCCESS',
      title: 'Yeni Üretim Emri',
      message: `${productName} için ${lotNumber} lot numaralı yeni üretim emri oluşturuldu.`,
      link: `/production-orders`
    });
  }

  /**
   * Yeni bir mesai planı bildirimi
   */
  static async notifyNewOvertimePlan(companyId: string, planName: string, startDate: Date) {
    return this.create({
      companyId,
      type: 'ACTION',
      title: 'Yeni Mesai Planı',
      message: `${planName} isimli yeni bir mesai planı oluşturuldu. Onay bekleniyor.`,
      link: `/overtime`,
      isPinned: true,
      metadata: { action: 'approve_overtime' }
    });
  }
}
