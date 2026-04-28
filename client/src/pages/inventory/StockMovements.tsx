import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ArrowRightLeft, Calendar, ChevronLeft, ChevronRight, Filter, History, Package, Search, TrendingDown, TrendingUp, X } from 'lucide-react';
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
  { id: 'all', label: 'TÜM TİPLER' },
  { id: 'PRODUCTION', label: 'ÜRETİM GİRİŞİ' },
  { id: 'SALE', label: 'SATIŞ ÇIKIŞI' },
  { id: 'ADJUSTMENT', label: 'SAYIM / DÜZELTME' },
  { id: 'TRANSFER', label: 'TRANSFER' },
  { id: 'INTERNAL', label: 'İÇ HAREKET' }
];

const normalize = (value: any) => String(value || '').toLocaleLowerCase('tr-TR');

export function StockMovements() {
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
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
            <div className="flex items-center gap-4">
              <div className="p-3 bg-theme-primary/10 rounded-2xl">
                <History className="w-5 h-5 text-theme-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-theme-main leading-none">İŞLEM GÜNLÜĞÜ</h3>
                <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-50">
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
              <CustomSelect
                options={movementTypes}
                value={filters.type}
                onChange={(value) => updateFilter('type', String(value || 'all'))}
                searchable={false}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Depo</span>
              <CustomSelect
                options={[
                  { id: 'all', label: 'TÜM DEPOLAR' },
                  ...warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name, subLabel: warehouse.type }))
                ]}
                value={filters.warehouseId}
                onChange={(value) => updateFilter('warehouseId', String(value || 'all'))}
                searchable={true}
              />
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
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Lot</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Tip</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Nereden / Nereye</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-dim ">Referans</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim text-right">Miktar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedMovements.map((move) => (
                <tr key={move.id} className="hover:bg-theme-main/5 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-theme-main">
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
                      <span className="text-xs font-bold text-theme-muted">{move.fromWarehouse?.name || '---'}</span>
                      <ArrowRightLeft size={12} className="text-theme-dim opacity-30" />
                      <span className="text-xs font-black text-theme-main">{move.toWarehouse?.name || '---'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-theme-dim uppercase">{move.referenceId || '-'}</span>
                      {move.description && (
                        <span className="text-[10px] font-bold text-theme-muted truncate max-w-[220px]">{move.description}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`text-sm font-black italic ${move.toWarehouseId ? 'text-theme-success' : 'text-theme-danger'}`}>
                      {move.toWarehouseId ? '+' : '-'}{move.quantity.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-32 text-center">
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
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase tracking-widest">SAYFADA:</span>
              <div className="w-24">
                <CustomSelect
                  options={[
                    { id: 20, label: '20' },
                    { id: 50, label: '50' },
                    { id: 250, label: '250' },
                    { id: 500, label: '500' },
                    { id: 1000, label: '1000' },
                    { id: 999999, label: 'Tümü' }
                  ]}
                  value={pageSize}
                  onChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(0);
                  }}
                  searchable={false}
                />
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
              className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-2xl">
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
              className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
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
  const isProduction = type === 'PRODUCTION';
  const isSale = type === 'SALE';

  return (
    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-2 ${isProduction
      ? 'bg-theme-success/10 text-theme-success border-theme-success/20'
      : isSale
        ? 'bg-theme-danger/10 text-theme-danger border-theme-danger/20'
        : 'bg-theme-primary/10 text-theme-primary border-theme-primary/20'
      }`}>
      {isProduction && <TrendingUp size={12} />}
      {isSale && <TrendingDown size={12} />}
      {!isProduction && !isSale && <ArrowRightLeft size={12} />}
      {isProduction ? 'ÜRETİM GİRİŞİ' : isSale ? 'SATIŞ ÇIKIŞI' : type}
    </span>
  );
}
