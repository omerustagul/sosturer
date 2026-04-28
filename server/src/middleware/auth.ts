import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { requestContext } from '../utils/asyncLocalStorage';
import { getRequestIp, isIpAllowed, parseAllowedIpList } from '../utils/securitySettings';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-super-secret-key-123';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
      return;
    }

    try {
      if (user.companyId) {
        const settings = await prisma.appSettings.findUnique({
          where: { companyId: user.companyId },
          select: { ipRestrictionEnabled: true, allowed_ip_list: true }
        });

        if (settings?.ipRestrictionEnabled) {
          const requestIp = getRequestIp(req);
          const allowedIps = parseAllowedIpList((settings as any).allowed_ip_list);

          if (!isIpAllowed(requestIp, allowedIps)) {
            res.status(403).json({ error: 'Bu IP adresinden erişime izin verilmiyor.' });
            return;
          }
        }
      }

      req.user = user;

      requestContext.run(
        { userId: user.id, userEmail: user.email, fullName: user.fullName, role: user.role, companyId: user.companyId },
        () => {
          next();
        }
      );
    } catch (error) {
      console.error('Security settings check failed:', error);
      res.status(500).json({ error: 'Güvenlik ayarları kontrol edilemedi.' });
    }
  });
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });
    return;
  }
  next();
};
