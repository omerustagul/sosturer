import exceljs from 'exceljs';

type ColumnDef = {
  col: string;
  header: string;
  required: boolean;
  width?: number;
};

const SHEET_DATA = 'Data';
const SHEET_INSTRUCTIONS = 'Instructions';
const SHEET_REFERENCE = 'Reference';

const TITLE_ROW = 1;
const HEADER_ROW = 2;
const EXAMPLE_START_ROW = 3;
const EXAMPLE_END_ROW = 5;

function styleTitleAndHeader(ws: exceljs.Worksheet, title: string, cols: ColumnDef[]) {
  ws.mergeCells(`${cols[0].col}${TITLE_ROW}:${cols[cols.length - 1].col}${TITLE_ROW}`);
  const titleCell = ws.getCell(`${cols[0].col}${TITLE_ROW}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws.getRow(TITLE_ROW).height = 24;

  const headerRow = ws.getRow(HEADER_ROW);
  headerRow.height = 20;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const c of cols) {
    const cell = ws.getCell(`${c.col}${HEADER_ROW}`);
    cell.value = c.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
    cell.fill = c.required
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  }

  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
}

function styleExampleRows(ws: exceljs.Worksheet, from = EXAMPLE_START_ROW, to = EXAMPLE_END_ROW) {
  for (let r = from; r <= to; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
      cell.font = { color: { argb: 'FF111827' } };
    });
  }
}

function fillExampleRows(ws: exceljs.Worksheet, cols: ColumnDef[], rows: Array<Record<string, any>>) {
  for (let i = 0; i < rows.length; i++) {
    const r = EXAMPLE_START_ROW + i;
    const rowData = rows[i];
    for (const c of cols) {
      const v = rowData[c.col];
      if (v !== undefined) ws.getCell(`${c.col}${r}`).value = v;
    }
  }
  styleExampleRows(ws, EXAMPLE_START_ROW, EXAMPLE_START_ROW + rows.length - 1);
}

function addInstructionsSheet(workbook: exceljs.Workbook, lines: string[]) {
  const ws = workbook.addWorksheet(SHEET_INSTRUCTIONS);
  ws.getColumn(1).width = 110;
  lines.forEach((t, idx) => {
    const cell = ws.getCell(`A${idx + 1}`);
    cell.value = t;
    if (idx === 0) cell.font = { bold: true, size: 14 };
  });
}

function addReferenceSheet(workbook: exceljs.Workbook, columns: Array<{ header: string; values: string[] }>) {
  const ws = workbook.addWorksheet(SHEET_REFERENCE);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.header, width: Math.max(18, Math.min(40, c.header.length + 6)) }));
  ws.getRow(1).font = { bold: true };

  const maxLen = Math.max(...columns.map((c) => c.values.length), 10);
  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, string> = {};
    for (const c of columns) row[c.header] = c.values[i] || '';
    ws.addRow(row);
  }

  return ws;
}

function defineRange(workbook: exceljs.Workbook, name: string, sheet: string, colLetter: string, count: number) {
  const endRow = Math.max(2, count + 1);
  workbook.definedNames.add(name, `${sheet}!$${colLetter}$2:$${colLetter}$${endRow}`);
}

function applyListValidation(ws: exceljs.Worksheet, colLetter: string, fromRow: number, toRow: number, rangeName: string, allowBlank: boolean) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${colLetter}${r}`).dataValidation = {
      type: 'list',
      allowBlank,
      showErrorMessage: true,
      formulae: [`=${rangeName}`],
    };
  }
}

