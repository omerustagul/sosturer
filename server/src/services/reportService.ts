import prisma from '../lib/prisma';
import exceljs from 'exceljs';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

export class ReportService {
  /**
   * Generates a professional Excel report with multiple tabs: Details, Machine Summary, Product Summary, and Operator Summary
   */
  static async generateProductionExcel(
    companyId: string,
    startDate?: string,
    endDate?: string,
    filters?: { machineId?: string; operatorId?: string; productId?: string; shiftId?: string; productGroup?: string; category?: string; brand?: string }
  ) {
    const whereClause: any = { companyId };
    
    // Date Filtering
    if (startDate || endDate) {
      whereClause.productionDate = {};
      
      if (startDate && startDate.trim()) {
        const d = parseISO(startDate);
        if (isValid(d)) whereClause.productionDate.gte = startOfDay(d);
      }
      
      if (endDate && endDate.trim()) {
        const d = parseISO(endDate);
        if (isValid(d)) whereClause.productionDate.lte = endOfDay(d);
      }
    }

    // Apply relationship filters
    if (filters?.machineId && filters.machineId !== 'all') whereClause.machineId = filters.machineId;
    if (filters?.operatorId && filters.operatorId !== 'all') whereClause.operatorId = filters.operatorId;
    if (filters?.productId && filters.productId !== 'all') whereClause.productId = filters.productId;
    if (filters?.shiftId && filters.shiftId !== 'all') whereClause.shiftId = filters.shiftId;

    // Deep product property filters
    if ((filters?.productGroup && filters.productGroup !== 'all') || (filters?.category && filters.category !== 'all') || (filters?.brand && filters.brand !== 'all')) {
      whereClause.product = {};
      if (filters?.productGroup && filters.productGroup !== 'all') whereClause.product.productGroup = filters.productGroup;
      if (filters?.category && filters.category !== 'all') whereClause.product.category = filters.category;
      if (filters?.brand && filters.brand !== 'all') whereClause.product.brand = filters.brand;
    }

    const workbook = new exceljs.Workbook();

    // FETCH RECORDS
    const records = await prisma.productionRecord.findMany({
      where: whereClause,
      include: {
        machine: true,
        operator: true,
        shift: true,
        product: true
      },
      orderBy: { productionDate: 'desc' }
    });

    // 1. DETAIL SHEET
    const detailSheet = workbook.addWorksheet('Detaylı Üretim Verileri');
    const headers = [
      { header: 'TARİH', key: 'date', width: 14 },
      { header: 'VARDİYA', key: 'shift', width: 14 },
      { header: 'TEZGAH', key: 'machine', width: 14 },
      { header: 'OPERATÖR', key: 'operator', width: 22 },
      { header: 'ÜRÜN KODU', key: 'productCode', width: 18 },
      { header: 'ÜRÜN ADI', key: 'productName', width: 25 },
      { header: 'PLAN ADET', key: 'planned', width: 12 },
      { header: 'ÜRETİLEN', key: 'produced', width: 12 },
      { header: 'HATALI', key: 'defect', width: 10 },
      { header: 'SÜRE (dk)', key: 'duration', width: 12 },
      { header: 'DURUŞ (dk)', key: 'downtime', width: 12 },
      { header: 'BİRİM SÜRE (sn)', key: 'cycleTime', width: 14 },
      { header: 'OEE %', key: 'oee', width: 10 },
      { header: 'NOTLAR', key: 'notes', width: 30 }
    ];

    detailSheet.columns = headers;

    // DETAIL DATA ROWS
    records.forEach((r, idx) => {
      const row = detailSheet.addRow({
        date: new Date(r.productionDate).toLocaleDateString('tr-TR'),
        shift: r.shift?.shiftName || '-',
        machine: r.machine?.code || '-',
        operator: r.operator?.fullName || '-',
        productCode: r.product?.productCode || '-',
        productName: r.product?.productName || '-',
        planned: r.plannedQuantity || 0,
        produced: r.producedQuantity || 0,
        defect: r.defectQuantity || 0,
        duration: r.actualDurationMinutes || 0,
        downtime: r.downtimeMinutes || 0,
        cycleTime: r.cycleTimeSeconds || 0,
        oee: r.oee ? r.oee / 100 : 0,
        notes: r.notes || ''
      });

      const oeeCell = row.getCell(13);
      oeeCell.numFmt = '0.0%';
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    // 2. MACHINE SUMMARY SHEET
    const machineSheet = workbook.addWorksheet('Tezgah Özeti');
    machineSheet.columns = [
      { header: 'TEZGAH KODU', key: 'code', width: 15 },
      { header: 'TOPLAM ÜRETİM', key: 'produced', width: 15 },
      { header: 'TOPLAM HATALI', key: 'defects', width: 15 },
      { header: 'TOPLAM DURUŞ (dk)', key: 'downtime', width: 18 },
      { header: 'ORTALAMA OEE %', key: 'oee', width: 15 }
    ];

    const machineStats: Record<string, any> = {};
    records.forEach(r => {
      const id = r.machine?.code || 'CNC';
      if (!machineStats[id]) machineStats[id] = { produced: 0, defects: 0, downtime: 0, oeeSum: 0, count: 0 };
      machineStats[id].produced += r.producedQuantity || 0;
      machineStats[id].defects += r.defectQuantity || 0;
      machineStats[id].downtime += r.downtimeMinutes || 0;
      machineStats[id].oeeSum += r.oee || 0;
      machineStats[id].count += 1;
    });

    Object.keys(machineStats).forEach(key => {
      const s = machineStats[key];
      const row = machineSheet.addRow({
        code: key,
        produced: s.produced,
        defects: s.defects,
        downtime: s.downtime,
        oee: s.count > 0 ? (s.oeeSum / (s.count * 100)) : 0
      });
      row.getCell(5).numFmt = '0.0%';
    });

    // 3. PRODUCT SUMMARY SHEET
    const productSheet = workbook.addWorksheet('Ürün Özeti');
    productSheet.columns = [
      { header: 'ÜRÜN KODU', key: 'code', width: 18 },
      { header: 'TOPLAM ÜRETİLEN', key: 'produced', width: 15 },
      { header: 'TOPLAM HATALI', key: 'defects', width: 15 },
      { header: 'ORTALAMA OEE %', key: 'oee', width: 15 }
    ];

    const productStats: Record<string, any> = {};
    records.forEach(r => {
      const id = r.product?.productCode || 'PRD';
      if (!productStats[id]) productStats[id] = { produced: 0, defects: 0, oeeSum: 0, count: 0 };
      productStats[id].produced += r.producedQuantity || 0;
      productStats[id].defects += r.defectQuantity || 0;
      productStats[id].oeeSum += r.oee || 0;
      productStats[id].count += 1;
    });

    Object.keys(productStats).forEach(key => {
      const s = productStats[key];
      const row = productSheet.addRow({
        code: key,
        produced: s.produced,
        defects: s.defects,
        oee: s.count > 0 ? (s.oeeSum / (s.count * 100)) : 0
      });
      row.getCell(4).numFmt = '0.0%';
    });

    // Styling Headers for all sheets
    workbook.worksheets.forEach(ws => {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      ws.getRow(1).height = 25;
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    return workbook;
  }

  /**
   * Generates a modern OEE and KPI analysis report as Excel
   */
  static async generateKPIExcel(companyId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { companyId };
    if (startDate || endDate) {
      whereClause.productionDate = {};
      if (startDate) {
        const d = parseISO(startDate);
        if (isValid(d)) whereClause.productionDate.gte = startOfDay(d);
      }
      if (endDate) {
        const d = parseISO(endDate);
        if (isValid(d)) whereClause.productionDate.lte = endOfDay(d);
      }
    }

    const [records, machines] = await Promise.all([
      prisma.productionRecord.findMany({ where: whereClause, include: { machine: true, shift: true } }),
      prisma.machine.findMany({ where: { companyId } })
    ]);

    const workbook = new exceljs.Workbook();
    
    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet('Yönetici Özeti');
    summarySheet.mergeCells('A1:F1');
    summarySheet.getCell('A1').value = 'ANAHTAR PERFORMANS GÖSTERGELERİ (KPI)';
    summarySheet.getCell('A1').font = { bold: true, size: 14 };
    
    const avgOee = records.length > 0 ? records.reduce((s, r) => s + (r.oee || 0), 0) / records.length : 0;
    const totalProduced = records.reduce((s, r) => s + (r.producedQuantity || 0), 0);
    const totalDowntime = records.reduce((s, r) => s + (r.downtimeMinutes || 0), 0);
    
    summarySheet.addRow(['Ortalama OEE', (avgOee / 100)]);
    summarySheet.addRow(['Toplam Üretim', totalProduced]);
    summarySheet.addRow(['Toplam Duruş (dk)', totalDowntime]);
    summarySheet.getCell('B2').numFmt = '0.0%';

    // Sheet 2: Machine Comparison
    const machineSheet = workbook.addWorksheet('Tezgah Analizi');
    machineSheet.columns = [
      { header: 'Tezgah Code', key: 'code', width: 20 },
      { header: 'Kayıt Sayısı', key: 'count', width: 15 },
      { header: 'Başarı Oranı %', key: 'success', width: 15 },
      { header: 'Ort. OEE %', key: 'oee', width: 15 }
    ];

    machines.forEach(m => {
      const mRecords = records.filter(r => r.machineId === m.id);
      const mOee = mRecords.length > 0 ? mRecords.reduce((s, r) => s + (r.oee || 0), 0) / mRecords.length / 100 : 0;
      machineSheet.addRow({
        code: m.code,
        count: mRecords.length,
        success: mRecords.length > 0 ? (mRecords.filter(r => (r.oee || 0) >= 80).length / mRecords.length) : 0,
        oee: mOee
      });
    });
    
    machineSheet.getColumn(3).numFmt = '0.0%';
    machineSheet.getColumn(4).numFmt = '0.0%';

    return workbook;
  }

  /**
   * Generates a daily OEE and KPI trend report
   */
  static async generateTrendExcel(companyId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { companyId };
    if (startDate || endDate) {
      whereClause.productionDate = {};
      if (startDate) {
        const d = parseISO(startDate);
        if (isValid(d)) whereClause.productionDate.gte = startOfDay(d);
      }
      if (endDate) {
        const d = parseISO(endDate);
        if (isValid(d)) whereClause.productionDate.lte = endOfDay(d);
      }
    }

    const records = await prisma.productionRecord.findMany({
      where: whereClause,
      select: { productionDate: true, oee: true, availability: true, performance: true, quality: true },
      orderBy: { productionDate: 'asc' }
    });

    const daily: Record<string, { count: number; oee: number; availability: number; performance: number; quality: number }> = {};
    for (const r of records) {
      if (r.oee === null || r.oee === undefined) continue;
      const key = r.productionDate.toISOString().split('T')[0];
      if (!daily[key]) daily[key] = { count: 0, oee: 0, availability: 0, performance: 0, quality: 0 };
      daily[key].count += 1;
      daily[key].oee += r.oee;
      daily[key].availability += (r.availability || 0);
      daily[key].performance += (r.performance || 0);
      daily[key].quality += (r.quality || 0);
    }

    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('OEE Trend');
    
    sheet.columns = [
      { header: 'TARİH', key: 'date', width: 15 },
      { header: 'OEE (%)', key: 'oee', width: 15 },
      { header: 'KULLANILABİLİRLİK (%)', key: 'availability', width: 22 },
      { header: 'PERFORMANS (%)', key: 'performance', width: 20 },
      { header: 'KALİTE (%)', key: 'quality', width: 15 },
      { header: 'KAYIT SAYISI', key: 'count', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };

    Object.keys(daily).sort().forEach((d) => {
      const row = daily[d];
      sheet.addRow({
        date: d,
        oee: Number((row.oee / row.count / 100).toFixed(4)),
        availability: Number((row.availability / row.count / 100).toFixed(4)),
        performance: Number((row.performance / row.count / 100).toFixed(4)),
        quality: Number((row.quality / row.count / 100).toFixed(4)),
        count: row.count,
      });
    });

    sheet.getColumn(2).numFmt = '0.0%';
    sheet.getColumn(3).numFmt = '0.0%';
    sheet.getColumn(4).numFmt = '0.0%';
    sheet.getColumn(5).numFmt = '0.0%';

    return workbook;
  }
}
