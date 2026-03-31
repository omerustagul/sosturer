import exceljs from 'exceljs';
import { SchemaAnalyzer, ModelMetadata } from './schemaAnalyzer';
import { PrismaClient } from '@prisma/client';
import { getDisplayName } from '../utils/fieldTranslations';

const prisma = new PrismaClient();

export interface ImportResult {
  totalRows: number;
  parsedRows: any[];
  errors: any[];
  warnings: any[];
}

export class DynamicImportService {
  private static HEADER_ROW = 2;
  private static DATA_START_ROW = 3;

  static getModelName(type: string): string {
    const typeToModel: Record<string, string> = {
      'production_records': 'ProductionRecord',
      'products': 'Product',
      'operators': 'Operator',
      'machines': 'Machine',
      'shifts': 'Shift',
      'departments': 'Department',
      'department_roles': 'DepartmentRole',
      'production_standards': 'ProductionStandard'
    };
    return typeToModel[type] || '';
  }

  /**
   * Validates and parses an Excel workbook for a specific model
   */
  static async validate(modelName: string, workbook: exceljs.Workbook): Promise<ImportResult> {
    const metadata = SchemaAnalyzer.getModelMetadata(modelName);
    if (!metadata) throw new Error(`Model not found: ${modelName}`);

    const ws = workbook.getWorksheet('Data') || workbook.worksheets[0];
    const totalRows = ws.actualRowCount - this.HEADER_ROW;
    
    const parsedRows: any[] = [];
    const errors: any[] = [];
    const warnings: any[] = [];

    const headerMap = this.getHeaderMap(ws, metadata);

    // Prepare reverse lookups for direct text entries (e.g. "Yiğit Öztürk" -> UUID)
    const reverseLookups: Record<string, string> = {};
    const [shifts, machines, operators, products, departments, roles] = await Promise.all([
      prisma.shift.findMany({ select: { id: true, shiftCode: true, shiftName: true } }),
      prisma.machine.findMany({ select: { id: true, code: true, name: true } }),
      prisma.operator.findMany({ select: { id: true, employeeId: true, fullName: true } }),
      prisma.product.findMany({ select: { id: true, productCode: true, productName: true } }),
      prisma.department.findMany({ select: { id: true, name: true, code: true } }),
      prisma.departmentRole.findMany({ select: { id: true, name: true } })
    ]);

    shifts.forEach(s => {
      reverseLookups[s.shiftCode.toLowerCase()] = s.id;
      reverseLookups[s.shiftName.toLowerCase()] = s.id;
    });
    machines.forEach(m => {
      reverseLookups[m.code.toLowerCase()] = m.id;
      reverseLookups[m.name.toLowerCase()] = m.id;
    });
    operators.forEach(o => {
      if (o.employeeId) reverseLookups[o.employeeId.toLowerCase()] = o.id;
      reverseLookups[o.fullName.toLowerCase()] = o.id;
    });
    products.forEach(p => {
      reverseLookups[p.productCode.toLowerCase()] = p.id;
      reverseLookups[p.productName.toLowerCase()] = p.id;
    });
    departments.forEach(d => {
      if (d.code) reverseLookups[d.code.toLowerCase()] = d.id;
      reverseLookups[d.name.toLowerCase()] = d.id;
    });
    roles.forEach(r => {
      reverseLookups[r.name.toLowerCase()] = r.id;
    });

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < this.DATA_START_ROW) return;

      const rowData: any = {};
      const rowErrors: string[] = [];

