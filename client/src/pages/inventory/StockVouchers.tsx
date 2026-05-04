import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';

const voucherTypes = [
  { id: 'ENTRY', label: 'Giriş', direction: 1 },
  { id: 'EXIT', label: 'Çıkış', direction: -1 },
  { id: 'TRANSFER', label: 'Transfer', direction: -1 },
  { id: 'COUNT_SURPLUS', label: 'Sayım Fazlası', direction: -1 },
  { id: 'COUNT_SHORTAGE', label: 'Sayım Eksiği', direction: 1 },
  { id: 'SCRAP', label: 'Fire', direction: -1 },
  { id: 'RESERVE', label: 'Rezerve', direction: -1 },
  { id: 'IMPORT_ENTRY', label: 'İthalat Girişi', direction: 1 },
  { id: 'EXPORT_EXIT', label: 'İhracat Çıkışı', direction: -1 },
  { id: 'CONSIGNMENT_ENTRY', label: 'Konsinye Girişi', direction: 1 },
  { id: 'CONSIGNMENT_EXIT', label: 'Konsinye Çıkışı', direction: -1 },
  { id: 'CONSUMPTION_EXIT', label: 'Tüketim Çıkışı', direction: -1 }
];

const controlStatuses = [
  { id: 'pending', label: 'Bekliyor' },
  { id: 'in_control', label: 'Kontrol Aşamasında' },
  { id: 'rejected', label: 'Reddedildi' },
  { id: 'accepted', label: 'Kabul Edildi' }
];

const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('tr-TR');

