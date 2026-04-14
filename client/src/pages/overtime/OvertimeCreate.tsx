import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Plus, Calendar, Clock, Trash2, Target, Copy, ChevronRight, Users, CheckCircle, Monitor, ShieldCheck, Zap, Edit2 } from 'lucide-react';
import { notify } from '../../store/notificationStore';
import { CustomSelect } from '../../components/common/CustomSelect';
import { cn } from '../../lib/utils';

interface Machine { id: string; name: string; code: string; }
interface Operator { id: string; fullName: string; employeeId: string; departmentId?: string; department?: { code: string; name: string }; role?: { name: string } }
interface Product { id: string; productName: string; productCode: string; cycleTimeSeconds?: number; }
interface Shift { id: string; shiftName: string; shiftCode: string; durationMinutes?: number; }
interface Department { id: string; name: string; code?: string; }

interface Assignment {
  id: string;
  type: 'machine' | 'support';
  machineId: string;
  productId: string;
  operatorId: string;
  backupMachineId: string;
  targetQuantity: string;
  isBackup?: boolean;
  tempDeptId?: string; // Support section filter
  averageCycleTime?: number; // Persist for shift recalculations
}

interface DayPlan {
  date: string;
  assignments: Assignment[];
}

const toTRUpper = (str: string) => (str || '').toLocaleUpperCase('tr-TR');

