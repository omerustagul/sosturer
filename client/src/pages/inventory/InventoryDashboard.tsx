import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Warehouse, Package, TrendingUp, AlertTriangle, Search } from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function InventoryDashboard() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [wRes, sRes] = await Promise.all([
          api.get('/inventory/warehouses'),
          api.get('/inventory/levels')
        ]);
        setWarehouses(wRes);
        setStockLevels(sRes);
      } catch (e) {
        console.error('Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredLevels = stockLevels.filter(lvl =>
    lvl.product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lvl.product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedLevels = filteredLevels.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.ceil(filteredLevels.length / pageSize);

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">STOK DURUMU</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Gerçek Zamanlı Depo Ve Envanter Takibi
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Warehouse} label="TOPLAM DEPO" value={warehouses.length} color="text-theme-primary" />
        <StatCard icon={Package} label="TOPLAM ÜRÜN" value={new Set(stockLevels.map(l => l.productId)).size} color="text-theme-success" />
        <StatCard icon={TrendingUp} label="TOPLAM STOK ADET" value={stockLevels.reduce((acc, curr) => acc + curr.quantity, 0).toLocaleString()} color="text-theme-warning" />
        <StatCard icon={AlertTriangle} label="KRİTİK SEVİYE" value="0" color="text-theme-danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Warehouse List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="modern-glass-card">
            <h3 className="text-lg font-black text-theme-main uppercase mb-6 flex items-center gap-3">
              <Warehouse className="w-5 h-5 text-theme-primary" /> DEPOLAR
            </h3>
            <div className="space-y-4">
              {warehouses.map(w => (
                <div key={w.id} className="p-4 bg-theme-surface/50 border border-theme rounded-2xl hover:border-theme-primary/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-theme-main text-sm uppercase">{w.name}</h4>
                      <p className="text-[10px] text-theme-muted font-bold uppercase mt-1">{w.type}</p>
                    </div>
                    <span className="text-[10px] font-black text-theme-primary bg-theme-primary/10 px-2 py-1 rounded-lg">AKTİF</span>
                  </div>
                </div>
              ))}
              {warehouses.length === 0 && <p className="text-center py-10 opacity-30 italic text-sm">Henüz depo tanımlanmamış.</p>}
            </div>
          </div>
        </div>

        {/* Stock Records Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="modern-glass-card p-0 overflow-hidden">
            <div className="p-4 border-b border-theme flex flex-col md:flex-row items-center justify-between bg-theme-surface/30 gap-4">
              <h3 className="text-xs font-bold text-theme-dim flex items-center gap-2">
                <Search size={14} /> ENVANTER LİSTESİ
              </h3>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="Ürün ara..."
                  className="w-full bg-theme-base border border-theme rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-theme-main focus:border-theme-primary outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface/50">
                    <th className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase tracking-[.2em]">Ürün Kodu</th>
                    <th className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase tracking-[.2em]">Ürün Adı</th>
                    <th className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase tracking-[.2em]">Depo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase tracking-[.2em] text-right">Miktar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme/20">
                  {paginatedLevels.map((lvl) => (
                    <tr key={lvl.id} className="hover:bg-theme-main/5 transition-all">
                      <td className="px-6 py-4 text-xs font-black text-theme-main">{lvl.product.productCode}</td>
                      <td className="px-6 py-4 text-xs font-bold text-theme-muted">{lvl.product.productName}</td>
                      <td className="px-6 py-4 text-[10px] font-black text-theme-dim uppercase">{lvl.warehouse.name}</td>
                      <td className="px-6 py-4 text-sm font-black text-theme-primary text-right">{lvl.quantity.toLocaleString()}</td>
                    </tr>
                  ))}
                  {filteredLevels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center opacity-30 italic text-sm">
                        Stok kaydı bulunamadı.
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
                <span className="text-[11px] font-black text-theme-dim">
                  Toplam <span className="text-theme-primary">{filteredLevels.length}</span> Kayıt
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
        <p className="text-[10px] font-black text-theme-dim uppercase tracking-[0.2em] mb-2 opacity-60">{label}</p>
        <p className="text-3xl font-black text-theme-main tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}
