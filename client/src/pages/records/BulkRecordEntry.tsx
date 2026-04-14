import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Activity, Save, Trash2, Plus, Factory, Package, AlertCircle, Clock, User, Calendar, ChevronLeft, CopyPlus, Wrench } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { notify } from '../../store/notificationStore';
import { ConfirmModal } from '../../components/common/ConfirmModal';

interface BulkEntry {
  id: string; // temp local id
  productionDate: string; // NEW: per row date
  shiftId: string; // per row shift
  machineId: string;
  operatorId: string;
  productId: string;
  producedQuantity: number;
  defectQuantity: number;
  cycleTimeSeconds: number;
  plannedDowntimeMinutes: number;
  isManualDurationEnabled?: boolean;
  effectiveDurationMinutes?: number;
  isDowntime?: boolean; // Arıza/Bakım modu
  notes: string;
}

export function BulkRecordEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productionDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [shiftId, setShiftId] = useState('');

  const [machines, setMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [m, o, p, s] = await Promise.all([
          api.get('/machines'),
          api.get('/operators'),
          api.get('/products'),
          api.get('/shifts')
        ]);

        setMachines(m.filter((x: any) => x.status === 'active'));
        setOperators(o.filter((x: any) => x.status === 'active'));
        setProducts(p.filter((x: any) => x.status === 'active'));
        setShifts(s.filter((x: any) => x.status === 'active'));

        // Find default shift based on current time
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const currentShift = s.find((sh: any) => {
          const [startH, startM] = sh.startTime.split(':').map(Number);
          const [endH, endM] = sh.endTime.split(':').map(Number);
          const start = startH * 60 + startM;
          const end = endH * 60 + endM;

          if (start <= end) {
            return currentTime >= start && currentTime <= end;
          } else {
            // Overlapping midnight
            return currentTime >= start || currentTime <= end;
          }
        });

        if (currentShift) setShiftId(currentShift.id);

        // Add initial row
        const initialEntry: BulkEntry = {
          id: Math.random().toString(36).substr(2, 9),
          productionDate: new Date().toISOString().split('T')[0],
          shiftId: currentShift?.id || '',
          machineId: '',
          operatorId: '',
          productId: '',
          producedQuantity: 0,
          defectQuantity: 0,
          cycleTimeSeconds: 0,
          plannedDowntimeMinutes: 0,
          isManualDurationEnabled: false,
          effectiveDurationMinutes: 0,
          isDowntime: false,
          notes: ''
        };
        setEntries([initialEntry]);

      } catch (e) {
        console.error('Failed to load initial data', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const machineOptions = useMemo(() =>
    machines.map(m => ({ id: m.id, label: m.code, subLabel: m.name })),
    [machines]
  );

  const operatorOptions = useMemo(() =>
    operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId })),
    [operators]
  );

  const productOptions = useMemo(() =>
    products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName })),
    [products]
  );

  const shiftOptions = useMemo(() =>
    shifts.map(s => ({
      id: s.id,
      label: s.shiftName,
      subLabel: `${s.startTime} - ${s.endTime}`
    })),
    [shifts]
  );

  const addEntry = () => {
    const lastEntry = entries[entries.length - 1];
    const newEntry: BulkEntry = {
      id: Math.random().toString(36).substr(2, 9),
      productionDate: lastEntry ? lastEntry.productionDate : productionDate,
      shiftId: lastEntry ? lastEntry.shiftId : shiftId,
      machineId: '',
      operatorId: lastEntry ? lastEntry.operatorId : '',
      productId: '',
      producedQuantity: 0,
      defectQuantity: 0,
      cycleTimeSeconds: 0,
      plannedDowntimeMinutes: 0,
      isManualDurationEnabled: false,
      effectiveDurationMinutes: 0,
      isDowntime: false,
      notes: ''
    };
    setEntries([...entries, newEntry]);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  const duplicateEntry = (id: string) => {
    setEntries((prev) => {
      const source = prev.find((e) => e.id === id);
      if (!source) return prev;
      const clone: BulkEntry = {
        ...source,
        id: Math.random().toString(36).substr(2, 9)
      };
      return [...prev, clone];
    });
  };

  const updateEntry = (id: string, field: keyof BulkEntry, value: any) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, [field]: value };
      }
      return e;
    }));
  };

  const handleSaveAll = async () => {
    // Downtime-only rows only need date+machine+shift; allow saving them without operator/product
    const validEntries = entries.filter(e =>
      e.machineId && e.shiftId && e.productionDate &&
      (e.isDowntime || (e.operatorId && e.productId))
    );
    if (validEntries.length === 0) {
      notify.error('Hata', 'Lütfen en az bir tam kayıt doldurunuz.');
      return;
    }

    try {
      setSaving(true);
      const payload = validEntries.map(e => ({
        productionDate: new Date(e.productionDate).toISOString(),
        shiftId: e.shiftId,
        machineId: e.machineId,
        // Downtime rows: no operator/product needed — use placeholder or empty
        operatorId: e.isDowntime ? (e.operatorId || '') : e.operatorId,
        productId: e.isDowntime ? (e.productId || '') : e.productId,
        producedQuantity: e.isDowntime ? 0 : (Number(e.producedQuantity) || 0),
        defectQuantity: e.isDowntime ? 0 : (Number(e.defectQuantity) || 0),
        cycleTimeSeconds: e.isDowntime ? 0 : (Number(e.cycleTimeSeconds) || 30),
        plannedDowntimeMinutes: e.isDowntime ? 0 : (Number(e.plannedDowntimeMinutes) || 0),
        effectiveDurationMinutes: e.isDowntime ? 0 : (e.isManualDurationEnabled ? (Number(e.effectiveDurationMinutes) || 0) : undefined),
        notes: e.isDowntime ? `[ARIZA/BAKIM]${e.notes ? ' ' + e.notes : ''}` : (e.notes || '')
      }));

      await api.post('/production-records/bulk-entry', { records: payload });
      notify.success('Başarılı', `${payload.length} adet kayıt oluşturuldu.`);
      navigate('/records');
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Kayıt sırasında bir hata oluşti.';
      notify.error('Hata', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full min-h-screen bg-theme-base space-y-10 animate-in fade-in duration-700">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-3">
          <button
            onClick={() => navigate('/records')}
            className="group flex items-center gap-2 text-theme-dim hover:text-theme-primary font-black text-[10px] uppercase tracking-[0.2em] transition-colors"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            GERİ DÖN
          </button>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center shadow-2xl shadow-theme-primary/30 ring-4 ring-theme-primary/10">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-theme-main uppercase">Hızlı Üretim Girişi</h1>
              <p className="text-theme-dim text-xs font-bold mt-0.05 opacity-60">Toplu Veri Matrisi ve Analitik Kayıt Paneli</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={addEntry}
            className="flex items-center h-10 gap-3 px-3 py-2 bg-theme-base hover:bg-theme-surface border border-theme rounded-xl text-theme-main font-black text-xs uppercase tracking-widest transition-all active:scale-95 group shadow-xl shadow-theme-main/10"
          >
            <Plus className="w-5 h-5 text-theme-primary group-hover:rotate-90 transition-transform duration-300" />
            YENİ SATIR EKLE
          </button>
        </div>
      </div>

      {/* Entry Table Body */}
      <div className="modern-glass-card p-0 overflow-hidden relative group">
        <div className="overflow-x-auto no-scrollbar resizable-table">
          <table className="w-full border-collapse table-fixed min-w-[1550px]">
            <thead>
              <tr className="bg-theme-surface/50 border-b border-theme">
                <th className="px-4 py-4 text-left text-[10px] font-black text-theme-dim tracking-[0.2em] w-[140px] uppercase">
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-theme-primary" /> TARİH</div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-theme-dim tracking-[0.2em] w-[180px] uppercase">
                  <div className="flex items-center gap-2"><Factory className="w-3.5 h-3.5 text-theme-primary" /> MAKİNE</div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-theme-dim tracking-[0.2em] w-[180px] uppercase">
                  <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-theme-primary" /> VARDİYA</div>
                </th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[100px] uppercase">
                  <div className="flex items-center justify-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-rose-400" /> ARIZA</div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-theme-dim tracking-[0.2em] w-[200px] uppercase">
                  <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-theme-primary" /> OPERATÖR</div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-theme-dim tracking-[0.2em] w-[200px] uppercase">
                  <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-theme-primary" /> ÜRÜN</div>
                </th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[120px] uppercase underline decoration-theme-success/30 underline-offset-8">ÜRETİLEN</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[120px] uppercase underline decoration-theme-danger/30 underline-offset-8">HATALI</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[120px] uppercase underline decoration-theme-primary/30 underline-offset-8">BİRİM (s)</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[120px] uppercase underline decoration-theme-warning/30 underline-offset-8">PLANLI (dk)</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-theme-dim tracking-[0.2em] w-[190px] uppercase">ETKİN SURE</th>
                <th className="px-4 py-4 text-center w-24 text-[10px] font-black text-theme-dim tracking-[0.2em] uppercase">AKSİYON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/30">
              {entries.map((entry) => {
                const isDown = entry.isDowntime;
                return (
                  <tr key={entry.id} className={`transition-all group/row ${isDown ? 'bg-rose-500/5 hover:bg-rose-500/8' : 'hover:bg-theme-primary/5'}`}>
                    {/* Date */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={entry.productionDate}
                        onChange={e => updateEntry(entry.id, 'productionDate', e.target.value)}
                        className="w-full h-10 bg-theme-base border border-theme focus:border-theme-primary/50 rounded-xl px-3 text-theme-main font-black text-xs focus:outline-none transition-all shadow-inner text-center"
                        max={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                      />
                    </td>

                    {/* Machine */}
                    <td className="px-2 py-2">
                      <CustomSelect
                        value={entry.machineId}
                        onChange={val => updateEntry(entry.id, 'machineId', val)}
                        options={machineOptions}
                        placeholder="Makine..."
                      />
                    </td>

                    {/* Vardiya */}
                    <td className="px-2 py-2">
                      <CustomSelect
                        value={entry.shiftId}
                        onChange={val => updateEntry(entry.id, 'shiftId', val)}
                        options={shiftOptions}
                        placeholder="Vardiya..."
                      />
                    </td>

                    {/* Arıza/Bakım Switch */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          title="Arıza / Bakım"
                          onClick={() => updateEntry(entry.id, 'isDowntime', !isDown)}
                          className={`relative h-6.25 w-11 rounded-full border transition-all duration-300 ${isDown
                            ? 'bg-rose-500 border-rose-500 shadow-lg shadow-rose-500/30'
                            : 'bg-theme-main/5 border-theme-border'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4.75 w-4.75 rounded-full transition-all duration-300 flex items-center justify-center ${isDown
                              ? 'left-[22px] bg-white'
                              : 'left-0.5 bg-white shadow-sm'
                              }`}
                          >
                            {isDown && <Wrench className="w-2.5 h-2.5 text-rose-500" />}
                          </span>
                        </button>
                        {isDown && (
                          <span className="text-[8px] font-black text-rose-400 leading-none">Arıza / Bakım</span>
                        )}
                      </div>
                    </td>

                    {/* Operator */}
                    <td className={`px-2 py-2 transition-opacity ${isDown ? 'opacity-30 pointer-events-none' : ''}`}>
                      <CustomSelect
                        value={entry.operatorId}
                        onChange={val => updateEntry(entry.id, 'operatorId', val)}
                        options={operatorOptions}
                        placeholder="Operatör..."
                        disabled={isDown}
                      />
                    </td>

                    {/* Product */}
                    <td className={`px-2 py-2 transition-opacity ${isDown ? 'opacity-30 pointer-events-none' : ''}`}>
                      <CustomSelect
                        value={entry.productId}
                        onChange={val => updateEntry(entry.id, 'productId', val)}
                        options={productOptions}
                        placeholder="Ürün Seçiniz..."
                        disabled={isDown}
                      />
                    </td>

                    {/* Quantities */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={isDown ? '' : (entry.producedQuantity || '')}
                        onChange={e => updateEntry(entry.id, 'producedQuantity', parseInt(e.target.value))}
                        disabled={isDown}
                        className={`w-full h-10 bg-theme-base border border-theme focus:border-theme-success/50 rounded-xl px-4 text-center text-theme-main font-black text-sm focus:outline-none focus:ring-4 focus:ring-theme-success/10 transition-all shadow-inner disabled:opacity-30 disabled:cursor-not-allowed`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={isDown ? '' : (entry.defectQuantity || '')}
                        onChange={e => updateEntry(entry.id, 'defectQuantity', parseInt(e.target.value))}
                        disabled={isDown}
                        className="w-full h-10 bg-theme-base border border-theme focus:border-theme-danger/50 rounded-xl px-4 text-center text-theme-main font-black text-sm focus:outline-none focus:ring-4 focus:ring-theme-danger/10 transition-all shadow-inner disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={isDown ? '' : (entry.cycleTimeSeconds || '')}
                        onChange={e => updateEntry(entry.id, 'cycleTimeSeconds', parseFloat(e.target.value))}
                        disabled={isDown}
                        className="w-full h-10 bg-theme-base border border-theme focus:border-theme-primary/50 rounded-xl px-4 text-center text-theme-main font-black text-sm focus:outline-none transition-all shadow-inner disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={isDown ? '' : (entry.plannedDowntimeMinutes || '')}
                        onChange={e => updateEntry(entry.id, 'plannedDowntimeMinutes', parseInt(e.target.value))}
                        disabled={isDown}
                        className="w-full h-10 bg-theme-base border border-theme focus:border-theme-warning/50 rounded-xl px-4 text-center text-theme-main font-black text-sm focus:outline-none transition-all shadow-inner disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className={`flex items-center gap-2 ${isDown ? 'opacity-30 pointer-events-none' : ''}`}>
                        <button
                          type="button"
                          onClick={() => updateEntry(entry.id, 'isManualDurationEnabled', !entry.isManualDurationEnabled)}
                          disabled={isDown}
                          className={`relative h-6.5 w-19 rounded-full border transition-all ${entry.isManualDurationEnabled ? 'bg-theme-primary border-theme-primary' : 'bg-theme-main/5 border-theme-border'}`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm shadow-theme-main/10 transition-all ${entry.isManualDurationEnabled ? 'left-6' : 'left-0.75'}`}
                          />
                        </button>
                        <input
                          type="number"
                          min={1}
                          placeholder="dk"
                          value={entry.effectiveDurationMinutes || ''}
                          onChange={(e) => updateEntry(entry.id, 'effectiveDurationMinutes', parseInt(e.target.value))}
                          disabled={!entry.isManualDurationEnabled || isDown}
                          className="w-full h-10 bg-theme-base border border-theme focus:border-theme-primary/50 rounded-xl px-4 text-center text-theme-main font-black text-sm focus:outline-none transition-all shadow-inner disabled:opacity-40"
                        />
                      </div>
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-2 pr-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => duplicateEntry(entry.id)}
                          className="p-2 rounded-xl hover:bg-theme-primary/10 hover:text-theme-primary transition-all border border-transparent hover:border-theme-primary/20 text-theme-dim"
                          title="Satırı kopyala"
                        >
                          <CopyPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className={`p-2 rounded-xl hover:bg-theme-danger/10 hover:text-theme-danger transition-all border border-transparent hover:border-theme-danger/20 ${entries.length <= 1 ? 'opacity-20' : 'text-theme-dim'}`}
                          disabled={entries.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons in footer of the table container */}
        <div className="p-2 border-t border-theme bg-theme-surface/50 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4 text-theme-dim font-black text-[10px] uppercase tracking-widest opacity-60">
            <div className="w-8 h-8 rounded-full bg-theme-base border border-theme flex items-center justify-center text-xs">
              {entries.length}
            </div>
            TOPLAM SATIR SAYISI
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto">
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="px-10 py-5 text-theme-dim hover:text-theme-main font-black text-xs uppercase tracking-widest transition-all hover:scale-105"
            >
              İPTAL
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-xs uppercase transition-all active:scale-95 shadow-2xl ${saving ? 'bg-theme-surface text-theme-dim border border-theme cursor-not-allowed' : 'bg-theme-primary hover:bg-theme-primary-hover text-white shadow-theme-primary/30'
                }`}
            >
              {saving ? <Loading size="sm" /> : <Save className="w-4 h-4" />}
              Kayıtları Oluştur
            </button>
          </div>
        </div>
      </div>

      {/* Helper Alert */}
      <div className="flex items-center gap-3 p-2 rounded-2xl bg-theme-primary/5 border border-theme-primary/10 text-theme-primary text-xs font-black leading-relaxed shadow-lg">
        <div className="w-12 h-12 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20 shrink-0">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-0">
          <p className="opacity-90">Klavye İpucu: Bir üstteki satırdan Tab tuşu ile hızlıca ilerleyebilirsiniz.</p>
          <p className="opacity-50">Seçilen operatör ve vardiya bilgileri yeni satırlara otomatik olarak aktarılır.</p>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => navigate('/records')}
        title="Girişten Çıkılıyor"
        message="Doldurduğunuz tüm taslak veriler kaybolacak. Çıkmak istediğinize emin misiniz?"
        type="danger"
        confirmLabel="EVET, ÇIK"
        cancelLabel="VAZGEÇ"
      />
    </div>
  );
}

export default BulkRecordEntry;
