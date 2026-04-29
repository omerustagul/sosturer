import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  ClipboardList, Plus, Search, Calendar, Building2,
  ChevronLeft, ChevronRight, Edit, Trash2, MoreVertical,
  Filter, CheckCircle2, Clock
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function WorkPlanList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/work-plans');
      setPlans(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Error fetching work plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const filteredPlans = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return plans.filter(p =>
      (p.planName?.toLowerCase().includes(lower)) ||
      (p.unit?.name?.toLowerCase().includes(lower)) ||
      (p.notes?.toLowerCase().includes(lower))
    );
  }, [plans, searchTerm]);

  const paginatedPlans = useMemo(() => {
    return filteredPlans.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [filteredPlans, currentPage, pageSize]);

  const pageCount = Math.ceil(filteredPlans.length / pageSize);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu iş listesini silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/work-plans/${id}`);
      fetchPlans();
    } catch (error) {
      alert('Silme işlemi başarısız oldu.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-theme-success/10 text-theme-success rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> AKTİF</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-theme-primary/10 text-theme-primary rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> TAMAMLANDI</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-theme-danger/10 text-theme-danger rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">İPTAL</span>;
      default:
        return <span className="px-2 py-1 bg-theme-muted/10 text-theme-muted rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3 h-3" /> BEKLEMEDE</span>;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-theme-main flex items-center gap-3 tracking-tight">
            <ClipboardList className="w-8 h-8 text-theme-primary" /> İŞ LİSTELERİ
          </h2>
          <p className="text-theme-muted text-sm mt-1">Birim bazlı <strong className="text-theme-primary">haftalık/periyodik çalışma planlarını</strong> buradan yönetebilirsiniz.</p>
        </div>
        <button
          onClick={() => navigate('/planning/work-plans/new')}
          className="bg-theme-primary hover:bg-theme-primary-hover text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-3 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> YENİ LİSTE OLUŞTUR
        </button>
      </div>

      <div className="modern-glass-card p-0">
        <div className="p-4 border-b border-theme flex flex-col md:flex-row justify-between items-center bg-theme-base/20 gap-4">
          <div className="relative group w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted group-focus-within:text-theme-primary transition-all" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Liste adı, birim veya notlarda ara..."
              className="w-full h-11 bg-theme-surface border-2 border-theme rounded-xl pl-12 pr-4 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold placeholder:text-theme-muted/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="h-11 px-4 border-2 border-theme rounded-xl text-theme-muted hover:border-theme-primary/30 hover:text-theme-primary transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
              <Filter className="w-4 h-4" /> FİLTRELE
            </button>
          </div>
        </div>

        <div className="overflow-x-auto relative min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-theme-surface/50 backdrop-blur-sm z-10">
              <Loading size="lg" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme bg-theme-base/10">
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">İŞ LİSTESİ ADI</th>
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">BİRİM / MERKEZ</th>
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">PLANLANAN TARİH</th>
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] text-center">KALEM SAYISI</th>
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">DURUM</th>
                  <th className="px-3 py-2 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] text-right">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {paginatedPlans.length > 0 ? paginatedPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-theme-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-theme-main group-hover:text-theme-primary transition-colors">{plan.planName || 'İsimsiz Liste'}</span>
                        <span className="text-[10px] text-theme-muted font-bold truncate max-w-xs">{plan.notes || 'Not yok'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-theme-primary/10 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-theme-primary" />
                        </div>
                        <span className="text-xs font-black text-theme-main uppercase">{plan.unit?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-theme-main">
                        <Calendar className="w-3.5 h-3.5 text-theme-muted" />
                        {format(new Date(plan.startDate), 'dd MMM', { locale: tr })} - {format(new Date(plan.endDate), 'dd MMM yyyy', { locale: tr })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-theme-muted/10 rounded-full text-xs font-black text-theme-main">
                        {plan._count?.items || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(plan.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-theme-muted">
                        <button
                          onClick={() => navigate(`/planning/work-plans/edit/${plan.id}`)}
                          className="p-2 hover:bg-theme-primary/10 hover:text-theme-primary rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="p-2 hover:bg-theme-danger/10 hover:text-theme-danger rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-theme-base/40 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <ClipboardList className="w-10 h-10 mb-2" />
                        <p className="font-black text-md">Hali hazırda bir plan bulunamadı.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-theme flex flex-col md:flex-row justify-between items-center bg-theme-base/10 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">GÖSTERİLEN:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-theme-surface border border-theme rounded-lg text-xs font-black px-3 py-1.5 focus:outline-none focus:border-theme-primary/50"
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size} Kayıt</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 border border-theme rounded-xl hover:bg-theme-primary/10 hover:text-theme-primary disabled:opacity-20 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-6 py-2 bg-theme-surface border border-theme rounded-xl text-[10px] font-black text-theme-main tracking-[0.2em] uppercase">
              SAYFA {currentPage + 1} / {Math.max(1, pageCount)}
            </div>
            <button
              disabled={currentPage >= pageCount - 1}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 border border-theme rounded-xl hover:bg-theme-primary/10 hover:text-theme-primary disabled:opacity-20 transition-all active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
