import { X, Clock, Factory, Users, Package, Settings, AlertTriangle, Layers, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '../../lib/utils';

interface RecordDetailModalProps {
  record: any;
  onClose: () => void;
}

// Helper for Turkish characters in uppercase
const toTRUpper = (str: string) => (str || '').toLocaleUpperCase('tr-TR');

export function RecordDetailModal({ record, onClose }: RecordDetailModalProps) {
  if (!record) return null;

  const stats = [
    { label: 'OEE (Verimlilik)', value: `%${record.oee.toFixed(1)}`, color: 'text-theme-primary', icon: Activity },
    { label: 'Performans', value: `%${record.performance.toFixed(1)}`, color: 'text-emerald-400', icon: Activity },
    { label: 'Müsaitlik', value: `%${record.availability.toFixed(1)}`, color: 'text-amber-400', icon: Activity },
    { label: 'Kalite', value: `%${record.quality.toFixed(1)}`, color: 'text-rose-400', icon: Activity },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-hidden bg-theme-base/60 backdrop-blur-xl animate-in fade-in duration-500">
      <div
        className="relative w-full max-w-5xl bg-theme-base border border-theme rounded-2xl shadow-[0_32px_80px_-16px_rgba(0,0,0,0.6)] flex flex-col max-h-[92vh] overflow-hidden scale-in duration-500 ring-1 ring-white/5"
      >

        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-theme-primary/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-theme-primary/5 blur-[100px] rounded-full" />

        {/* Header */}
        <div className="p-8 md:p-10 border-b border-theme/50 flex items-center justify-between bg-theme-surface/50 backdrop-blur-3xl relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20 shadow-inner group">
              <Clock className="w-8 h-8 text-theme-primary group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-theme-main tracking-tight leading-none mb-2">
                {toTRUpper('Üretim Kaydı Detayları')}
              </h3>
              <p className="text-theme-dim text-xs font-black tracking-widest flex items-center gap-2 opacity-60">
                İŞLEM ID: <span className="font-mono text-theme-primary">{record.id.toUpperCase()}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-theme-base border border-theme rounded-2xl text-theme-dim hover:text-white hover:bg-theme-danger/20 hover:border-theme-danger/30 transition-all duration-300 active:scale-90 group"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar relative z-10">

          {/* OEE Stats Grid - Premium Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-theme-surface/30 rounded-2xl p-6 border border-theme/20 flex flex-col items-center text-center group hover:bg-theme-surface/60 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1">
                <div className={cn(
                  "p-4 rounded-2xl bg-theme-base mb-4 shadow-xl ring-1 ring-white/5 transition-transform duration-500 group-hover:scale-110",
                  stat.color
                )}>
                  <stat.icon size={24} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-dim mb-2 opacity-60">{toTRUpper(stat.label)}</p>
                <p className={cn("text-2xl font-black tracking-tighter", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Context Information */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px bg-theme-primary/30 flex-1" />
                <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-[0.3em] flex items-center gap-2 shrink-0">
                  <Layers className="w-4 h-4" /> {toTRUpper('KAPSAM BİLGİLERİ')}
                </h4>
                <div className="h-px bg-theme-primary/30 flex-1" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <DetailCard icon={Clock} label="Üretim Tarihi" value={format(new Date(record.productionDate), 'd MMMM yyyy, EEEE', { locale: tr })} />
                <DetailCard icon={Factory} label="Tezgah" value={`${record.machine.code} - ${record.machine.name}`} />
                <DetailCard icon={Users} label="Operatör" value={record.operator.fullName} />
                <DetailCard icon={Clock} label="Vardiya" value={`${record.shift.shiftName} (${record.shift.shiftCode})`} />
              </div>
            </div>

            {/* Production & Units Information */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px bg-theme-primary/30 flex-1" />
                <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-[0.3em] flex items-center gap-2 shrink-0">
                  <Package className="w-4 h-4" /> {toTRUpper('ÜRETİM & BİRİM VERİLERİ')}
                </h4>
                <div className="h-px bg-theme-primary/30 flex-1" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <DetailCard icon={Package} label="Ürün" value={`${record.product.productCode} - ${record.product.productName}`} subValue={record.product.productGroup ? `Grup: ${record.product.productGroup}` : undefined} />
                <div className="grid grid-cols-2 gap-4">
                  <DetailCard label="Planlanan Adet" value={record.plannedQuantity || 0} unit="Adet" />
                  <DetailCard label="Üretilen Adet" value={record.producedQuantity} unit="Adet" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DetailCard label="Hatalı Adet" value={record.defectQuantity || 0} unit="Adet" color="text-rose-400" />
                  <DetailCard label="Cycle Time (Birim)" value={record.cycleTimeSeconds} unit="sn" color="text-theme-primary" />
                </div>
              </div>
            </div>

            {/* Duration Detailed Breakdown */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-px bg-theme-primary/30 flex-1" />
                <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-[0.3em] flex items-center gap-2 shrink-0">
                  <Settings className="w-4 h-4" /> {toTRUpper('SÜRE VE DURUŞ DETAYLARI')}
                </h4>
                <div className="h-px bg-theme-primary/30 flex-1" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <DetailCard label="Vardiya Süresi" value={record.shift.durationMinutes || 0} unit="dk" color="text-theme-primary" />
                <DetailCard label="Gerçek Çalışma" value={record.actualDurationMinutes} unit="dk" color="text-amber-400" />
                <DetailCard label="Tezgah Beklenen" value={record.plannedDurationMinutes.toFixed(1) || 0} unit="dk" />
                <DetailCard label="Planlı Duruş" value={record.plannedDowntimeMinutes || 0} unit="dk" />
                <DetailCard label="Plansız Duruş" value={record.unplannedDowntimeMinutes || 0} unit="dk" color="text-rose-400" />
              </div>
              <div className="bg-theme-danger/5 rounded-2xl p-6 border border-theme-danger/20 flex items-center justify-between group transition-all duration-300 hover:bg-theme-danger/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-theme-danger/10 flex items-center justify-center border border-theme-danger/20 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="text-theme-danger" size={24} />
                  </div>
                  <span className="text-[11px] font-black text-theme-danger uppercase tracking-[0.2em]">{toTRUpper('Toplam Duruş Süresi')}</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-theme-main tracking-tighter">{record.downtimeMinutes}</span>
                  <span className="text-xs font-black text-theme-dim uppercase ml-2 opacity-50">Dakika</span>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {record.notes && (
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-4">
                  <h4 className="text-[10px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">{toTRUpper('NOTLAR VE AÇIKLAMALAR')}</h4>
                  <div className="h-px bg-theme flex-1 opacity-10" />
                </div>
                <div className="bg-theme-surface/40 p-8 rounded-2xl border border-theme/20 text-theme-main text-sm font-bold italic leading-relaxed relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-theme-primary/30 group-hover:bg-theme-primary transition-colors" />
                  "{record.notes}"
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-8 md:p-10 bg-theme-surface/50 border-t border-theme/50 flex justify-end gap-4 relative z-10 backdrop-blur-2xl">
          <button
            onClick={onClose}
            className="px-10 py-4 bg-theme-surface border border-theme text-theme-dim font-black text-xs uppercase tracking-widest rounded-2xl transition-all duration-300 hover:text-white hover:bg-theme-primary hover:border-theme-primary shadow-xl hover:shadow-theme-primary/20 active:scale-95"
          >
            {toTRUpper('Kapat')}
          </button>
        </div>

      </div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value, subValue, unit = '', color = 'text-theme-main' }: any) {
  return (
    <div className="bg-theme-surface/20 p-5 rounded-2xl border border-theme/10 flex flex-col gap-2 ring-1 ring-transparent hover:ring-white/10 transition-all duration-300 group">
      <div className="flex items-center gap-2 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
        {Icon && <Icon size={14} className="text-theme-primary" />}
        <span className="text-[9px] font-black text-theme-dim uppercase tracking-[0.2em]">{toTRUpper(label)}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-lg font-black tracking-tight truncate transition-colors", color)}>{value}</span>
        {unit && <span className="text-[10px] font-black text-theme-dim uppercase opacity-40">{toTRUpper(unit)}</span>}
      </div>
      {subValue && <span className="text-[9px] text-theme-dim italic mt-1 font-bold opacity-40">{subValue}</span>}
    </div>
  )
}
