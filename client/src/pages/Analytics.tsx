import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Activity, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, XCircle, Calendar, BarChart3, Target } from 'lucide-react';
import { Loading } from '../components/common/Loading';

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [oeeTrend, setOeeTrend] = useState<any[]>([]);
  const [machineEff, setMachineEff] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState(7); // default 7 days
  const [startDate, setStartDate] = useState(''); // yyyy-MM-dd
  const [endDate, setEndDate] = useState(''); // yyyy-MM-dd
  const [reportSort, setReportSort] = useState<{
    key: 'machine' | 'producedQuantity' | 'plannedQuantity' | 'downtimeMinutes' | 'averageOee' | 'achievementRate';
    dir: 'asc' | 'desc';
  }>({
    key: 'producedQuantity',
    dir: 'desc',
  });

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (!startDate && !endDate) params.set('days', String(timeRange));
    return params.toString();
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const q = buildQuery();
        const [trendRes, effRes] = await Promise.all([
          api.get(`/analytics/oee-trend${q ? `?${q}` : ''}`),
          api.get(`/analytics/machine-efficiency${q ? `?${q}` : ''}`)
        ]);
        setOeeTrend(trendRes);
        setMachineEff(effRes);
      } catch (e) {
        console.error('Failed to load analytics', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [timeRange, startDate, endDate]);

  if (loading) return <Loading size="lg" fullScreen />;

  const totalProduced = machineEff.reduce((sum, m) => sum + (m.producedQuantity || 0), 0);
  const totalDowntime = machineEff.reduce((sum, m) => sum + (m.downtimeMinutes || 0), 0);
  const totalPlanned = machineEff.reduce((sum, m) => sum + (m.plannedQuantity || 0), 0);
  const totalRecordCount = machineEff.reduce((sum, m) => sum + (m.recordCount || 0), 0);
  const totalOeeSum = machineEff.reduce((sum, m) => sum + (m.oeeSum || 0), 0);
  const totalAvgOee = totalRecordCount > 0 ? (totalOeeSum / totalRecordCount) : 0;
  const totalAchievement = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
  const dateLabel = (startDate || endDate)
    ? `${startDate || endDate} → ${endDate || startDate}`
    : `Son ${timeRange} gün`;

  const reportRows = machineEff
    .slice()
    .sort((a: any, b: any) => {
      const { key, dir } = reportSort;
      const va = a[key];
      const vb = b[key];

      if (key === 'machine') {
        const sa = String(va ?? '');
        const sb = String(vb ?? '');
        const c = sa.localeCompare(sb, 'tr', { numeric: true, sensitivity: 'base' });
        return dir === 'asc' ? c : -c;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return dir === 'asc' ? (na - nb) : (nb - na);
    });

  const toggleReportSort = (key: typeof reportSort.key) => {
    setReportSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const SortIcon = ({ col }: { col: typeof reportSort.key }) => {
    if (reportSort.key !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return reportSort.dir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-theme-primary" />
      : <ArrowDown className="w-3.5 h-3.5 text-theme-primary" />;
  };

  return (
    <div className="p-6 lg:p-10 w-full min-h-screen bg-theme-base space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="text-4xl font-black text-theme-main tracking-tight uppercase flex items-center gap-4">
            <BarChart3 className="w-12 h-12 text-theme-primary" /> GELİŞMİŞ ANALİTİK
          </h2>
          <p className="text-theme-dim text-xs font-bold uppercase tracking-widest mt-2 opacity-60">PERFORMANS, VERİMLİLİK VE TREND ANALİZ PLATFORMU</p>
        </div>

        {/* Filter Container */}
        <div className="bg-theme-card backdrop-blur-2xl border border-theme rounded-2xl p-2 shadow-2xl ring-1 ring-white/5">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex bg-theme-base rounded-2xl p-1 gap-1">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => { setTimeRange(days); setStartDate(''); setEndDate(''); }}
                  className={`px-6 h-10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!startDate && !endDate && timeRange === days ? 'bg-theme-primary text-white shadow-xl shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main hover:bg-theme-main/5'}`}
                >
                  {days} GÜN
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-10 bg-theme self-center"></div>

            <div className="flex items-center gap-3 bg-theme-base rounded-2xl px-4 h-12">
              <Calendar className="w-4 h-4 text-theme-primary/40" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-xs text-theme-main font-black focus:outline-none placeholder-theme-dim w-28"
              />
              <span className="text-theme-dim opacity-30 font-black">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-xs text-theme-main font-black focus:outline-none placeholder-theme-dim w-28"
              />
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="p-2 text-theme-danger hover:bg-theme-danger/10 rounded-xl transition-all">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overviews */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <KpiBox label="PLANLANAN" value={totalPlanned.toLocaleString()} color="primary" />
        <KpiBox label="TOPLAM ÜRETİM" value={totalProduced.toLocaleString()} color="success" />
        <KpiBox label="TOPLAM DURUŞ" value={`${totalDowntime.toLocaleString()} DK`} color="danger" />
        <KpiBox label="ORTALAMA OEE" value={`%${totalAvgOee.toFixed(1)}`} color="primary" />
        <KpiBox label="HEDEF ULAŞIM" value={`%${totalAchievement.toFixed(1)}`} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* OEE Trend Chart */}
        <div className="bg-theme-card backdrop-blur-3xl border border-theme rounded-2xl p-8 shadow-2xl ring-1 ring-white/5 min-h-[450px] flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-theme-primary/10 rounded-2xl border border-theme-primary/10">
              <Activity className="w-6 h-6 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-theme-main uppercase tracking-tight">Genel OEE Trendi</h3>
              <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest opacity-50 mt-1">{dateLabel}</p>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={oeeTrend}>
                <defs>
                  <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} opacity={0.4} />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fontWeight: 800 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)', borderRadius: '1rem', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
                  itemStyle={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 800 }}
                  labelStyle={{ fontWeight: 900, color: 'var(--primary)', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="oee" stroke="var(--primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorOee)" name="OEE %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pareto / Machine Downtime Chart */}
        <div className="bg-theme-card backdrop-blur-3xl border border-theme rounded-2xl p-8 shadow-2xl ring-1 ring-white/5 min-h-[450px] flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-theme-danger/10 rounded-2xl border border-theme-danger/10">
              <TrendingDown className="w-6 h-6 text-theme-danger" />
            </div>
            <div>
              <h3 className="text-xl font-black text-theme-main uppercase tracking-tight">Duruş Analizi (Pareto)</h3>
              <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest opacity-50 mt-1">En çok duruş yapan tezgahlar (Dakika)</p>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineEff.sort((a, b) => b.downtimeMinutes - a.downtimeMinutes)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} opacity={0.4} />
                <XAxis dataKey="machine" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)', borderRadius: '1rem' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 800 }}
                  labelStyle={{ fontWeight: 900, color: 'var(--danger)' }}
                />
                <Bar dataKey="downtimeMinutes" fill="var(--danger)" radius={[8, 8, 0, 0]} name="Duruş (dk)" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Table */}
      <div className="bg-theme-card backdrop-blur-3xl border border-theme rounded-2xl overflow-hidden shadow-22 shadow-black/5 ring-1 ring-white/5">
        <div className="p-8 border-b border-theme bg-theme-surface/30 flex items-center justify-between">
          <h3 className="text-xl font-black text-theme-main uppercase tracking-tight flex items-center gap-4">
            <Target className="w-6 h-6 text-theme-primary" /> Detaylı Performans Matrisi
          </h3>
          <span className="text-[10px] font-black text-theme-primary bg-theme-primary/10 px-4 py-2 rounded-full border border-theme-primary/20 uppercase tracking-[0.2em]">
            {machineEff.length} AKTİF TEZGAH ANALİZ EDİLİYOR
          </span>
        </div>
        <div className="overflow-x-auto text-left">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-theme-surface/20 text-theme-dim text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-6 w-1/5">
                  <button onClick={() => toggleReportSort('machine')} className="flex items-center gap-2 hover:text-theme-main transition-colors">
                    TEZGAH <SortIcon col="machine" />
                  </button>
                </th>
                <th className="px-8 py-6 w-1/5 text-right">
                  <button onClick={() => toggleReportSort('plannedQuantity')} className="flex items-center justify-end gap-2 hover:text-theme-main transition-colors w-full">
                    PLANLANAN <SortIcon col="plannedQuantity" />
                  </button>
                </th>
                <th className="px-8 py-6 w-1/5 text-right">
                  <button onClick={() => toggleReportSort('producedQuantity')} className="flex items-center justify-end gap-2 hover:text-theme-main transition-colors w-full">
                    ÜRETİM <SortIcon col="producedQuantity" />
                  </button>
                </th>
                <th className="px-8 py-6 w-1/5 text-right">
                  <button onClick={() => toggleReportSort('downtimeMinutes')} className="flex items-center justify-end gap-2 hover:text-theme-main transition-colors w-full">
                    DURUŞ (DK) <SortIcon col="downtimeMinutes" />
                  </button>
                </th>
                <th className="px-8 py-6 w-1/5 text-right">
                  <button onClick={() => toggleReportSort('averageOee')} className="flex items-center justify-end gap-2 hover:text-theme-main transition-colors w-full">
                    OEE % <SortIcon col="averageOee" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/30 font-bold">
              {reportRows.map((m: any, idx) => (
                <tr key={idx} className="group hover:bg-theme-primary/5 transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-theme-base border border-theme rounded-xl flex items-center justify-center font-black text-theme-primary text-xs shadow-sm group-hover:bg-theme-primary group-hover:text-white transition-all">
                        {m.machine.substring(0, 2)}
                      </div>
                      <span className="text-theme-main font-black tracking-tight">{m.machine}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right text-theme-dim">{m.plannedQuantity?.toLocaleString()}</td>
                  <td className="px-8 py-6 text-right text-theme-success">{(m.producedQuantity || 0).toLocaleString()}</td>
                  <td className="px-8 py-6 text-right text-theme-danger font-black">{m.downtimeMinutes?.toLocaleString()} <span className="text-[10px] opacity-40">dk</span></td>
                  <td className="px-8 py-6 text-right">
                    <span className={`px-4 py-1.5 rounded-xl font-black text-xs border tracking-tighter shadow-sm ${m.averageOee >= 80 ? 'bg-theme-success/10 text-theme-success border-theme-success/20' :
                      m.averageOee >= 60 ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' :
                        'bg-theme-danger/10 text-theme-danger border-theme-danger/20'
                      }`}>
                      %{m.averageOee.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string, value: string, color: 'primary' | 'success' | 'warning' | 'danger' }) {
  const colors: any = {
    primary: 'border-theme-primary/20 bg-theme-primary/5 text-theme-primary',
    success: 'border-theme-success/20 bg-theme-success/5 text-theme-success',
    warning: 'border-theme-warning/20 bg-theme-warning/5 text-theme-warning',
    danger: 'border-theme-danger/20 bg-theme-danger/5 text-theme-danger'
  };

  return (
    <div className={`backdrop-blur-xl border-2 ${colors[color]} p-6 rounded-2xl shadow-xl hover:scale-105 transition-all duration-300 group overflow-hidden relative`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">{label}</p>
      <p className="text-2xl font-black text-theme-main tracking-tighter">{value}</p>
      <div className="mt-4 flex items-center gap-1 opacity-20">
        {[1, 2, 3].map(i => <div key={i} className={`w-1 h-3 rounded-full bg-current ${i === 3 && 'animate-pulse'}`}></div>)}
      </div>
    </div>
  );
}

export default Analytics;
