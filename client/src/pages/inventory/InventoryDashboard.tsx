import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Filter, Package, RefreshCw, Search, TrendingUp, Warehouse, X } from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';

const normalize = (value: any) => String(value || '').toLocaleLowerCase('tr-TR');

export function InventoryDashboard() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [warehouseRes, levelRes] = await Promise.all([
          api.get('/inventory/warehouses'),
          api.get('/inventory/levels')
        ]);
        setWarehouses(warehouseRes);
        setStockLevels(levelRes);
        setSelectedWarehouseId((prev) => prev ?? warehouseRes[0]?.id ?? null);
      } catch (e) {
        console.error('Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);

  const filteredLevels = useMemo(() => {
    const search = normalize(searchTerm.trim());
    const product = normalize(productFilter.trim());
    const lot = normalize(lotFilter.trim());

    return stockLevels.filter((level) => {
      const productCode = normalize(level.product?.productCode);
      const productName = normalize(level.product?.productName);
      const lotNumber = normalize(level.lotNumber);
      const warehouseName = normalize(level.warehouse?.name);

      const matchesWarehouse = selectedWarehouseId ? level.warehouseId === selectedWarehouseId : true;
      const matchesSearch = !search ||
        productCode.includes(search) ||
        productName.includes(search) ||
        lotNumber.includes(search) ||
        warehouseName.includes(search);
      const matchesProduct = !product || productCode.includes(product) || productName.includes(product);
      const matchesLot = !lot || lotNumber.includes(lot);
      const matchesStock =
        stockStatus === 'all' ||
        (stockStatus === 'positive' && level.quantity > 0) ||
        (stockStatus === 'zero' && level.quantity === 0) ||
        (stockStatus === 'negative' && level.quantity < 0);

      return matchesWarehouse && matchesSearch && matchesProduct && matchesLot && matchesStock;
    });
  }, [lotFilter, productFilter, searchTerm, selectedWarehouseId, stockLevels, stockStatus]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredLevels.length / pageSize) - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [currentPage, filteredLevels.length, pageSize]);

  const paginatedLevels = filteredLevels.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.max(1, Math.ceil(filteredLevels.length / pageSize));

  const handleWarehouseSelect = (warehouseId: string | null) => {
    setSelectedWarehouseId(warehouseId);
    setCurrentPage(0);
  };

  const activeFilterCount = [
    searchTerm.trim(),
    productFilter.trim(),
    lotFilter.trim(),
    selectedWarehouseId,
    stockStatus !== 'all' ? stockStatus : ''
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchTerm('');
    setProductFilter('');
    setLotFilter('');
    setStockStatus('all');
    setSelectedWarehouseId(null);
    setCurrentPage(0);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedWarehouseId) params.set('warehouseId', selectedWarehouseId);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (productFilter.trim()) params.set('product', productFilter.trim());
      if (lotFilter.trim()) params.set('lotNumber', lotFilter.trim());
      if (stockStatus !== 'all') params.set('stockStatus', stockStatus);

      const suffix = selectedWarehouse ? selectedWarehouse.name.replace(/\s+/g, '_') : 'Tum_Depolar';
      await api.download(`/inventory/levels/export?${params.toString()}`, `Detayli_Envanter_${suffix}.xlsx`);
      notify.success('Excel Hazırlandı', 'Detaylı envanter çıktısı indirildi.');
    } catch (error) {
      notify.error('Excel Alınamadı', 'Envanter çıktısı oluşturulurken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };


  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">STOK DURUMU</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Gerçek Zamanlı Depo Ve Envanter Takibi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Warehouse} label="TOPLAM DEPO" value={warehouses.length} color="text-theme-primary" />
        <StatCard icon={Package} label="TOPLAM ÜRÜN" value={new Set(stockLevels.map((level) => level.productId)).size} color="text-theme-success" />
        <StatCard icon={TrendingUp} label="TOPLAM STOK ADET" value={stockLevels.reduce((acc, curr) => acc + curr.quantity, 0).toLocaleString()} color="text-theme-warning" />
        <StatCard icon={AlertTriangle} label="KRİTİK SEVİYE" value="0" color="text-theme-danger" />
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-theme bg-theme-surface/30 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <h3 className="text-xs font-bold text-theme-dim flex items-center gap-2 uppercase">
              <Search size={14} /> Envanter Listesi
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <button
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="h-10 px-4 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:border-theme-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <X size={16} />
                Temizle
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="h-10 px-4 rounded-xl bg-theme-primary text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <FilterInput
              icon={Search}
              label="Genel Arama"
              value={searchTerm}
              placeholder="Ürün, lot veya depo..."
              onChange={(value: string) => {
                setSearchTerm(value);
                setCurrentPage(0);
              }}
            />
            <FilterInput
              icon={Package}
              label="Ürün Bazında"
              value={productFilter}
              placeholder="Ürün kodu veya adı"
              onChange={(value: string) => {
                setProductFilter(value);
                setCurrentPage(0);
              }}
            />
            <FilterInput
              icon={Filter}
              label="Lot Bazında"
              value={lotFilter}
              placeholder="Lot numarası"
              onChange={(value: string) => {
                setLotFilter(value);
                setCurrentPage(0);
              }}
            />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Depo</span>
              <CustomSelect options={[
                { id: 'all', label: 'Tüm Depolar' },
                ...warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name, subLabel: warehouse.type }))
              ]}
                value={selectedWarehouseId || 'all'}
                onChange={(value) => handleWarehouseSelect(value === 'all' || value === '' ? null : String(value))}
                searchable={true} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Stok Durumu</span>
              <CustomSelect options={[
                { id: 'all', label: 'Tüm Stoklar' },
                { id: 'positive', label: 'Stokta Var' },
                { id: 'zero', label: 'Sıfır Stok' },
                { id: 'negative', label: 'Eksi Stok' }
              ]}
                value={stockStatus}
                onChange={(value) => {
                  setStockStatus(String(value || 'all'));
                  setCurrentPage(0);
                }}
                searchable={false} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Ürün Kodu</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Ürün Adı</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Lot</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Depo</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-right">Miktar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedLevels.map((level) => (
                <tr key={level.id} className="hover:bg-theme-main/5 transition-all">
                  <td className="px-6 py-4 text-xs font-black text-theme-main">{level.product.productCode}</td>
                  <td className="px-6 py-4 text-xs font-bold text-theme-muted">{level.product.productName}</td>
                  <td className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase">{level.lotNumber || '-'}</td>
                  <td className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase">{level.warehouse.name}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-theme-primary">
                        {(() => {
                          const isKg = level.product?.unitOfMeasure?.toLowerCase() === 'kilogram' || level.product?.unitOfMeasure?.toLowerCase() === 'kg';
                          if (isKg && level.quantity > 0 && level.quantity < 1) {
                            return (level.quantity * 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });
                          }
                          return level.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 });
                        })()}
                      </span>
                      <span className="text-[10px] font-black text-theme-dim uppercase opacity-60">
                        {(() => {
                          const isKg = level.product?.unitOfMeasure?.toLowerCase() === 'kilogram' || level.product?.unitOfMeasure?.toLowerCase() === 'kg';
                          if (isKg && level.quantity > 0 && level.quantity < 1) {
                            return 'Gram';
                          }
                          return level.product?.unitOfMeasure || 'Adet';
                        })()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLevels.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center opacity-30 font-bold text-sm">
                    Stok kaydı bulunamadı.
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
                <CustomSelect fullWidth={false} options={[{ id: 20, label: '20' }, { id: 50, label: '50' }, { id: 250, label: '250' }, { id: 500, label: '500' }, { id: 1000, label: '1000' }, { id: 999999, label: 'Tümü' }]} value={pageSize} onChange={(value) => { setPageSize(Number(value)); setCurrentPage(0); }} searchable={false} />
              </div>
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredLevels.length}</span> Kayıt
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border border-theme-border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">{currentPage + 1}</span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">{pageCount}</span>
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage >= pageCount - 1}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border border-theme-border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterInput({ icon: Icon, label, value, onChange, placeholder = '' }: any) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 bg-theme-base border border-theme rounded-xl pl-10 pr-3 text-xs font-bold text-theme-main outline-none focus:border-theme-primary transition-all"
        />
      </div>
    </div>
  );
}


function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="modern-glass-card p-6 border-theme-primary/10 hover:border-theme-primary/30 hover:scale-[1.02] transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color.replace('text', 'bg')}/10 group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-6 h-6`} />
        </div>
      </div>
      <div>
        <p className="text-[13px] font-black text-theme-dim mb-2 opacity-80">{label}</p>
        <p className="text-2xl font-black text-theme-main tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}
