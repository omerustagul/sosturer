import { PrismaClient } from '@prisma/client';
import { requestContext } from '../utils/asyncLocalStorage';
import { getIO } from './socket';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Temel Prisma İstemcisi
const prismaBase = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;

// -----------------------------------------------------
// PRISMA EXTENSION: Otomatik Audit Log (Kayıt Geçmişi)
// -----------------------------------------------------
export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);

        // Kendi kendini loglamasın
        if (model === 'AuditLog') return result;

        const trackedOps = ['create', 'update', 'delete', 'createMany', 'updateMany', 'deleteMany'];
        if (trackedOps.includes(operation)) {
          let actionType = 'UNKNOWN';
          if (operation.includes('create')) actionType = 'CREATE';
          if (operation.includes('update')) actionType = 'UPDATE';
          if (operation.includes('delete')) actionType = 'DELETE';

          // Retrieve context injected by auth middleware
          const ctx = requestContext.getStore();
          const changedBy = ctx ? ctx.fullName : 'Sistem';

          // Asenkron olarak Log tablosuna yaz
          prismaBase.auditLog.create({
            data: {
              tableName: model,
              recordId: (result as any)?.id ? String((result as any).id) : 'BULK_OP',
              action: actionType,
              newValues: result ? JSON.stringify(result).substring(0, 1000) : '',
              oldValues: args ? JSON.stringify(args).substring(0, 1000) : '',
              changedBy: changedBy,
              company_id: ctx?.companyId || null
            }
          }).then(newLog => {
            try {
              const io = getIO();
              if (io) {
                // Map to frontend interface: AuditLog (action, entity, entityId, details, user, createdAt)
                io.emit('activity:new', {
                  id: newLog.id,
                  action: newLog.action,
                  entity: newLog.tableName,
                  entityId: newLog.recordId,
                  details: newLog.newValues,
                  user: { fullName: newLog.changedBy || 'Sistem' },
                  createdAt: newLog.changedAt
                });
              }
            } catch (err) {
              // Socket not initialized yet, ignore
            }
          }).catch(e => console.error(`AuditLog Hatası [${model} - ${operation}]:`, e));
        }
        return result;
      }
    }
  }
}) as unknown as PrismaClient; // Cast to bypass strict type inference issues in extensions

export default prisma;
