import { Router } from 'express';
import prisma from '../lib/prisma';
import exceljs from 'exceljs';
import multer from 'multer';
import { ReportService } from '../services/reportService';
import { AuthRequest, authenticateToken } from '../middleware/auth';

// Use memory storage for Excel parsing
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// ==========================================
// EXCEL EXPORT - Üretim Kayıtları İndir
// ==========================================
router.get('/excel/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, machineId, operatorId, productId, shiftId, productGroup, category, brand } = req.query;
    const workbook = await ReportService.generateProductionExcel(
      companyId,
      startDate as string,
      endDate as string,
      {
        machineId: machineId as string,
        operatorId: operatorId as string,
        productId: productId as string,
        shiftId: shiftId as string,
        productGroup: productGroup as string,
        category: category as string,
        brand: brand as string,
      }
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=uretim_raporu_${new Date().getTime()}.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ error: 'Excel disari aktarilirken hata olustu.' });
  }
});

// ==========================================
// EXCEL EXPORT - Günlük OEE Trend
// ==========================================
router.get('/excel/oee-trend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const workbook = await ReportService.generateTrendExcel(companyId, startDate as string, endDate as string);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=oee_trend_analizi_${new Date().getTime()}.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('OEE Trend Export Error:', error);
    res.status(500).json({ error: 'OEE trend disari aktarilirken hata olustu.' });
  }
});

// ==========================================
// EXCEL EXPORT - Tezgah Verimlilik Özeti
// ==========================================
router.get('/excel/machine-efficiency', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;
    const workbook = await ReportService.generateKPIExcel(companyId, startDate as string, endDate as string);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tezgah_verimlilik_analizi_${new Date().getTime()}.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Machine Efficiency Export Error:', error);
    res.status(500).json({ error: 'Tezgah ozeti disari aktarilirken hata olustu.' });
  }
});

// ==========================================
// EXCEL TEMPLATE - Şablon İndir
// ==========================================
router.get('/excel/template', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user.companyId;
    const workbook = new exceljs.Workbook();
    
    // 1. Data Sheet (Kayıtların girileceği sayfa)
    const dataSheet = workbook.addWorksheet('Veri Girisi');
    
    dataSheet.columns = [
      { header: 'Uretim Tarihi (YYYY-MM-DD)', key: 'date', width: 25 },
      { header: 'Vardiya Kodu', key: 'shift', width: 15 },
      { header: 'Tezgah Kodu', key: 'machine', width: 15 },
      { header: 'Operator Sicil No', key: 'operator', width: 20 },
      { header: 'Urun Kodu', key: 'product', width: 15 },
      { header: 'Uretim Adeti', key: 'produced', width: 15 },
      { header: 'Hatalı Adet', key: 'defect', width: 15 },
      { header: 'Gercek Sure (dk)', key: 'duration', width: 15 },
      { header: 'Durus Suresi (dk)', key: 'downtime', width: 15 },
      { header: 'Notlar', key: 'notes', width: 30 }
    ];

    dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };

    // Örnek 1 satır veri
    dataSheet.addRow({
      date: new Date().toISOString().split('T')[0],
      shift: 'V-01',
      machine: 'CNC-001',
      operator: 'OP-101',
      product: 'PRD-A100',
      produced: 100,
      defect: 2,
      duration: 480,
      downtime: 30,
      notes: 'Örnek kayıt'
    });

    // 2. Reference Sheet (ID ve Kodların olduğu referans sayfası)
    const refSheet = workbook.addWorksheet('Referans Kodlari');
    
    const [machines, operators, products, shifts] = await Promise.all([
      prisma.machine.findMany({ where: { companyId }, select: { code: true, name: true } }),
      prisma.operator.findMany({ where: { companyId }, select: { employeeId: true, fullName: true } }),
      prisma.product.findMany({ where: { companyId }, select: { productCode: true, productName: true } }),
      prisma.shift.findMany({ where: { companyId }, select: { shiftCode: true, shiftName: true } })
    ]);

    refSheet.columns = [
      { header: 'Tezgah Kodlari', key: 'machines', width: 20 },
      { header: 'Operator Kodlari', key: 'operators', width: 20 },
      { header: 'Urun Kodlari', key: 'products', width: 20 },
      { header: 'Vardiya Kodlari', key: 'shifts', width: 20 },
    ];
    refSheet.getRow(1).font = { bold: true };

    const maxRows = Math.max(machines.length, operators.length, products.length, shifts.length);
    for (let i = 0; i < maxRows; i++) {
        refSheet.addRow({
            machines: machines[i] ? `${machines[i].code} (${machines[i].name})` : '',
            operators: operators[i] ? `${operators[i].employeeId} (${operators[i].fullName})` : '',
            products: products[i] ? `${products[i].productCode} (${products[i].productName})` : '',
            shifts: shifts[i] ? `${shifts[i].shiftCode} (${shifts[i].shiftName})` : '',
        });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'uretim_sablonu.xlsx');

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Excel Template Error:', error);
    res.status(500).json({ error: 'Excel sablonu olusturulamadi.' });
  }
});

