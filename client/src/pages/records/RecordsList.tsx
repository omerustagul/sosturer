import { useState, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { SortingState, PaginationState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Eye,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Activity,
  Package,
  Calendar,
  User,
  Settings,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calculator
} from 'lucide-react';
import { notify } from '../../store/notificationStore';
import { Loading } from '../../components/common/Loading';
import { Tooltip } from '../../components/common/Tooltip';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { RecordDetailModal } from '../../components/records/RecordDetailModal';
import { CustomSelect } from '../../components/common/CustomSelect';

export interface RecordType {
  id: string;
  productionDate: string;
  shiftId: string;
  machineId: string;
  operatorId: string;
  productId: string;
  producedQuantity: number;
  plannedQuantity: number;
  cycleTimeSeconds: number;
  actualDurationMinutes: number;
  plannedDowntimeMinutes: number;
  unplannedDowntimeMinutes: number;
  downtimeMinutes: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  defectQuantity: number;
  notes: string;
  machine: { code: string; name: string };
  operator: { fullName: string };
  shift: { shiftCode: string; shiftName: string; durationMinutes: number };
  product: { productCode: string; productName: string; category: string; productGroup: string; brand: string };
}

const columnHelper = createColumnHelper<RecordType>();

export function RecordsList() {
  const navigate = useNavigate();
  const [data, setData] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

  const [filters, setFilters] = useState({
    machineId: '',
    operatorId: '',
    shiftId: '',
    productId: '',
    productGroup: '',
    category: '',
    brand: '',
    startDate: '',
    endDate: ''
  });

  // Reference data for filters
  const [machines, setMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, Partial<RecordType>>>({});
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => { }
  });

  const handleGlobalRecalculate = async () => {
    setConfirmState({
      isOpen: true,
      title: 'TÜMÜNÜ YENİDEN HESAPLA',
      message: 'TÜM üretim kayıtlarının OEE, kapasite ve duruş verileri sıfırdan hesaplanacaktır. Bu işlem kayıt sayısına göre zaman alabilir. Devam etmek istiyor musunuz?',
      type: 'warning',
      onConfirm: async () => {
        try {
          setLoading(true);
          await api.post('/production-records/recalculate-all', {});
          notify.success('Başarılı', 'Tüm kayıtlar yeniden hesaplandı.');
          fetchData();
        } catch (e: any) {
          notify.error('Hata', e.message || 'Hesaplama başarısız oldu.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const updateLocalChange = (id: string, field: keyof RecordType, value: any) => {
    setLocalChanges(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recordsRes, machinesRes, operatorsRes, productsRes, shiftsRes] = await Promise.all([
        api.get('/production-records'),
        api.get('/machines'),
        api.get('/operators'),
        api.get('/products'),
        api.get('/shifts')
      ]);
      setData(recordsRes);
      setMachines(machinesRes);
      setOperators(operatorsRes);
      setProducts(productsRes);
      setShifts(shiftsRes);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Merge changes for real-time calculation preview
  const mergedData = useMemo(() => {
    return data.map(r => ({
      ...r,
      ...(localChanges[r.id] || {})
    }));
  }, [data, localChanges]);

  // Centralized Shift Calculations for real-time OEE preview
  const shiftCalculations = useMemo(() => {
    const calcs: Record<string, { totalActualMin: number; ppt: number }> = {};
    mergedData.forEach(r => {
      const datePart = (r.productionDate || '').substring(0, 10);
      const key = `${datePart}_${r.machineId}_${r.shiftId}`;
      if (!calcs[key]) {
        const shift = shifts.find(s => s.id === r.shiftId) || r.shift;
        calcs[key] = { totalActualMin: 0, ppt: (shift?.durationMinutes || 0) - (r.plannedDowntimeMinutes || 0) };
      }
      calcs[key].totalActualMin += ((r.producedQuantity || 0) * (r.cycleTimeSeconds || 0)) / 60;
    });
    return calcs;
  }, [mergedData, shifts]);

  // Memoized filter options
  const categoryOptions = useMemo(() =>
    Array.from(new Set(products.map(p => p.category).filter(Boolean)))
      .map(g => ({ id: g!, label: g! })),
    [products]
  );

  const productGroupOptions = useMemo(() =>
    Array.from(new Set(products.map(p => p.productGroup).filter(Boolean)))
      .map(g => ({ id: g!, label: g! })),
    [products]
  );

  const brandOptions = useMemo(() =>
    Array.from(new Set(products.map(p => p.brand).filter(Boolean)))
      .map(b => ({ id: b!, label: b! })),
    [products]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const exportExcelData = async () => {
    try {
      setLoading(true);
      await api.download('/reports/excel/export', 'Uretim_Kayitlari.xlsx');
    } catch (e) {
      alert('Excel dışa aktarma başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'KAYDI SİL',
      message: 'Bu üretim kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/production-records/${id}`);
          fetchData();
          notify.success('Silindi', 'Kayıt başarıyla silindi.');
        } catch (e) {
          notify.error('Hata', 'Kayıt silinirken bir hata oluştu.');
        }
      }
    });
  };

  const SortIcon = ({ sortStatus }: { sortStatus: false | 'asc' | 'desc' }) => {
    if (!sortStatus) return <TrendingUp size={11} className="text-theme-dim/60 group-hover:text-theme-primary/40 ml-1.5 inline-block transition-colors" />;
    return sortStatus === 'asc'
      ? <ChevronLeft size={13} className="rotate-90 text-theme-primary ml-1.5 inline-block" />
      : <ChevronRight size={13} className="rotate-90 text-theme-primary ml-1.5 inline-block" />;
  };

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <label className="relative flex items-center cursor-pointer group">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={table.getIsAllRowsSelected()}
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
            <div className="w-5 h-5 bg-theme-base border-2 border-theme rounded-lg transition-all peer-checked:bg-theme-primary peer-checked:border-theme-primary group-hover:border-theme-muted flex items-center justify-center">
              <div className="w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 mb-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
          </label>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <label className="relative flex items-center cursor-pointer group">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
            />
            <div className="w-5 h-5 bg-theme-base border-2 border-theme rounded-lg transition-all peer-checked:bg-theme-primary peer-checked:border-theme-primary group-hover:border-theme-muted flex items-center justify-center scale-90 group-hover:scale-100">
              <div className="w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 mb-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
          </label>
        </div>
      ),
      size: 30,
      minSize: 30,
      maxSize: 30,
    }),
    columnHelper.accessor('productionDate', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Tarih</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-theme-main">{format(new Date(info.getValue()), 'dd.MM.yyyy')}</span>
          <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest leading-none">
            {format(new Date(info.getValue()), 'EEEE', { locale: tr })}
          </span>
        </div>
      ),
      size: 100,
      minSize: 100,
    }),
    columnHelper.accessor('machine.code', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Tezgah</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => <span className="font-mono text-theme-primary font-bold bg-theme-primary/5 px-2 py-1 rounded-lg border border-theme-primary/10">{info.getValue() || '-'}</span>,
      size: 80,
      minSize: 80,
    }),
    columnHelper.accessor(row => row.shift.durationMinutes, {
      id: 'plannedDuration',
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>P.Çalışma</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => (
        <div className="flex items-center gap-1.5 font-medium text-theme-muted">
          <Clock size={12} className="text-theme-primary/60" />
          <span>{info.getValue() || 0}</span> <span className="text-[10px] font-bold text-theme-muted/60">dk</span>
        </div>
      ),
      size: 85,
      minSize: 85,
    }),
    columnHelper.accessor('product.productCode', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Ürün</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => (
        <div className="flex flex-col max-w-[120px]">
          <span className="text-theme-main font-bold truncate">{info.getValue() || '-'}</span>
          <span className="text-[10px] text-theme-muted truncate leading-none">{(info.row.original.product as any).productName}</span>
        </div>
      ),
      size: 140,
      minSize: 140,
    }),
    columnHelper.accessor('cycleTimeSeconds', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Birim Süre</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => {
        const id = info.row.original.id;
        const meta = info.table.options.meta as any;
        const isSelected = meta?.rowSelection?.[id];
        const isBulkEditing = meta?.isBulkEditing;
        const localChanges = meta?.localChanges;

        if (isBulkEditing && isSelected) {
          return (
            <input
              type="number"
              step="0.01"
              value={localChanges?.[id]?.cycleTimeSeconds ?? info.getValue()}
              onChange={(e) => meta?.updateLocalChange(id, 'cycleTimeSeconds', parseFloat(e.target.value) || 0)}
              className="w-24 bg-theme-surface border-2 border-theme-primary/30 rounded-xl px-3 py-1.5 text-theme-main text-xs font-bold focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all"
            />
          );
        }
        return <span className="font-bold text-theme-primary/80">{info.getValue()} <span className="text-[9px] font-black text-theme-muted/60">sn</span></span>;
      },
      size: 80,
      minSize: 80,
    }),
    columnHelper.accessor('plannedQuantity', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Planlanan</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => <span className="text-theme-muted font-medium">{info.getValue() || 0}</span>,
      size: 80,
      minSize: 80,
    }),
    columnHelper.accessor('producedQuantity', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Üretilen</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => {
        const id = info.row.original.id;
        const meta = info.table.options.meta as any;
        const isSelected = meta?.rowSelection?.[id];
        const isBulkEditing = meta?.isBulkEditing;
        const localChanges = meta?.localChanges;

        if (isBulkEditing && isSelected) {
          return (
            <input
              type="number"
              value={localChanges?.[id]?.producedQuantity ?? info.getValue()}
              onChange={(e) => meta?.updateLocalChange(id, 'producedQuantity', parseInt(e.target.value) || 0)}
              className="w-24 bg-theme-surface border-2 border-theme-primary/30 rounded-xl px-3 py-1.5 text-theme-main text-xs font-bold focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all"
            />
          );
        }
        return <span className="text-theme-success font-black">{info.getValue()}</span>;
      },
      size: 80,
      minSize: 80,
    }),
    columnHelper.accessor('defectQuantity', {
      header: 'Fire',
      cell: info => {
        const id = info.row.original.id;
        const meta = info.table.options.meta as any;
        const isSelected = meta?.rowSelection?.[id];
        const isBulkEditing = meta?.isBulkEditing;
        const localChanges = meta?.localChanges;

        if (isBulkEditing && isSelected) {
          return (
            <input
              type="number"
              value={localChanges?.[id]?.defectQuantity ?? (info.getValue() || 0)}
              onChange={(e) => meta?.updateLocalChange(id, 'defectQuantity', parseInt(e.target.value) || 0)}
              className="w-20 bg-theme-surface border-2 border-theme-danger/30 rounded-xl px-3 py-1.5 text-theme-main text-xs font-bold focus:border-theme-danger focus:ring-4 focus:ring-theme-danger/10 outline-none transition-all"
            />
          );
        }
        return <span className="text-theme-danger font-medium">{info.getValue() || 0}</span>;
      },
      size: 60,
      minSize: 60,
    }),
    columnHelper.accessor('downtimeMinutes', {
      id: 'downtimeMinutes',
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>Top.Duruş</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => <span className="text-theme-danger/80 font-medium">{info.getValue() || 0} <span className="text-[9px] text-theme-dim">dk</span></span>,
      size: 80,
      minSize: 80,
    }),
    columnHelper.accessor('oee', {
      header: ({ column }) => (
        <div className="flex items-center cursor-pointer group hover:text-theme-primary transition-colors" onClick={() => column.toggleSorting()}>
          <span>OEE (%)</span>
          <SortIcon sortStatus={column.getIsSorted()} />
        </div>
      ),
      cell: info => {
        const r = info.row.original;
        const meta = info.table.options.meta as any;
        const shiftCalculations = meta?.shiftCalculations;

        const datePart = (r.productionDate || '').substring(0, 10);
        const key = `${datePart}_${r.machineId}_${r.shiftId}`;
        const calc = shiftCalculations?.[key];

        let displayOee = r.oee || 0;

        // If there are local changes for this shift, recalculate preview OEE
        const availability = (calc && calc.ppt > 0) ? (calc.totalActualMin / calc.ppt) : 0;
        const quality = r.producedQuantity > 0 ? (r.producedQuantity - (r.defectQuantity || 0)) / r.producedQuantity : 1;
        displayOee = Math.min(100, availability * quality * 100);

        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-tighter ${displayOee >= 80 ? 'bg-theme-success/10 text-theme-success border border-theme-success/20' :
            displayOee >= 60 ? 'bg-theme-warning/10 text-theme-warning border border-theme-warning/20' :
              'bg-theme-danger/10 text-theme-danger border border-theme-danger/20'
            }`}>
            %{displayOee.toFixed(1)}
          </span>
        );
      },
      size: 80,
      minSize: 80,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'İşlemler',
      cell: info => (
        <div className="flex items-center gap-1.5 justify-end">
          <Tooltip content="Görüntüle">
            <button
              onClick={() => setSelectedRecord(info.row.original)}
              className="p-2 hover:bg-theme-main/10 rounded-xl text-theme-dim hover:text-theme-main transition-all bg-theme-card border border-theme group"
            >
              <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </Tooltip>
          <Tooltip content="Düzenle">
            <button
              onClick={() => navigate(`/records/edit/${info.row.original.id}`)}
              className="p-2 hover:bg-theme-primary/10 rounded-xl text-theme-dim hover:text-theme-primary transition-all bg-theme-card border border-theme group"
            >
              <Edit className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </Tooltip>
          <Tooltip content="Sil">
            <button
              onClick={() => handleDelete(info.row.original.id)}
              className="p-2 hover:bg-red-500/10 rounded-xl text-theme-dim hover:text-red-400 transition-all bg-theme-card border border-theme group"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </Tooltip>
        </div>
      ),
      size: 120,
      minSize: 120,
    }),
  ], [navigate, isBulkEditing]); // Stabilized deps, exclude localChanges and rowSelection!

  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Search term filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLocaleLowerCase('tr-TR');
      filtered = filtered.filter(r =>
        r.machine.code.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        r.product.productCode.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        r.operator.fullName.toLocaleLowerCase('tr-TR').includes(lowerSearch)
      );
    }

    // Machine filter
    if (filters.machineId) {
      filtered = filtered.filter(r => r.machineId === filters.machineId);
    }

    // Operator filter
    if (filters.operatorId) {
      filtered = filtered.filter(r => r.operatorId === filters.operatorId);
    }

    // Shift filter
    if (filters.shiftId) {
      filtered = filtered.filter(r => r.shiftId === filters.shiftId);
    }

    // Product filter
    if (filters.productId) {
      filtered = filtered.filter(r => r.productId === filters.productId);
    }

    // Category filter (via product relation)
    if (filters.category) {
      filtered = filtered.filter(r => r.product.category === filters.category);
    }

    // Product Group filter
    if (filters.productGroup) {
      filtered = filtered.filter(r => r.product.productGroup === filters.productGroup);
    }

    // Brand filter (via product relation)
    if (filters.brand) {
      filtered = filtered.filter(r => r.product.brand === filters.brand);
    }

    // Date range filter
    if (filters.startDate) {
      filtered = filtered.filter(r => r.productionDate >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(r => r.productionDate <= filters.endDate);
    }

    return filtered;
  }, [mergedData, searchTerm, filters]);

  // Optimized Stats Calculation
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { oee: 0, totalProduced: 0, totalCapacity: 0, totalRecords: 0, totalDowntime: 0 };
    }

    const totalProduced = filteredData.reduce((acc, curr) => acc + (curr.producedQuantity || 0), 0);
    const totalDowntime = filteredData.reduce((acc, curr) => acc + (curr.downtimeMinutes || 0), 0);
    const totalRecords = filteredData.length;

    let oeeSum = 0;
    let capacitySum = 0;
    let shiftCount = 0;
    const shiftKeys = new Set<string>();

    filteredData.forEach(r => {
      const datePart = (r.productionDate || '').substring(0, 10);
      const key = `${datePart}_${r.machineId}_${r.shiftId}`;

      const calc = shiftCalculations[key];
      const availability = (calc && calc.ppt > 0) ? (calc.totalActualMin / calc.ppt) : 0;
      const quality = r.producedQuantity > 0 ? (r.producedQuantity - (r.defectQuantity || 0)) / r.producedQuantity : 1;
      const calculatedOee = Math.min(100, availability * quality * 100);

      oeeSum += calculatedOee;
      if (!shiftKeys.has(key)) {
        shiftKeys.add(key);
        const shift = shifts.find(s => s.id === r.shiftId) || r.shift;
        capacitySum += (shift?.durationMinutes || 0);
      }
      shiftCount++;
    });

    return {
      oee: (oeeSum / (shiftCount || 1)).toFixed(1),
      totalProduced,
      totalCapacity: capacitySum,
      totalDowntime,
      totalRecords
    };
  }, [filteredData, shiftCalculations, shifts]);

  const footerTotals = useMemo(() => {
    if (filteredData.length === 0) return null;

    let shiftDurationSum = 0;
    let shiftDowntimeSum = 0;
    let oeeSum = 0;
    let shiftCount = 0;

    const recordTotals = filteredData.reduce((acc, curr) => ({
      plannedQty: acc.plannedQty + (curr.plannedQuantity || 0),
      producedQty: acc.producedQty + (curr.producedQuantity || 0),
      defectQty: acc.defectQty + (curr.defectQuantity || 0),
    }), { plannedQty: 0, producedQty: 0, defectQty: 0 });

    // Use Weighted Average for avgCycle (Robust Math: Sum of CycleTime * Qty / Sum of Qty)
    let avgCycleValue = 0;
    let totalWeightedTime = 0;
    let totalProduced = 0;

    filteredData.forEach(r => {
      const q = r.producedQuantity || 0;
      totalWeightedTime += (r.cycleTimeSeconds || 0) * q;
      totalProduced += q;
    });

    if (totalProduced > 0) {
      avgCycleValue = totalWeightedTime / totalProduced;
    } else {
      const simpleSum = filteredData.reduce((acc, r) => acc + (r.cycleTimeSeconds || 0), 0);
      avgCycleValue = simpleSum / (filteredData.length || 1);
    }

    filteredData.forEach(r => {
      const datePart = (r.productionDate || '').substring(0, 10);
      const key = `${datePart}_${r.machineId}_${r.shiftId}`;
      const calc = shiftCalculations[key];

      const availability = (calc && calc.ppt > 0) ? (calc.totalActualMin / calc.ppt) : 0;
      const quality = r.producedQuantity > 0 ? (r.producedQuantity - (r.defectQuantity || 0)) / r.producedQuantity : 1;
      const calculatedOee = Math.min(100, availability * quality * 100);

      oeeSum += calculatedOee;
      shiftDurationSum += (r.shift?.durationMinutes || 0);
      shiftDowntimeSum += (r.downtimeMinutes || 0);
      shiftCount++;
    });

    return {
      duration: shiftDurationSum,
      avgCycle: avgCycleValue.toFixed(2),
      plannedQty: recordTotals.plannedQty,
      producedQty: recordTotals.producedQty,
      defectQty: recordTotals.defectQty,
      downtime: shiftDowntimeSum,
      avgOee: (oeeSum / (shiftCount || 1)).toFixed(1),
    };
  }, [filteredData, shiftCalculations]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onEnd',
    enableColumnResizing: true,
    getRowId: row => row.id,
    meta: {
      localChanges,
      updateLocalChange,
      isBulkEditing,
      rowSelection,
      shiftCalculations
    }
  });

  const selectedRows = table.getSelectedRowModel().flatRows;
  const selectedCount = selectedRows.length;

  const handleBulkDelete = async () => {
    setConfirmState({
      isOpen: true,
      title: 'TOPLU SİLME',
      message: `${selectedCount} adet kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setLoading(true);
          const ids = selectedRows.map(r => r.original.id);
          await api.post('/production-records/bulk-delete', { ids });
          setRowSelection({});
          fetchData();
          notify.success('Başarılı', 'Seçili kayıtlar silindi.');
        } catch (e) {
          notify.error('Hata', 'Toplu silme başarısız oldu.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleBulkSave = async () => {
    try {
      setLoading(true);
      const updates = Object.entries(localChanges).map(([id, data]) => ({ id, data }));
      if (updates.length > 0) {
        await api.post('/production-records/bulk-update', { updates });
      }
      setLocalChanges({});
      setIsBulkEditing(false);
      setRowSelection({});
      fetchData();
    } catch (e) {
      notify.error('Hata', 'Toplu kaydetme başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const [showAddOptions, setShowAddOptions] = useState(false);

  return (
    <div className="p-6 lg:p-10 w-full space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-theme-main tracking-tight flex items-center gap-4">
            <Activity className="w-10 h-10 text-theme-primary" /> Üretim Kayıtları
          </h2>
          <p className="text-theme-muted text-sm mt-2 font-medium">Günlük üretim verileri, OEE analizleri ve tezgah performansları.</p>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 lg:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Kayıtlarda ara..."
              className="w-full h-10 bg-theme-base border-2 border-theme rounded-xl pl-12 pr-4 py-3 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all shadow-inner"
            />
          </div>



          <div className="flex items-center gap-3">
            <button
              onClick={handleGlobalRecalculate}
              title="Tüm Kayıtları Yeniden Hesapla"
              className="w-10 h-10 bg-theme-base hover:bg-theme-primary/10 border-2 border-theme rounded-xl text-theme-dim hover:text-theme-primary transition-all flex items-center justify-center shadow-inner group active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 transition-all group-hover:rotate-180 duration-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCalculator(true)}
              title="Üretim Hesaplama Aracı"
              className="w-10 h-10 bg-theme-base hover:bg-theme-primary/10 border-2 border-theme rounded-xl text-theme-dim hover:text-theme-primary transition-all flex items-center justify-center shadow-inner group active:scale-95"
            >
              <Calculator className="w-4 h-4" />
            </button>
          </div>

          <div className="relative group" onMouseEnter={() => setShowAddOptions(true)} onMouseLeave={() => setShowAddOptions(false)}>
            <button
              className="w-full h-10 bg-theme-primary hover:bg-theme-primary-hover text-white px-6 py-3.5 rounded-xl text-sm font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-3 active:scale-95"
            >
              <Plus className={`w-5 h-5 transition-transform duration-500 ${showAddOptions ? 'rotate-90' : ''}`} /> YENİ KAYIT
            </button>

            {/* Dropdown Options */}
            <div className={`absolute right-0 top-full mt-3 w-64 bg-theme-card backdrop-blur-2xl border border-theme rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 transition-all duration-300 origin-top-right ${showAddOptions ? 'scale-100 opacity-100 visible' : 'scale-90 opacity-0 invisible translate-y-2'}`}>
              <button
                onClick={() => navigate('/records/new')}
                className="w-full flex items-center gap-4 p-4 hover:bg-theme-main/5 rounded-2xl text-left transition-colors group/btn"
              >
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center group-hover/btn:bg-theme-primary/20 transition-colors">
                  <Plus className="w-5 h-5 text-theme-primary" />
                </div>
                <div>
                  <p className="text-theme-main font-black text-xs uppercase tracking-widest">MANUEL EKLE</p>
                  <p className="text-theme-dim text-[10px] font-bold mt-0.5">Tekil kayıt oluşturun</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/records/bulk')}
                className="w-full flex items-center gap-4 p-4 hover:bg-theme-main/5 rounded-2xl text-left transition-colors group/btn mt-1 border-t border-theme"
              >
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center group-hover/btn:bg-theme-primary/20 transition-colors">
                  <Activity className="w-5 h-5 text-theme-primary" />
                </div>
                <div>
                  <p className="text-theme-main font-black text-xs uppercase tracking-widest">HIZLI TOPLU GİRİŞ</p>
                  <p className="text-theme-dim text-[10px] font-bold mt-0.5">Vardiya bazlı matris girişi</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/settings', { state: { activeTab: 'import', importType: 'production_records' } })}
                className="w-full flex items-center gap-4 p-4 hover:bg-theme-main/5 rounded-2xl text-left transition-colors group/btn mt-1"
              >
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover/btn:bg-emerald-500/20 transition-colors">
                  <Download className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-theme-main font-black text-xs uppercase tracking-widest">EXCEL'DEN AKTAR</p>
                  <p className="text-theme-dim text-[10px] font-bold mt-0.5">Toplu veri yükleyin</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Filter Bar */}
      <div className="relative z-30 bg-theme-card backdrop-blur-xl border border-theme rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-theme pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-theme-primary/10 rounded-lg">
              <Filter size={18} className="text-theme-primary" />
            </div>
            <h3 className="text-xs font-black text-theme-muted uppercase tracking-widest">Gelişmiş Filtreleme</h3>
          </div>
          {(filters.machineId || filters.operatorId || filters.shiftId || filters.productId || filters.productGroup || filters.category || filters.brand || filters.startDate || filters.endDate) && (
            <button
              onClick={() => {
                setFilters({ machineId: '', operatorId: '', shiftId: '', productId: '', productGroup: '', category: '', brand: '', startDate: '', endDate: '' });
                setSearchTerm('');
              }}
              className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 uppercase tracking-widest"
            >
              <XCircle size={14} /> Filtreleri Temizle
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Ãœst SatÄ±r: 5 Filtre */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Settings size={12} /> Tezgah
              </label>
              <CustomSelect
                options={machines.map(m => ({ id: m.id, label: m.code, subLabel: m.name }))}
                value={filters.machineId}
                onChange={(val) => setFilters(prev => ({ ...prev, machineId: val }))}
                placeholder="Hepsi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <User size={12} /> Personel
              </label>
              <CustomSelect
                options={operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))}
                value={filters.operatorId}
                onChange={(val) => setFilters(prev => ({ ...prev, operatorId: val }))}
                placeholder="Hepsi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Package size={12} /> Ürün
              </label>
              <CustomSelect
                options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                value={filters.productId}
                onChange={(val) => setFilters(prev => ({ ...prev, productId: val }))}
                placeholder="Hepsi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Package size={12} /> Ürün Grubu
              </label>
              <CustomSelect
                options={productGroupOptions}
                value={filters.productGroup}
                onChange={(val) => setFilters(prev => ({ ...prev, productGroup: val }))}
                placeholder="Hepsi"
                searchable
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Package size={12} /> Kategori
              </label>
              <CustomSelect
                options={categoryOptions}
                value={filters.category}
                onChange={(val) => setFilters(prev => ({ ...prev, category: val }))}
                placeholder="Hepsi"
                searchable
              />
            </div>
          </div>

          {/* Alt SatÄ±r: 4 Filtre */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Settings size={12} /> Marka
              </label>
              <CustomSelect
                options={brandOptions}
                value={filters.brand}
                onChange={(val) => setFilters(prev => ({ ...prev, brand: val }))}
                placeholder="Hepsi"
                searchable
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Clock size={12} /> Vardiya
              </label>
              <CustomSelect
                options={shifts.map(s => ({ id: s.id, label: s.shiftName, subLabel: `${s.durationMinutes} dk` }))}
                value={filters.shiftId}
                onChange={(val) => setFilters(prev => ({ ...prev, shiftId: val }))}
                placeholder="Hepsi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Calendar size={12} className="text-theme-primary/60" /> Başlangıç
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-theme-base border border-theme rounded-xl px-4 py-2.5 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all custom-calendar-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Calendar size={12} className="text-theme-primary/60" /> Bitiş
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-theme-base border border-theme rounded-xl px-4 py-2.5 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all custom-calendar-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Card Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard icon={TrendingUp} label="Ortalama OEE" value={`%${stats.oee}`} color="text-theme-primary" />
        <StatCard icon={Package} label="Toplam Üretim" value={stats.totalProduced.toLocaleString()} color="text-theme-success" />
        <StatCard icon={Clock} label="Toplam Kapasite" value={`${stats.totalCapacity.toLocaleString()} dk`} color="text-theme-warning" />
        <StatCard icon={AlertTriangle} label="Toplam Duruş" value={`${Math.round(stats.totalDowntime || 0).toLocaleString()} dk`} color="text-theme-danger" />
        <StatCard icon={Activity} label="Toplam Kayıt" value={stats.totalRecords} color="text-theme-dim" />
      </div>

      {/* Main Table Content */}
      <div className="bg-theme-card backdrop-blur-xl border border-theme rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-theme flex items-center justify-between bg-theme-surface/30">
          <h3 className="text-xs font-bold text-theme-dim flex items-center gap-2">
            <Filter size={14} /> Veri Listesi
          </h3>
          <div className="flex gap-2">
            <button
              onClick={exportExcelData}
              disabled={loading}
              className="p-2 px-4 rounded-xl text-xs font-bold text-theme-dim hover:text-theme-main bg-theme-base border border-theme transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Dışa Aktar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
          {loading ? (
            <div className="py-32 flex flex-col items-center">
              <Loading size="lg" />
              <p className="text-theme-primary font-black text-xs uppercase tracking-widest mt-4 animate-pulse">Veri Yükleniyor...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse resizable-table density-aware-table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="bg-theme-surface/50 transition-colors">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className={`py-2 text-[10px] font-bold text-theme-dim border-b border-theme relative ${header.column.id === 'select' ? 'px-0 w-[10px] max-w-[10px]' : 'px-1'}`}
                        style={{
                          width: header.getSize(),
                          position: 'relative'
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                            style={{
                              transform: header.column.getIsResizing() ? 'translateX(0)' : undefined,
                            }}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-theme/40">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="group hover:bg-theme-main/5 transition-all duration-300">
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={`py-1.5 text-[13px] whitespace-nowrap ${cell.column.id === 'select' ? 'px-0 w-[30px] max-w-[30px]' : 'px-1'}`}
                        style={{
                          width: cell.column.getSize(),
                          maxWidth: cell.column.getSize()
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-30">
                        <Package size={64} className="text-theme-dim" />
                        <p className="text-theme-dim font-bold uppercase tracking-widest text-[13px]">Henüz hiç kayıt bulunmuyor.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {footerTotals && (
                <tfoot className="bg-theme-surface border-t-2 border-theme backdrop-blur-md">
                  <tr>
                    <td className="px-0 py-3 text-center text-theme-primary font-black text-[10px] italic w-[30px] max-w-[30px]">Toplam</td>
                    <td className="px-1 py-1 text-theme-dim font-bold text-[10px]">---</td>
                    <td className="px-1 py-1 text-theme-dim font-bold text-[10px]">---</td>
                    <td className="px-1 py-1 text-theme-main font-bold text-[11px]">{footerTotals.duration.toLocaleString()} <span className="opacity-50 text-[9px]">dk</span></td>
                    <td className="px-1 py-1 text-theme-dim font-bold text-[10px]">---</td>
                    <td className="px-1 py-1 text-theme-primary/80 font-bold text-[11px]">{footerTotals.avgCycle} <span className="opacity-50 text-[9px]">sn</span></td>
                    <td className="px-1 py-1 text-theme-dim font-bold text-[11px]">{footerTotals.plannedQty.toLocaleString()}</td>
                    <td className="px-1 py-1 text-theme-success font-black text-[11px]">{footerTotals.producedQty.toLocaleString()}</td>
                    <td className="px-1 py-1 text-theme-danger font-bold text-[11px]">{footerTotals.defectQty.toLocaleString()}</td>
                    <td className="px-1 py-1 text-theme-danger/80 font-bold text-[11px]">{footerTotals.downtime.toLocaleString()} <span className="opacity-50 text-[9px]">dk</span></td>
                    <td className="px-1 py-1 text-center">
                      <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] bg-theme-primary/10 text-theme-primary border border-theme-primary/20`}>
                        %{footerTotals.avgOee}
                      </span>
                    </td>
                    <td className="px-1 py-1 text-theme-dim font-bold text-[10px]">---</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-theme flex flex-col md:flex-row items-center justify-between bg-theme-surface/30 gap-6">
          <div className="flex flex-wrap items-center gap-6 order-2 md:order-1">
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest whitespace-nowrap">
              {filteredData.length} Kayıt Bulundu
            </p>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest whitespace-nowrap">SAYFADA GÖRÜNÜM:</span>
              <div className="w-24">
                <CustomSelect
                  options={[10, 25, 50, 100, 250].map(size => ({ id: size, label: size.toString() }))}
                  value={table.getState().pagination.pageSize}
                  onChange={value => table.setPageSize(Number(value))}
                  searchable={false}
                  placeholder="Seç"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-2xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                {table.getState().pagination.pageIndex + 1}
              </span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                {table.getPageCount() || 1}
              </span>
            </div>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal Integration */}
      {selectedRecord && createPortal(
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />,
        document.body
      )}

      {showCalculator && createPortal(
        <ProductionCalculatorModal
          shifts={shifts}
          products={products}
          onClose={() => setShowCalculator(false)}
        />,
        document.body
      )}

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && createPortal(
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 w-fit max-w-[95vw]">
          <div className="bg-theme-card backdrop-blur-2xl border border-theme-primary/30 rounded-2xl p-3 flex items-center gap-6 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-3 border-r border-theme pr-6">
              <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shadow-theme-primary/20">
                {selectedCount}
              </div>
              <div className="whitespace-nowrap">
                <p className="text-[10px] font-black text-theme-primary uppercase tracking-widest leading-none">SEÇİLİ</p>
                <p className="text-theme-main font-bold text-xs mt-1">İşlem Bekliyor</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isBulkEditing ? (
                <button
                  onClick={handleBulkSave}
                  className="flex items-center gap-2 px-5 py-2.5 bg-theme-success hover:bg-theme-success/80 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-theme-success/10"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Değişiklikleri Kaydet
                </button>
              ) : (
                <button
                  onClick={() => setIsBulkEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-theme-base hover:bg-theme-surface border border-theme rounded-xl text-theme-main font-black text-[10px] uppercase tracking-wider transition-all active:scale-95"
                >
                  <Edit className="w-3.5 h-3.5 text-theme-primary" />
                  Tabloyu Düzenle
                </button>
              )}

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-5 py-2.5 bg-theme-danger/10 hover:bg-theme-danger/20 border border-theme-danger/20 rounded-xl text-theme-danger font-black text-[10px] uppercase tracking-wider transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Seçiliyi Sil
              </button>

              <div className="w-px h-8 bg-theme mx-2" />

              <button
                onClick={() => {
                  setRowSelection({});
                  setIsBulkEditing(false);
                  setLocalChanges({});
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-theme-dim hover:text-theme-main transition-colors text-[10px] font-black uppercase tracking-widest"
              >
                <XCircle className="w-4 h-4" />
                İptal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
      />
    </div>
  );
}

const StatCard = memo(({ icon: Icon, label, value, color }: any) => {
  return (
    <div className="bg-theme-card backdrop-blur-md border border-theme rounded-2xl p-6 hover:bg-theme-surface hover:-translate-y-1 transition-all duration-300 group shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color.replace('text', 'bg')}/10 group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-6 h-6`} />
        </div>
      </div>
      <div>
        <p className="text-xs font-black text-theme-dim uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-2xl font-black text-theme-main tracking-tight">{value}</p>
      </div>
    </div>
  );
});

function ProductionCalculatorModal({ shifts, products, onClose }: any) {
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [cycleTime, setCycleTime] = useState<number>(30);
  const [selectedProductId, setSelectedProductId] = useState('');

  const selectedShift = shifts.find((s: any) => s.id === selectedShiftId);
  const duration = selectedShift?.durationMinutes || 0;

  const result = useMemo(() => {
    if (duration <= 0 || cycleTime <= 0) return 0;
    return Math.floor((duration * 60) / cycleTime);
  }, [duration, cycleTime]);

  const handleProductChange = (pid: string) => {
    setSelectedProductId(pid);
    const p = products.find((x: any) => x.id === pid);
    if (p?.cycleTimeSeconds) setCycleTime(p.cycleTimeSeconds);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-theme-sidebar/10 backdrop-blur-xs" onClick={onClose} />
      <div className="bg-theme-base border border-theme-primary/30 rounded-3xl w-full max-w-lg shadow-[0_32px_64px_rgba(0,0,0,0.2)] relative overflow-hidden ring-1 ring-white/10">
        <div className="p-4 border-b border-theme bg-theme-surface/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-theme-primary/20 rounded-2xl text-theme-primary">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-theme-main uppercase tracking-tight">ÜRETİM HESAPLAMA ARACI</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-theme-primary/10 rounded-xl transition-all text-theme-dim hover:text-theme-primary">
              <XCircle size={20} />
            </button>
          </div>
          <p className="text-theme-muted text-[10px] font-bold uppercase tracking-widest leading-relaxed">Vardiya süresi ve birim süreye göre teorik kapasite analizi</p>
        </div>

        <div className="px-6 py-3 space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest px-1">ÜRÜN SEÇIMI (OPSIYONEL)</label>
              <CustomSelect
                options={products.map((p: any) => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                value={selectedProductId}
                onChange={handleProductChange}
                placeholder="Ürün seçerek birim süreyi getir..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest px-1 flex items-center justify-between">
                VARDIYA SÜRESI
                {duration > 0 && <span className="text-theme-primary font-black">{duration} DK</span>}
              </label>
              <CustomSelect
                options={shifts.map((s: any) => ({ id: s.id, label: s.shiftName, subLabel: `${s.durationMinutes} dk` }))}
                value={selectedShiftId}
                onChange={setSelectedShiftId}
                placeholder="Bir vardiya seçin..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest px-1">BIRIM SÜRE (SANIYE)</label>
              <div className="relative">
                <input
                  type="number"
                  value={cycleTime}
                  onChange={(e) => setCycleTime(parseFloat(e.target.value) || 0)}
                  className="w-full h-12 bg-theme-base border-2 border-theme rounded-xl px-5 text-sm text-theme-main font-black focus:border-theme-primary focus:ring-4 focus:ring-theme-primary/10 transition-all outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-theme-dim uppercase tracking-widest">SANIYE</span>
              </div>
            </div>
          </div>

          <div className="bg-theme-primary/5 rounded-3xl p-8 border border-theme-primary/20 flex flex-col items-center justify-center text-center space-y-2 group hover:bg-theme-primary/10 transition-all duration-500">
            <p className="text-[10px] font-black text-theme-primary uppercase tracking-[0.2em] mb-2 opacity-60">TOPLAM ÜRETİLEBİLECEK ADET</p>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black text-theme-primary tracking-tighter group-hover:scale-110 transition-transform duration-500">
                {result.toLocaleString()}
              </span>
              <span className="text-sm font-black text-theme-primary/40 uppercase">ADET</span>
            </div>
            <div className="mt-4 pt-4 border-t border-theme-primary/10 w-full">
              <p className="text-[9px] text-theme-dim font-bold leading-relaxed italic opacity-80">
                * Bu değer {duration} dakika ({duration * 60} saniye) çalışma süresinin tamamında %100 verimlilikle üretim yapıldığı varsayılarak hesaplanmıştır.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-theme-surface/30 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            ANLADIM
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordsList;
