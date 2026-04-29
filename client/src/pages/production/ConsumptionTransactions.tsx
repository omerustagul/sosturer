import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, ClipboardList, Package, Plus, RefreshCw, Search, Trash2, Edit2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';

const statusOptions = [
  { id: 'all', label: 'Tüm Durumlar' },
  { id: 'pending', label: 'Bekliyor' },
  { id: 'available', label: 'Kullanılabilir' },
  { id: 'used', label: 'Kullanıldı' }
];

const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('tr-TR');

export function ConsumptionTransactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transactionRes, typeRes, warehouseRes] = await Promise.all([
        api.get('/consumption-transactions?take=5000'),
        api.get('/consumption-types'),
        api.get('/inventory/warehouses')
      ]);
      setTransactions(Array.isArray(transactionRes) ? transactionRes : []);
      setTypes(Array.isArray(typeRes) ? typeRes : []);
      setWarehouses(Array.isArray(warehouseRes) ? warehouseRes : []);
    } catch (error) {
      notify.error('Veri Alınamadı', 'Tüketim işlemleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTransactions = useMemo(() => {
    const search = normalize(searchTerm.trim());
    return transactions.filter((item) => {
      const matchesSearch = !search ||
        normalize(item.transactionNo).includes(search) ||
        normalize(item.type?.name).includes(search) ||
        normalize(item.product?.productCode).includes(search) ||
        normalize(item.product?.productName).includes(search) ||
        normalize(item.warehouse?.name).includes(search) ||
        normalize(item.lotNumber).includes(search) ||
        normalize(item.serialNo).includes(search) ||
        normalize(item.personnelName).includes(search) ||
        normalize(item.notes).includes(search);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.typeId === typeFilter;
      const matchesWarehouse = warehouseFilter === 'all' || item.warehouseId === warehouseFilter;
      return matchesSearch && matchesStatus && matchesType && matchesWarehouse;
    });
  }, [transactions, searchTerm, statusFilter, typeFilter, warehouseFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = filteredTransactions.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useEffect(() => {
    const maxPage = Math.max(0, pageCount - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [currentPage, pageCount]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setWarehouseFilter('all');
    setCurrentPage(0);
  };

  const deleteTransaction = async (id: string) => {
    if (!window.confirm('Bu tüketim işlemini silmek istediğinize emin misiniz? Kullanılmış kayıt ise stok hareketi geri alınır.')) return;
    try {
      await api.delete(`/consumption-transactions/${id}`);
      notify.success('Silindi', 'Tüketim işlemi kaldırıldı.');
      fetchData();
    } catch (error: any) {
      notify.error('Silinemedi', error.message || 'Tüketim işlemi silinemedi.');
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-theme-primary" />
            TÜKETİM İŞLEMLERİ
          </h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Stok tüketimleri ve üretim emri bağlantıları
          </p>
        </div>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-6 border-b border-theme bg-theme-surface/30 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div className="relative group flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Hızlı arama..."
                className="w-full h-10 bg-theme-base/20 border border-theme rounded-xl pl-10 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/40 focus:bg-theme-surface transition-all font-bold placeholder:text-theme-dim/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={clearFilters}
                className="h-10 px-4 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:border-theme-primary/30 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <X size={16} />
                Temizle
              </button>
              <button
                onClick={fetchData}
                className="h-10 px-4 rounded-xl border border-theme bg-theme-base/20 text-theme-dim hover:text-theme-main hover:bg-theme-surface hover:border-theme-primary/30 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <RefreshCw size={14} /> Yenile
              </button>
              <button
                onClick={() => navigate('/production/consumption-transactions/new')}
                className="bg-theme-primary hover:bg-theme-primary-hover h-10 text-white px-7 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl shadow-theme-primary/30 flex items-center gap-2.5 active:scale-95 whitespace-nowrap uppercase tracking-widest"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Yeni Ekle
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Durum</span>
              <CustomSelect
                options={statusOptions}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(String(value || 'all'));
                  setCurrentPage(0);
                }}
                searchable={false}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Tip</span>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Tipler' }, ...types.map((type) => ({ id: type.id, label: type.name, subLabel: type.code }))]}
                value={typeFilter}
                onChange={(value) => {
                  setTypeFilter(String(value || 'all'));
                  setCurrentPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Depo</span>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Depolar' }, ...warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name, subLabel: warehouse.code || warehouse.type }))]}
                value={warehouseFilter}
                onChange={(value) => {
                  setWarehouseFilter(String(value || 'all'));
                  setCurrentPage(0);
                }}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">İşlem No</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tip</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Stok Kodu</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Depo / Giriş No</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Durum</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-right">Miktar</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Personel</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedTransactions.map((item) => (
                <tr key={item.id} className="hover:bg-theme-main/5 transition-all">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-theme-main">{format(new Date(item.transactionDate), 'dd/MM/yyyy')}</span>
                      <span className="text-[10px] text-theme-muted font-bold">{format(new Date(item.transactionDate), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-mono text-sm font-black text-theme-primary whitespace-nowrap">{item.transactionNo}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-main whitespace-nowrap">{item.type?.name || '-'}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-theme-main">{item.product?.productCode || '-'}</span>
                      <span className="text-[10px] text-theme-muted font-bold truncate max-w-[220px]">{item.product?.productName || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-theme-main">{item.warehouse?.name || '-'}</span>
                      <span className="text-[10px] text-theme-muted font-bold">{item.lotNumber || 'Lotsuz'}{item.serialNo ? ` / ${item.serialNo}` : ''}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5"><StatusBadge status={item.status} /></td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-mono text-sm font-black text-theme-danger">
                      -{Number(item.quantity || 0).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                    </span>
                    <span className="ml-1 text-[10px] font-black text-theme-muted">{item.unit || item.product?.unitOfMeasure || ''}</span>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{item.personnelName || '-'}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/production/consumption-transactions/${item.transactionNo}`)}
                        className="p-2 rounded-lg bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 transition-all"
                        title="Düzenle"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteTransaction(item.id)}
                        className="p-2 rounded-lg bg-theme-danger/10 text-theme-danger hover:bg-theme-danger/20 transition-all"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-25">
                      <Package size={34} />
                      <p className="text-sm font-black">Tüketim işlemi bulunamadı</p>
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
              <CustomSelect
                options={[20, 50, 250, 500, 1000].map((value) => ({ id: value, label: String(value) }))}
                value={pageSize}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(0);
                }}
                searchable={false}
              />
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredTransactions.length}</span> Kayıt
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">{currentPage + 1}</span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">{pageCount}</span>
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage >= pageCount - 1}
              className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = status === 'used'
    ? { label: 'Kullanıldı', className: 'bg-theme-danger/10 text-theme-danger border-theme-danger/20' }
    : status === 'available'
      ? { label: 'Kullanılabilir', className: 'bg-theme-success/10 text-theme-success border-theme-success/20' }
      : { label: 'Bekliyor', className: 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' };

  return (
    <span className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border inline-flex items-center ${config.className}`}>
      {config.label}
    </span>
  );
}

export default ConsumptionTransactions;
