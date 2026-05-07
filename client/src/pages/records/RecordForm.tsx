import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Save, ArrowLeft, Clock, Target, Info, CheckCircle2, Plus, List, Download, Wrench } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, subDays, isBefore, startOfToday } from 'date-fns';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { cn } from '../../lib/utils';

const schema = z.object({
  productionDate: z.string()
    .min(1, 'Üretim tarihi zorunludur')
    .refine(val => isBefore(new Date(val), startOfToday()), {
      message: 'Üretim kaydı yalnızca geçmiş tarihler için girilebilir. Bugünün planlaması için Planlama modülünü kullanın.'
    }),
  shiftId: z.string().min(1, 'Vardiya seçimi zorunludur'),
  machineId: z.string().min(1, 'Makine seçimi zorunludur'),
  operatorId: z.string().optional().default(''),
  productId: z.string().optional().default(''),
  cycleTimeSeconds: z.number().min(0).optional().default(0),
  producedQuantity: z.number().min(0).optional().default(0),
  defectQuantity: z.number().min(0).optional().default(0),
  plannedDowntimeMinutes: z.number().min(0).optional().default(0),
  effectiveDurationMinutes: z.number().min(1).optional(),
  notes: z.string().optional(),
});

type FormData = z.input<typeof schema>;