export function createProductsTemplateWorkbook() {
  const wb = new exceljs.Workbook();
  wb.creator = 'verimlilik';
  wb.created = new Date();

  const cols: ColumnDef[] = [
    { col: 'A', header: 'Ürün Kodu ★ (Benzersiz)', required: true, width: 18 },
    { col: 'B', header: 'Ürün Adı ★', required: true, width: 26 },
    { col: 'C', header: 'Ürün Grubu', required: false, width: 18 },
    { col: 'D', header: 'Açıklama', required: false, width: 28 },
    { col: 'E', header: 'Ölçü Birimi ★ (adet, kg, m)', required: true, width: 16 },
    { col: 'F', header: 'Kategori', required: false, width: 18 },
    { col: 'G', header: 'Durumu ★ (Dropdown)', required: true, width: 14 },
  ];

  const ws = wb.addWorksheet(SHEET_DATA);
  for (const c of cols) ws.getColumn(c.col).width = c.width ?? 18;
  styleTitleAndHeader(ws, 'PRODUCTS IMPORT TEMPLATE', cols);

  fillExampleRows(ws, cols, [
    { A: 'P001', B: 'Metal Parça-A', C: 'Metal', D: 'CNC işlenmiş', E: 'adet', F: 'Metal', G: 'Active' },
    { A: 'P002', B: 'Plastik Kap', C: 'Plastik', D: 'Enjeksiyon', E: 'adet', F: 'Plastik', G: 'Active' },
    { A: 'P003', B: 'Çelik Mil', C: 'Çelik', D: '10mm çap', E: 'adet', F: 'Çelik', G: 'Active' },
  ]);

  addInstructionsSheet(wb, [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sarı örnek satırları doldurun.',
    '2) Ürün Kodu benzersiz olmalıdır.',
    '3) Ürün grubu opsiyoneldir; raporlama/filtreleme için önerilir.',
  ]);

  const ref = addReferenceSheet(wb, [{ header: 'Durum', values: ['Active', 'Inactive'] }]);
  defineRange(wb, 'StatusList', SHEET_REFERENCE, 'A', 2);
  applyListValidation(ws, 'G', EXAMPLE_START_ROW, 1000, 'StatusList', false);

  return wb;
}

export function createOperatorsTemplateWorkbook() {
  const wb = new exceljs.Workbook();
  wb.creator = 'verimlilik';
  wb.created = new Date();

  const cols: ColumnDef[] = [
    { col: 'A', header: 'Personel ID ★ (Benzersiz)', required: true, width: 18 },
    { col: 'B', header: 'Ad Soyad ★', required: true, width: 24 },
    { col: 'C', header: 'Departman', required: false, width: 18 },
    { col: 'D', header: 'İşe Giriş Tarihi (YYYY-MM-DD)', required: false, width: 22 },
    { col: 'E', header: 'Tecrübe (Yıl)', required: false, width: 14 },
    { col: 'F', header: 'Sertifikalar', required: false, width: 22 },
    { col: 'G', header: 'Durumu ★ (Dropdown)', required: true, width: 14 },
  ];

  const ws = wb.addWorksheet(SHEET_DATA);
  for (const c of cols) ws.getColumn(c.col).width = c.width ?? 18;
  styleTitleAndHeader(ws, 'OPERATORS IMPORT TEMPLATE', cols);

  fillExampleRows(ws, cols, [
    { A: 'OP-101', B: 'Ahmet Yılmaz', C: 'Talaşlı İmalat', D: '', E: 5, F: '', G: 'Active' },
    { A: 'OP-102', B: 'Mehmet Demir', C: 'Talaşlı İmalat', D: '', E: 8, F: '', G: 'Active' },
    { A: 'OP-103', B: 'Ali Kaya', C: 'Talaşlı İmalat', D: '', E: 3, F: '', G: 'Active' },
  ]);

  addInstructionsSheet(wb, [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sarı örnek satırları doldurun.',
    '2) Personel ID benzersiz olmalıdır.',
  ]);

  addReferenceSheet(wb, [{ header: 'Durum', values: ['Active', 'Inactive'] }]);
  defineRange(wb, 'StatusList', SHEET_REFERENCE, 'A', 2);
  applyListValidation(ws, 'G', EXAMPLE_START_ROW, 1000, 'StatusList', false);

  return wb;
}

