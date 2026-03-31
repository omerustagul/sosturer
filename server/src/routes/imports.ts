import { Router } from 'express';
import exceljs from 'exceljs';
import multer from 'multer';
import prisma from '../lib/prisma';
import type { ImportType } from '../excel/excelTypes';
import { DynamicImportService } from '../services/dynamicImportService';
import { calculateOEE, rebalanceShift } from '../services/oeeCalculator';
import type { AuthRequest } from '../middleware/auth';
import { createImportErrorReportWorkbook } from '../excel/productionRecordsExcel';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function normalizeImportType(input: unknown): ImportType | null {
  const t = String(input || '').trim().toLowerCase();
  if (!t) return null;
  const allowed: ImportType[] = [
    'production_records', 'products', 'operators', 'machines', 
    'shifts', 'departments', 'department_roles', 'production_standards'
  ];
  return (allowed as string[]).includes(t) ? (t as ImportType) : null;
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new exceljs.Workbook();
  // @ts-ignore exceljs buffer typing mismatch sometimes
  await workbook.xlsx.load(buffer);
  return workbook;
}

router.post('/validate', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin.' });
  if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Sadece .xlsx dosyaları kabul edilir.' });
  }

  const importType = normalizeImportType((req.body as any)?.importType) || 'production_records';
  const modelName = DynamicImportService.getModelName(importType);
  
  if (!modelName) return res.status(400).json({ error: `Geçersiz import tipi: ${importType}` });

  try {
    const workbook = await loadWorkbook(req.file.buffer);
    const result = await DynamicImportService.validate(modelName, workbook);

    return res.json({
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      successCount: result.parsedRows.length,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });
  } catch (error) {
    console.error('Import validate error:', error);
    return res.status(500).json({ error: 'Dosya doğrulama sırasında hata oluştu.' });
  }
});

router.post('/preview', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin.' });
  if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Sadece .xlsx dosyaları kabul edilir.' });
  }

  const importType = normalizeImportType((req.body as any)?.importType) || 'production_records';
  const modelName = DynamicImportService.getModelName(importType);

  if (!modelName) return res.status(400).json({ error: `Geçersiz import tipi: ${importType}` });

  try {
    const workbook = await loadWorkbook(req.file.buffer);
    const result = await DynamicImportService.validate(modelName, workbook);

    // OEE Calculation for preview rows
    let previewSamples = result.parsedRows.slice(0, 3);
    if (importType === 'production_records') {
      const enrichedSamples = [];
      for (const row of previewSamples) {
        let shiftDuration = 480; 
        if (row.shiftId) {
          const s = await prisma.shift.findUnique({ where: { id: row.shiftId } });
          if (s) shiftDuration = s.durationMinutes;
        }

        const calculated = await calculateOEE({
          producedQuantity: row.producedQuantity,
          cycleTimeSeconds: row.cycleTimeSeconds,
          plannedDowntimeMinutes: row.plannedDowntimeMinutes || 0,
          defectQuantity: row.defectQuantity || 0,
          shiftDurationMinutes: shiftDuration
        }) as any;

        enrichedSamples.push({ 
          ...row, 
          ...calculated,
          actualDurationMinutes: Math.round(calculated.actualDurationMinutes || 0),
          plannedDowntimeMinutes: Math.round(calculated.plannedDowntimeMinutes || 0),
          unplannedDowntimeMinutes: Math.round(calculated.unplannedDowntimeMinutes || 0),
          downtimeMinutes: Math.round(calculated.downtimeMinutes || 0)
        });
      }
      previewSamples = enrichedSamples;
    }

    return res.json({
      totalRows: result.totalRows,
      sampleData: previewSamples,
      valid: result.errors.length === 0,
      errors: result.errors.slice(0, 20),
      warnings: result.warnings.slice(0, 20),
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });
  } catch (error) {
    console.error('Import preview error:', error);
    return res.status(500).json({ error: 'Önizleme sırasında hata oluştu.' });
  }
});

