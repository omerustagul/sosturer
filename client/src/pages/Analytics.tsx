import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Activity, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, XCircle, Calendar, BarChart3, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loading } from '../components/common/Loading';
import { CustomSelect } from '../components/common/CustomSelect';

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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

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
        setOeeTrend(Array.isArray(trendRes) ? trendRes : []);
        setMachineEff(Array.isArray(effRes) ? effRes : []);
      } catch (e) {
        console.error('Failed to load analytics', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [timeRange, startDate, endDate]);

  if (loading) return <Loading size="lg" fullScreen />;

  const safeEff = Array.isArray(machineEff) ? machineEff : [];
  const totalProduced = safeEff.reduce((sum, m) => sum + (m.producedQuantity || 0), 0);
  const totalDowntime = safeEff.reduce((sum, m) => sum + (m.downtimeMinutes || 0), 0);
  const totalPlanned = safeEff.reduce((sum, m) => sum + (m.plannedQuantity || 0), 0);
  const totalRecordCount = safeEff.reduce((sum, m) => sum + (m.recordCount || 0), 0);
  const totalOeeSum = safeEff.reduce((sum, m) => sum + (m.oeeSum || 0), 0);
  const totalAvgOee = totalRecordCount > 0 ? (totalOeeSum / totalRecordCount) : 0;
  const totalAchievement = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
  const dateLabel = (startDate || endDate)
    ? `${startDate || endDate} → ${endDate || startDate}`
    : `Son ${timeRange} gün`;

  const reportRows = safeEff
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

  const paginatedRows = reportRows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.ceil(reportRows.length / pageSize);

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
    <div className="p-4 lg:p-6 w-full min-h-screen bg-theme-base space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="text-xl font-black text-theme-main tracking-tight uppercase flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-theme-primary" /> GELİŞMİŞ ANALİTİK
          </h2>
          <p className="text-theme-dim text-xs font-bold mt-1">Performans, Verimlilik ve Trend Analiz Platformu</p>
        </div>

        {/* Filter Container */}
        <div className="modern-glass-card p-1 border border-theme-main-20">
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
        <div className="modern-glass-card min-h-[450px] flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-2 bg-theme-primary/10 rounded-lg border border-theme-primary/10">
              <Activity className="w-4 h-4 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-md font-black text-theme-main uppercase tracking-tight">Genel OEE Trendi</h3>
              <p className="text-[12px] text-theme-dim font-bold opacity-50 mt-0.2">{dateLabel}</p>
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
        <div className="modern-glass-card min-h-[450px] flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-2 bg-theme-danger/10 rounded-lg border border-theme-danger/10">
              <TrendingDown className="w-4 h-4 text-theme-danger" />
            </div>
            <div>
              <h3 className="text-md font-black text-theme-main uppercase tracking-tight">Duruş Analizi (Pareto)</h3>
              <p className="text-[12px] text-theme-dim font-bold opacity-50 mt-0.2">En çok duruş yapan makineler (Dakika)</p>
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
      <div className="modern-glass-card p-0">
        <div className="p-4 border-b border-theme bg-theme-surface/30 flex items-center justify-between">
          <h3 className="text-md font-black text-theme-main uppercase tracking-tight flex items-center gap-4">
            <Target className="w-6 h-6 text-theme-primary" /> Detaylı Performans Matrisi
          </h3>
          <span className="text-[10px] font-black text-theme-primary bg-theme-primary/10 px-4 py-2 rounded-full border border-theme-primary/20">
            {machineEff.length} AKTİF MAKİNE ANALİZ EDİLİYOR
          </span>
        </div>
        <div className="overflow-x-auto text-left">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-theme-surface/20 text-theme-dim text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-4 w-1/5">
                  <button onClick={() => toggleReportSort('machine')} className="flex items-center gap-2 hover:text-theme-main transition-colors">
                    MAKİNE <SortIcon col="machine" />
                  </button>
                </th>
                <th className="px-4 py-4 w-1/5 text-left">
                  <button onClick={() => toggleReportSort('plannedQuantity')} className="flex items-center justify-start gap-2 hover:text-theme-main transition-colors w-full">
                    PLANLANAN <SortIcon col="plannedQuantity" />
                  </button>
                </th>
                <th className="px-4 py-4 w-1/5 text-left">
                  <button onClick={() => toggleReportSort('producedQuantity')} className="flex items-center justify-start gap-2 hover:text-theme-main transition-colors w-full">
                    ÜRETİM <SortIcon col="producedQuantity" />
                  </button>
                </th>
                <th className="px-4 py-4 w-1/5 text-left">
                  <button onClick={() => toggleReportSort('downtimeMinutes')} className="flex items-center justify-start gap-2 hover:text-theme-main transition-colors w-full">
                    DURUŞ (DK) <SortIcon col="downtimeMinutes" />
                  </button>
                </th>
                <th className="px-4 py-4 w-1/5 text-left">
                  <button onClick={() => toggleReportSort('averageOee')} className="flex items-center justify-start gap-2 hover:text-theme-main transition-colors w-full">
                    OEE % <SortIcon col="averageOee" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/30 font-bold">
              {paginatedRows.map((m: any, idx) => (
                <tr key={idx} className="group hover:bg-theme-primary/5 transition-all">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-8 bg-theme-base border border-theme rounded-xl flex items-center justify-center font-black text-theme-primary text-xs shadow-sm group-hover:bg-theme-primary group-hover:text-white transition-all">
                        {m.machine.substring(0, 3)}
                      </div>
                      <span className="text-theme-main text-xs font-black tracking-tight">{m.machine}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-left text-theme-dim">{m.plannedQuantity?.toLocaleString()}</td>
                  <td className="px-4 py-4 text-xs text-left text-theme-success">{(m.producedQuantity || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-xs text-left text-theme-danger font-black">{m.downtimeMinutes?.toLocaleString()} <span className="text-[10px] opacity-40">dk</span></td>
                  <td className="px-4 py-4 text-xs text-left">
                    <span className={`px-2 py-1 rounded-xl font-black text-xs border tracking-tighter shadow-sm ${m.averageOee >= 80 ? 'bg-theme-success/10 text-theme-success border-theme-success/20' :
                      m.averageOee >= 60 ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' :
                        'bg-theme-danger/10 text-xs text-theme-danger border-theme-danger/20'
                      }`}>
                      %{m.averageOee.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase tracking-widest">SAYFADA:</span>
              <div className="w-24">
                <CustomSelect
                  options={[
                    { id: 10, label: '10' },
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
            <span className="text-[11px] font-black text-theme-dim uppercase tracking-widest">
              TOPLAM <span className="text-theme-primary">{reportRows.length}</span> KAYIT
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
    <div className={`modern-glass-card ${colors[color]} hover:scale-105 transition-all duration-300 group overflow-hidden relative`}>
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
