import exceljs from 'exceljs';
import { ModelMetadata } from './schemaAnalyzer';
import { getDisplayName } from '../utils/fieldTranslations';

export interface TemplateColumn {
  fieldName: string;
  displayName: string;
  type: string;
  required: boolean;
  validation?: any;
}

export class ExcelTemplateBuilder {
  private static SHEET_DATA = 'Data';
  private static SHEET_INSTRUCTIONS = 'Instructions';
  private static HEADER_ROW = 2;
  private static DATA_START_ROW = 3;

  static async buildWorkbook(model: ModelMetadata, lookups: Record<string, any[]> = {}): Promise<exceljs.Workbook> {
    const workbook = new exceljs.Workbook();
    workbook.creator = 'Neyesem Üretim';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(this.SHEET_DATA);
    
    // Create hidden lookups sheet for validation lists (bypasses 255 char limit)
    const lookupsSheet = workbook.addWorksheet('Lookups', { state: 'hidden' });
    let lookupColIdx = 1;
    
    // Filter out internal fields and relations
    const blacklist: Record<string, string[]> = {
      'ProductionRecord': [
        'actualDurationMinutes',
        'plannedDurationMinutes',
        'cncReportedDurationMinutes',
        'unplannedDowntimeMinutes',
        'downtimeMinutes',
        'availability',
        'performance',
        'quality',
        'oee',
        'plannedQuantity',
        'companyId'
      ],
      'Product': ['companyId'],
      'Machine': ['companyId'],
      'Operator': ['companyId'],
      'Shift': ['companyId'],
      'Department': ['companyId'],
      'DepartmentRole': ['companyId'],
      'Operation': ['companyId'],
      'Warehouse': ['companyId'],
      'Station': ['companyId'],
      'ProductionRoute': ['companyId'],
      'ProductionStandard': ['companyId']
    };

    const modelBlacklist = blacklist[model.name] || [];

    const fieldsToInclude = model.fields.filter(f =>
      !f.isRelation &&
      !['id', 'createdAt', 'updatedAt', ...modelBlacklist].includes(f.name) &&
      !f.isUpdatedAt
    );

    // Header styling
    ws.getRow(this.HEADER_ROW).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(this.HEADER_ROW).height = 25;

    fieldsToInclude.forEach((field, idx) => {
      const col = idx + 1;
      const cell = ws.getCell(this.HEADER_ROW, col);
      
      const displayName = getDisplayName(field.name);
      cell.value = displayName + (field.isRequired ? ' ★' : '');
      
      // Cell styling
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: field.isRequired ? 'FFB91C1C' : 'FF1E293B' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      ws.getColumn(col).width = Math.max(20, displayName.length + 5);

      // Data Validation
      if (field.name.endsWith('Id') && lookups[field.name]?.length > 0) {
        this.applyValidation(ws, col, field, lookups, lookupsSheet, lookupColIdx);
        lookupColIdx++;
      } else {
        this.applyValidation(ws, col, field, lookups, lookupsSheet, 0); // Not a lookup
      }
    });

    // Example Row
    this.addExampleRow(ws, fieldsToInclude);

    // Instructions Sheet
    this.addInstructionsSheet(workbook, model, fieldsToInclude);

    // Freeze headers
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: this.HEADER_ROW }];

    return workbook;
  }

  private static applyValidation(ws: exceljs.Worksheet, col: number, field: any, lookups: Record<string, any[]>, lookupsSheet: exceljs.Worksheet, lookupColIdx: number) {
    const startRow = this.DATA_START_ROW;
    const endRow = 5000;
    
    let validation: exceljs.DataValidation | null = null;

    // Check if it's a foreign key style ID (ends with Id)
    if (field.name.endsWith('Id') && lookups[field.name]) {
      const options = lookups[field.name];
      if (options.length > 0 && lookupColIdx > 0) {
        
        // Write the options to the hidden lookups sheet
        options.forEach((opt, idx) => {
          lookupsSheet.getCell(idx + 1, lookupColIdx).value = opt;
        });

        const colLetter = lookupsSheet.getColumn(lookupColIdx).letter;
        
        validation = {
          type: 'list',
          allowBlank: !field.isRequired,
          // Reference the named range/sheet cells (Excel requires this format for cross-sheet references)
          formulae: [`Lookups!$${colLetter}$1:$${colLetter}$${options.length}`],
          showErrorMessage: true,
          errorTitle: 'Hatalı Seçim',
          error: 'Lütfen açılır listeden (dropdown) geçerli bir değer seçin. Elle metin kopyalamayınız.'
        };
      }
    } else {
      switch (field.type) {
        case 'DateTime':
          validation = {
            type: 'date',
            allowBlank: !field.isRequired,
            operator: 'greaterThan',
            formulae: [new Date('2000-01-01')],
            showErrorMessage: true,
            error: 'Lütfen geçerli bir tarih girin.'
          };
          break;
        case 'Int':
        case 'Float':
        case 'Decimal':
          validation = {
            type: 'decimal',
            allowBlank: !field.isRequired,
            operator: 'greaterThanOrEqual',
            formulae: [0],
            showErrorMessage: true,
            error: 'Lütfen sıfır veya daha büyük bir sayı girin.'
          };
          break;
      }
    }

    if (validation) {
      for (let r = startRow; r <= endRow; r++) {
        ws.getCell(r, col).dataValidation = validation;
      }
    }
  }

  private static addExampleRow(ws: exceljs.Worksheet, fields: any[]) {
    const row = ws.getRow(this.DATA_START_ROW);
    fields.forEach((field, idx) => {
      const col = idx + 1;
      const cell = ws.getCell(this.DATA_START_ROW, col);
      
      // Different examples based on types
      if (field.name.includes('Date')) cell.value = new Date().toISOString().split('T')[0];
      else if (field.type === 'Int') cell.value = 100;
      else if (field.type === 'String' && !field.name.endsWith('Id')) cell.value = 'Örnek Veri';
      
      cell.font = { italic: true, color: { argb: 'FF64748B' } };
    });
  }

  private static addInstructionsSheet(workbook: exceljs.Workbook, model: ModelMetadata, fields: any[]) {
    const ws = workbook.addWorksheet(this.SHEET_INSTRUCTIONS);
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 80;

    ws.addRow(['Geri Bildirim', 'Şablon Kullanım Talimatları']).font = { bold: true, size: 14 };
    ws.addRow(['', '']);
    ws.addRow(['1. Zorunlu Alanlar', 'Kırmızı renkli ve ★ işareti bulunan sütunlar doldurulmak zorundadır.']);
    ws.addRow(['2. Tarih Formatı', 'Tarihleri YYYY-MM-DD (2025-03-17) formatında giriniz.']);
    ws.addRow(['3. Sayısal Veriler', 'Sayısal alanlarda sadece rakam kullanınız.']);
    ws.addRow(['4. Dropdown Listeler', 'Bazı alanlar seçim listesi içerir, elle yazmak yerine listeden seçiniz.']);
    
    ws.addRow(['', '']);
    ws.addRow(['SÜTUN AÇIKLAMALARI', '']).font = { bold: true };
    
    fields.forEach(f => {
      ws.addRow([getDisplayName(f.name), f.documentation || (f.isRequired ? 'Zorunlu alan.' : 'Opsiyonel alan.')]);
    });
  }
}