// ==========================================
// EXCEL IMPORT - Şablondan Veri Oku ve Kaydet
// ==========================================
router.post('/excel/import', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Lütfen bir dosya yükleyin.' });
  }

  try {
    const companyId = req.user.companyId;
    const workbook = new exceljs.Workbook();
    // @ts-ignore
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet('Veri Girisi');
    if (!worksheet) {
      return res.status(400).json({ error: 'Excel dosyasında "Veri Girisi" adında bir sayfa bulunamadı. Lütfen indirilen şablonu kullanın.' });
    }

    const rows: any[] = [];
    let isError = false;
    let errorDetails = '';

    const dbMachines = await prisma.machine.findMany({ where: { companyId } });
    const dbOperators = await prisma.operator.findMany({ where: { companyId } });
    const dbProducts = await prisma.product.findMany({ where: { companyId } });
    const dbShifts = await prisma.shift.findMany({ where: { companyId } });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const dateVal = row.getCell(1).value;
      const shiftCode = row.getCell(2).text;
      const machineCode = row.getCell(3).text;
      const opCode = row.getCell(4).text;
      const prodCode = row.getCell(5).text;
      const producedQ = Number(row.getCell(6).value) || 0;
      const defectQ = Number(row.getCell(7).value) || 0;
      const duration = Number(row.getCell(8).value) || 0;
      const downtime = Number(row.getCell(9).value) || 0;
      const notes = row.getCell(10).text;

      if (!dateVal || !shiftCode || !machineCode || !opCode || !prodCode) {
        // Skip empty rows if they appear at the end
        if (!dateVal && !shiftCode && !machineCode) return;
        isError = true;
        errorDetails = `Satır ${rowNumber}: Zorunlu alanlardan biri eksik.`;
        return; 
      }

      const foundMachine = dbMachines.find(m => m.code === machineCode);
      const foundOperator = dbOperators.find(o => o.employeeId === opCode);
      const foundProduct = dbProducts.find(p => p.productCode === prodCode);
      const foundShift = dbShifts.find(s => s.shiftCode === shiftCode);

      if (!foundMachine || !foundOperator || !foundProduct || !foundShift) {
        if (!isError) {
          isError = true;
          errorDetails = `Satır ${rowNumber}: Kodlar doğrulanamadı. Referans sayfasını inceleyin.`;
        }
        return;
      }

      rows.push({
        companyId,
        productionDate: typeof dateVal === 'string' ? new Date(dateVal) : dateVal,
        shiftId: foundShift.id,
        machineId: foundMachine.id,
        operatorId: foundOperator.id,
        productId: foundProduct.id,
        producedQuantity: producedQ,
        defectQuantity: defectQ,
        actualDurationMinutes: duration,
        plannedDurationMinutes: duration,
        downtimeMinutes: downtime,
        notes: notes
      });
    });

    if (isError) return res.status(400).json({ error: errorDetails });
    if (rows.length === 0) return res.status(400).json({ error: 'Excel dosyası boş veya veri okunamadı.' });

    const { calculateOEE } = await import('../services/oeeCalculator');
    let insertedCount = 0;

    for (const record of rows) {
      const calculatedMetrics = await calculateOEE(record);
      const finalRecord = { ...record, ...calculatedMetrics };
      await prisma.productionRecord.create({ data: finalRecord });
      insertedCount++;
    }

    res.status(200).json({ 
      success: true, 
      message: `${insertedCount} adet kayıt başarıyla içe aktarıldı.` 
    });

  } catch (error) {
    console.error('Excel Import Error:', error);
    res.status(500).json({ error: 'İçe aktarma sırasında sunucu hatası oluştu.' });
  }
});

export default router;
