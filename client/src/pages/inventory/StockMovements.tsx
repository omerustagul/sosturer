import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { History, ArrowRightLeft, TrendingUp, TrendingDown, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function StockMovements() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/inventory/movements');
        setMovements(res);
      } catch (e) {
        console.error('Failed to load movements');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const paginatedMovements = movements.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.ceil(movements.length / pageSize);

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">STOK HAREKETLERİ</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60 uppercase tracking-widest">
            Envanter Hareket Geçmişi Ve İzlenebilirlik
          </p>
        </div>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-6 border-b border-theme flex flex-col md:flex-row items-center justify-between bg-theme-surface/30 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-theme-primary/10 rounded-2xl">
              <History className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main leading-none">İŞLEM GÜNLÜĞÜ</h3>
              <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-50">Son 100 hareket listeleniyor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:border-theme-primary/30 transition-all">
              <Filter size={18} />
            </button>
            <button className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:border-theme-primary/30 transition-all flex items-center gap-2">
              <Calendar size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Bugün</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase tracking-[.3em]">TARİH</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase tracking-[.3em]">ÜRÜN</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase tracking-[.3em]">TİP</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase tracking-[.3em]">NEREDEN / NEREYE</th>
                <th className="px-8 py-5 text-[10px] font-black text-theme-dim uppercase tracking-[.3em] text-right">MİKTAR</th>
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
                      <span className="text-[10px] text-theme-muted font-bold truncate max-w-[200px]">{move.product.productName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-2 ${move.type === 'PRODUCTION'
                        ? 'bg-theme-success/10 text-theme-success border-theme-success/20'
                        : move.type === 'SALE'
                          ? 'bg-theme-danger/10 text-theme-danger border-theme-danger/20'
                          : 'bg-theme-primary/10 text-theme-primary border-theme-primary/20'
                      }`}>
                      {move.type === 'PRODUCTION' && <TrendingUp size={12} />}
                      {move.type === 'SALE' && <TrendingDown size={12} />}
                      {move.type !== 'PRODUCTION' && move.type !== 'SALE' && <ArrowRightLeft size={12} />}
                      {move.type === 'PRODUCTION' ? 'ÜRETİM GİRİŞİ' : move.type === 'SALE' ? 'SATIŞ ÇIKIŞI' : move.type}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-theme-muted">{move.fromWarehouse?.name || '---'}</span>
                      <ArrowRightLeft size={12} className="text-theme-dim opacity-30" />
                      <span className="text-xs font-black text-theme-main">{move.toWarehouse?.name || '---'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`text-sm font-black italic ${move.toWarehouseId ? 'text-theme-success' : 'text-theme-danger'}`}>
                      {move.toWarehouseId ? '+' : '-'}{move.quantity.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <History size={48} />
                      <p className="text-sm font-black uppercase tracking-widest">Hareket kaydı bulunamadı</p>
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
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase tracking-widest">SAYFADA:</span>
              <div className="w-24">
                <CustomSelect
                  options={[
                    { id: 10, label: '10' },
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
            <span className="text-[11px] font-black text-theme-dim uppercase tracking-widest">
              TOPLAM <span className="text-theme-primary">{movements.length}</span> KAYIT
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
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
                {pageCount || 1}
              </span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
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
