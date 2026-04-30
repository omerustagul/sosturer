import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { ArrowRightLeft, Calendar, ChevronLeft, ChevronRight, Filter, History, Package, Search, TrendingDown, TrendingUp, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const initialFilters = {
  search: '',
  product: '',
  lotNumber: '',
  type: 'all',
  warehouseId: 'all',
  startDate: '',
  endDate: '',
  referenceId: ''
};

const movementTypes = [
  { id: 'all', label: 'Tüm Hareketler' },
  { id: 'PRODUCTION', label: 'Üretim Girişi' },
  { id: 'SALE', label: 'Satış Çıkışı' },
  { id: 'STOCK_VOUCHER_ENTRY', label: 'Stok Girişi' },
  { id: 'STOCK_VOUCHER_EXIT', label: 'Stok Çıkışı' },
  { id: 'TRANSFER', label: 'Transfer' },
  { id: 'STOCK_COUNT_SURPLUS', label: 'Sayım Fazlası' },
  { id: 'STOCK_COUNT_SHORTAGE', label: 'Sayım Eksigi' },
  { id: 'SCRAP', label: 'Fire / Hurda' },
  { id: 'RESERVE', label: 'Rezerve' },
  { id: 'CONSUMPTION', label: 'Üretim Tüketimi' },
  { id: 'CONSUMPTION_TRANSACTION', label: 'Tüketim İşlemi' },
  { id: 'REJECT', label: 'Üretim Reddi' },
  { id: 'SAMPLE', label: 'Üretim Numarası' },
  { id: 'CONSUMPTION_EXIT', label: 'Tüketim Çıkışı' }
];

const normalize = (value: any) => String(value || '').toLocaleLowerCase('tr-TR');

export function StockMovements() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [warehouseRes, movementRes] = await Promise.all([
          api.get('/inventory/warehouses'),
          api.get('/inventory/movements?take=5000')
        ]);
        setWarehouses(warehouseRes);
        setMovements(movementRes);
      } catch (e) {
        console.error('Failed to load stock movements');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredMovements = useMemo(() => {
    const search = normalize(filters.search.trim());
    const product = normalize(filters.product.trim());
    const lotNumber = normalize(filters.lotNumber.trim());
    const referenceId = normalize(filters.referenceId.trim());
    const startTime = filters.startDate ? new Date(filters.startDate).setHours(0, 0, 0, 0) : null;
    const endTime = filters.endDate ? new Date(filters.endDate).setHours(23, 59, 59, 999) : null;

    return movements.filter((move) => {
      const productCode = normalize(move.product?.productCode);
      const productName = normalize(move.product?.productName);
      const lot = normalize(move.lotNumber);
      const reference = normalize(move.referenceId);
      const description = normalize(move.description);
      const fromWarehouse = normalize(move.fromWarehouse?.name);
      const toWarehouse = normalize(move.toWarehouse?.name);
      const movementTime = new Date(move.createdAt).getTime();

      const matchesSearch = !search ||
        productCode.includes(search) ||
        productName.includes(search) ||
        lot.includes(search) ||
        reference.includes(search) ||
        description.includes(search) ||
        fromWarehouse.includes(search) ||
        toWarehouse.includes(search) ||
        normalize(move.type).includes(search);
      const matchesProduct = !product || productCode.includes(product) || productName.includes(product);
      const matchesLot = !lotNumber || lot.includes(lotNumber);
      const matchesReference = !referenceId || reference.includes(referenceId);
      const matchesType = !filters.type || filters.type === 'all' || move.type === filters.type;
      const matchesWarehouse = !filters.warehouseId || filters.warehouseId === 'all' || move.fromWarehouseId === filters.warehouseId || move.toWarehouseId === filters.warehouseId;
      const matchesStart = !startTime || movementTime >= startTime;
      const matchesEnd = !endTime || movementTime <= endTime;

      return matchesSearch && matchesProduct && matchesLot && matchesReference && matchesType && matchesWarehouse && matchesStart && matchesEnd;
    });
  }, [filters, movements]);

  const paginatedMovements = filteredMovements.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.max(1, Math.ceil(filteredMovements.length / pageSize));

  useEffect(() => {
    const maxPage = Math.max(0, pageCount - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [currentPage, pageCount]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([, value]) => value && value !== 'all').length;
  }, [filters]);

  const updateFilter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(0);
  };

  const handleReferenceClick = (move: any) => {
    if (!move.referenceId) return;

    const prodTypes = ['PRODUCTION', 'CONSUMPTION', 'RESERVE', 'REJECT', 'SAMPLE'];
    const voucherTypes = ['STOCK_VOUCHER_ENTRY', 'STOCK_VOUCHER_EXIT'];

    if (prodTypes.includes(move.type)) {
      navigate(`/production-orders/${move.referenceId}`);
    } else if (move.type === 'CONSUMPTION_TRANSACTION') {
      navigate(`/production/consumption-transactions/${move.referenceId}`);
    } else if (voucherTypes.includes(move.type)) {
      navigate(`/inventory/stock-vouchers/${move.referenceId}`);
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">STOK HAREKETLERİ</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Envanter Hareket Geçmişi Ve İzlenebilirlik
          </p>
        </div>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-6 border-b border-theme bg-theme-surface/30 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div className="flex items-center justify-center gap-4">
              <div className="p-2.5 bg-theme-primary/10 rounded-xl mb-1">
                <History className="w-4.5 h-4.5 text-theme-primary" />
              </div>
              <div>
                <h3 className="text-md font-black text-theme-main leading-none">İŞLEM GÜNLÜĞÜ</h3>
                <p className="text-[11px] text-theme-dim font-black mt-0 opacity-50">
                  {`${filteredMovements.length.toLocaleString()} hareket listeleniyor`}
                </p>
              </div>
            </div>

            <button
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
              className="h-10 px-4 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:border-theme-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <X size={16} />
              Filtreleri Temizle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <FilterInput
              icon={Search}
              label="Genel Arama"
              value={filters.search}
              placeholder="Kod, ürün, lot, açıklama..."
              onChange={(value: string) => updateFilter('search', value)}
            />
            <FilterInput
              icon={Package}
              label="Ürün Bazında"
              value={filters.product}
              placeholder="Ürün kodu veya adı"
              onChange={(value: string) => updateFilter('product', value)}
            />
            <FilterInput
              icon={Filter}
              label="Lot Bazında"
              value={filters.lotNumber}
              placeholder="Lot numarası"
              onChange={(value: string) => updateFilter('lotNumber', value)}
            />
            <FilterInput
              icon={ArrowRightLeft}
              label="Referans"
              value={filters.referenceId}
              placeholder="Referans ID"
              onChange={(value: string) => updateFilter('referenceId', value)}
            />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">İşlem Tipi</span>
              <CustomSelect options={movementTypes}
                value={filters.type}
                onChange={(value) => updateFilter('type', String(value || 'all'))}
                searchable={false} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Depo</span>
              <CustomSelect options={[
                  { id: 'all', label: 'Tüm Depolar' },
                  ...warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name, subLabel: warehouse.type }))
                ]}
                value={filters.warehouseId}
                onChange={(value) => updateFilter('warehouseId', String(value || 'all'))}
                searchable={true} />
            </div>
            <FilterInput
              icon={Calendar}
              label="Başlangıç"
              type="date"
              value={filters.startDate}
              onChange={(value: string) => updateFilter('startDate', value)}
            />
            <FilterInput
              icon={Calendar}
              label="Bitiş"
              type="date"
              value={filters.endDate}
              onChange={(value: string) => updateFilter('endDate', value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim">Tarih</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim">Ürün</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Giriş No</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Tip</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Nereden / Nereye</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Referans</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim text-right">Miktar</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim text-left">Birim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedMovements.map((move) => (
                <tr key={move.id} className="hover:bg-theme-main/5 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-theme-main">
                        {format(new Date(move.createdAt), 'dd MMMM yyyy', { locale: tr })}
                      </span>
                      <span className="text-[10px] text-theme-muted font-bold">
                        {format(new Date(move.createdAt), 'HH:mm')}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-theme-main">{move.product.productCode}</span>
                      <span className="text-[10px] text-theme-muted font-bold truncate max-w-[240px]">{move.product.productName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase">
                    {move.lotNumber || '-'}
                  </td>
                  <td className="px-8 py-5">
                    <MovementTypeBadge type={move.type} />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-theme-main">{move.fromWarehouse?.name || '-'}</span>
                      <ArrowRightLeft size={12} className="text-theme-dim opacity-90" />
                      <span className="text-xs font-bold text-theme-main">{move.toWarehouse?.name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      {move.referenceId && (
                        <div className="opacity-50 group-hover:opacity-100 transition-opacity">
                          <Tooltip content="Kayda Git">
                            <button
                              onClick={() => handleReferenceClick(move)}
                              className="p-1.5 rounded-lg bg-theme-surface border border-theme text-theme-dim hover:text-theme-primary hover:border-theme-primary/30 hover:bg-theme-primary/10 transition-all flex items-center justify-center shadow-sm"
                            >
                              <Eye size={13} strokeWidth={2.5} />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <span className="text-[10px] font-black text-theme-dim uppercase">
                          {move.type === 'CONSUMPTION_TRANSACTION' ? 'TÜKETİM İŞLEMİ' : (move.type.includes('PRODUCTION') || move.type === 'CONSUMPTION' ? 'ÜRETİM EMRİ' : (move.referenceId || '-'))}
                        </span>
                        {move.description && (
                          <span className="text-[10px] font-bold text-theme-muted truncate max-w-[200px]">{move.description}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`text-sm font-black ${move.toWarehouseId ? 'text-theme-success' : 'text-theme-danger'}`}>
                      {move.toWarehouseId ? '+' : '-'}
                      {(() => {
                        const isKg = move.product?.unitOfMeasure?.toLowerCase() === 'kilogram' || move.product?.unitOfMeasure?.toLowerCase() === 'kg';
                        if (isKg && move.quantity > 0 && move.quantity < 1) {
                           return (move.quantity * 1000).toLocaleString(undefined, { maximumFractionDigits: 4 });
                        }
                        return move.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 });
                      })()}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-left">
                    <span className="text-[10px] font-bold text-theme-muted">
                      {(() => {
                        const isKg = move.product?.unitOfMeasure?.toLowerCase() === 'kilogram' || move.product?.unitOfMeasure?.toLowerCase() === 'kg';
                        if (isKg && move.quantity > 0 && move.quantity < 1) {
                           return 'Gram';
                        }
                        return move.product?.unitOfMeasure || '-';
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center p-10 gap-2 opacity-20">
                      <History size={32} />
                      <p className="text-sm font-black">Hareket kaydı bulunamadı</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
              <div className="min-w-fit">
                <CustomSelect fullWidth={false} options={[ { id: 20, label: '20' }, { id: 50, label: '50' }, { id: 250, label: '250' }, { id: 500, label: '500' }, { id: 1000, label: '1000' }, { id: 999999, label: 'Tümü' } ]} value={pageSize} onChange={(value) => { setPageSize(Number(value)); setCurrentPage(0); }} searchable={false} />
              </div>
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredMovements.length}</span> Kayıt
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme-border rounded-xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                {currentPage + 1}
              </span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                {pageCount}
              </span>
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage >= pageCount - 1}
              className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterInput({ icon: Icon, label, value, onChange, placeholder = '', type = 'text' }: any) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 bg-theme-base border border-theme rounded-xl pl-10 pr-3 text-xs font-bold text-theme-main outline-none focus:border-theme-primary transition-all"
        />
      </div>
    </div>
  );
}

function MovementTypeBadge({ type }: { type: string }) {
  const typeMap: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    PRODUCTION: { label: 'ÜRETİM GİRİŞİ', color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20', icon: TrendingUp },
    SALE: { label: 'SATIŞ ÇIKIŞI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: TrendingDown },
    STOCK_VOUCHER_ENTRY: { label: 'STOK GİRİŞİ', color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20', icon: Package },
    STOCK_VOUCHER_EXIT: { label: 'STOK ÇIKIŞI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    TRANSFER: { label: 'TRANSFER', color: 'text-theme-primary', bg: 'bg-theme-primary/10', border: 'border-theme-primary/20', icon: ArrowRightLeft },
    STOCK_COUNT_SURPLUS: { label: 'SAYIM FAZLASI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: TrendingUp },
    STOCK_COUNT_SHORTAGE: { label: 'SAYIM EKSİĞİ', color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20', icon: TrendingDown },
    SCRAP: { label: 'FİRE / HURDA', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: X },
    RESERVE: { label: 'REZERVE', color: 'text-theme-warning', bg: 'bg-theme-warning/10', border: 'border-theme-warning/20', icon: Package },
    IMPORT_ENTRY: { label: 'İTHALAT GİRİŞİ', color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20', icon: Package },
    EXPORT_EXIT: { label: 'İHRACAT ÇIKIŞI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    CONSIGNMENT_ENTRY: { label: 'KONSİNYE GİRİŞİ', color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20', icon: Package },
    CONSIGNMENT_EXIT: { label: 'KONSİNYE ÇIKIŞI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    CONSUMPTION_EXIT: { label: 'TÜKETİM ÇIKIŞI', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    CONSUMPTION_TRANSACTION: { label: 'TÜKETİM İŞLEMİ', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    CONSUMPTION: { label: 'ÜRETİM TÜKETİMİ', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: Package },
    REJECT: { label: 'ÜRETİM REDDİ', color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20', icon: X },
    SAMPLE: { label: 'ÜRETİM NUMUNESİ', color: 'text-theme-warning', bg: 'bg-theme-warning/10', border: 'border-theme-warning/20', icon: Package },
    ADJUSTMENT: { label: 'DÜZELTME', color: 'text-theme-primary', bg: 'bg-theme-primary/10', border: 'border-theme-primary/20', icon: Filter },
  };

  const config = typeMap[type] || { label: type, color: 'text-theme-dim', bg: 'bg-theme-dim/10', border: 'border-theme-dim/20', icon: History };
  const Icon = config.icon;

  return (
    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-2 ${config.bg} ${config.color} ${config.border}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}
