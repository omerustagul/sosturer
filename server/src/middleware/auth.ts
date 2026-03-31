import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requestContext } from '../utils/asyncLocalStorage';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-super-secret-key-123';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
      return;
    }
    
    req.user = user;
    
    requestContext.run(
      { userId: user.id, userEmail: user.email, fullName: user.fullName, role: user.role, companyId: user.companyId }, 
      () => {
        next();
      }
    );
  });
};

// Admin kontrolü - sadece admin veya superadmin rolündeki kullanıcılar geçer
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });
    return;
  }
  next();
};
