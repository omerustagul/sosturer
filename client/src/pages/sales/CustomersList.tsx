import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Users, Mail, Phone, MapPin, UserPlus, ExternalLink } from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CustomersList() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/sales/customers');
        setCustomers(res);
      } catch (e) {
        console.error('Failed to load customers');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const paginatedCustomers = customers.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.ceil(customers.length / pageSize);

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase">MÜŞTERİ YÖNETİMİ</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">
            Kayıtlı Cari Hesaplar Ve İletişim Veritabanı
          </p>
        </div>

        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95 text-xs">
          <UserPlus size={18} /> YENİ MÜŞTERİ EKLE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-theme-surface/50 border border-theme p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">TOPLAM MÜŞTERİ</p>
            <p className="text-xl font-black text-theme-main">{customers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCustomers.map((cust) => (
          <div key={cust.id} className="modern-glass-card group hover:border-indigo-500/30 transition-all duration-500 flex flex-col justify-between">
            {/* ... card content ... */}
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-xl font-black text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                  {cust.name.substring(0, 1)}
                </div>
                <button className="text-theme-muted hover:text-indigo-400 p-2 transition-colors">
                  <ExternalLink size={18} />
                </button>
              </div>

              <h3 className="text-lg font-black text-theme-main uppercase tracking-tight italic line-clamp-1">{cust.name}</h3>
              <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-1 mb-6">Sosturer Partner</p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-theme-muted hover:text-theme-main transition-colors text-xs font-bold">
                  <Mail size={14} className="opacity-50" />
                  {cust.email || 'Email belirtilmemiş'}
                </div>
                <div className="flex items-center gap-3 text-theme-muted hover:text-theme-main transition-colors text-xs font-bold">
                  <Phone size={14} className="opacity-50" />
                  {cust.phone || 'Telefon belirtilmemiş'}
                </div>
                <div className="flex items-center gap-3 text-theme-muted hover:text-theme-main transition-colors text-xs font-bold">
                  <MapPin size={14} className="opacity-50" />
                  <span className="line-clamp-1">{cust.address || 'Adres belirtilmemiş'}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-theme/30 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-theme-dim uppercase tracking-widest">VERGİ NO</span>
                <span className="text-xs font-black text-theme-main">{cust.taxNumber || '---'}</span>
              </div>
              <button className="px-4 py-2 bg-theme-base border border-theme text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 hover:text-white transition-all">
                DETAYLAR
              </button>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full py-32 text-center modern-glass-card opacity-20">
            <Users size={48} className="mx-auto mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">HENÜZ MÜŞTERİ KAYDI BULUNMUYOR</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="modern-glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6 order-2 md:order-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
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
            Toplam <span className="text-theme-primary">{customers.length}</span> Kayıt
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
  );
}
