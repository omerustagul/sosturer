import exceljs from 'exceljs';
import type { ImportIssue, ImportType, ImportValidateResult } from './excelTypes';

type Lookups = {
  machinesByCode: Map<string, { id: string; code: string }>;
  shiftsByCode: Map<string, { id: string; shiftCode: string }>;
  productsByCode: Map<string, { id: string; productCode: string }>;
  operatorsByEmployeeId: Map<string, { id: string; employeeId: string; fullName: string }>;
  operatorsByFullName: Map<string, { id: string; employeeId: string; fullName: string }[]>;
};

export type ProductionRecordImportRow = {
  productionDate: Date;
  shiftId: string;
  machineId: string;
  operatorId: string;
  productId: string;
  producedQuantity: number;
  actualDurationMinutes: number;
  cncReportedDurationMinutes: number;
  downtimeMinutes: number;
  qualityIssues?: string;
  notes?: string;
  defectQuantity: number;
  plannedDurationMinutes: number;
};

const SHEET_DATA = 'Data';
const SHEET_INSTRUCTIONS = 'Instructions';
const SHEET_REFERENCE = 'Reference';

const DATA_TITLE_ROW = 1;
const DATA_HEADER_ROW = 2;
const DATA_EXAMPLE_START_ROW = 3;
const DATA_EXAMPLE_END_ROW = 5;

const columns = [
  { col: 'A', header: 'Üretim Tarihi ★ (YYYY-MM-DD)', required: true, key: 'productionDate' },
  { col: 'B', header: 'Vardiya Kodu ★ (Dropdown)', required: true, key: 'shiftCode' },
  { col: 'C', header: 'Makine Kodu ★ (Dropdown)', required: true, key: 'machineCode' },
  { col: 'D', header: 'Operatör Adı ★ (Dropdown)', required: true, key: 'operatorName' },
  { col: 'E', header: 'Ürün Kodu ★ (Dropdown)', required: true, key: 'productCode' },
  { col: 'F', header: 'Üretim Adeti ★ (Sayı, >= 1)', required: true, key: 'producedQuantity' },
  { col: 'G', header: 'Gerçek Süre (dk) ★ (Sayı, > 0)', required: true, key: 'actualDurationMinutes' },
  { col: 'H', header: 'Makine Raporu (dk) ★ (Sayı, > 0)', required: true, key: 'cncReportedDurationMinutes' },
  { col: 'I', header: 'Duruş Süresi (dk) (Sayı, >= 0)', required: false, key: 'downtimeMinutes' },
  { col: 'J', header: 'Kalite Sorunları (Metin)', required: false, key: 'qualityIssues' },
  { col: 'K', header: 'Notlar (Metin)', required: false, key: 'notes' },
] as const;

function setHeaderStyles(ws: exceljs.Worksheet) {
  // Title row
  ws.mergeCells(`${columns[0].col}${DATA_TITLE_ROW}:${columns[columns.length - 1].col}${DATA_TITLE_ROW}`);
  const titleCell = ws.getCell(`${columns[0].col}${DATA_TITLE_ROW}`);
  titleCell.value = 'PRODUCTION_RECORDS IMPORT TEMPLATE';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws.getRow(DATA_TITLE_ROW).height = 24;

  // Header row
  const headerRow = ws.getRow(DATA_HEADER_ROW);
  headerRow.height = 20;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const c of columns) {
    const cell = ws.getCell(`${c.col}${DATA_HEADER_ROW}`);
    cell.value = c.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };

    if (c.required) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } }; // dark red
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // slate
    }
  }

  ws.views = [{ state: 'frozen', ySplit: DATA_HEADER_ROW }];
}

function setExampleStyles(ws: exceljs.Worksheet) {
  for (let r = DATA_EXAMPLE_START_ROW; r <= DATA_EXAMPLE_END_ROW; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // yellow
      cell.font = { color: { argb: 'FF111827' } };
    });
  }
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseExcelDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  // ExcelJS might return { year, month, day } for dates
  if (typeof value === 'object' && value && 'year' in (value as any) && 'month' in (value as any) && 'day' in (value as any)) {
    const v = value as any;
    const dt = new Date(Number(v.year), Number(v.month) - 1, Number(v.day));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const text = safeText(value);
  if (!text) return null;
  // Expect YYYY-MM-DD but allow locale separators.
  const m = text.match(/^(\d{4})[-./](\d{2})[-./](\d{2})$/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = safeText(value).replace(',', '.');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizedOperatorKey(value: string): { employeeId?: string; fullName?: string } {
  const t = value.trim();
  const m = t.match(/\(([^)]+)\)\s*$/);
  if (m) return { employeeId: m[1].trim(), fullName: t.replace(/\s*\([^)]+\)\s*$/, '').trim() };
  return { fullName: t };
}

