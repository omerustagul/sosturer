export type ImportType =
  | 'production_records'
  | 'products'
  | 'operators'
  | 'machines'
  | 'shifts'
  | 'departments'
  | 'department_roles'
  | 'warehouses'
  | 'operations'
  | 'stations'
  | 'routes'
  | 'production_standards';

export type CellAddress = {
  sheet: string;
  row: number;
  col: string;
};

export type ImportIssue = {
  type: 'error' | 'warning';
  code: string;
  message: string;
  address?: CellAddress;
  rowIndex?: number;
  rawValue?: unknown;
};

export type ImportValidateResult<TParsed> = {
  importType: ImportType;
  totalRows: number;
  validRows: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  parsedRows: TParsed[];
};

