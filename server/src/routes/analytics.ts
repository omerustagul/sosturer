import { Router } from 'express';
import prisma from '../lib/prisma';
import { eachDayOfInterval, endOfDay, parseISO, startOfDay, subDays } from 'date-fns';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

function resolveDateRange(query: any) {
  const endParam = typeof query.end === 'string' ? query.end : undefined;
  const startParam = typeof query.start === 'string' ? query.start : undefined;
  const days = Number(query.days) || 7;

  if (startParam || endParam) {
    const end = endOfDay(endParam ? parseISO(endParam) : new Date());
    const start = startOfDay(startParam ? parseISO(startParam) : end);
    return { start, end, days: Math.max(1, days) };
  }

  const end = endOfDay(new Date());
  const start = startOfDay(subDays(end, Math.max(0, days - 1)));
  return { start, end, days: Math.max(1, days) };
}

const getCompanyId = (req: AuthRequest) => req.user?.companyId;

// Hızlı OEE Trendi (Genel, Son X gün)
router.get('/oee-trend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { start, end } = resolveDateRange(req.query);

    const records = await prisma.productionRecord.findMany({
      where: {
        companyId,
        productionDate: { gte: start, lte: end }
      },
      select: {
        productionDate: true,
        oee: true,
        availability: true,
        performance: true,
        quality: true
      },
      orderBy: { productionDate: 'asc' }
    });

    const dailyData: Record<string, { oee: number, count: number, availability: number, performance: number, quality: number }> = {};
    
    records.forEach(r => {
      if(r.oee === null || r.oee === undefined) return;
      const d = r.productionDate.toISOString().split('T')[0];
      if (!dailyData[d]) {
        dailyData[d] = { oee: 0, count: 0, availability: 0, performance: 0, quality: 0 };
      }
      dailyData[d].oee += r.oee;
      dailyData[d].availability += (r.availability || 0);
      dailyData[d].performance += (r.performance || 0);
      dailyData[d].quality += (r.quality || 0);
      dailyData[d].count += 1;
    });

    const result = Object.keys(dailyData).map(k => ({
      date: k,
      oee: Number((dailyData[k].oee / dailyData[k].count).toFixed(2)),
      availability: Number((dailyData[k].availability / dailyData[k].count).toFixed(2)),
      performance: Number((dailyData[k].performance / dailyData[k].count).toFixed(2)),
      quality: Number((dailyData[k].quality / dailyData[k].count).toFixed(2))
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Makine Bazlı Performans & Duruş (Downtime)
router.get('/machine-efficiency', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const { start, end } = resolveDateRange(req.query);
    const records = await prisma.productionRecord.findMany({
      where: {
        companyId,
        productionDate: { gte: start, lte: end }
      },
      include: { machine: true }
    });

    const machineData: Record<string, { totalDowntime: number, totalProduced: number, totalPlanned: number, count: number, oeeSum: number }> = {};

    records.forEach(r => {
      const g = r.machine.code;
      if (!machineData[g]) {
        machineData[g] = { totalDowntime: 0, totalProduced: 0, totalPlanned: 0, count: 0, oeeSum: 0 };
      }
      machineData[g].totalDowntime += (r.downtimeMinutes || 0);
      machineData[g].totalProduced += (r.producedQuantity || 0);
      machineData[g].totalPlanned += (r.plannedQuantity || 0);
      machineData[g].oeeSum += (r.oee || 0);
      machineData[g].count += 1;
    });

    const result = Object.keys(machineData).map(k => ({
      machine: k,
      downtimeMinutes: machineData[k].totalDowntime,
      producedQuantity: machineData[k].totalProduced,
      achievementRate: machineData[k].totalPlanned > 0 ? Number((machineData[k].totalProduced / machineData[k].totalPlanned * 100).toFixed(1)) : 0,
      averageOee: machineData[k].count > 0 ? Number((machineData[k].oeeSum / machineData[k].count).toFixed(1)) : 0,
      recordCount: machineData[k].count,
      oeeSum: Number(machineData[k].oeeSum.toFixed(2)),
      plannedQuantity: machineData[k].totalPlanned
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Stok Özeti (Top Ürünler)
router.get('/stock-summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const stockLevels = await prisma.stockLevel.findMany({
      where: { companyId },
      include: { product: { select: { productCode: true, productName: true } } },
      orderBy: { quantity: 'desc' },
      take: 10
    });

    // Group by product name (sum quantities across warehouses)
    const summary: Record<string, number> = {};
    stockLevels.forEach(sl => {
      const name = sl.product.productName;
      summary[name] = (summary[name] || 0) + sl.quantity;
    });

    const result = Object.entries(summary).map(([name, quantity]) => ({ name, quantity }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Stok özeti alınamadı' });
  }
});

// Satış Özeti (Son 30 Gün)
router.get('/sales-overview', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    const thirtyDaysAgo = subDays(new Date(), 30);

    const orders = await prisma.order.findMany({
      where: {
        companyId,
        orderDate: { gte: thirtyDaysAgo }
      },
      select: { orderDate: true, totalAmount: true }
    });

    const dailyStats: Record<string, { count: number, total: number }> = {};
    orders.forEach(o => {
      const date = o.orderDate.toISOString().split('T')[0];
      if (!dailyStats[date]) dailyStats[date] = { count: 0, total: 0 };
      dailyStats[date].count++;
      dailyStats[date].total += (o.totalAmount || 0);
    });

    const result = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      count: stats.count,
      amount: Number(stats.total.toFixed(2))
    })).sort((a,b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Satış özeti alınamadı' });
  }
});

router.get('/missing-production', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.json({
        summary: { missingEntries: 0, missingDaysCount: 0, uniqueMachines: 0, uniqueShifts: 0 },
        byDate: [],
        byMachine: [],
        byShift: [],
        dailyDetail: [],
        missingRecords: []
      });
    }

    const { start, end } = resolveDateRange(req.query);
    const machineIdFilter =
      typeof req.query.machineId === 'string' && req.query.machineId && req.query.machineId !== 'all'
        ? req.query.machineId
        : undefined;
    const shiftIdFilter =
      typeof req.query.shiftId === 'string' && req.query.shiftId && req.query.shiftId !== 'all'
        ? req.query.shiftId
        : undefined;

    const [machinesAll, shiftsAll, records, settings, companyLocations] = await Promise.all([
      prisma.machine.findMany({
        where: { companyId, status: 'active' },
        select: { id: true, code: true, name: true }
      }),
      prisma.shift.findMany({
        where: { companyId, status: 'active' },
        select: { id: true, shiftName: true }
      }),
      prisma.productionRecord.findMany({
        where: { companyId, productionDate: { gte: start, lte: end } },
        select: { productionDate: true, machineId: true, shiftId: true }
      }),
      prisma.appSettings.findUnique({ where: { companyId } }),
      prisma.locations.findMany({ where: { company_id: companyId } })
    ]);

    const offDays: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM company_off_days WHERE company_id = $1`,
      companyId
    );

    const offDayDates = new Set(offDays.map((od: any) => {
      const d = new Date(od.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${dayStr}`;
    }));

    // Handle reference location for working hours
    const refLocationId = (settings as any)?.referenceLocationId;
    const refLocation = (refLocationId && refLocationId !== '')
      ? companyLocations.find(l => l.id === refLocationId)
      : (companyLocations.find(l => l.is_main) || companyLocations[0]);
    const workingHours = refLocation?.working_hours as any;
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Parse standard shifts
    let standardShiftIds: string[] = [];
    try {
      standardShiftIds = JSON.parse((settings as any)?.standardShiftIds || '[]');
    } catch (e) {
      standardShiftIds = [];
    }

    const machines = machineIdFilter ? machinesAll.filter((m) => m.id === machineIdFilter) : machinesAll;
    const shifts = shiftIdFilter ? shiftsAll.filter((s) => s.id === shiftIdFilter) : shiftsAll;

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const existingKeys = new Set(
      records.map((r) => `${formatDate(r.productionDate)}|${r.machineId}|${r.shiftId}`)
    );

    const days = eachDayOfInterval({ start, end });
    const missingRecords: Array<{ date: string; machineId: string; machineCode: string; machineName: string; shiftId: string; shiftName: string }> = [];

    for (const day of days) {
      const dateKey = formatDate(day);
      
      // SKIP Company Off-Days
      if (offDayDates.has(dateKey)) continue;

      // Check if day is working day
      const dayName = daysOfWeek[day.getDay()];
      if (workingHours && workingHours[dayName]) {
        const schedule = workingHours[dayName];
        const isWorking = schedule.enabled !== false && schedule.active !== false;
        if (!isWorking) continue;
      }

      // Skip today - production isn't finished until the day is over
      if (dateKey === formatDate(new Date())) continue;
      for (const machine of machines) {
        if (standardShiftIds.length > 0) {
          // If ANY of standard shifts exist, it's NOT missing.
          const anyStandardExists = standardShiftIds.some(sid => existingKeys.has(`${dateKey}|${machine.id}|${sid}`));
          if (!anyStandardExists) {
            const firstShiftId = standardShiftIds[0];
            const shiftInfo = shifts.find(s => s.id === firstShiftId) || shifts[0];
            missingRecords.push({
              date: dateKey,
              machineId: machine.id,
              machineCode: machine.code,
              machineName: machine.name,
              shiftId: firstShiftId,
              shiftName: shiftInfo?.shiftName || 'Standart'
            });
          }
        } else {
          // Fallback: Check every active shift
          for (const shift of shifts) {
            const key = `${dateKey}|${machine.id}|${shift.id}`;
            if (!existingKeys.has(key)) {
              missingRecords.push({
                date: dateKey,
                machineId: machine.id,
                machineCode: machine.code,
                machineName: machine.name,
                shiftId: shift.id,
                shiftName: shift.shiftName
              });
            }
          }
        }
      }
    }

    const byDateMap: Record<string, { date: string; missingCount: number; machines: string[] }> = {};
    const byMachineMap: Record<string, { machineId: string; machineCode: string; machineName: string; missingCount: number; missingDates: string[] }> = {};

    missingRecords.forEach((m) => {
      if (!byDateMap[m.date]) byDateMap[m.date] = { date: m.date, missingCount: 0, machines: [] };
      byDateMap[m.date].missingCount += 1;
      if (!byDateMap[m.date].machines.includes(m.machineCode)) byDateMap[m.date].machines.push(m.machineCode);

      if (!byMachineMap[m.machineId]) {
        byMachineMap[m.machineId] = {
          machineId: m.machineId,
          machineCode: m.machineCode,
          machineName: m.machineName,
          missingCount: 0,
          missingDates: []
        };
      }
      byMachineMap[m.machineId].missingCount += 1;
      if (!byMachineMap[m.machineId].missingDates.includes(m.date)) byMachineMap[m.machineId].missingDates.push(m.date);
    });

    const byShiftMap: Record<string, { shiftId: string; shiftName: string; missingCount: number }> = {};
    missingRecords.forEach((m) => {
      if (!byShiftMap[m.shiftId]) {
        byShiftMap[m.shiftId] = { shiftId: m.shiftId, shiftName: m.shiftName, missingCount: 0 };
      }
      byShiftMap[m.shiftId].missingCount += 1;
    });

    const dailyRowsMap: Record<string, typeof missingRecords> = {};
    missingRecords.forEach((m) => {
      if (!dailyRowsMap[m.date]) dailyRowsMap[m.date] = [];
      dailyRowsMap[m.date].push(m);
    });
    const dailyDetail = Object.keys(dailyRowsMap)
      .sort((a, b) => a.localeCompare(b))
      .map((date) => ({
        date,
        rows: dailyRowsMap[date].sort((x, y) => x.machineCode.localeCompare(y.machineCode) || x.shiftName.localeCompare(y.shiftName))
      }));

    const byDate = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date));
    const byMachine = Object.values(byMachineMap).sort((a, b) => b.missingCount - a.missingCount);
    const byShift = Object.values(byShiftMap).sort((a, b) => b.missingCount - a.missingCount);
    const missingDaysCount = new Set(missingRecords.map((m) => m.date)).size;

    res.json({
      summary: {
        missingEntries: missingRecords.length,
        missingDaysCount,
        uniqueMachines: Object.keys(byMachineMap).length,
        uniqueShifts: Object.keys(byShiftMap).length,
        rangeStart: start.toISOString().split('T')[0],
        rangeEnd: end.toISOString().split('T')[0]
      },
      byDate,
      byMachine,
      byShift,
      dailyDetail,
      missingRecords
    });
  } catch (error: any) {
    console.error('Missing Production Analysis Error:', error);
    res.status(500).json({ error: 'Eksik üretim kaydı analizi alınamadı', details: error.message });
  }
});

export default router;