export function createProductionRecordsTemplateWorkbook(params: {
  machines: { code: string }[];
  shifts: { shiftCode: string }[];
  operators: { employeeId: string; fullName: string }[];
  products: { productCode: string }[];
}) {
  const workbook = new exceljs.Workbook();
  workbook.creator = 'verimlilik';
  workbook.created = new Date();

  const dataWs = workbook.addWorksheet(SHEET_DATA);
  const instructionsWs = workbook.addWorksheet(SHEET_INSTRUCTIONS);
  const refWs = workbook.addWorksheet(SHEET_REFERENCE);

  // Data sheet columns widths
  const widths: Record<string, number> = {
    A: 18,
    B: 16,
    C: 16,
    D: 22,
    E: 16,
    F: 14,
    G: 16,
    H: 18,
    I: 18,
    J: 28,
    K: 28,
  };
  for (const c of columns) dataWs.getColumn(c.col).width = widths[c.col] ?? 18;

  setHeaderStyles(dataWs);

  // Example rows (yellow)
  const today = new Date();
  const shiftExample = params.shifts[0]?.shiftCode || 'Vardiya-1';
  const machineExample = params.machines[0]?.code || 'CNC-1';
  const nameCounts = new Map<string, number>();
  for (const o of params.operators) {
    const k = o.fullName.trim();
    nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
  }
  const operatorDisplayValues = params.operators.map((o) => {
    const c = nameCounts.get(o.fullName.trim()) || 0;
    return c > 1 ? `${o.fullName} (${o.employeeId})` : o.fullName;
  });
  const operatorExample = operatorDisplayValues[0] || 'Operatör';
  const productExample = params.products[0]?.productCode || 'P001';

  const exampleRows = [
    { productionDate: today, shiftCode: shiftExample, machineCode: machineExample, operatorName: operatorExample, productCode: productExample, producedQuantity: 100, actualDurationMinutes: 45, cncReportedDurationMinutes: 48, downtimeMinutes: 5, qualityIssues: '', notes: 'Normal' },
    { productionDate: today, shiftCode: shiftExample, machineCode: machineExample, operatorName: operatorExample, productCode: productExample, producedQuantity: 150, actualDurationMinutes: 60, cncReportedDurationMinutes: 62, downtimeMinutes: 8, qualityIssues: '', notes: '' },
    { productionDate: today, shiftCode: shiftExample, machineCode: machineExample, operatorName: operatorExample, productCode: productExample, producedQuantity: 80, actualDurationMinutes: 36, cncReportedDurationMinutes: 40, downtimeMinutes: 2, qualityIssues: '', notes: '' },
  ];

  for (let i = 0; i < exampleRows.length; i++) {
    const r = DATA_EXAMPLE_START_ROW + i;
    const rowData = exampleRows[i];
    const dateCell = dataWs.getCell(`A${r}`);
    dateCell.value = rowData.productionDate as Date;
    dateCell.numFmt = 'yyyy-mm-dd';
    dataWs.getCell(`B${r}`).value = rowData.shiftCode;
    dataWs.getCell(`C${r}`).value = rowData.machineCode;
    dataWs.getCell(`D${r}`).value = rowData.operatorName;
    dataWs.getCell(`E${r}`).value = rowData.productCode;
    dataWs.getCell(`F${r}`).value = rowData.producedQuantity;
    dataWs.getCell(`G${r}`).value = rowData.actualDurationMinutes;
    dataWs.getCell(`H${r}`).value = rowData.cncReportedDurationMinutes;
    dataWs.getCell(`I${r}`).value = rowData.downtimeMinutes;
    dataWs.getCell(`J${r}`).value = rowData.qualityIssues;
    dataWs.getCell(`K${r}`).value = rowData.notes;
  }
  setExampleStyles(dataWs);

  // Reference sheet: 4 simple lists (as spec)
  refWs.columns = [
    { header: 'Vardiyalar', key: 'shifts', width: 22 },
    { header: 'Makineler', key: 'machines', width: 22 },
    { header: 'Operatörler', key: 'operators', width: 28 },
    { header: 'Ürünler', key: 'products', width: 22 },
  ];
  refWs.getRow(1).font = { bold: true };

  const maxLen = Math.max(params.shifts.length, params.machines.length, params.operators.length, params.products.length, 10);
  for (let i = 0; i < maxLen; i++) {
    refWs.addRow({
      shifts: params.shifts[i]?.shiftCode || '',
      machines: params.machines[i]?.code || '',
      operators: operatorDisplayValues[i] || '',
      products: params.products[i]?.productCode || '',
    });
  }

  // Named ranges for dropdown validations (start from row2)
  const shiftEnd = params.shifts.length + 1;
  const machineEnd = params.machines.length + 1;
  const operatorEnd = params.operators.length + 1;
  const productEnd = params.products.length + 1;

  workbook.definedNames.add('Shifts', `${SHEET_REFERENCE}!$A$2:$A$${Math.max(2, shiftEnd)}`);
  workbook.definedNames.add('Machines', `${SHEET_REFERENCE}!$B$2:$B$${Math.max(2, machineEnd)}`);
  workbook.definedNames.add('Operators', `${SHEET_REFERENCE}!$C$2:$C$${Math.max(2, operatorEnd)}`);
  workbook.definedNames.add('Products', `${SHEET_REFERENCE}!$D$2:$D$${Math.max(2, productEnd)}`);

  // Data validations for a reasonable row range
  const applyRange = (col: string, fromRow: number, toRow: number, apply: (cell: exceljs.Cell, row: number) => void) => {
    for (let r = fromRow; r <= toRow; r++) apply(dataWs.getCell(`${col}${r}`), r);
  };

  const firstDataRow = DATA_EXAMPLE_START_ROW;
  const lastDataRow = 1000;

  // A: Date <= TODAY()
  applyRange('A', firstDataRow, lastDataRow, (cell, r) => {
    cell.numFmt = 'yyyy-mm-dd';
    cell.dataValidation = {
      type: 'custom',
      allowBlank: false,
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Geçersiz tarih',
      error: 'Üretim tarihi gelecekte olamaz. Format: YYYY-MM-DD',
      formulae: [`=AND(ISNUMBER(A${r}),A${r}<=TODAY())`],
    };
  });

  // B-E dropdowns
  applyRange('B', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['=Shifts'] };
  });
  applyRange('C', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['=Machines'] };
  });
  applyRange('D', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['=Operators'] };
  });
  applyRange('E', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'list', allowBlank: false, showErrorMessage: true, formulae: ['=Products'] };
  });

  // F: whole >= 1
  applyRange('F', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', allowBlank: false, showErrorMessage: true, formulae: [1] };
  });
  // G/H: decimal > 0
  for (const col of ['G', 'H'] as const) {
    applyRange(col, firstDataRow, lastDataRow, (cell) => {
      cell.dataValidation = { type: 'decimal', operator: 'greaterThan', allowBlank: false, showErrorMessage: true, formulae: [0] };
    });
  }
  // I: decimal >= 0 (optional)
  applyRange('I', firstDataRow, lastDataRow, (cell) => {
    cell.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, showErrorMessage: true, formulae: [0] };
  });

  // Instructions sheet (short but aligned to spec)
  instructionsWs.getColumn(1).width = 110;
  const lines = [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sadece sarı örnek satırları doldurun (Satır 3-5).',
    '2) Sütun sırasını değiştirmeyin; başlık satırını silmeyin.',
    '3) Üretim Tarihi gelecekte olamaz. Format: YYYY-MM-DD',
    '4) Vardiya/Makine/Operatör/Ürün alanlarını dropdown’dan seçin.',
    '5) Üretim Adeti >= 1, Süre alanları > 0 olmalıdır.',
    '',
    'NOT:',
    '- Operatör alanında sistemde aynı isimden birden fazla varsa, lütfen "Ad Soyad (Sicil)" formatını kullanın.',
  ];
  lines.forEach((t, idx) => {
    instructionsWs.getCell(`A${idx + 1}`).value = t;
    if (idx === 0) instructionsWs.getCell(`A${idx + 1}`).font = { bold: true, size: 14 };
  });

  return workbook;
}