export function createMachinesTemplateWorkbook() {
  const wb = new exceljs.Workbook();
  wb.creator = 'verimlilik';
  wb.created = new Date();

  const cols: ColumnDef[] = [
    { col: 'A', header: 'Tezgah Kodu ★ (Benzersiz)', required: true, width: 18 },
    { col: 'B', header: 'Tezgah Adı ★', required: true, width: 26 },
    { col: 'C', header: 'Marka', required: false, width: 18 },
    { col: 'D', header: 'Model', required: false, width: 18 },
    { col: 'E', header: 'Kurulum Tarihi (YYYY-MM-DD)', required: false, width: 22 },
    { col: 'F', header: 'Vardiya Kapasitesi (adet)', required: false, width: 22 },
    { col: 'H', header: 'Durumu ★ (Dropdown)', required: true, width: 14 },
    { col: 'I', header: 'Notlar', required: false, width: 22 },
  ];

  const ws = wb.addWorksheet(SHEET_DATA);
  for (const c of cols) ws.getColumn(c.col).width = c.width ?? 18;
  styleTitleAndHeader(ws, 'MACHINES IMPORT TEMPLATE', cols);

  fillExampleRows(ws, cols, [
    { A: 'CNC-1', B: 'Mazak 1', C: 'Mazak', D: 'i-200', E: '', F: 200, H: 'Active', I: '' },
    { A: 'CNC-2', B: 'DMG Mori', C: 'DMG', D: 'NHX', E: '', F: 250, H: 'Active', I: '' },
    { A: 'CNC-3', B: 'Doosan Puma', C: 'Doosan', D: 'Puma', E: '', F: 150, H: 'Active', I: '' },
  ]);

  addInstructionsSheet(wb, [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sarı örnek satırları doldurun.',
    '2) Tezgah Kodu benzersiz olmalıdır.',
  ]);

  addReferenceSheet(wb, [{ header: 'Durum', values: ['Active', 'Inactive', 'Maintenance'] }]);
  defineRange(wb, 'MachineStatusList', SHEET_REFERENCE, 'A', 3);
  applyListValidation(ws, 'H', EXAMPLE_START_ROW, 1000, 'MachineStatusList', false);

  return wb;
}

export function createShiftsTemplateWorkbook() {
  const wb = new exceljs.Workbook();
  wb.creator = 'verimlilik';
  wb.created = new Date();

  const cols: ColumnDef[] = [
    { col: 'A', header: 'Vardiya Kodu ★ (Benzersiz)', required: true, width: 18 },
    { col: 'B', header: 'Vardiya Adı ★', required: true, width: 22 },
    { col: 'C', header: 'Başlangıç Saati ★ (HH:MM)', required: true, width: 20 },
    { col: 'D', header: 'Bitiş Saati ★ (HH:MM)', required: true, width: 18 },
    { col: 'E', header: 'Vardiya Süresi (dk) ★', required: true, width: 20 },
    { col: 'F', header: 'Renk Kodu', required: false, width: 16 },
    { col: 'G', header: 'Durumu ★ (Dropdown)', required: true, width: 14 },
  ];

  const ws = wb.addWorksheet(SHEET_DATA);
  for (const c of cols) ws.getColumn(c.col).width = c.width ?? 18;
  styleTitleAndHeader(ws, 'SHIFTS IMPORT TEMPLATE', cols);

  fillExampleRows(ws, cols, [
    { A: 'Vardiya-1', B: 'Sabah', C: '06:00', D: '14:00', E: 480, F: '#FF6B6B', G: 'Active' },
    { A: 'Vardiya-2', B: 'Öğleden Sonra', C: '14:00', D: '22:00', E: 480, F: '#4ECDC4', G: 'Active' },
    { A: 'Vardiya-3', B: 'Gece', C: '22:00', D: '06:00', E: 480, F: '#45B7D1', G: 'Active' },
  ]);

  addInstructionsSheet(wb, [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sarı örnek satırları doldurun.',
    '2) Saat formatı HH:MM olmalıdır.',
  ]);

  addReferenceSheet(wb, [{ header: 'Durum', values: ['Active', 'Inactive'] }]);
  defineRange(wb, 'StatusList', SHEET_REFERENCE, 'A', 2);
  applyListValidation(ws, 'G', EXAMPLE_START_ROW, 1000, 'StatusList', false);

  return wb;
}