router.post('/execute', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin.' });
  if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Sadece .xlsx dosyaları kabul edilir.' });
  }

  const importType = normalizeImportType((req.body as any)?.importType) || 'production_records';
  const modelName = DynamicImportService.getModelName(importType);

  if (!modelName) return res.status(400).json({ error: `Geçersiz import tipi: ${importType}` });

  try {
    const workbook = await loadWorkbook(req.file.buffer);
    const result = await DynamicImportService.validate(modelName, workbook);

    let userId = req.user?.id || null;
    const companyId = req.user?.companyId;

    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        userId = null; 
      }
    }

    if (result.errors.length > 0) {
      const history = await prisma.importHistory.create({
        data: {
          companyId: companyId as string,
          importType,
          fileName: req.file.originalname,
          status: 'failed',
          totalRows: result.totalRows,
          successCount: 0,
          errorCount: result.errors.length,
          warningsCount: result.warnings.length,
          errors: result.errors as any,
          warnings: result.warnings as any,
          createdByUserId: userId as string || undefined,
        },
      });

      return res.status(400).json({
        success: false,
        message: 'Dosyada hatalar var. Hata raporunu indirip düzeltin.',
        successCount: 0,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        importId: history.id,
        downloadUrl: `/api/imports/${history.id}/error-report`,
        errors: result.errors.slice(0, 20),
      });
    }

    // Inject companyId into all rows
    const rowsWithCompany = result.parsedRows.map(row => ({
      ...row,
      companyId: companyId as string
    }));

    // Special handling for production_records: calculate OEE
    let rowsToInsert = rowsWithCompany;
    if (importType === 'production_records') {
      const enrichedRows = [];
      for (const row of rowsWithCompany) {
        let shiftDuration = 480; // default
        if (row.shiftId) {
          const s = await prisma.shift.findUnique({ where: { id: row.shiftId } });
          if (s) shiftDuration = s.durationMinutes;
        }

        const calculated = await calculateOEE({
          producedQuantity: row.producedQuantity,
          cycleTimeSeconds: row.cycleTimeSeconds,
          plannedDowntimeMinutes: row.plannedDowntimeMinutes || 0,
          defectQuantity: row.defectQuantity || 0,
          shiftDurationMinutes: shiftDuration
        }) as any;

        // Use Float values for DB consistency
        enrichedRows.push({ 
          ...row, 
          ...calculated,
          actualDurationMinutes: calculated.actualDurationMinutes || 0,
          plannedDowntimeMinutes: calculated.plannedDowntimeMinutes || 0,
          unplannedDowntimeMinutes: calculated.unplannedDowntimeMinutes || 0,
          downtimeMinutes: calculated.downtimeMinutes || 0
        });
      }
      rowsToInsert = enrichedRows;
    }

    const executionResult = await DynamicImportService.execute(modelName, rowsToInsert);

    // After successful insertion, if it's production records, we need to balance the affected shifts!
    if (importType === 'production_records' && executionResult.count > 0) {
      const uniqueContexts = new Set<string>();
      for (const row of rowsToInsert) {
        if (row.productionDate && row.machineId && row.shiftId) {
          // Normalizing the date to avoid duplicate processing of the same day
          const dateStr = new Date(row.productionDate).toISOString().split('T')[0];
          uniqueContexts.add(`${dateStr}|${row.machineId}|${row.shiftId}`);
        }
      }
      
      // Execute rebalance for each discovered shift context
      const contextPromises = Array.from(uniqueContexts).map(ctx => {
        const [dateStr, mId, sId] = ctx.split('|');
        const companyId = (req as any).user?.companyId;
        return rebalanceShift(new Date(dateStr), mId, sId, companyId).catch((err: any) => {
          console.error(`Rebalance failed for context ${ctx}:`, err);
        });
      });
      await Promise.all(contextPromises);
    }

    const history = await prisma.importHistory.create({
      data: {
        companyId: companyId as string,
        importType,
        fileName: req.file.originalname,
        status: 'executed',
        totalRows: result.totalRows,
        successCount: executionResult.count,
        errorCount: 0,
        warningsCount: executionResult.logs.length,
        errors: [] as any,
        warnings: executionResult.logs as any,
        createdByUserId: userId as string || undefined,
      },
    });

    return res.json({
      success: true,
      message: `${executionResult.count} satır başarıyla içe aktarıldı.`,
      successCount: executionResult.count,
      errorCount: 0,
      warningCount: result.warnings.length,
      logs: executionResult.logs,
      importId: history.id,
    });
  } catch (error: any) {
    console.error('Import execute error:', error);
    return res.status(500).json({ 
      error: 'İçe aktarma sırasında sunucu hatası oluştu.', 
      details: error.message,
      logs: [] 
    });
  }
});

router.get('/history', async (_req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number((_req.query as any)?.limit) || 20, 100);
    const offset = Math.max(Number((_req.query as any)?.offset) || 0, 0);

    const [total, data] = await Promise.all([
      prisma.importHistory.count(),
      prisma.importHistory.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { createdBy: { select: { id: true, email: true, fullName: true } } },
      }),
    ]);

    return res.json({ total, data });
  } catch (error) {
    console.error('Import history error:', error);
    return res.status(500).json({ error: 'Import geçmişi alınamadı.' });
  }
});

router.get('/:importId/details', async (req: AuthRequest, res) => {
  try {
    const importId = String(req.params.importId);
    const history = await prisma.importHistory.findUnique({
      where: { id: importId },
      include: { createdBy: { select: { id: true, email: true, fullName: true } } },
    });
    if (!history) return res.status(404).json({ error: 'Import bulunamadı.' });
    return res.json(history);
  } catch (error) {
    console.error('Import details error:', error);
    return res.status(500).json({ error: 'Import detayları alınamadı.' });
  }
});

router.get('/:importId/error-report', async (req: AuthRequest, res) => {
  try {
    const importId = String(req.params.importId);
    const history = await prisma.importHistory.findUnique({ where: { id: importId } });
    if (!history) return res.status(404).json({ error: 'Import bulunamadı.' });

    const errors = (history.errors as any[]) || [];
    const warnings = (history.warnings as any[]) || [];

    const workbook = createImportErrorReportWorkbook({ importType: history.importType as ImportType, errors, warnings });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=import_errors_${importId}.xlsx`);
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Error report generation error:', error);
    return res.status(500).json({ error: 'Hata raporu oluşturulamadı.' });
  }
});

router.delete('/:importId/rollback', async (req: AuthRequest, res) => {
  try {
    const importId = String(req.params.importId);
    const history = await prisma.importHistory.findUnique({ where: { id: importId } });
    if (!history) return res.status(404).json({ error: 'Import bulunamadı.' });

    if (history.status !== 'executed') {
      return res.status(400).json({ error: `Rollback yapılamaz. Import status: ${history.status}` });
    }

    const ids = (history.createdRecordIds as any[]) || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Rollback için kayıt bulunamadı.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.productionRecord.deleteMany({ where: { id: { in: ids.map(String) } } });
      await tx.importHistory.update({ where: { id: importId }, data: { status: 'rolled_back' } });
    });

    return res.json({ success: true, message: 'Rollback tamamlandı.' });
  } catch (error) {
    console.error('Rollback error:', error);
    return res.status(500).json({ error: 'Rollback sırasında hata oluştu.' });
  }
});

export default router;