export function OvertimeCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const cncDeptIds = (departments || [])
    .filter(d => d.code === 'DP-01' || (d.name || '').toLocaleUpperCase('tr-TR').includes('CNC ÜRETİM'))
    .map(d => d.id);

  useEffect(() => {
    Promise.all([
      api.get('/machines'),
      api.get('/operators'),
      api.get('/products'),
      api.get('/shifts'),
      api.get('/departments')
    ]).then(([m, o, p, s, d]) => {
      setMachines(m);
      setOperators(o);
      setProducts(p);
      setShifts(s);
      setDepartments(d);
      setInitialFetchDone(true);
    });
  }, []);

  // Recalculate targets when shiftId changes globally
  useEffect(() => {
    if (shiftId && dayPlans.length > 0) {
      setDayPlans(prev => prev.map(day => ({
        ...day,
        assignments: day.assignments.map(a => {
          if (a.type === 'machine' && a.averageCycleTime) {
            const s = shifts.find(x => x.id === shiftId);
            if (s?.durationMinutes) {
              const target = Math.floor((s.durationMinutes * 60) / a.averageCycleTime);
              return { ...a, targetQuantity: target > 0 ? target.toString() : a.targetQuantity };
            }
          }
          return a;
        })
      })));
    }
  }, [shiftId]);

  // Consolidated Load Effect for Edit Mode
  useEffect(() => {
    if (isEdit && initialFetchDone && operators.length > 0) {
      api.get(`/overtime/${id}`).then(plan => {
        // 1. Set Meta Info
        setPlanName(plan.planName);
        const sDate = new Date(plan.startDate).toISOString().split('T')[0];
        const eDate = new Date(plan.endDate).toISOString().split('T')[0];
        setStartDate(sDate);
        setEndDate(eDate);
        setShiftId(plan.shiftId);
        setNotes(plan.notes || '');

        // 2. Build Day Structure
        const dates: string[] = [];
        const current = new Date(sDate);
        const last = new Date(eDate);
        while (current <= last) {
          dates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }

        // 3. Group and Map Items
        const grouped: any = {};
        (plan.items || []).forEach((item: any) => {
          const dateStr = new Date(item.date).toISOString().split('T')[0];
          if (!grouped[dateStr]) grouped[dateStr] = [];

          grouped[dateStr].push({
            id: Math.random().toString(36).substring(2, 9),
            type: item.machineId ? 'machine' : 'support',
            machineId: item.machineId || '',
            productId: item.productId || '',
            operatorId: item.operatorId,
            backupMachineId: item.backupMachineId || '',
            targetQuantity: item.targetQuantity?.toString() || '',
            isBackup: (item.notes || '').includes('[YEDEK]'),
            tempDeptId: operators.find(o => o.id === item.operatorId)?.departmentId || ''
          });
        });

        const initialDayPlans = dates.map(date => ({
          date,
          assignments: grouped[date] || []
        }));

        setDayPlans(initialDayPlans);
      });
    }
  }, [isEdit, id, initialFetchDone, operators]);

  // Date Range Sync (Handles manual changes, but preserves existing assignments)
  useEffect(() => {
    // Skip if we don't have dates
    if (!startDate || !endDate) {
      if (!isEdit) setDayPlans([]);
      return;
    }

    const dates: string[] = [];
    const current = new Date(startDate);
    const last = new Date(endDate);
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    setDayPlans(prev => {
      // If the dates haven't actually changed in count and exist in prev, don't stomp
      // This helps prevent race conditions during edit load
      const next = dates.map(date => {
        const existing = prev.find(p => p.date === date);
        if (existing) return existing;
        return {
          date,
          assignments: []
        };
      });

      // Simple optimization: only update state if structure changed
      if (prev.length === next.length && prev.every((p, i) => p.date === next[i].date)) {
        return prev;
      }

      if (activeDayIndex >= next.length && next.length > 0) setActiveDayIndex(0);
      return next;
    });
  }, [startDate, endDate]);

  const createEmptyAssignment = (type: 'machine' | 'support'): Assignment => ({
    id: Math.random().toString(36).substring(2, 9),
    type,
    machineId: '',
    productId: '',
    operatorId: '',
    backupMachineId: '',
    targetQuantity: '',
    isBackup: false,
    tempDeptId: ''
  });

  const addAssignment = (dayIndex: number, type: 'machine' | 'support') => {
    const newPlans = [...dayPlans];
    newPlans[dayIndex].assignments.push(createEmptyAssignment(type));
    setDayPlans(newPlans);
  };

  const updateAssignment = async (dayIndex: number, assignId: string, field: keyof Assignment, value: any) => {
    const newPlans = [...dayPlans];
    const assign = newPlans[dayIndex].assignments.find(a => a.id === assignId);
    if (assign) {
      if (field === 'tempDeptId') assign.operatorId = '';
      (assign as any)[field] = value;

      // Automated Target Calculation using historical average
      if (field === 'productId' && value && shiftId) {
        try {
          const res = await api.get(`/production-records/average-cycle-time/${value}`);
          const avgCycle = res.averageCycleTime;
          assign.averageCycleTime = avgCycle; // Store for shift recalculations

          const s = shifts.find(x => x.id === shiftId);
          if (avgCycle && s?.durationMinutes) {
            const target = Math.floor((s.durationMinutes * 60) / avgCycle);
            if (target > 0) assign.targetQuantity = target.toString();
          }
        } catch (e) {
          console.error('Failed to get avg cycle time', e);
        }
      }

      setDayPlans([...newPlans]);
    }
  };

  const removeAssignment = (dayIndex: number, assignId: string) => {
    const newPlans = [...dayPlans];
    newPlans[dayIndex].assignments = newPlans[dayIndex].assignments.filter(a => a.id !== assignId);
    setDayPlans(newPlans);
  };

  const copyToAllDays = (sourceDayIndex: number) => {
    const sourceAssignments = dayPlans[sourceDayIndex].assignments.map(a => ({ ...a, id: Math.random().toString(36).substring(2, 9) }));
    const newPlans = dayPlans.map(p => ({
      ...p,
      assignments: JSON.parse(JSON.stringify(sourceAssignments)).map((a: any) => ({ ...a, id: Math.random().toString(36).substring(2, 9) }))
    }));
    setDayPlans(newPlans);
    notify.info('Plan Kopyalandı', 'Seçili günün atamaları tüm günlere uygulandı.');
  };

  const importPersonnelFromUnits = (dayIndex: number) => {
    if (selectedDeptIds.length === 0) {
      notify.warning('Birim Seçilmedi', 'Önce üst panelden çalışacak birimleri seçmelisiniz.');
      return;
    }
    const filtered = (operators || []).filter(o => o.departmentId && selectedDeptIds.includes(o.departmentId));
    if (filtered.length === 0) return;
    const existingOpIds = dayPlans[dayIndex].assignments.map(a => a.operatorId);
    const newOps = filtered.filter(o => !existingOpIds.includes(o.id));
    if (newOps.length === 0) return;

    const newAssignments = newOps.map(op => ({
      ...createEmptyAssignment('support'),
      operatorId: op.id,
      tempDeptId: op.departmentId
    }));

    const newPlans = [...dayPlans];
    newPlans[dayIndex].assignments = [...newPlans[dayIndex].assignments, ...newAssignments];
    setDayPlans(newPlans);
    notify.success(`${newOps.length} Personel Eklendi.`);
  };

  const handleSubmit = async () => {
    if (!planName || !startDate || !endDate || !shiftId) {
      notify.warning('Eksik Alan', 'Gerekli alanları doldurunuz.');
      return;
    }
    const flatItems: any[] = [];
    dayPlans.forEach(day => {
      day.assignments.forEach(a => {
        if (a.operatorId) {
          flatItems.push({
            date: day.date,
            machineId: a.machineId || null,
            operatorId: a.operatorId,
            productId: a.productId || null,
            targetQuantity: a.targetQuantity ? parseInt(a.targetQuantity) : null,
            notes: a.isBackup ? `[YEDEK] ${notes || ''}`.trim() : notes
          });
        }
      });
    });
    if (flatItems.length === 0) {
      notify.warning('İçerik Gerekli', 'En az bir personel ataması yapmalısınız.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/overtime/${id}`, { planName, startDate, endDate, shiftId, notes, items: flatItems });
        notify.success('Güncellendi', 'Mesai planı başarıyla güncellendi.');
      } else {
        await api.post('/overtime', { planName, startDate, endDate, shiftId, notes, items: flatItems });
        notify.success('Başarılı', 'Yeni mesai planı kaydedildi.');
      }
      navigate('/overtime/list');
    } catch (err: any) {
      notify.error('Hata', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-32 mx-auto animate-premium-page space-y-6 max-w-[1750px]">

      {/* Header Panel */}
      <div className="premium-card p-6 border-theme/50 shadow-xl bg-theme-surface overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none rotate-12">
          <Zap size={100} className="text-theme-primary/10" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-theme/20 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-theme-primary/10 rounded-xl border border-theme-primary/20 flex items-center justify-center shadow-inner">
              {isEdit ? <Edit2 className="w-6 h-6 text-theme-primary" /> : <Clock className="w-6 h-6 text-theme-primary" />}
            </div>
            <div>
              <h1 className="text-xl font-black text-theme-main tracking-tight uppercase leading-none mb-1">{toTRUpper(isEdit ? 'Mesai Planı Düzenle' : 'Mesai Yönetim Merkezi')}</h1>
              <p className="text-[10px] font-black text-theme-dim opacity-70 uppercase tracking-widest flex items-center gap-2">
                <Target size={10} className="text-theme-primary" /> Üretim, Kalite ve Operasyon Takvimi
              </p>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary h-10 px-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-theme-primary/20">
            {isEdit ? <Edit2 size={20} /> : <Plus size={20} />} {toTRUpper(isEdit ? 'Planı Güncelle' : 'Planı Kaydet')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-theme-dim uppercase tracking-[0.2em] px-1 opacity-60 mb-2 block">PLAn ADI</label>
            <input type="text" value={planName} onChange={e => setPlanName(e.target.value)} className="form-input h-10 bg-theme-base/30 border-theme/30 text-xs font-bold" placeholder="..." />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-theme-dim uppercase tracking-[0.2em] px-1 opacity-60 mb-2 block">{toTRUpper('Başlangıç')}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input h-10 bg-theme-base/30 border-theme/30 text-xs font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-theme-dim uppercase tracking-[0.2em] px-1 opacity-60 mb-2 block">{toTRUpper('Bitiş')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input h-10 bg-theme-base/30 border-theme/30 text-xs font-bold" />
          </div>
          <div className="space-y-1">
            <CustomSelect label="VARDİYA TÜRÜ" options={(shifts || []).map(s => ({ id: s.id, label: s.shiftName, subLabel: s.shiftCode }))} value={shiftId} onChange={setShiftId} placeholder="Vardiya..." />
          </div>
          <div className="space-y-1">
            <CustomSelect label="BİRİM FİLTRESİ" isMulti options={(departments || []).map(d => ({ id: d.id, label: d.name }))} value={selectedDeptIds} onChange={setSelectedDeptIds} placeholder="Birimler..." />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* LEFT SIDEBAR */}
        <div className="xl:col-span-3 space-y-6 lg:sticky lg:top-6">
          <div className="premium-card p-5 bg-theme-base/20 border-theme/30 space-y-4 shadow-lg backdrop-blur-md">
            <h3 className="text-[10px] font-black text-theme-main tracking-widest uppercase pb-3 border-b border-theme/20 flex items-center justify-between">
              <span>{toTRUpper('Gün Listesi')}</span>
              <span className="text-theme-primary opacity-60">{dayPlans.length}</span>
            </h3>
            {dayPlans.length > 0 ? (
              <div className="space-y-2 max-h-[30vh] overflow-y-auto custom-scroll pr-1">
                {dayPlans.map((day, idx) => (
                  <button key={day.date} onClick={() => setActiveDayIndex(idx)} className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                    activeDayIndex === idx ? "bg-theme-surface border-theme-primary shadow-sm" : "bg-theme-surface/30 border-transparent hover:bg-theme-base/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black", activeDayIndex === idx ? "bg-theme-primary text-white" : "bg-theme-base/50 text-theme-dim")}>
                        <p className="text-[11px] leading-none">{new Date(day.date).getDate()}</p>
                        <p className="text-[6px] opacity-60 uppercase">{new Date(day.date).toLocaleDateString('tr-TR', { month: 'short' })}</p>
                      </div>
                      <p className={cn("text-[11px] font-black", activeDayIndex === idx ? "text-theme-primary" : "text-theme-main")}>
                        {new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                      </p>
                    </div>
                    <ChevronRight size={14} className={cn(activeDayIndex === idx ? "text-theme-primary" : "text-theme-dim opacity-20")} />
                  </button>
                ))}
              </div>
            ) : <div className="py-8 text-center opacity-30 text-[9px] uppercase font-black">Plan Bekleniyor...</div>}
          </div>

          {/* Personnel Selection */}
          <div className="premium-card p-5 bg-theme-base/20 border-theme/30 space-y-4 shadow-lg backdrop-blur-md">
            <h3 className="text-[10px] font-black text-theme-main tracking-widest uppercase pb-3 border-b border-theme/20 flex items-center justify-between">
              <span>{toTRUpper('Personel Listesi')}</span>
              <Users size={14} />
            </h3>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scroll pr-1">
              {(operators || [])
                .filter(o => selectedDeptIds.length === 0 || (o.departmentId && selectedDeptIds.includes(o.departmentId)))
                .map(op => {
                  const isAlreadyAdded = dayPlans[activeDayIndex]?.assignments?.some(a => a.operatorId === op.id);
                  return (
                    <div key={op.id} className={cn("w-full flex items-center justify-between p-2.5 rounded-xl border transition-all bg-theme-surface/40 hover:bg-theme-surface group/row", isAlreadyAdded ? "border-theme-success/30 bg-theme-success/5 opacity-60" : "border-transparent")}>
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-lg bg-theme-base flex items-center justify-center text-[10px] font-black text-theme-primary shrink-0">
                          {(op.fullName || '').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] font-black text-theme-main truncate">{op.fullName}</p>
                          <p className="text-[7px] font-bold text-theme-dim uppercase opacity-50 truncate">{(op.role as any)?.name || 'Personel'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!isAlreadyAdded && dayPlans[activeDayIndex]) {
                            const newPlans = [...dayPlans];
                            newPlans[activeDayIndex].assignments.push({ ...createEmptyAssignment('support'), operatorId: op.id, tempDeptId: op.departmentId });
                            setDayPlans([...newPlans]);
                          }
                        }}
                        disabled={isAlreadyAdded || !dayPlans.length}
                        className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all", isAlreadyAdded ? "text-theme-success" : "bg-theme-primary/10 text-theme-primary hover:bg-theme-primary hover:text-white")}
                      >
                        {isAlreadyAdded ? <CheckCircle size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="xl:col-span-9 space-y-8">
          {dayPlans.length > 0 ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

              {/* Daily Header */}
              <div className="premium-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-theme-surface/80 backdrop-blur-xl border-theme/40 shadow-xl overflow-hidden relative">
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-12 h-12 bg-theme-primary text-white rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-theme-primary/30">
                    <p className="text-sm font-black leading-none">{dayPlans[activeDayIndex] ? new Date(dayPlans[activeDayIndex].date).getDate() : ''}</p>
                    <p className="text-[6px] font-black uppercase opacity-60">{dayPlans[activeDayIndex] ? new Date(dayPlans[activeDayIndex].date).toLocaleDateString('tr-TR', { month: 'short' }) : ''}</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-theme-main tracking-tight uppercase leading-none">{dayPlans[activeDayIndex] ? new Date(dayPlans[activeDayIndex].date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</h2>
                    <p className="text-[8px] font-black text-theme-primary mt-1.5 uppercase tracking-[0.2em] opacity-80">MESAI PLANLAMA PANELİ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <button onClick={() => copyToAllDays(activeDayIndex)} className="btn-secondary h-10 px-5 flex items-center gap-2 text-[9px] font-black" title="Kopyala"><Copy size={14} /> {toTRUpper('Hepsine Aktar')}</button>
                  <button onClick={() => importPersonnelFromUnits(activeDayIndex)} className="btn-secondary h-10 px-5 flex items-center gap-2 text-[9px] font-black text-theme-primary border-theme-primary/20"><Users size={14} /> {toTRUpper('Birim Çağır')}</button>
                </div>
              </div>

              {/* CONTAINER 1: MAKİNE MESAiSİ */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-10 h-10 rounded-2xl bg-theme-primary/10 flex items-center justify-center text-theme-primary shadow-lg shadow-theme-primary/5">
                    <Monitor size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[12px] font-black text-theme-main tracking-tight uppercase leading-tight mb-1">MAKİNE VE ÜRETİM MESAİSİ</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-primary animate-pulse" />
                      <p className="text-[8px] font-bold text-theme-dim opacity-60 uppercase tracking-widest">SADECE CNC ÜRETİM DEPARTMANI (DP-01)</p>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <button onClick={() => addAssignment(activeDayIndex, 'machine')} className="btn-primary h-9 px-5 flex items-center gap-2 text-[9px] font-black shadow-lg shadow-theme-primary/10">
                      <Plus size={14} /> {toTRUpper('MAKİNE SATIRI EKLE')}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(dayPlans[activeDayIndex]?.assignments || []).filter(a => a.type === 'machine').map((assign) => (
                    <div key={assign.id} className="premium-card p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end border-theme/20 bg-theme-surface/40 hover:bg-theme-surface transition-all group">
                      <div className="lg:col-span-3">
                        <CustomSelect label="MAKİNE" options={(machines || []).map(m => ({ id: m.id, label: m.name, subLabel: m.code }))} value={assign.machineId} onChange={v => updateAssignment(activeDayIndex, assign.id, 'machineId', v)} placeholder="Makine Seç..." />
                      </div>
                      <div className="lg:col-span-3">
                        <CustomSelect
                          label="OPERATÖR"
                          options={(operators || []).filter(o => o.departmentId && cncDeptIds.includes(o.departmentId)).map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))}
                          value={assign.operatorId}
                          onChange={v => updateAssignment(activeDayIndex, assign.id, 'operatorId', v)}
                          placeholder="Cnc Operatörü..."
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <CustomSelect label="AKTİF ÜRÜN" options={(products || []).map(p => ({ id: p.id, label: p.productName, subLabel: p.productCode }))} value={assign.productId} onChange={v => updateAssignment(activeDayIndex, assign.id, 'productId', v)} placeholder="Ürün..." />
                      </div>
                      <div className="lg:col-span-1">
                        <label className="text-[8px] font-black text-theme-dim uppercase mb-1.5 block opacity-60 ml-0.5">HEdEF</label>
                        <input type="number" value={assign.targetQuantity} onChange={e => updateAssignment(activeDayIndex, assign.id, 'targetQuantity', e.target.value)} className="form-input h-9 bg-theme-base/20 border-theme/20 text-[10px] font-black text-center" placeholder="0" />
                      </div>
                      <div className="lg:col-span-1">
                        <button onClick={() => updateAssignment(activeDayIndex, assign.id, 'isBackup', !assign.isBackup)} className={cn("w-full h-9 rounded-lg border transition-all flex items-center justify-center gap-1.5 text-[8px] font-black", assign.isBackup ? "bg-theme-success text-white border-theme-success shadow-md shadow-theme-success/20" : "bg-theme-base/10 border-theme/10 text-theme-dim select-none")}>
                          {assign.isBackup ? <CheckCircle size={10} /> : <div className="w-1.5 h-1.5 rounded-full border border-current opacity-20" />} {toTRUpper('Yedek')}
                        </button>
                      </div>
                      <div className="lg:col-span-1 flex justify-end">
                        <button onClick={() => removeAssignment(activeDayIndex, assign.id)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-theme-danger/5 text-theme-danger hover:bg-theme-danger hover:text-white transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {(dayPlans[activeDayIndex]?.assignments || []).filter(a => a.type === 'machine').length === 0 && (
                    <div className="p-10 text-center border-2 border-dashed border-theme/10 rounded-2xl opacity-20 text-[9px] font-black uppercase tracking-widest">Henüz Makine Ataması Mevcut Değil</div>
                  )}
                </div>
              </div>

              {/* CONTAINER 2: DİĞER BİRİMLER / DESTEK */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-10 h-10 rounded-2xl bg-theme-dim/10 flex items-center justify-center text-theme-dim shadow-lg shadow-theme-dim/5">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[12px] font-black text-theme-main tracking-tight uppercase leading-tight mb-1">DESTEK VE İDARİ BİRİM MESAİSİ</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-dim opacity-40" />
                      <p className="text-[8px] font-bold text-theme-dim opacity-50 uppercase tracking-widest">BİRİM SEÇİMİNE GÖRE PERSONEL LİSTELEME</p>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <button onClick={() => addAssignment(activeDayIndex, 'support')} className="btn-secondary h-9 px-5 flex items-center gap-2 text-[9px] font-black border-theme-primary/20 text-theme-primary">
                      <Plus size={14} /> {toTRUpper('DESTEK PERSONELİ EKLE')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(dayPlans[activeDayIndex]?.assignments || []).filter(a => a.type === 'support').map((assign) => (
                    <div key={assign.id} className="premium-card p-5 border-theme/20 bg-theme-surface/40 hover:bg-theme-surface transition-all flex flex-col gap-4 relative group">
                      <div className="flex items-center justify-between border-b border-theme/10 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-theme-primary/10 flex items-center justify-center text-theme-primary">
                            <Users size={16} />
                          </div>
                          <p className="text-[10px] font-black text-theme-main uppercase tracking-widest">DESTEK PERSONELİ ATAMA</p>
                        </div>
                        <button onClick={() => removeAssignment(activeDayIndex, assign.id)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-theme-danger/5 text-theme-danger hover:bg-theme-danger hover:text-white transition-all"><Trash2 size={12} /></button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <CustomSelect
                          label="BİRİM / DEPARTMAN"
                          options={(departments || [])
                            .filter(d => selectedDeptIds.length === 0 || selectedDeptIds.includes(d.id))
                            .map(d => ({ id: d.id, label: d.name }))}
                          value={assign.tempDeptId}
                          onChange={v => updateAssignment(activeDayIndex, assign.id, 'tempDeptId', v)}
                          placeholder="Seçiniz..."
                        />
                        <CustomSelect
                          label="PERSONEL"
                          options={(operators || [])
                            .filter(o => !assign.tempDeptId || o.departmentId === assign.tempDeptId)
                            .map(o => ({ id: o.id, label: o.fullName, subLabel: (o.role as any)?.name }))}
                          value={assign.operatorId}
                          onChange={v => updateAssignment(activeDayIndex, assign.id, 'operatorId', v)}
                          placeholder={assign.tempDeptId ? "Personel..." : "Önce Birim Seç!"}
                          disabled={!assign.tempDeptId}
                        />
                      </div>

                      {assign.operatorId && (
                        <div className="flex items-center gap-3 bg-theme-base/20 p-2.5 rounded-xl border border-theme/10 animate-in fade-in slide-in-from-left-2 transition-all">
                          <div className="w-8 h-8 rounded-lg bg-theme-surface flex items-center justify-center text-[10px] font-black text-theme-primary shadow-inner">
                            {((operators || []).find(o => o.id === assign.operatorId)?.fullName || '').split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-theme-main leading-none mb-1 uppercase">{(operators || []).find(o => o.id === assign.operatorId)?.fullName}</p>
                            <p className="text-[8px] font-bold text-theme-dim opacity-60 uppercase tracking-tighter truncate">
                              {((operators || []).find(o => o.id === assign.operatorId)?.role as any)?.name || 'Personel'} • {(departments || []).find(d => d.id === assign.tempDeptId)?.name || 'Birim'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {(dayPlans[activeDayIndex]?.assignments || []).filter(a => a.type === 'support').length === 0 && (
                  <div className="p-10 text-center border-2 border-dashed border-theme/10 rounded-2xl opacity-20 text-[9px] font-black uppercase tracking-widest">Henüz Destek Personeli Eklenmedi</div>
                )}
              </div>

            </div>
          ) : (
            <div className="premium-card p-24 flex flex-col items-center justify-center text-center bg-theme-surface/30 border-dashed border-theme/40 min-h-[550px] shadow-inner rounded-[3rem]">
              <div className="w-24 h-24 bg-theme-base rounded-2xl flex items-center justify-center shadow-2xl border border-theme mb-8 opacity-20 rotate-3">
                <Calendar size={40} className="text-theme-dim" />
              </div>
              <h3 className="text-2xl font-black text-theme-main mb-3 uppercase tracking-tighter">{toTRUpper('Planlama Hazır')}</h3>
              <p className="text-[13px] text-theme-dim font-medium max-w-sm leading-relaxed opacity-60">Üst panelden tarih ve vardiya seçerek günlük mesai takvimini oluşturmaya başlayın.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OvertimeCreate;