export function RecordForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [machines, setMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, handleSubmit, watch, control, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      productionDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      defectQuantity: 0,
      plannedDowntimeMinutes: 0,
      cycleTimeSeconds: 0,
      producedQuantity: 0,
    }
  });

  const [shiftContext, setShiftContext] = useState({ totalActual: 0, totalPlanned: 0 });
  const [isManualDurationEnabled, setIsManualDurationEnabled] = useState(false);
  const [manualDurationMinutes, setManualDurationMinutes] = useState<number>(0);
  const [isDowntime, setIsDowntime] = useState(false);

  // Watch only necessary fields for context to avoid unnecessary renders
  const watchContext = watch(['productionDate', 'machineId', 'shiftId']);
  const [productionDate, machineId, shiftId] = watchContext;

  useEffect(() => {
    if (productionDate && machineId && shiftId) {
      const fetchContext = async () => {
        try {
          const res = await api.get(`/production-records/shift-context?date=${productionDate}&machineId=${machineId}&shiftId=${shiftId}${id ? `&excludeId=${id}` : ''}`);
          setShiftContext(res);
        } catch (err) {
          console.error('Error fetching context:', err);
        }
      };
      fetchContext();
    }
  }, [productionDate, machineId, shiftId, id]);

  // Watch all fields needed for calculation
  const watchCalc = watch(['shiftId', 'producedQuantity', 'cycleTimeSeconds', 'plannedDowntimeMinutes', 'defectQuantity']);
  const [watchedShiftId, producedQuantity, cycleTimeSeconds, plannedDowntimeMinutes, defectQuantity] = watchCalc;

  // Use useMemo for derived state to prevent infinite loops and unnecessary re-renders
  const automationResult = useMemo(() => {
    const selectedShift = shifts.find(s => s.id === watchedShiftId);

    if (selectedShift && (cycleTimeSeconds || 0) > 0 && (producedQuantity || 0) > 0) {
      const shiftDurationMinutes = selectedShift.durationMinutes;
      const effectiveDuration = isManualDurationEnabled && manualDurationMinutes > 0
        ? manualDurationMinutes
        : shiftDurationMinutes;

      // Calculations for the CURRENT product
      const currentActualMin = ((producedQuantity || 0) * (cycleTimeSeconds || 0)) / 60;
      const currentPlannedDowntime = plannedDowntimeMinutes || 0;

      // Aggregates (Current + Other products in same shift)
      const totalActualMin = currentActualMin + shiftContext.totalActual;
      const totalPlannedDowntime = currentPlannedDowntime + shiftContext.totalPlanned;

      // Shift-wide availability
      const ppt = effectiveDuration - totalPlannedDowntime;
      let availability = ppt > 0 ? (totalActualMin / ppt) * 100 : 0;
      availability = Math.min(100, Math.max(0, availability));

      // Global (Shift) Downtime
      const totalDowntimeMin = Math.max(0, effectiveDuration - totalActualMin);
      const shiftUnplannedDowntime = Math.max(0, totalDowntimeMin - totalPlannedDowntime);

      // Current Product Quality and OEE
      let quality = (producedQuantity || 0) > 0 ? (((producedQuantity || 0) - (defectQuantity || 0)) / (producedQuantity || 0)) * 100 : 0;
      quality = Math.min(100, Math.max(0, quality));

      const oee = (availability / 100) * 1 * (quality / 100) * 100;

      return {
        plannedQuantity: Math.floor((effectiveDuration * 60) / (cycleTimeSeconds || 1)),
        actualWorkingMinutes: currentActualMin.toFixed(1),
        occupiedMinutes: shiftContext.totalActual.toFixed(1),
        currentUnplanned: (shiftUnplannedDowntime * (currentActualMin / totalActualMin)).toFixed(1),
        totalShiftDowntime: totalDowntimeMin.toFixed(1),
        shiftUnplanned: shiftUnplannedDowntime.toFixed(1),
        availability: availability.toFixed(1),
        oee: oee.toFixed(1),
        performance: 100,
        shiftTotal: effectiveDuration
      };
    }
    return null;
  }, [watchedShiftId, producedQuantity, cycleTimeSeconds, plannedDowntimeMinutes, defectQuantity, shifts, shiftContext, isManualDurationEnabled, manualDurationMinutes]);

  useEffect(() => {
    const selectedShift = shifts.find((s) => s.id === watchedShiftId);
    if (!selectedShift) return;
    if (!isManualDurationEnabled) {
      setManualDurationMinutes(selectedShift.durationMinutes || 0);
    }
  }, [watchedShiftId, shifts, isManualDurationEnabled]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [mRes, oRes, sRes, pRes] = await Promise.all([
          api.get('/machines'),
          api.get('/operators?is_operator=true'),
          api.get('/shifts'),
          api.get('/products'),
        ]);
        setMachines(mRes.filter((m: any) => m.status === 'active' || isEditMode));
        setOperators(oRes.filter((o: any) => o.status === 'active' || isEditMode));
        setShifts(sRes.filter((s: any) => s.status === 'active' || isEditMode));
        setProducts(pRes.filter((p: any) => p.status === 'active' || isEditMode));

        if (isEditMode) {
          const editData = await api.get(`/production-records/${id}`);
          if (editData.productionDate) {
            editData.productionDate = format(new Date(editData.productionDate), 'yyyy-MM-dd');
          }
          if ((editData.plannedDurationMinutes || 0) > 0) {
            setManualDurationMinutes(editData.plannedDurationMinutes);
            const shift = sRes.find((s: any) => s.id === editData.shiftId);
            if (shift && editData.plannedDurationMinutes !== shift.durationMinutes) {
              setIsManualDurationEnabled(true);
            }
          }
          reset(editData);
        }
      } catch (err) {
        setServerError('Veriler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [id, isEditMode, reset]);


  const onSubmit = async (data: FormData) => {
    try {
      setServerError('');
      const payload = {
        ...data,
        // Downtime mode: zero out all production values
        operatorId: isDowntime ? (data.operatorId || '') : data.operatorId,
        productId: isDowntime ? (data.productId || '') : data.productId,
        producedQuantity: isDowntime ? 0 : (data.producedQuantity || 0),
        defectQuantity: isDowntime ? 0 : (data.defectQuantity || 0),
        cycleTimeSeconds: isDowntime ? 0 : (data.cycleTimeSeconds || 0),
        plannedDowntimeMinutes: isDowntime ? 0 : (data.plannedDowntimeMinutes || 0),
        effectiveDurationMinutes: isDowntime ? 0 : (isManualDurationEnabled && manualDurationMinutes > 0 ? manualDurationMinutes : 0),
        notes: isDowntime
          ? `[ARIZA/BAKIM]${data.notes ? ' ' + data.notes : ''}`
          : (data.notes || ''),
      };
      if (isEditMode) {
        await api.put(`/production-records/${id}`, payload);
      } else {
        await api.post('/production-records', payload);
      }
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submission error:', err);
      setServerError('Kayıt işlemi başarısız. Lütfen tekrar deneyiniz.');
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <button
              onClick={() => navigate('/records')}
              className="flex items-center gap-2 text-theme-dim hover:text-theme-main transition-colors mb-2 text-sm font-medium group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kayıt Listesine Dön
            </button>
            <h2 className="text-2xl font-bold text-theme-main tracking-tight leading-tight">
              {isEditMode ? 'Kayıt Düzenle' : 'Yeni Üretim Kaydı'}
            </h2>
            <p className="text-theme-muted text-sm mt-1">Sistem verileri veritabanına <strong className="text-theme-primary">güvenli</strong> bir şekilde işler.</p>
          </div>
        </div>

        {!isEditMode && !isSuccess && (
          <button
            onClick={() => navigate('/settings', { state: { activeTab: 'import', importType: 'production_records' } })}
            className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 hover:scale-105 text-emerald-400 border border-emerald-500/20 rounded-2xl transition-all group shrink-0"
          >
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Download className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black leading-none mb-1">Toplu Veri mi Var</p>
              <p className="text-xs font-bold text-emerald-300">EXCEL İLE İÇERİ AKTAR</p>
            </div>
          </button>
        )}
      </div>

      {serverError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 flex items-center gap-3 animate-in shake">
          <Info className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{serverError}</p>
        </div>
      )}

      {isSuccess ? (
        <div className="modern-glass-card py-10 flex flex-col items-center text-center space-y-8 shadow-theme-primary/5 animate-in zoom-in-95 duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-theme-primary/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative w-16 h-16 bg-theme-primary/10 border border-theme-primary/50 rounded-2xl flex items-center justify-center shadow-2xl shadow-theme-primary/50 rotate-3 hover:rotate-0 transition-transform duration-500">
              <CheckCircle2 className="w-8 h-8 text-theme-primary" />
            </div>
          </div>

          <div className="max-w-md">
            <h3 className="text-xl font-black text-theme-primary mb-2 tracking-tight">HARİKA! BAŞARIYLA KAYDEDİLDİ.</h3>
            <p className="text-theme-muted text-sm leading-relaxed">
              Üretim verileri sisteme başarıyla işlendi. Şimdi ne yapmak istersiniz
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 w-full max-w-lg justify-center">
            <button
              onClick={() => {
                setIsSuccess(false);
                reset();
                if (isEditMode) navigate('/records/new');
              }}
              className="flex-1 px-4 py-2 h-12 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl shadow-xl shadow-theme-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Plus className="w-6 h-6" /> YENİ KAYIT EKLE
            </button>
            <button
              onClick={() => navigate('/records')}
              className="flex-1 px-4 py-2 h-12 bg-theme-surface hover:bg-theme-surface/80 text-theme-main font-black rounded-xl border border-theme active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <List className="w-6 h-6" /> LİSTEYE DÖN
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="modern-glass-card overflow-hidden p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            <div className="lg:col-span-12 xl:col-span-4 space-y-6">
              <div className="p-4 bg-theme-surface/10 rounded-2xl border border-theme space-y-8 shadow-inner shadow-theme-main/5 h-full">
                <div className="flex items-center gap-3 border-b border-theme pb-4">
                  <Target className="w-5 h-5 text-theme-primary" />
                  <h3 className="text-lg font-semibold text-theme-main">Otomatik Hesaplama</h3>
                </div>

                {automationResult ? (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 gap-4">
                      <SummaryItem label="Hedef Kapasite" value={automationResult.plannedQuantity} unit="Adet" icon={Target} color="text-theme-primary" />
                      <SummaryItem label="Vardiya Süresi" value={automationResult.shiftTotal} unit="dk" icon={Clock} color="text-theme-dim" />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-theme">
                      <div className="flex justify-between items-center bg-theme-main/5 p-3 rounded-xl">
                        <span className="text-xs font-bold text-theme-dim uppercase tracking-widest">Bu Ürün Süresi</span>
                        <span className="text-sm font-bold text-emerald-400">{automationResult.actualWorkingMinutes} dk</span>
                      </div>
                      {parseFloat(automationResult.occupiedMinutes) > 0 && (
                        <div className="flex justify-between items-center bg-theme-primary/5 p-3 rounded-xl border border-theme-primary/10">
                          <span className="text-xs font-bold text-theme-primary uppercase tracking-widest">Diğer Ürünler</span>
                          <span className="text-sm font-bold text-theme-primary/80">{automationResult.occupiedMinutes} dk</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center bg-theme-main/5 p-3 rounded-xl border border-red-500/10">
                        <span className="text-xs font-bold text-theme-dim uppercase tracking-widest">Vardiya Plansız Duruş</span>
                        <span className="text-sm font-bold text-red-400">{automationResult.shiftUnplanned} dk</span>
                      </div>
                      <div className="flex justify-between items-center bg-theme-main/10 p-3 rounded-xl">
                        <span className="text-xs font-bold text-theme-dim uppercase tracking-widest">Toplam Vardiya Duruş</span>
                        <span className="text-sm font-bold text-theme-main">{automationResult.totalShiftDowntime} dk</span>
                      </div>
                    </div>

                    <div className="mt-8 p-6 bg-theme-primary/10 border-2 border-theme-primary/20 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest leading-none mb-1">Hesaplanan OEE</span>
                          <span className="text-[8px] text-theme-primary uppercase font-black tracking-tight">(Vardiya Bazlı Verimlilik)</span>
                        </div>
                        <span className="text-lg font-black text-theme-primary">%{automationResult.oee}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4 opacity-30">
                    <Info className="w-12 h-12 mx-auto text-theme-dim" />
                    <p className="text-xs font-bold text-theme-dim uppercase tracking-widest">Hesaplama için lütfen verileri giriniz.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-12 xl:col-span-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-dim ml-1">Üretim Tarihi</label>
                  <input type="date" {...register('productionDate')} className="form-input" max={format(subDays(new Date(), 1), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-dim ml-1">Vardiya</label>
                  <Controller name="shiftId" control={control} render={({ field }) => (
                    <CustomSelect options={(shifts || []).map((s: any) => ({ id: s.id, label: s.shiftName, subLabel: `${s.durationMinutes} dk` }))} value={field.value} onChange={field.onChange} error={errors.shiftId?.message} searchable={false} />
                  )} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-theme-dim ml-1">Makine</label>
                  <Controller name="machineId" control={control} render={({ field }) => (
                    <CustomSelect options={(machines || []).map((m: any) => ({ id: m.id, label: m.code, subLabel: m.name }))} value={field.value} onChange={field.onChange} error={errors.machineId?.message} />
                  )} />
                </div>
                <div className={`space-y-2 transition-opacity ${isDowntime ? 'opacity-40 pointer-events-none' : ''}`}>
                  <label className="text-xs font-bold text-theme-dim ml-1">Operatör</label>
                  <Controller name="operatorId" control={control} render={({ field }) => (
                    <CustomSelect options={(operators || []).map((o: any) => ({ id: o.id, label: o.fullName, subLabel: o.department?.name || o.employeeId }))} value={field.value} onChange={field.onChange} error={isDowntime ? undefined : errors.operatorId?.message} disabled={isDowntime} />
                  )} />
                </div>
              </div>

              {/* Arıza / Bakım Toggle */}
              <div className={`p-4 rounded-2xl border-2 transition-all duration-300 ${isDowntime
                ? 'bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10'
                : 'bg-theme-surface/10 border-theme'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isDowntime ? 'bg-rose-500/20' : 'bg-theme-main/5'
                      }`}>
                      <Wrench className={`w-4 h-4 transition-colors ${isDowntime ? 'text-rose-400' : 'text-theme-dim'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest transition-colors ${isDowntime ? 'text-rose-400' : 'text-theme-main'
                        }`}>Arıza / Bakım Modu</p>
                      <p className="text-[11px] text-theme-dim font-bold">
                        {isDowntime
                          ? 'Bu makine bu vardiyada çalışmadı. Üretim değerleri sıfır olarak kaydedilecek.'
                          : 'Aktif edilirse tüm üretim alanları devre dışı kalır, OEE %0 hesaplanır.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDowntime(prev => !prev)}
                    className={cn(
                      'relative h-7 w-14 rounded-full border-2 transition-all duration-300',
                      isDowntime ? 'bg-rose-500 border-rose-500 shadow-lg shadow-rose-500/30' : 'bg-theme-main/10 border-theme'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300 flex items-center justify-center',
                        isDowntime ? 'left-[30px]' : 'left-0.75'
                      )}
                    >
                      {isDowntime && <Wrench className="w-2.5 h-2.5 text-rose-500" />}
                    </span>
                  </button>
                </div>
              </div>

              <div className={`space-y-6 pt-6 border-t border-theme transition-all ${isDowntime ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <div className="p-4 rounded-2xl border border-theme bg-theme-surface/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-theme-main uppercase tracking-widest">Etkin Çalışma Süresi</p>
                      <p className="text-[11px] text-theme-dim font-bold">Varsayılan olarak vardiya süresi kullanılır. Arıza/değişim senaryolarında manuel değiştirebilirsiniz.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsManualDurationEnabled((prev) => !prev)}
                      disabled={isDowntime}
                      className={cn(
                        'relative h-6.5 w-14 rounded-full border transition-all',
                        isManualDurationEnabled ? 'bg-theme-primary border-theme-primary' : 'bg-theme-main/10 border-theme'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                          isManualDurationEnabled ? 'left-8' : 'left-0.75 '
                        )}
                      />
                    </button>
                  </div>
                  {isManualDurationEnabled && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-theme-primary ml-1">Manuel Çalışma Süresi (Dk)</label>
                      <input
                        type="number"
                        min={1}
                        value={manualDurationMinutes || ''}
                        onChange={(e) => setManualDurationMinutes(Number(e.target.value) || 0)}
                        className="form-input rounded-xl border-theme-primary/30 font-black"
                        placeholder="dk"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-theme-dim ml-1">Ürün</label>
                    <Controller name="productId" control={control} render={({ field }) => (
                      <CustomSelect options={(products || []).map((p: any) => ({ id: p.id, label: p.productCode, subLabel: p.productName }))} value={field.value} onChange={field.onChange} error={errors.productId?.message} disabled={isDowntime} />
                    )} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-red-400 ml-1 flex items-center gap-2">
                      ⭐ Cycle Time (Sn)
                    </label>
                    <div className="relative group/cycle">
                      <input
                        type="number"
                        step="0.1"
                        disabled={isDowntime}
                        {...register('cycleTimeSeconds', { valueAsNumber: true })}
                        className="h-10 w-full bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2 text-xl font-black text-theme-main focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all placeholder:text-theme-dim/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                      {errors.cycleTimeSeconds && !isDowntime && (
                        <p className="text-red-400 text-[10px] mt-1 font-bold absolute -bottom-5 left-1">
                          {errors.cycleTimeSeconds.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-400 ml-1">Üretilen Adet *</label>
                    <input type="number" disabled={isDowntime} {...register('producedQuantity', { valueAsNumber: true })} className="form-input rounded-xl border-emerald-500/20 text-emerald-100 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed" placeholder="0" />
                    {errors.producedQuantity && !isDowntime && <p className="error-text">{errors.producedQuantity.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-theme-dim ml-1">Planlı Duruş (Dk)</label>
                    <input type="number" disabled={isDowntime} {...register('plannedDowntimeMinutes', { valueAsNumber: true })} className="form-input rounded-xl disabled:opacity-50 disabled:cursor-not-allowed" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-theme-dim ml-1">Hatalı Adet</label>
                    <input type="number" disabled={isDowntime} {...register('defectQuantity', { valueAsNumber: true })} className="form-input rounded-xl disabled:opacity-50 disabled:cursor-not-allowed" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className={`space-y-2 transition-opacity ${isDowntime ? 'opacity-40' : ''}`}>
                <label className="text-xs font-bold text-theme-dim ml-1">Notlar</label>
                <textarea {...register('notes')} rows={2} className="form-input h-20 rounded-xl resize-none" placeholder="Opsiyonel açıklamalar..." />
              </div>

              <div className="pt-6 flex justify-end gap-4">
                <button type="button" onClick={() => navigate('/records')} className="w-auto h-10 px-4 py-0 text-theme-dim hover:text-theme-main font-bold transition-all rounded-xl items-center j">Vazgeç</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-auto h-10 px-4 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl shadow-2xl shadow-theme-primary/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loading size="sm" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {isEditMode ? 'KAYDET' : 'KAYDI EKLE'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function SummaryItem({ label, value, unit, icon: Icon, color }: { label: string, value: any, unit: string, icon: any, color: string }) {
  return (
    <div className="bg-theme-main/5 p-4 rounded-2xl border border-theme space-y-1">
      <div className="flex items-center gap-2 opacity-50">
        <Icon size={12} className={color} />
        <span className="text-[10px] font-black uppercase tracking-widest text-theme-dim">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-theme-main">{value}</span>
        <span className="text-[10px] font-bold text-theme-dim uppercase">{unit}</span>
      </div>
    </div>
  );
}