export function StockVouchers() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const voucherRes = await api.get('/inventory/stock-vouchers?take=5000');
      setVouchers(Array.isArray(voucherRes) ? voucherRes : []);
    } catch (error) {
      notify.error('Veri Alınamadı', 'Stok fişleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredVouchers = useMemo(() => {
    const search = normalize(searchTerm.trim());
    if (!search) return vouchers;

    return vouchers.filter((voucher) => {
      return (
        normalize(voucher.voucherNo).includes(search) ||
        normalize(voucher.documentNo).includes(search) ||
        normalize(voucher.firm?.name).includes(search) ||
        normalize(voucher.warehouse?.name).includes(search) ||
        normalize(voucher.targetWarehouse?.name).includes(search) ||
        normalize(voucher.createdBy).includes(search) ||
        voucher.items?.some((item: any) =>
          normalize(item.product?.productCode).includes(search) ||
          normalize(item.product?.productName).includes(search) ||
          normalize(item.lotNumber).includes(search)
        )
      );
    });
  }, [searchTerm, vouchers]);

  const pageCount = Math.max(1, Math.ceil(filteredVouchers.length / pageSize));
  const paginatedVouchers = filteredVouchers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useEffect(() => {
    const maxPage = Math.max(0, pageCount - 1);
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [currentPage, pageCount]);

  const getVoucherTypeLabel = (type: string) => voucherTypes.find((item) => item.id === type)?.label || type;
  const getControlLabel = (status: string) => controlStatuses.find((item) => item.id === status)?.label || status;

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="modern-glass-card p-4 overflow-hidden shrink-0 flex flex-col sm:flex-row border border-theme-primary-10 items-center gap-4 rounded-2xl">
        <div className="relative group flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hızlı Arama (Fiş No, Ürün, Lot...)"
            className="w-full h-10 bg-theme-base/20 border-2 border-theme rounded-xl pl-10 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/40 focus:bg-theme-surface transition-all font-bold placeholder:text-theme-dim/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="h-10 px-4 rounded-xl border-2 border-theme bg-theme-base/20 text-theme-dim hover:text-theme-main hover:bg-theme-surface hover:border-theme-primary/30 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <RefreshCw size={14} /> Yenile
          </button>

          <div className="h-8 w-px bg-theme/30 mx-1" />

          <button
            onClick={() => navigate('/inventory/stock-vouchers/new')}
            className="bg-theme-primary hover:bg-theme-primary-hover h-10 text-white px-8 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl shadow-theme-primary/30 flex items-center gap-2.5 group active:scale-95 whitespace-nowrap uppercase tracking-widest"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Yeni Stok Fişi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Kayıtlı Fiş" value={vouchers.length.toLocaleString('tr-TR')} color="text-theme-primary" />
        <StatCard icon={CalendarClock} label="Sistem Tarihi" value={format(new Date(), 'dd/MM/yyyy HH:mm')} color="text-theme-warning" />
        <StatCard icon={Package} label="Ürün Satırı" value={vouchers.reduce((sum, v) => sum + (v.items?.length || 0), 0).toLocaleString('tr-TR')} color="text-theme-success" />
        <StatCard icon={Warehouse} label="Bekleyen Kontrol" value={vouchers.filter(v => v.controlStatus === 'pending').length.toLocaleString('tr-TR')} color="text-theme-danger" />
      </div>


      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-theme bg-theme-surface/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-6 bg-theme-success rounded-full" />
            <h3 className="text-sm font-black text-theme-main leading-tight uppercase tracking-wider">
              Stok Fişleri
            </h3>
            <div className="h-4 w-px bg-theme/30" />
            <span className="text-[10px] font-bold text-theme-muted">
              {filteredVouchers.length} Sonuç Listeleniyor
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Fiş No</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tip</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Firma</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Depo</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Personel</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Kontrol</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Belge</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-right">Miktar</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-center w-24">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedVouchers.map((voucher) => {
                const totalQty = (voucher.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                return (
                  <tr key={voucher.id} className="hover:bg-theme-main/5 transition-all">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-theme-main">{format(new Date(voucher.transactionDate), 'dd/MM/yyyy')}</span>
                        <span className="text-[10px] text-theme-muted font-bold">{format(new Date(voucher.transactionDate), 'HH:mm')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-sm font-black text-theme-primary whitespace-nowrap">{voucher.voucherNo}</td>
                    <td className="px-6 py-5">
                      <TypeBadge direction={voucher.direction} label={getVoucherTypeLabel(voucher.voucherType)} />
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{voucher.firm?.name || '-'}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-0.5 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-black text-theme-main">
                          <span>{voucher.warehouse?.name || '-'}</span>
                          {voucher.targetWarehouse && (
                            <>
                              <ArrowRightLeft size={12} className="text-theme-dim opacity-50" />
                              <span className="text-theme-primary">{voucher.targetWarehouse.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-theme-muted opacity-60 uppercase tracking-tighter">
                          <span>{voucher.warehouse?.code || '-'}</span>
                          {voucher.targetWarehouse && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-theme-dim" />
                              <span>{voucher.targetWarehouse.code || '-'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-theme-main whitespace-nowrap">
                      {voucher.createdBy || '-'}
                    </td>
                    <td className="px-6 py-5">
                      <ControlBadge status={voucher.controlStatus} label={getControlLabel(voucher.controlStatus)} />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-theme-dim uppercase">{voucher.documentNo || '-'}</span>
                        {voucher.documentUrl && (
                          <a href={voucher.documentUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black text-theme-primary hover:underline">
                            PDF
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className={`font-mono text-sm font-black ${voucher.direction === 1 ? 'text-theme-success' : 'text-theme-danger'}`}>
                        {voucher.direction === 1 ? '+' : '-'}{totalQty.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/inventory/stock-vouchers/${voucher.voucherNo}`)}
                          className="p-2 rounded-lg bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 transition-all"
                          title="Düzenle"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Bu fişi ve tüm bağlı hareketleri silmek/iptal etmek istediğinize emin misiniz?')) {
                              try {
                                await api.delete(`/inventory/stock-vouchers/${voucher.id}`);
                                notify.success('Silindi', 'Stok fişi başarıyla iptal edildi.');
                                fetchData();
                              } catch (err: any) {
                                notify.error('Hata', err.message || 'Silme işlemi başarısız.');
                              }
                            }
                          }}
                          className="p-2 rounded-lg bg-theme-danger/10 text-theme-danger hover:bg-theme-danger/20 transition-all"
                          title="İptal Et"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center opacity-30 italic text-sm">
                    Stok fişi bulunamadı.
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
                <CustomSelect fullWidth={false} options={[{ id: 20, label: '20' }, { id: 50, label: '50' }, { id: 250, label: '250' }, { id: 500, label: '500' }, { id: 1000, label: '1000' }]} value={pageSize} onChange={(value) => { setPageSize(Number(value)); setCurrentPage(0); }} searchable={false} />
              </div>
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredVouchers.length}</span> Kayıt
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

function TypeBadge({ direction, label }: { direction: number; label: string }) {
  const isPositive = direction === 1;
  return (
    <span className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-2 ${isPositive ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : 'bg-theme-danger/10 text-theme-danger border-theme-danger/20'}`}>
      {isPositive ? '+' : '-'} {label}
    </span>
  );
}

function ControlBadge({ status, label }: { status: string; label: string }) {
  const className = status === 'accepted'
    ? 'bg-theme-success/10 text-theme-success border-theme-success/20'
    : status === 'rejected'
      ? 'bg-theme-danger/10 text-theme-danger border-theme-danger/20'
      : status === 'in_control'
        ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/20'
        : 'bg-theme-primary/10 text-theme-primary border-theme-primary/20';

  return (
    <span className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border inline-flex items-center ${className}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="modern-glass-card p-5 border-theme-primary/10 hover:border-theme-primary/30 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl ${color.replace('text', 'bg')}/10 group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-4 h-4`} />
        </div>
      </div>
      <p className="text-[13px] font-black text-theme-dim mb-2 opacity-80">{label}</p>
      <p className="text-xl font-black text-theme-main tracking-tight leading-none truncate">{value}</p>
    </div>
  );
}

export default StockVouchers;
