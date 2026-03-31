import { SchemaAnalyzer, ModelMetadata } from './schemaAnalyzer';
import { ExcelTemplateBuilder } from './excelTemplateBuilder';
import { loadProductionRecordLookups } from '../excel/lookups';
import exceljs from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TemplateGeneratorService {
  /**
   * Generates a template based on the import type
   */
  static async generate(type: string): Promise<exceljs.Workbook> {
    // Map import type to Prisma model name
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

    const modelName = typeToModel[type];
    if (!modelName) {
      throw new Error(`Unsupported template type: ${type}`);
    }

    const metadata = SchemaAnalyzer.getModelMetadata(modelName);
    if (!metadata) {
      throw new Error(`Model metadata not found for: ${modelName}`);
    }

    // Load lookups if necessary
    const lookups = await this.prepareLookups(type);

    return ExcelTemplateBuilder.buildWorkbook(metadata, lookups);
  }

  /**
   * Prepares lookup values for dropdowns in Excel
   */
  private static async prepareLookups(type: string): Promise<Record<string, string[]>> {
    const lookups: Record<string, string[]> = {};

    if (type === 'production_records') {
      const data = await loadProductionRecordLookups();
      lookups['shiftId'] = data.shifts.map(s => `${s.shiftCode} | ${s.id}`);
      lookups['machineId'] = data.machines.map(m => `${m.code} | ${m.id}`);
      lookups['operatorId'] = data.operators.map(o => `${o.fullName} | ${o.id}`);
      lookups['productId'] = data.products.map(p => `${p.productCode} | ${p.id}`);
    } else if (type === 'production_standards') {
      const machines = await prisma.machine.findMany({ select: { id: true, code: true } });
      const products = await prisma.product.findMany({ select: { id: true, productCode: true } });
      lookups['machineId'] = machines.map(m => `${m.code} | ${m.id}`);
      lookups['productId'] = products.map(p => `${p.productCode} | ${p.id}`);
    } else if (type === 'department_roles') {
      const departments = await prisma.department.findMany({ select: { id: true, name: true } });
      lookups['departmentId'] = departments.map(d => `${d.name} | ${d.id}`);
    } else if (type === 'operators') {
      const departments = await prisma.department.findMany({ select: { id: true, name: true } });
      const roles = await prisma.departmentRole.findMany({ select: { id: true, name: true } });
      lookups['departmentId'] = departments.map(d => `${d.name} | ${d.id}`);
      lookups['roleId'] = roles.map(r => `${r.name} | ${r.id}`);
    }

    return lookups;
  }
}
