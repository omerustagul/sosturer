import prisma from '../lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export interface OEEDataInput {
  producedQuantity: number;
  cycleTimeSeconds: number;      // ◄─ Saniye olarak CNC verisi
  plannedDowntimeMinutes?: number;
  defectQuantity?: number;
  shiftDurationMinutes: number; // ◄─ Vardiya süresi (Dakika)
}

export interface OEEResult {
  plannedQuantity: number;       // ◄─ Otomatik hesaplanan (Max kapasite)
  actualDurationMinutes: number;  // ◄─ Üretim sayısına göre "çalışması gereken" süre
  plannedDowntimeMinutes: number;
  unplannedDowntimeMinutes: number; // ◄─ Kalan süreden otomatik hesaplanan
  downtimeMinutes: number;        // ◄─ Toplam Duruş
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  plannedDurationMinutes: number;
}

/**
 * Otomatik OEE ve Duruş Hesaplama Servisi
 * Kullanıcı girdilerini azaltıp sistem otomatizasyonunu artırmak için güncellenmiştir.
 */
export async function calculateOEE(data: OEEDataInput): Promise<Partial<OEEResult>> {
  try {
    const {
      producedQuantity,
      cycleTimeSeconds,
      plannedDowntimeMinutes = 0,
      defectQuantity = 0,
      shiftDurationMinutes
    } = data;

    if (!cycleTimeSeconds || cycleTimeSeconds <= 0 || !shiftDurationMinutes || shiftDurationMinutes <= 0) {
      return {};
    }

    // 1. Planlanan Adet (Max Kapasite) = (Vardiya Süresi * 60) / Birim Süre
    const plannedQuantity = Math.floor((shiftDurationMinutes * 60) / cycleTimeSeconds);

    // 2. Gerçek Çalışma Süresi (Dakika) = (Üretilen Adet * Birim Süre) / 60
    // Not: Bu üretim adeti için tezgahın "aktif üretimde" geçirmesi gereken süredir.
    const actualDurationMinutes = (producedQuantity * cycleTimeSeconds) / 60;

    // 3. Toplam Duruş (Dakika) = Vardiya Süresi - Çalışma Süresi
    const downtimeMinutes = Math.max(0, shiftDurationMinutes - actualDurationMinutes);

    // 4. Plansız Duruş = Toplam Duruş - Planlı Duruş
    const unplannedDowntimeMinutes = Math.max(0, downtimeMinutes - plannedDowntimeMinutes);

    // 5. OEE Bileşenleri
    // Planned Production Time (PPT) = Net Müsait Süre
    const ppt = shiftDurationMinutes - plannedDowntimeMinutes;

    // Availability = Çalışılan Süre / (Vardiya Süresi - Planlı Duruş)
    let availability = 0;
    if (ppt > 0) {
      availability = (actualDurationMinutes / ppt) * 100;
      if (availability > 100) availability = 100;
    }

    // Performance = Bu sistemde "hız kaybı" olmadığı varsayılıyor (Çalışma süresi zaten cycle-adetten geliyor)
    // Eğer üretilen adet planlanandan (kapasiteden) fazlaysa performans > 100 çıkabilir.
    // Ancak kullanıcı arayüzünde verimliliği "zaman kaybı" olarak görmek istediği için 
    // Performans 100 sabitleyip, kayıpları Availability (Duruş) üzerinden yönetiyoruz.
    const performance = 100;

    // Quality = (Sağlam / Toplam) * 100
    let quality = 0;
    if (producedQuantity > 0) {
      quality = ((producedQuantity - defectQuantity) / producedQuantity) * 100;
      if (quality > 100) quality = 100;
    }

    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    return {
      plannedQuantity,
      actualDurationMinutes: Number(actualDurationMinutes.toFixed(2)),
      plannedDowntimeMinutes,
      unplannedDowntimeMinutes: Number(unplannedDowntimeMinutes.toFixed(2)),
      downtimeMinutes: Number(downtimeMinutes.toFixed(2)),
      plannedDurationMinutes: Number(actualDurationMinutes.toFixed(2)), // Teorik çalışma = beklenen süre
      availability: Number(availability.toFixed(2)),
      performance: Number(performance.toFixed(2)),
      quality: Number(quality.toFixed(2)),
      oee: Number(oee.toFixed(2))
    };

  } catch (error) {
    console.error('Error in Automated OEE Calculation:', error);
    return {};
  }
}