      metadata.fields.forEach(field => {
        if (field.isRelation || ['id', 'createdAt', 'updatedAt'].includes(field.name) || field.isUpdatedAt) return;

        const displayName = getDisplayName(field.name);
        // Find column by display name (or display name + *)
        const colIndex = headerMap[displayName] || headerMap[displayName + ' ★'];
        
        if (!colIndex) {
          if (field.isRequired && !field.hasDefaultValue) {
            rowErrors.push(`Sütun bulunamadı: ${displayName}`);
          }
          return;
        }

        let value = row.getCell(colIndex).value;
        
        // Handle lookup values (e.g. "Sabah | id-123" -> "id-123" or "Ahmet Yılmaz" -> mapped-id)
        if (typeof value === 'string') {
          let str = value.trim();
          if (str.includes('|')) {
            value = str.split('|').pop()?.trim() || str;
          } else if (field.name.endsWith('Id') && str.length > 0 && str.length < 30) {
            // Direct text copy-paste (bypassing UUID / Dropdown) -> Map to UUID 
            const foundId = reverseLookups[str.toLowerCase()];
            if (foundId) {
              value = foundId;
            }
            // If they typed something that isn't mapped, it continues as raw string and gets caught by the length validation error.
          }
        }

        // Type conversion & validation
        const { val, error } = this.processValue(value, field);
        if (error) rowErrors.push(`${displayName}: ${error}`);
        if (val !== undefined) rowData[field.name] = val;
      });

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, message: rowErrors.join('; ') });
      } else {
        parsedRows.push(rowData);
      }
    });

    return { totalRows, parsedRows, errors, warnings };
  }

  /**
   * Executes the import and returns a detailed execution log
   */
  static async execute(modelName: string, parsedRows: any[]): Promise<{ count: number, logs: string[] }> {
    const logs: string[] = [];
    let count = 0;

    await prisma.$transaction(async (tx) => {
      const txModel = (tx as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
      
      for (let i = 0; i < parsedRows.length; i++) {
        const data = parsedRows[i];
        const created = await txModel.create({ data });
        count++;
        
        // Friendly log generator
        let identifier = '';
        if (data.productCode) identifier = `Ürün: ${data.productCode}`;
        else if (data.code) identifier = `Tezgah: ${data.code}`;
        else if (data.fullName) identifier = `Operatör: ${data.fullName}`;
        else if (data.shiftCode) identifier = `Vardiya: ${data.shiftCode}`;
        else if (data.productionDate) identifier = `Üretim Kaydı: ${new Date(data.productionDate).toLocaleDateString('tr-TR')}`;
        else identifier = `Kayıt ${i + 1}`;

        logs.push(`✅ [${i + 1}] ${identifier} başarıyla sisteme eklendi.`);
      }
    });

    return { count, logs };
  }

  private static getHeaderMap(ws: exceljs.Worksheet, metadata: ModelMetadata): Record<string, number> {
    const headerRow = ws.getRow(this.HEADER_ROW);
    const map: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) map[String(cell.value).trim()] = colNumber;
    });
    return map;
  }

  private static processValue(value: any, field: any): { val: any, error?: string } {
    if (value === null || value === undefined || value === '') {
      if (field.isRequired && !field.hasDefaultValue) return { val: null, error: 'Zorunlu alan boş bırakılamaz.' };
      return { val: null };
    }

    // Excel nested values (result might be an object)
    if (value && typeof value === 'object' && 'result' in value) value = value.result;

    switch (field.type) {
      case 'DateTime':
        const date = new Date(value);
        if (isNaN(date.getTime())) return { val: null, error: 'Geçersiz tarih formatı.' };
        return { val: date };
      case 'Int':
        const intVal = parseInt(value);
        if (isNaN(intVal)) return { val: null, error: 'Tamsayı bekliyor.' };
        return { val: intVal };
      case 'Float':
      case 'Decimal':
        const floatVal = parseFloat(value);
        if (isNaN(floatVal)) return { val: null, error: 'Sayısal değer bekliyor.' };
        return { val: floatVal };
      case 'Boolean':
        return { val: !!value };
      case 'String':
        let strVal = String(value).trim();
        // Normalize status values for Turkish users
        if (field.name === 'status') {
          const lower = strVal.toLowerCase();
          if (['aktif', 'active', 'açık', 'etkin'].includes(lower)) return { val: 'active' };
          if (['pasif', 'passive', 'kapalı', 'devre dışı'].includes(lower)) return { val: 'passive' };
        }
        
        if (strVal === '') {
          if (field.isRequired && !field.hasDefaultValue) return { val: null, error: 'Zorunlu alan boş bırakılamaz.' };
          return { val: null };
        }

        // Validate Foreign Keys structure (typically UUID which is 36 chars)
        // If a user types "Ahmet Yılmaz" (12 chars) instead of picking the UUID dropdown, it fails here
        if (field.name.endsWith('Id') && strVal.length < 20) {
           return { val: null, error: `Hatalı Seçim ('${strVal}'). Lütfen hücreye elle kopyalama yapmak yerine Dropdown (Açılır Liste) menüsünden güncel seçimi yapınız.` };
        }

        return { val: strVal };
      default:
        return { val: value };
    }
  }
}
