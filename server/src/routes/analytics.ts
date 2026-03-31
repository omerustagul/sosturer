import { Router } from 'express';
import prisma from '../lib/prisma';
import { endOfDay, parseISO, startOfDay, subDays } from 'date-fns';
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

export default router;