export function createProductionStandardsTemplateWorkbook(args: { machineCodes: string[]; productCodes: string[] }) {
  const wb = new exceljs.Workbook();
  wb.creator = 'verimlilik';
  wb.created = new Date();

  const cols: ColumnDef[] = [
    { col: 'A', header: 'Tezgah Kodu ★ (Dropdown)', required: true, width: 18 },
    { col: 'B', header: 'Ürün Kodu ★ (Dropdown)', required: true, width: 18 },
    { col: 'C', header: 'Birim Süre ★ (dk/adet)', required: true, width: 18 },
    { col: 'D', header: 'Kabul Edilen Duruş %', required: false, width: 18 },
    { col: 'E', header: 'Hedef OEE %', required: false, width: 14 },
    { col: 'F', header: 'Kalite Hedefi %', required: false, width: 16 },
    { col: 'G', header: 'Yürürlüğe Giriş Tarihi ★ (YYYY-MM-DD)', required: true, width: 26 },
    { col: 'H', header: 'Yürürlükten Çıkış Tarihi (YYYY-MM-DD)', required: false, width: 28 },
    { col: 'I', header: 'Durumu ★ (Dropdown)', required: true, width: 14 },
    { col: 'J', header: 'Notlar', required: false, width: 22 },
  ];

  const ws = wb.addWorksheet(SHEET_DATA);
  for (const c of cols) ws.getColumn(c.col).width = c.width ?? 18;
  styleTitleAndHeader(ws, 'PRODUCTION_STANDARDS IMPORT TEMPLATE', cols);

  fillExampleRows(ws, cols, [
    { A: args.machineCodes[0] || 'CNC-1', B: args.productCodes[0] || 'P001', C: 0.45, D: 10, E: 85, F: 99, G: new Date().toISOString().slice(0, 10), H: '', I: 'Active', J: '' },
    { A: args.machineCodes[0] || 'CNC-1', B: args.productCodes[1] || 'P002', C: 0.3, D: 10, E: 80, F: 98, G: new Date().toISOString().slice(0, 10), H: '', I: 'Active', J: '' },
    { A: args.machineCodes[1] || 'CNC-2', B: args.productCodes[0] || 'P001', C: 0.6, D: 12, E: 82, F: 99, G: new Date().toISOString().slice(0, 10), H: '', I: 'Active', J: '' },
  ]);

  addInstructionsSheet(wb, [
    'KULLANIM TALİMATLARI',
    '====================',
    '',
    '1) "Data" sayfasında sarı örnek satırları doldurun.',
    '2) Tezgah/Ürün alanlarını dropdown’dan seçin.',
    '3) Tarih formatı YYYY-MM-DD olmalıdır.',
  ]);

  // Reference sheet for dropdowns
  addReferenceSheet(wb, [
    { header: 'Tezgahlar', values: args.machineCodes },
    { header: 'Ürünler', values: args.productCodes },
    { header: 'Durum', values: ['Active', 'Inactive'] },
  ]);

  defineRange(wb, 'Machines', SHEET_REFERENCE, 'A', args.machineCodes.length);
  defineRange(wb, 'Products', SHEET_REFERENCE, 'B', args.productCodes.length);
  defineRange(wb, 'StatusList', SHEET_REFERENCE, 'C', 2);

  applyListValidation(ws, 'A', EXAMPLE_START_ROW, 1000, 'Machines', false);
  applyListValidation(ws, 'B', EXAMPLE_START_ROW, 1000, 'Products', false);
  applyListValidation(ws, 'I', EXAMPLE_START_ROW, 1000, 'StatusList', false);

  return wb;
}