export function validateProductionRecordsWorkbook(args: {
  workbook: exceljs.Workbook;
  lookups: Lookups;
}): ImportValidateResult<ProductionRecordImportRow> {
  const importType: ImportType = 'production_records';
  const ws = args.workbook.getWorksheet(SHEET_DATA) || args.workbook.getWorksheet('Veri Girisi');
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const parsedRows: ProductionRecordImportRow[] = [];
  let totalRows = 0;

  if (!ws) {
    errors.push({ type: 'error', code: 'SHEET_MISSING', message: `Excel dosyasında "${SHEET_DATA}" sayfası bulunamadı.` });
    return { importType, totalRows: 0, validRows: 0, errors, warnings, parsedRows };
  }

  const seenKeys = new Set<string>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastRow = ws.actualRowCount || ws.rowCount || 0;
  for (let r = DATA_EXAMPLE_START_ROW; r <= lastRow; r++) {
    const a = ws.getCell(`A${r}`).value;
    const b = safeText(ws.getCell(`B${r}`).value);
    const c = safeText(ws.getCell(`C${r}`).value);
    const d = safeText(ws.getCell(`D${r}`).value);
    const e = safeText(ws.getCell(`E${r}`).value);

    // stop if the row is completely empty
    const isEmpty = !safeText(a) && !b && !c && !d && !e && !safeText(ws.getCell(`F${r}`).value) && !safeText(ws.getCell(`G${r}`).value) && !safeText(ws.getCell(`H${r}`).value);
    if (isEmpty) continue;
    totalRows++;

    const productionDate = parseExcelDate(a);
    if (!productionDate) {
      errors.push({ type: 'error', code: 'DATE_INVALID', message: 'Üretim Tarihi geçersiz (YYYY-MM-DD).', address: { sheet: SHEET_DATA, row: r, col: 'A' }, rowIndex: r, rawValue: a });
      continue;
    }
    const pd = new Date(productionDate);
    pd.setHours(0, 0, 0, 0);
    if (pd.getTime() > today.getTime()) {
      errors.push({ type: 'error', code: 'DATE_FUTURE', message: 'Üretim Tarihi gelecekte olamaz.', address: { sheet: SHEET_DATA, row: r, col: 'A' }, rowIndex: r, rawValue: a });
      continue;
    }

    if (!b) errors.push({ type: 'error', code: 'SHIFT_REQUIRED', message: 'Vardiya Kodu zorunludur.', address: { sheet: SHEET_DATA, row: r, col: 'B' }, rowIndex: r });
    if (!c) errors.push({ type: 'error', code: 'MACHINE_REQUIRED', message: 'Makine Kodu zorunludur.', address: { sheet: SHEET_DATA, row: r, col: 'C' }, rowIndex: r });
    if (!d) errors.push({ type: 'error', code: 'OPERATOR_REQUIRED', message: 'Operatör Adı zorunludur.', address: { sheet: SHEET_DATA, row: r, col: 'D' }, rowIndex: r });
    if (!e) errors.push({ type: 'error', code: 'PRODUCT_REQUIRED', message: 'Ürün Kodu zorunludur.', address: { sheet: SHEET_DATA, row: r, col: 'E' }, rowIndex: r });

    const producedQ = parseNumber(ws.getCell(`F${r}`).value);
    const actualMin = parseNumber(ws.getCell(`G${r}`).value);
    const cncMin = parseNumber(ws.getCell(`H${r}`).value);
    const downtimeMin = parseNumber(ws.getCell(`I${r}`).value) ?? 0;
    const qualityIssues = safeText(ws.getCell(`J${r}`).value) || undefined;
    const notes = safeText(ws.getCell(`K${r}`).value) || undefined;

    if (producedQ === null || producedQ < 1) errors.push({ type: 'error', code: 'QTY_INVALID', message: 'Üretim Adeti >= 1 olmalıdır.', address: { sheet: SHEET_DATA, row: r, col: 'F' }, rowIndex: r, rawValue: ws.getCell(`F${r}`).value });
    if (actualMin === null || actualMin <= 0) errors.push({ type: 'error', code: 'DUR_INVALID', message: 'Gerçek Süre > 0 olmalıdır.', address: { sheet: SHEET_DATA, row: r, col: 'G' }, rowIndex: r, rawValue: ws.getCell(`G${r}`).value });

    let cncReportedDurationMinutes = cncMin;
    if (cncReportedDurationMinutes === null || cncReportedDurationMinutes <= 0) {
      // In some legacy templates H column didn't exist; fallback to actual with a warning.
      cncReportedDurationMinutes = actualMin ?? null;
      if (cncReportedDurationMinutes && cncReportedDurationMinutes > 0) {
        warnings.push({ type: 'warning', code: 'CNC_FALLBACK', message: 'Makine Raporu boş/invalid; Gerçek Süre kullanıldı.', address: { sheet: SHEET_DATA, row: r, col: 'H' }, rowIndex: r });
      } else {
        errors.push({ type: 'error', code: 'CNC_INVALID', message: 'Makine Raporu (dk) > 0 olmalıdır.', address: { sheet: SHEET_DATA, row: r, col: 'H' }, rowIndex: r, rawValue: ws.getCell(`H${r}`).value });
      }
    }

    if (downtimeMin < 0) errors.push({ type: 'error', code: 'DOWN_INVALID', message: 'Duruş Süresi >= 0 olmalıdır.', address: { sheet: SHEET_DATA, row: r, col: 'I' }, rowIndex: r, rawValue: ws.getCell(`I${r}`).value });

    if (errors.some((x) => x.rowIndex === r && x.type === 'error')) {
      continue;
    }

    const shift = args.lookups.shiftsByCode.get(b);
    if (!shift) {
      errors.push({ type: 'error', code: 'SHIFT_NOT_FOUND', message: `Vardiya bulunamadı: ${b}`, address: { sheet: SHEET_DATA, row: r, col: 'B' }, rowIndex: r, rawValue: b });
      continue;
    }

    const machine = args.lookups.machinesByCode.get(c);
    if (!machine) {
      errors.push({ type: 'error', code: 'MACHINE_NOT_FOUND', message: `Makine bulunamadı: ${c}`, address: { sheet: SHEET_DATA, row: r, col: 'C' }, rowIndex: r, rawValue: c });
      continue;
    }

    const product = args.lookups.productsByCode.get(e);
    if (!product) {
      errors.push({ type: 'error', code: 'PRODUCT_NOT_FOUND', message: `Ürün bulunamadı: ${e}`, address: { sheet: SHEET_DATA, row: r, col: 'E' }, rowIndex: r, rawValue: e });
      continue;
    }

    const opKey = normalizedOperatorKey(d);
    let operatorId: string | null = null;
    if (opKey.employeeId) {
      operatorId = args.lookups.operatorsByEmployeeId.get(opKey.employeeId)?.id || null;
    } else if (opKey.fullName) {
      const list = args.lookups.operatorsByFullName.get(opKey.fullName) || [];
      if (list.length === 1) operatorId = list[0].id;
      if (list.length > 1) {
        errors.push({ type: 'error', code: 'OPERATOR_AMBIGUOUS', message: `Operatör adı birden fazla kayda uyuyor. Lütfen "Ad Soyad (Sicil)" kullanın: ${opKey.fullName}`, address: { sheet: SHEET_DATA, row: r, col: 'D' }, rowIndex: r, rawValue: d });
        continue;
      }
    }
    if (!operatorId) {
      errors.push({ type: 'error', code: 'OPERATOR_NOT_FOUND', message: `Operatör bulunamadı: ${d}`, address: { sheet: SHEET_DATA, row: r, col: 'D' }, rowIndex: r, rawValue: d });
      continue;
    }

    const dupKey = [pd.toISOString().slice(0, 10), shift.id, machine.id, operatorId, product.id].join('|');
    if (seenKeys.has(dupKey)) {
      warnings.push({ type: 'warning', code: 'DUPLICATE_IN_FILE', message: 'Dosya içinde muhtemel duplicate satır (aynı tarih+vardiya+makine+operatör+ürün).', address: { sheet: SHEET_DATA, row: r, col: 'A' }, rowIndex: r });
    }
    seenKeys.add(dupKey);

    parsedRows.push({
      productionDate: pd,
      shiftId: shift.id,
      machineId: machine.id,
      operatorId,
      productId: product.id,
      producedQuantity: Math.floor(producedQ as number),
      actualDurationMinutes: Number(actualMin),
      cncReportedDurationMinutes: Number(cncReportedDurationMinutes),
      downtimeMinutes: Number(downtimeMin),
      qualityIssues,
      notes,
      defectQuantity: 0, // not in template spec; default safe
      plannedDurationMinutes: Number(actualMin),
    });
  }

  return {
    importType,
    totalRows,
    validRows: parsedRows.length,
    errors,
    warnings,
    parsedRows,
  };
}

export function createImportErrorReportWorkbook(args: { importType: ImportType; errors: ImportIssue[]; warnings?: ImportIssue[] }) {
  const workbook = new exceljs.Workbook();
  workbook.creator = 'verimlilik';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Errors');
  ws.columns = [
    { header: 'Tip', key: 'type', width: 10 },
    { header: 'Kod', key: 'code', width: 18 },
    { header: 'Mesaj', key: 'message', width: 60 },
    { header: 'Sayfa', key: 'sheet', width: 14 },
    { header: 'Satır', key: 'row', width: 8 },
    { header: 'Sütun', key: 'col', width: 8 },
    { header: 'Değer', key: 'rawValue', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };

  const all = [...args.errors, ...(args.warnings || [])];
  for (const issue of all) {
    ws.addRow({
      type: issue.type,
      code: issue.code,
      message: issue.message,
      sheet: issue.address?.sheet || '',
      row: issue.address?.row || issue.rowIndex || '',
      col: issue.address?.col || '',
      rawValue: safeText(issue.rawValue),
    });
  }

  return workbook;
}
