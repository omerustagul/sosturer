import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ChevronLeft, ChevronRight, ShoppingCart, Clock, CheckCircle2, Search, Plus, MoreVertical, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function OrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/sales/orders');
        setOrders(res);
      } catch (e) {
        console.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);



  const filteredOrders = useMemo(() => {
    return orders.filter(order =>
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredOrders, currentPage, pageSize]);

  const pageCount = Math.ceil(filteredOrders.length / pageSize);

  const getStatusBadge = (status: string) => {
    const normalizedStatus = (status || '').toLowerCase();

    if (normalizedStatus === 'completed') {
      return <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-theme-success/10 text-theme-success border border-theme-success/20">Tamamlandı</span>;
    }
    if (normalizedStatus === 'pending') {
      return <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-theme-warning/10 text-theme-warning border border-theme-warning/20">Bekliyor</span>;
    }
    if (normalizedStatus === 'cancelled') {
      return <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-theme-danger/10 text-theme-danger border border-theme-danger/20">İptal</span>;
    }
    return <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-theme-primary/10 text-theme-primary border border-theme-primary/20">{status || 'Bilinmiyor'}</span>;
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">SİPARİŞ YÖNETİMİ</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Aktif Satış Siparişleri Ve Hazırlık Durumları
          </p>
        </div>

        <button className="bg-theme-primary hover:opacity-90 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-3 active:scale-95 text-xs">
          <Plus size={18} /> YENİ SİPARİŞ OLUŞTUR
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatSummary icon={ShoppingCart} label="AKTİF SİPARİŞ" value={orders.filter(o => o.status !== 'completed').length} color="text-theme-primary" />
        <StatSummary icon={Clock} label="TERMINİ YAKIN" value="0" color="text-theme-warning" />
        <StatSummary icon={CheckCircle2} label="BUGÜN TAMAMLANAN" value="0" color="text-theme-success" />
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-theme flex flex-col md:flex-row items-center justify-between bg-theme-surface/30 gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Sipariş no veya müşteri ara..."
              className="w-full bg-theme-base border border-theme rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-theme-main focus:border-theme-primary outline-none transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-8 py-6 text-[11px] font-black text-theme-dim ">Sipariş Bilgisi</th>
                <th className="px-8 py-6 text-[11px] font-black text-theme-dim">Müşteri/Bayi</th>
                <th className="px-8 py-6 text-[11px] font-black text-theme-dim ">Tarih / Termin</th>
                <th className="px-8 py-6 text-[11px] font-black text-theme-dim ">Durum</th>
                <th className="px-8 py-6 text-[11px] font-black text-theme-dim text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-theme-primary/5 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-theme-main">#{order.orderNumber}</span>
                      <span className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-1">
                        {order.orderItems?.length || 0} ÇEŞİT ÜRÜN
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-black text-theme-main uppercase tracking-tight italic">
                      {order.customer?.name}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-theme-muted">
                        <Calendar size={12} className="opacity-50" />
                        {format(new Date(order.orderDate), 'dd.MM.yyyy')}
                      </div>
                      {order.dueDate && (
                        <div className="flex items-center gap-2 text-[11px] font-black text-theme-warning">
                          <Clock size={12} />
                          {format(new Date(order.dueDate), 'dd.MM.yyyy')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="p-2 hover:bg-theme-primary/10 rounded-xl transition-all text-theme-dim hover:text-theme-primary">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-10">
                      <ShoppingCart size={48} />
                      <p className="text-md font-black uppercase">Sipariş Bulunmuyor</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
              <div className="min-w-fit">
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
                  onChange={value => {
                    setPageSize(Number(value));
                    setCurrentPage(0);
                  }}
                  searchable={false}
                />
              </div>
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredOrders.length}</span> Kayıt
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                {currentPage + 1}
              </span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                {pageCount || 1}
              </span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
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

function StatSummary({ icon: Icon, label, value, color }: any) {
  return (
    <div className="modern-glass-card p-6 flex items-center justify-between group hover:scale-[1.03] transition-all">
      <div className="space-y-1">
        <p className="text-[10px] font-black text-theme-dim uppercase tracking-[.2em] opacity-60 leading-none mb-2">{label}</p>
        <h4 className="text-3xl font-black text-theme-main leading-none">{value}</h4>
      </div>
      <div className={`p-4 rounded-2xl ${color.replace('text', 'bg')}/10 border border-theme-primary/5 group-hover:scale-110 transition-transform`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
    </div>
  );
}
