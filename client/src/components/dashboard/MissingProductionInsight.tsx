import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, List, Download, AlertCircle } from 'lucide-react';
import { CustomSelect } from '../common/CustomSelect';
import { cn } from '../../lib/utils';

export interface MissingProductionPayload {
  summary?: {
    missingEntries: number;
    missingDaysCount: number;
    uniqueMachines?: number;
    uniqueShifts?: number;
    rangeStart?: string;
    rangeEnd?: string;
  };
  byMachine?: Array<{
    machineId: string;
    machineCode: string;
    machineName: string;
    missingCount: number;
    missingDates: string[];
    missingShifts?: Array<{ date: string; shiftName: string; shiftId: string }>;
  }>;
  missingRecords?: Array<{
    date: string;
    machineId: string;
    machineCode: string;
    machineName: string;
    shiftId: string;
    shiftName: string;
  }>;
}

type Props = {
  data: MissingProductionPayload | null;
  machines: Array<{ id: string; code: string; name?: string }>;
  compact?: boolean;
  title?: string;
};

export function MissingProductionInsight({ data, machines, compact, title = 'Eksik Üretim Kaydı Uyarısı' }: Props) {
  const [filterMachine, setFilterMachine] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'simple' | 'daily' | 'list'>('simple');
  // const [expandedMachine, setExpandedMachine] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const rows = data?.missingRecords || [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterMachine !== 'all' && r.machineId !== filterMachine) return false;
      if (q && !`${r.machineCode} ${r.machineName} ${r.shiftName} ${r.date}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data?.missingRecords, filterMachine, search]);

  const machineSummary = useMemo(() => {
    const map: Record<string, { machineId: string; machineCode: string; missingDates: string[] }> = {};
    filteredRecords.forEach(r => {
      if (!map[r.machineId]) {
        map[r.machineId] = { machineId: r.machineId, machineCode: r.machineCode, missingDates: [] };
      }
      if (!map[r.machineId].missingDates.includes(r.date)) {
        map[r.machineId].missingDates.push(r.date);
      }
    });
    return Object.values(map).sort((a, b) => a.machineCode.localeCompare(b.machineCode));
  }, [filteredRecords]);

  if (!data?.summary || data.summary.missingEntries === 0) return null;

  const exportCsv = () => {
    const header = 'Tarih;Makine Kodu;Vardiya';
    const lines = (data.missingRecords || []).map((r) => `${r.date};${r.machineCode};${r.shiftName}`);
    const blob = new Blob([`\uFEFF${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eksik_recordlar.csv`;
    a.click();
  };

  return (
    <div className={cn(
      "modern-glass-card border border-rose-500/20 bg-rose-500/5 animate-in fade-in slide-in-from-top-4 duration-500",
      compact ? "p-4" : "p-6"
    )}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shrink-0">
            <AlertCircle className="w-6 h-6 text-rose-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-theme-main uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold text-theme-dim mt-1 opacity-70">
              Sistem tarafından tespit edilen girilmemiş üretim verileri.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-500 uppercase tracking-widest">
                {data.summary.missingEntries} EKSİK KAYIT
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-theme-base/50 border border-theme text-[9px] font-black text-theme-dim uppercase tracking-widest">
                {data.summary.uniqueMachines} MAKİNE
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 bg-theme-base/50 p-1 rounded-xl border border-theme shadow-inner">
            {[
              { id: 'simple', icon: List, label: 'Özet' },
              { id: 'daily', icon: Calendar, label: 'Günlük' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3 rounded-lg text-[9px] font-black uppercase transition-all",
                  view === t.id ? "bg-theme-main text-theme-base shadow-lg" : "text-theme-dim hover:text-theme-main"
                )}
              >
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="p-2.5 rounded-xl border border-theme hover:bg-theme-surface transition-all text-theme-dim">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Filters (Only in non-compact or if visible) */}
      {!compact && (
        <div className="flex flex-wrap gap-4 mb-6 pt-4 border-t border-theme/30">
          <div className="w-48">
            <CustomSelect
              options={[{ id: 'all', label: 'TÜM MAKİNELER' }, ...machines.map(m => ({ id: m.id, label: m.code }))]}
              value={filterMachine}
              onChange={setFilterMachine}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tarih veya kod ara..."
              className="h-10 w-full bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main focus:border-rose-500/50 transition-all outline-none"
            />
          </div>
        </div>
      )}

      {/* Main Content - Simple View (New Grid Style) */}
      {view === 'simple' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
          {machineSummary.map(m => (
            <div
              key={m.machineId}
              className="bg-theme-base/30 border border-theme hover:border-rose-500/30 rounded-2xl p-4 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-black text-theme-main uppercase tracking-wider">{m.machineCode}</span>
                </div>
                <span className="text-[9px] font-black text-rose-500/60 uppercase">{m.missingDates.length} GÜN EKSİK</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {m.missingDates.sort().map(date => {
                  const d = new Date(date + 'T12:00:00');
                  return (
                    <span
                      key={date}
                      className="px-2 py-1 rounded-lg bg-theme-surface/50 border border-theme text-[10px] font-bold text-theme-dim hover:text-rose-500 hover:border-rose-500/30 transition-all cursor-default"
                      title={d.toLocaleDateString('tr-TR', { weekday: 'long' })}
                    >
                      {formatDate(date)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily View (Accordions) */}
      {view === 'daily' && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
          {getDailyData(filteredRecords).map(day => (
            <div key={day.date} className="bg-theme-base/30 border border-theme rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-theme-surface/10">
                <span className="text-[11px] font-black text-theme-main uppercase tracking-widest">{formatFullDate(day.date)}</span>
                <span className="text-[10px] font-black text-rose-500 uppercase">{day.rows.length} KAYIT EKSİK</span>
              </div>
              <div className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {day.rows.map((r, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl bg-theme-base/20 border border-theme/50 flex flex-col items-center">
                    <span className="text-[10px] font-black text-theme-main">{r.machineCode}</span>
                    <span className="text-center italic opacity-40 text-[8px] font-bold text-theme-dim uppercase px-1">{r.shiftName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-theme/30 flex items-center gap-3">
        <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-500">
          <AlertTriangle size={14} />
        </div>
        <p className="text-[9px] font-bold text-theme-dim uppercase tracking-widest leading-relaxed">
          * Referans lokasyonun çalışma saatlerine göre filtrelenmiştir. Sadece tanımlı aktif makineler ve vardiyalar için beklenen kayıtlar gösterilmektedir.
        </p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}`;
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'short' });
}

function getDailyData(records: any[]) {
  const map: Record<string, any[]> = {};
  records.forEach(r => {
    if (!map[r.date]) map[r.date] = [];
    map[r.date].push(r);
  });
  return Object.keys(map).sort().map(d => ({ date: d, rows: map[d] }));
}
