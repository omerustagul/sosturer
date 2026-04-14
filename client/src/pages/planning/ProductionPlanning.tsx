import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  GanttChart, Plus,
  ChevronLeft, ChevronRight, Save, Trash2, Info,
  AlertCircle, Activity, Target
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { notify } from '../../store/notificationStore';

export function ProductionPlanning() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));

  const [machines, setMachines] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);

  const [isAdding, setIsAdding] = useState(false);
  const [newPlan, setNewPlan] = useState({
    machineId: '',
    shiftId: '',
    productId: '',
    plannedQuantity: 0,
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [m, p, s, pl, reqs] = await Promise.all([
        api.get('/machines'),
        api.get('/products'),
        api.get('/shifts'),
        api.get(`/planning/production?date=${selectedDate}`),
        api.get('/planning/requirements')
      ]);
      setMachines(m.filter((x: any) => x.status === 'active'));
      setProducts(p.filter((x: any) => x.status === 'active'));
      setShifts(s.filter((x: any) => x.status === 'active'));
      setPlans(pl || []);
      setRequirements(reqs || []);
    } catch (error) {
      console.error('Data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleAddPlan = async () => {
    if (!newPlan.machineId || !newPlan.shiftId || !newPlan.productId || newPlan.plannedQuantity <= 0) {
      notify.error('Hata', 'Lütfen tüm alanları geçerli değerlerle doldurun.');
      return;
    }

    try {
      await api.post('/planning/production', {
        ...newPlan,
        planDate: selectedDate
      });
      notify.success('Başarılı', 'Üretim planı kaydedildi.');
      setIsAdding(false);
      setNewPlan({ machineId: '', shiftId: '', productId: '', plannedQuantity: 0, notes: '' });
      fetchData();
    } catch (error: any) {
      notify.error('Hata', error.response?.data?.error || 'Plan kaydedilemedi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu planı silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/planning/production/${id}`);
      notify.success('Başarılı', 'Plan silindi.');
      fetchData();
    } catch (error) {
      notify.error('Hata', 'Plan silinemedi.');
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-6 w-full min-h-screen bg-theme-base space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-theme-primary/10 rounded-2xl flex items-center justify-center border border-theme-primary/20 shadow-xl group">
            <GanttChart className="w-6 h-6 text-theme-primary group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-theme-main uppercase tracking-tight">Üretim Planlama</h1>
            <p className="text-theme-dim text-xs font-bold leading-none opacity-60">Gelecek dönem üretim hedefleri ve makine yüklemeleri</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-theme-surface/50 border border-theme rounded-2xl p-1 shadow-inner">
            <button
              onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), -1), 'yyyy-MM-dd'))}
              className="p-2 hover:bg-theme-base rounded-xl text-theme-dim hover:text-white transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-6 flex flex-col items-center">
              <span className="text-[10px] font-black text-theme-primary uppercase tracking-[0.2em] leading-none mb-1">PLAN TARİHİ</span>
              <span className="text-xs font-black text-theme-main uppercase">
                {format(new Date(selectedDate), 'd MMMM yyyy, EEEE', { locale: tr })}
              </span>
            </div>
            <button
              onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
              className="p-2 hover:bg-theme-base rounded-xl text-theme-dim hover:text-white transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="h-12 flex items-center gap-3 px-6 bg-theme-primary hover:bg-theme-primary/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-theme-primary/20 active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            YENİ PLAN OLUŞTUR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Column: Requirements & Status */}
        <div className="xl:col-span-1 space-y-6">
          <div className="modern-glass-card p-5 space-y-4 border-theme-primary/20">
            <h3 className="text-xs font-black text-theme-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={14} /> ÜRETİM İHTİYAÇLARI
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
              {requirements.filter(r => r.netRequirement > 0).map(req => (
                <div key={req.id} className="bg-theme-surface/30 border border-theme/60 rounded-xl p-3 hover:border-theme-primary/30 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-black text-theme-main group-hover:text-theme-primary transition-colors">{req.productCode}</span>
                    <span className="text-[10px] font-bold text-theme-dim opacity-50">{req.productGroup}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-theme-dim font-bold uppercase tracking-tighter opacity-40">Net İhtiyaç</span>
                      <span className="text-sm font-black text-theme-main">{req.netRequirement} Adet</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-theme-dim font-bold block mb-0.5 opacity-40 uppercase">Süre</span>
                      <span className="text-[11px] font-bold text-emerald-400">{(req.estimatedProductionMinutes / 60).toFixed(1)} Saat</span>
                    </div>
                  </div>
                </div>
              ))}
              {requirements.filter(r => r.netRequirement > 0).length === 0 && (
                <div className="py-8 text-center opacity-30">
                  <Info size={24} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Bekleyen ihtiyaç bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Column: Plan Matrix */}
        <div className="xl:col-span-3 space-y-6">
          <div className="modern-glass-card p-0 overflow-hidden">
            <div className="p-4 border-b border-theme bg-theme-surface/30 flex items-center justify-between">
              <h3 className="text-xs font-black text-theme-main uppercase tracking-widest flex items-center gap-2">
                <Target size={14} className="text-theme-primary" /> Atanmış Planlar
              </h3>
              <span className="text-[10px] font-bold text-theme-dim px-2 py-1 bg-theme-base rounded-lg border border-theme">
                TOPLAM: {plans.length} PLAN
              </span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-theme-surface/50 text-[10px] font-black text-theme-dim uppercase tracking-widest border-b border-theme">
                  <th className="px-6 py-4 text-left">Makine</th>
                  <th className="px-6 py-4 text-left">Vardiya</th>
                  <th className="px-6 py-4 text-left">Planlanan Ürün</th>
                  <th className="px-6 py-4 text-center">Hedef Miktar</th>
                  <th className="px-6 py-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme/30">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-theme-primary/5 transition-colors group/row">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-main">{plan.machine.code}</span>
                        <span className="text-[10px] text-theme-dim font-bold truncate max-w-[150px]">{plan.machine.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-theme-surface rounded-lg border border-theme text-[10px] font-black text-theme-main">
                        {plan.shift.shiftName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-primary">{plan.product.productCode}</span>
                        <span className="text-[10px] text-theme-dim font-bold truncate max-w-[200px]">{plan.product.productName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-base font-black text-theme-main">{plan.plannedQuantity}</span>
                      <span className="text-[10px] text-theme-dim ml-1 opacity-50 uppercase font-black">Adet</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-2 text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 rounded-xl transition-all opacity-0 group-hover/row:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center opacity-30">
                      <div className="flex flex-col items-center gap-4">
                        <AlertCircle size={32} />
                        <p className="text-xs font-black uppercase tracking-widest">Bu tarih için henüz planlama yapılmamış.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Plan Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-theme-base/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="modern-glass-card w-full max-w-lg p-8 space-y-8 relative ring-2 ring-theme-primary/20">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-theme-main uppercase tracking-tight">Yeni Üretim Planı</h2>
              <p className="text-xs font-bold text-theme-dim">{format(new Date(selectedDate), 'd MMMM yyyy', { locale: tr })} Tarihli Görev Ataması</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest ml-1">Makine Seçimi</label>
                <CustomSelect
                  options={machines.map(m => ({ id: m.id, label: m.code, subLabel: m.name }))}
                  value={newPlan.machineId}
                  onChange={val => setNewPlan({ ...newPlan, machineId: val })}
                  placeholder="Makine seçin..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest ml-1">Vardiya</label>
                <CustomSelect
                  options={shifts.map(s => ({ id: s.id, label: s.shiftName }))}
                  value={newPlan.shiftId}
                  onChange={val => setNewPlan({ ...newPlan, shiftId: val })}
                  placeholder="Vardiya seçin..."
                  searchable={false}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest ml-1">Planlanan Ürün</label>
                <CustomSelect
                  options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                  value={newPlan.productId}
                  onChange={val => setNewPlan({ ...newPlan, productId: val })}
                  placeholder="Ürün seçin..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest ml-1">Hedef Miktar (Adet)</label>
                <input
                  type="number"
                  value={newPlan.plannedQuantity}
                  onChange={e => setNewPlan({ ...newPlan, plannedQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full h-12 bg-theme-surface border border-theme focus:border-theme-primary rounded-xl px-4 text-theme-main font-bold transition-all"
                  placeholder="Üretim adedi girin..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 h-12 bg-theme-surface border border-theme text-theme-dim rounded-xl font-black text-xs uppercase tracking-widest hover:text-white transition-all"
              >
                İPTAL
              </button>
              <button
                onClick={handleAddPlan}
                className="flex-[2] h-12 bg-theme-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} />
                PLANI KAYDET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
