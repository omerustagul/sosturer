export const fieldTranslations: Record<string, string> = {
  // Common
  'id': 'ID',
  'createdAt': 'Oluşturulma Tarihi',
  'updatedAt': 'Güncelleme Tarihi',
  'status': 'Durum',
  'notes': 'Notlar',

  // Machine
  'code': 'Tezgah/Vardiya Kodu',
  'name': 'Tezgah Adı',
  'brand': 'Marka',
  'model': 'Model',
  'installedDate': 'Kurulum Tarihi',
  'capacityPerShift': 'Vardiya Kapasitesi',

  // Operator
  'employeeId': 'Personel ID',
  'fullName': 'Ad Soyad',
  'department': 'Departman',
  'phone': 'Telefon',
  'email': 'E-posta',
  'hireDate': 'İşe Giriş Tarihi',
  'experienceYears': 'Tecrübe (Yıl)',
  'certifications': 'Sertifikalar',

  // Shift
  'shiftCode': 'Vardiya Kodu',
  'shiftName': 'Vardiya Adı',
  'startTime': 'Başlangıç Saati',
  'endTime': 'Bitiş Saati',
  'durationMinutes': 'Vardiya Süresi (dk)',
  'colorCode': 'Renk Kodu',

  // Product
  'productCode': 'Ürün Kodu',
  'productName': 'Ürün Adı',
  'description': 'Açıklama',
  'unitOfMeasure': 'Ölçü Birimi',
  'category': 'Kategori',

  // ProductionRecord
  'productionDate': 'Üretim Tarihi',
  'shiftId': 'Vardiya',
  'machineId': 'Tezgah',
  'operatorId': 'Operatör',
  'productId': 'Ürün',
  'plannedQuantity': 'Planlanan Adet',
  'cycleTimeSeconds': 'Birim Süre (sn)',
  'producedQuantity': 'Üretilen Adet',
  'actualDurationMinutes': 'Çalışma Süresi (dk)',
  'plannedDurationMinutes': 'Beklenen Çalışma (dk)',
  'downtimeMinutes': 'Toplam Duruş (dk)',
  'plannedDowntimeMinutes': 'Planlı Duruş (dk)',
  'unplannedDowntimeMinutes': 'Plansız Duruş (dk)',
  'availability': 'Kullanılabilirlik (%)',
  'performance': 'Performans (%)',
  'quality': 'Kalite (%)',
  'oee': 'Verimlilik (OEE %)',
  'defectQuantity': 'Hatalı Adet',
  'qualityIssues': 'Kalite Sorunları',

  // ProductionStandard
  'unitTimeSeconds': 'Birim Süre (sn/adet)',
  'acceptableDowntimePercent': 'Kabul Edilen Duruş %',
  'targetOeePercent': 'Hedef OEE %',
  'qualityTargetPercent': 'Kalite Hedefi %',
  'effectiveDate': 'Yürürlüğe Giriş Tarihi',
  'endDate': 'Yürürlükten Çıkış Tarihi',
};

export function getDisplayName(fieldName: string): string {
  if (fieldTranslations[fieldName]) return fieldTranslations[fieldName];
  
  // Snake case to Title case if no translation
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
