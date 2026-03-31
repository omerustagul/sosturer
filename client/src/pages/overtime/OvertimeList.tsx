import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Eye, Trash2, Clock, X, Calendar,
  Users, ShieldCheck,
  Search,
  LayoutList, Download, Activity,
  Monitor, Package, Layers, Edit2
} from 'lucide-react';
import { notify } from '../../store/notificationStore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CustomSelect } from '../../components/common/CustomSelect';

interface PlanItem {
  id: string;
  date: string;
  machine: { name: string; code: string } | null;
  backupMachine?: { name: string; code: string } | null;
  operator: {
    fullName: string;
    employeeId: string;
    department?: { name: string }
  };
  product?: { productName: string; productCode: string } | null;
  targetQuantity?: number | null;
  notes?: string | null;
}

interface Plan {
  id: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  shift: { id: string; shiftName: string; shiftCode: string } | null;
  items: PlanItem[];
  _count: { items: number };
}

const statusConfig: Record<string, { label: string; color: string; border: string }> = {
  planned: { label: 'PLANLANMIŞ', color: 'bg-blue-500/10 text-blue-400', border: 'border-blue-500/20' },
  active: { label: 'AKTİF', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20' },
  completed: { label: 'TAMAMLANDI', color: 'bg-theme-dim/10 text-theme-dim', border: 'border-theme/20' },
  cancelled: { label: 'İPTAL', color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/20' }
};

export function OvertimeList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [activeDayDate, setActiveDayDate] = useState<string | null>(null);

  // States for Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await api.get('/overtime');
      setPlans(data);
    } catch (err) {
      notify.error('Hata', 'Mesai planları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Bu mesai planını silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/overtime/${id}`);
      setPlans(prev => prev.filter(p => p.id !== id));
      notify.success('Başarılı', 'Mesai planı silindi.');
    } catch (err) {
      notify.error('Hata', 'Mesai planı silinemedi.');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/overtime/${id}`, { status });
      setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      notify.success('Güncellendi', 'Plan durumu değiştirildi.');
    } catch (err) {
      notify.error('Hata', 'Durum güncellenemedi.');
    }
  };

  const filteredPlans = useMemo(() => {
    const lowerSearch = searchTerm.toLocaleLowerCase('tr-TR');
    return plans.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = p.planName.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        (p.shift?.shiftName || '').toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        p.items.some(i => i.operator.fullName.toLocaleLowerCase('tr-TR').includes(lowerSearch));

      const planStart = new Date(p.startDate);
      const planEnd = new Date(p.endDate);
      const filterStart = dateFilter.start ? new Date(dateFilter.start) : null;
      const filterEnd = dateFilter.end ? new Date(dateFilter.end) : null;

      const matchesDate = (!filterStart || planEnd >= filterStart) && (!filterEnd || planStart <= filterEnd);

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [plans, statusFilter, searchTerm, dateFilter]);

  // Modal logic to handle day selection
  useEffect(() => {
    if (selectedPlan && selectedPlan.items.length > 0 && !activeDayDate) {
      const uniqueDates = [...new Set(selectedPlan.items.map(i => i.date.split('T')[0]))].sort();
      setActiveDayDate(uniqueDates[0]);
    }
  }, [selectedPlan]);

  const activeDayItems = useMemo(() => {
    if (!selectedPlan || !activeDayDate) return [];
    return selectedPlan.items.filter(i => i.date.startsWith(activeDayDate));
  }, [selectedPlan, activeDayDate]);

  const uniqueDays = useMemo(() => {
    if (!selectedPlan) return [];
    return [...new Set(selectedPlan.items.map(i => i.date.split('T')[0]))].sort();
  }, [selectedPlan]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header & Main Filters */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-theme-main tracking-tight uppercase leading-none mb-2">MESAİ LİSTESİ</h1>
            <div className="flex items-center gap-2 text-theme-dim opacity-60">
              <LayoutList size={14} className="text-theme-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest">TÜM PLANLANAN VE GERÇEKLEŞEN MESAİLER</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-theme-base/50 p-1 rounded-2xl border border-theme/20 backdrop-blur-sm">
              {['all', 'planned', 'active', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    statusFilter === status
                      ? "bg-theme-main text-theme-base shadow-lg"
                      : "text-theme-dim hover:text-theme-main hover:bg-theme-main/5"
                  )}
                >
                  {status === 'all' ? 'HEPSİ' : statusConfig[status]?.label || status.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="premium-card p-4 flex flex-wrap items-center gap-4 bg-theme-surface/30">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim opacity-40 w-4 h-4" />
            <input
              type="text"
              placeholder="Mesai Planı Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-theme-base border border-theme rounded-2xl pl-12 pr-4 py-3 text-xs font-bold text-theme-main focus:ring-2 focus:ring-theme-primary outline-none transition-all placeholder:text-theme-dim/40"
            />
          </div>

          <div className="flex items-center gap-2 bg-theme-base/50 p-1 rounded-2xl border border-theme/10">
            <div className="flex items-center px-4 gap-2 text-theme-dim opacity-50 border-r border-theme/20">
              <Calendar size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">TARİH</span>
            </div>
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent text-xs font-bold text-theme-main p-2 outline-none cursor-pointer"
            />
            <span className="text-theme-dim opacity-20">—</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent text-xs font-bold text-theme-main p-2 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter({ start: '', end: '' }) }}
            className="px-4 py-3 bg-theme-base border border-theme rounded-2xl text-[10px] font-black uppercase text-theme-dim hover:text-theme-main hover:bg-theme-main/5 transition-all"
          >
            TEMİZLE
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 w-full animate-pulse bg-theme-surface/50 rounded-2xl border border-theme/10" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="premium-card p-20 text-center bg-theme-surface/10">
          <Clock className="w-16 h-16 text-theme-dim/10 mx-auto mb-6" />
          <h2 className="text-lg font-black text-theme-dim/60 uppercase tracking-[0.2em]">Sonuç Bulunamadı</h2>
          <p className="text-[10px] font-bold text-theme-dim/40 uppercase mt-2">Filtrelerinizi güncelleyerek tekrar deneyin.</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden border-theme/10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-theme-surface/50 border-b border-theme/20">
                <th className="text-left py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">MESAI PLANI / VARDİYA</th>
                <th className="text-left py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">TARİH ARALIĞI</th>
                <th className="text-center py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">OPERATÖR</th>
                <th className="text-center py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">ALAN/T.GAH</th>
                <th className="text-center py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">DURUM</th>
                <th className="text-right py-6 px-8 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">AKSİYON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {filteredPlans.map(plan => {
                const status = statusConfig[plan.status] || { label: plan.status.toUpperCase(), color: 'bg-theme/10 text-theme-dim', border: 'border-theme/10' };
                const opCount = [...new Set((plan.items || []).map(i => i.operator?.fullName || ''))].length;
                const machineCount = [...new Set((plan.items || []).filter(i => i.machine).map(i => i.machine?.name || ''))].length;

                return (
                  <tr key={plan.id} className="hover:bg-theme-primary/5 transition-all group">
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center text-theme-primary border border-theme-primary/20 shadow-inner group-hover:rotate-6 transition-transform">
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-theme-main group-hover:text-theme-primary transition-colors leading-tight">{plan.planName}</p>
                          <p className="text-[10px] font-bold text-theme-dim opacity-60 uppercase tracking-widest">{plan.shift?.shiftName || 'Vardiya Belirtilmedi'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-8">
                      <div className="flex flex-col">
                        <p className="text-xs font-black text-theme-main">
                          {format(new Date(plan.startDate), 'd MMMM', { locale: tr })} — {format(new Date(plan.endDate), 'd MMMM', { locale: tr })}
                        </p>
                        <p className="text-[10px] font-bold text-theme-dim opacity-50 uppercase tracking-tighter">
                          {format(new Date(plan.startDate), 'yyyy')}
                        </p>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-center">
                      <span className="text-sm font-black text-theme-main">{opCount}</span>
                      <span className="text-[10px] text-theme-dim font-bold ml-1">Kişi</span>
                    </td>
                    <td className="py-6 px-8 text-center">
                      <span className="text-sm font-black text-theme-main">{machineCount}</span>
                      <span className="text-[10px] text-theme-dim font-bold ml-1">Birim</span>
                    </td>
                    <td className="py-6 px-8 text-center">
                      <span className={cn("px-4 py-1.5 rounded-full text-[9px] font-black border uppercase tracking-widest inline-block shadow-sm", status.color, status.border)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-6 px-8">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedPlan(plan); setActiveDayDate(null); }}
                          className="w-9 h-9 flex items-center justify-center bg-theme-primary/10 text-theme-primary border border-theme-primary/20 rounded-xl hover:bg-theme-primary hover:text-white transition-all active:scale-95 shadow-lg shadow-theme-primary/5"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/overtime/edit/${plan.id}`)}
                          className="w-9 h-9 flex items-center justify-center bg-theme-base/50 text-theme-main border border-theme/20 rounded-xl hover:bg-theme-main hover:text-theme-base transition-all active:scale-95 shadow-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <div className="w-[140px]">
                          <CustomSelect
                            options={Object.entries(statusConfig).map(([val, cfg]) => ({
                              id: val,
                              label: cfg.label
                            }))}
                            value={plan.status}
                            onChange={(val) => updateStatus(plan.id, val)}
                            searchable={false}
                          />
                        </div>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          className="w-9 h-9 flex items-center justify-center bg-theme-danger/10 text-theme-danger border border-theme-danger/20 rounded-xl hover:bg-theme-danger hover:text-white transition-all active:scale-95"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlan && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-10 overflow-hidden bg-theme-base/10 backdrop-blur-xs animate-in fade-in duration-500">
          <div className="relative w-full h-[85vh] max-w-6xl bg-theme-base border border-theme rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-500 ring-1 ring-white/5">

            {/* Modal Header */}
            <div className="p-4 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primary border border-theme-primary/30 shadow-2xl relative group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-theme-primary/20 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <LayoutList size={24} className="relative z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black text-theme-main tracking-tight uppercase leading-none">{selectedPlan.planName}</h3>
                    <span className={cn("px-3 py-1 rounded-lg text-[8px] font-black border uppercase tracking-[0.2em]", statusConfig[selectedPlan.status]?.color || '', statusConfig[selectedPlan.status]?.border || '')}>
                      {statusConfig[selectedPlan.status]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-theme-dim opacity-50 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><Calendar size={12} /> {format(new Date(selectedPlan.startDate), 'd MMMM', { locale: tr })} - {format(new Date(selectedPlan.endDate), 'd MMMM', { locale: tr })}</div>
                    <div className="w-1 h-1 rounded-full bg-theme-primary/40" />
                    <div className="flex items-center gap-1.5"><Clock size={12} /> {selectedPlan.shift?.shiftName}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/overtime/edit/${selectedPlan.id}`)}
                  className="h-12 px-6 flex items-center justify-center bg-theme-primary/10 text-theme-primary border border-theme-primary/20 rounded-2xl hover:bg-theme-primary hover:text-white transition-all duration-300 group shadow-xl gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <Edit2 size={16} /> DÜZENLE
                </button>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-12 h-12 flex items-center justify-center bg-theme-surface border border-theme rounded-2xl text-theme-dim hover:text-white hover:bg-theme-danger hover:border-theme-danger transition-all duration-300 group shadow-xl"
                >
                  <X className="group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            {/* Day Selector Track - Modern Compact Navigation */}
            <div className="px-8 mb-3">
              <div className="bg-theme-surface/30 p-1.5 rounded-2xl border border-theme/10 flex items-center gap-2 relative overflow-x-auto no-scrollbar backdrop-blur-md">
                {uniqueDays.map(day => {
                  const isActive = activeDayDate === day;
                  const dateObj = new Date(day);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  return (
                    <button
                      key={day}
                      onClick={() => setActiveDayDate(day)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[100px] h-12 rounded-2xl transition-all duration-500 relative shrink-0",
                        isActive
                          ? "bg-theme-main text-theme-base shadow-xl scale-[1.05] z-10 translate-y-[-2px]"
                          : "text-theme-dim hover:bg-theme-main/10 hover:text-theme-main"
                      )}
                    >
                      <span className={cn("text-[9px] font-black uppercase tracking-widest mb-0.5 opacity-60", isActive && "text-theme-primary")}>
                        {format(dateObj, 'EEEE', { locale: tr })}
                      </span>
                      <span className="text-sm font-black tracking-tighter">
                        {format(dateObj, 'd MMMM', { locale: tr })}
                      </span>
                      {isWeekend && !isActive && <div className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-rose-500/40" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body - Dual Column Layout */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Side: Assignment List */}
              <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 custom-scrollbar">
                {activeDayItems.length === 0 ? (
                  <div className="py-12 text-center bg-theme-surface/20 rounded-3xl border border-dashed border-theme/20 mt-4">
                    <p className="text-[10px] font-black text-theme-dim opacity-40 uppercase tracking-widest italic">BU GÜN İÇİN ATAMA BULUNMUYOR</p>
                  </div>
                ) : (
                  <>
                    {/* Production Section */}
                    {activeDayItems.filter(i => i.machine).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-theme-primary/20 flex-1" />
                          <span className="text-[9px] font-black text-theme-primary uppercase tracking-[0.3em]">TEZGAH VE ÜRETİM MESAİSİ</span>
                          <div className="h-px bg-theme-primary/20 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {activeDayItems.filter(i => i.machine).map((item) => (
                            <div key={item.id} className="premium-card p-5 group flex flex-col gap-4 border border-theme/10 hover:border-theme-primary/30 transition-all duration-300">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-theme-base border border-theme flex items-center justify-center text-theme-dim group-hover:text-theme-primary transition-colors shadow-sm">
                                    <Monitor size={18} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-theme-main group-hover:text-theme-primary transition-colors leading-none mb-1">{item.machine?.name}</p>
                                    <p className="text-[10px] font-bold text-theme-dim opacity-60 uppercase">{item.machine?.code}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-theme-main uppercase">{item.operator.fullName}</span>
                                  <span className="text-[9px] font-bold text-theme-dim opacity-50 uppercase tracking-widest">OPERATÖR</span>
                                </div>
                              </div>

                              <div className="bg-theme-main/5 p-3 rounded-2xl flex items-center justify-between border border-theme/5">
                                <div className="flex flex-col">
                                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-wider opacity-40 leading-none mb-1.5">ÜRÜN / PARÇA</p>
                                  <div className="flex items-center gap-2">
                                    <Package size={12} className="text-theme-primary/60" />
                                    <p className="text-xs font-bold text-theme-main truncate max-w-[140px] leading-tight">
                                      {item.product ? item.product.productName : "Belirtilmedi"}
                                    </p>
                                    {item.product?.productCode && <span className="text-[9px] font-black text-theme-dim py-0.5 px-1.5 bg-theme-base border border-theme/10 rounded-md uppercase">{item.product.productCode}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-wider opacity-40 leading-none mb-1.5 text-right">HEDEF</p>
                                  <p className="text-xs font-black text-theme-primary italic">{item.targetQuantity ? `${item.targetQuantity} ADET` : "—"}</p>
                                </div>
                              </div>

                              {item.notes && (
                                <div className="bg-theme-warning/5 px-3 py-2 rounded-xl border-l-2 border-theme-warning/30 flex items-center gap-2">
                                  <ShieldCheck size={12} className="text-theme-warning/40 shrink-0" />
                                  <p className="text-[10px] font-bold text-theme-dim/70 leading-relaxed italic truncate opacity-80">
                                    "{item.notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Support/Other Units Section */}
                    {activeDayItems.filter(i => !i.machine).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-theme-dim/10 flex-1" />
                          <span className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-60">DESTEK VE İDARİ BİRİM MESAİLERİ</span>
                          <div className="h-px bg-theme-dim/10 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeDayItems.filter(i => !i.machine).map((item) => (
                            <div key={item.id} className="premium-card p-4 group flex items-center gap-4 hover:border-theme-primary/20 transition-all bg-theme-surface/10 border-theme/5">
                              <div className="w-10 h-10 rounded-2xl bg-theme-base border border-theme flex items-center justify-center text-theme-dim group-hover:bg-theme-primary/10 group-hover:text-theme-primary group-hover:border-theme-primary/20 transition-all shadow-sm">
                                <Users size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-theme-main tracking-tight group-hover:text-theme-primary transition-colors truncate">{item.operator.fullName}</p>
                                <p className="text-[9px] font-bold text-theme-dim opacity-60 uppercase flex items-center gap-1.5 mt-0.5">
                                  <Activity size={10} /> {item.operator.department?.name || "Birim Desteği"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Side: Plan Dashboard / Modular Stats */}
              <div className="w-80 border-l border-theme/10 bg-theme-surface/10 p-6 space-y-8 overflow-y-auto no-scrollbar">
                
                {/* Stats Section 1: Overview */}
                <div className="space-y-4">
                   <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">PLANA GENEL BAKIŞ</p>
                   <div className="grid grid-cols-1 gap-3">
                      {[
                        { label: 'TOPLAM PERSONEL', value: [...new Set(selectedPlan.items.map(i => i.operator.fullName))].length, icon: Users, color: 'text-theme-primary', bg: 'bg-theme-primary/10' },
                        { label: 'AKTİF BİRİMLER', value: [...new Set(selectedPlan.items.map(i => i.operator.department?.name || 'Diğer'))].length, icon: Layers, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                        { label: 'TOPLAM TEZGAH', value: [...new Set(selectedPlan.items.filter(i=>i.machine).map(i=>i.machine?.code))].length, icon: Monitor, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { label: 'ÜRETİM HEDEFİ', value: selectedPlan.items.reduce((acc, curr) => acc + (curr.targetQuantity || 0), 0) + ' ADET', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-theme-base border border-theme/10 p-4 rounded-2xl flex items-center gap-4 group hover:border-theme/40 transition-all">
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                              <stat.icon size={18} />
                           </div>
                           <div>
                              <p className="text-sm font-black text-theme-main">{stat.value}</p>
                              <p className="text-[8px] font-bold text-theme-dim uppercase tracking-widest">{stat.label}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Stats Section 2: Active Day Summary */}
                <div className="space-y-4">
                   {/* Calculate unique personnel for the day */}
                   {(() => {
                      // Get unique operator list with their department info
                      const uniqueDayOps = Array.from(
                        new Map(activeDayItems.map(item => [item.operator.fullName, item.operator])).values()
                      );
                      
                      // Calculate department distribution
                      const deptDistribution: Record<string, number> = {};
                      uniqueDayOps.forEach(op => {
                        const dName = op.department?.name || 'Birim Belirtilmedi';
                        deptDistribution[dName] = (deptDistribution[dName] || 0) + 1;
                      });

                      const dayMachines = [...new Set(activeDayItems.filter(i => i.machine).map(i => i.machine?.code))];

                      return (
                        <>
                          <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">GÜNLÜK ÖZET</p>
                          <div className="bg-theme-primary/5 border border-theme-primary/10 rounded-3xl p-5 space-y-5 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Calendar size={80} />
                             </div>
                             <div className="relative">
                                <p className="text-[10px] font-black text-theme-primary uppercase mb-4 flex items-center gap-2">
                                  <Activity size={14} /> BUGÜNÜN VERİLERİ
                                </p>
                                <div className="space-y-5">
                                   <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                         <span className="text-[10px] font-bold text-theme-dim uppercase">PERSONEL</span>
                                         <span className="text-xs font-black text-theme-main">{uniqueDayOps.length} PERSONEL</span>
                                      </div>
                                      {/* Department Breakdown */}
                                      <div className="pl-3 space-y-1 border-l border-theme-primary/20">
                                         {Object.entries(deptDistribution).map(([dept, count]) => (
                                           <div key={dept} className="flex items-center justify-between opacity-70">
                                              <span className="text-[9px] font-bold text-theme-dim uppercase italic">{dept}</span>
                                              <span className="text-[10px] font-black text-theme-main">{count}</span>
                                           </div>
                                         ))}
                                      </div>
                                   </div>
                                   <div className="flex items-center justify-between border-t border-theme-primary/10 pt-2">
                                      <span className="text-[10px] font-bold text-theme-dim uppercase">TEZGAH</span>
                                      <span className="text-xs font-black text-theme-main">{dayMachines.length} BİRİM</span>
                                   </div>
                                </div>
                             </div>
                          </div>

                          {/* Working Personnel List (Small) */}
                          <div className="space-y-4 pt-4">
                             <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">GÜNÜN PERSONELLERİ</p>
                             <div className="space-y-2">
                                {uniqueDayOps.slice(0, 10).map((op, i) => (
                                  <div key={i} className="flex items-center justify-between py-1 text-theme-main group/p">
                                     <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-theme-primary/40 shrink-0 group-hover/p:bg-theme-primary transition-colors" />
                                        <span className="text-[10px] font-black truncate">{op.fullName}</span>
                                     </div>
                                     <span className="text-[8px] font-bold text-theme-dim uppercase opacity-40 italic">{op.department?.name || '—'}</span>
                                  </div>
                                ))}
                                {uniqueDayOps.length > 10 && (
                                  <p className="text-[9px] font-bold text-theme-dim italic ml-4 opacity-40">...ve {uniqueDayOps.length - 10} kişi daha</p>
                                )}
                             </div>
                          </div>
                        </>
                      );
                   })()}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-theme-surface/50 border-t border-theme/10 flex items-center justify-between backdrop-blur-2xl">
              <div className="flex items-center gap-6">
                <div className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="opacity-40" /> TOPLAM {selectedPlan.items.length} ATAMA
                </div>
                <div className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2">
                  <Download size={14} className="opacity-40" /> PDF DIŞA AKTAR
                </div>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="px-8 py-3 bg-theme-main text-theme-base font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:-translate-y-1 transition-all active:scale-95"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default OvertimeList;