/**
 * Rebalances OEE and Downtime across all records for a specific Machine, Shift, and Date.
 * Essential for multi-product shifts.
 */
export async function rebalanceShift(productionDate: Date, machineId: string, shiftId: string, companyId: string) {
  if (!companyId) {
    console.error('rebalanceShift: companyId is required');
    return;
  }
  
  console.log(`REBALANCING SHIFT: ${machineId} on ${productionDate.toISOString()}`);

  // Use consistent local date-fns logic to match the rest of the API
  const targetDate = startOfDay(new Date(productionDate));
  const nextDay = endOfDay(new Date(productionDate));

  const records = await prisma.productionRecord.findMany({
    where: {
      companyId,
      productionDate: { gte: targetDate, lte: nextDay },
      machineId,
      shiftId
    },
    include: { shift: true }
  });

  if (records.length === 0) {
    console.log(`rebalanceShift: No records found for ${machineId} on ${targetDate.toISOString()}`);
    return;
  }

  const shift = records[0].shift;
  const shiftDuration = shift.durationMinutes;

  // 1. Calculate Aggregates
  const totalActual = records.reduce((acc, r) => acc + (r.producedQuantity * r.cycleTimeSeconds) / 60, 0);
  const totalPlannedDowntime = records.reduce((acc, r) => acc + (r.plannedDowntimeMinutes || 0), 0);
  
  const ppt = shiftDuration - totalPlannedDowntime;
  const availability = ppt > 0 ? Math.min(100, (totalActual / ppt) * 100) : 0;
  
  // Total downtime is the remaining time in the shift not spent producing
  const totalDowntime = Math.max(0, shiftDuration - totalActual);
  const totalUnplanned = Math.max(0, totalDowntime - totalPlannedDowntime);

  // 2. Distribute and Update
  for (const record of records) {
    const safeCycleTime = record.cycleTimeSeconds > 0 ? record.cycleTimeSeconds : 1;
    const recordActual = (record.producedQuantity * safeCycleTime) / 60;
    
    // Proportional distribution of unplanned downtime
    const share = totalActual > 0 ? recordActual / totalActual : 1 / records.length;
    
    const recordUnplanned = totalUnplanned * share;
    const recordDowntime = recordUnplanned + (record.plannedDowntimeMinutes || 0);

    const quality = record.producedQuantity > 0 
      ? ((record.producedQuantity - (record.defectQuantity || 0)) / record.producedQuantity) * 100 
      : 100;
      
    const performance = 100; // Simplified model as per architecture
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
    
    // Recalculate Planned Quantity based on potentially updated cycleTimeSeconds
    const recordPlannedQuantity = Math.floor((shiftDuration * 60) / safeCycleTime);

    const recordId = record.id;
    await (prisma.productionRecord as any).update({
      where: { id: recordId } as any,
      data: {
        availability: Number(availability.toFixed(2)),
        performance: Number(performance.toFixed(2)),
        quality: Number(quality.toFixed(2)),
        oee: Number(oee.toFixed(2)),
        unplannedDowntimeMinutes: Number(recordUnplanned.toFixed(2)),
        downtimeMinutes: Number(recordDowntime.toFixed(2)),
        actualDurationMinutes: Number(recordActual.toFixed(2)),
        plannedQuantity: recordPlannedQuantity
      }
    });
  }
}
