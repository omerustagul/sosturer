import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  User,
  Users,
  Activity,
  Calendar,
  Download,
  Trophy,
  Package,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  History,
  Factory,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

export function ReportsOperators() {
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<any | null>(null);

  const [filters, setFilters] = useState({
    operatorId: 'all',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'avgOee',
    direction: 'desc'
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  useEffect(() => {
    async function init() {
      try {
        const o = await api.get('/operators');
        setOperators(o.filter((x: any) => x.status === 'active'));
      } catch (e) {
        console.error('Failed to load operators', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingRecords(true);
        const params = new URLSearchParams();
        if (filters.startDate) params.set('start', filters.startDate);
        if (filters.endDate) params.set('end', filters.endDate);

        const endpoint = `/production-records${params.toString() ? `?${params.toString()}` : ''}`;
        const data = await api.get(endpoint);
        setRecords(data);
      } catch (e) {
        console.error('Failed to load records', e);
      } finally {
        setLoadingRecords(false);
      }
    }
    if (!loading) loadData();
  }, [filters.startDate, filters.endDate, loading]);

  const filteredRecords = useMemo(() => {
    if (filters.operatorId === 'all') return records;
    return records.filter(r => r.operatorId === filters.operatorId);
  }, [records, filters.operatorId]);

  const operatorStats = useMemo(() => {
    const stats: Record<string, any> = {};

    filteredRecords.forEach(r => {
      const oId = r.operatorId || 'none';
      const oName = r.operator?.fullName || 'Bilinmiyor';

      if (!stats[oId]) {
        stats[oId] = {
          id: oId,
          name: oName,
          produced: 0,
          planned: 0,
          oeeSum: 0,
          count: 0,
          downtime: 0,
          defects: 0,
          time: 0,
          entries: []
        };
      }

      stats[oId].produced += r.producedQuantity || 0;
      stats[oId].planned += r.plannedQuantity || 0;
      stats[oId].oeeSum += r.oee || 0;
      stats[oId].count += 1;
      stats[oId].downtime += r.downtimeMinutes || 0;
      stats[oId].defects += r.defectQuantity || 0;
      stats[oId].time += r.shift?.durationMinutes || 480;
      stats[oId].entries.push(r);
    });

    return Object.values(stats).map(s => ({
      ...s,
      avgOee: Number((s.oeeSum / (s.count || 1)).toFixed(1)),
      efficiency: Number(((s.produced / (s.planned || 1)) * 100).toFixed(1))
    }));
  }, [filteredRecords]);

  const sortedOperators = useMemo(() => {
    return [...operatorStats].sort((a, b) => {
      const { key, direction } = sortConfig;
      const valA = a[key] || 0;
      const valB = b[key] || 0;
      const res = valA > valB ? 1 : valA < valB ? -1 : 0;
      return direction === 'asc' ? res : -res;
    });
  }, [operatorStats, sortConfig]);

  const paginatedOperators = useMemo(() => {
    return sortedOperators.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [sortedOperators, currentPage, pageSize]);

  const pageCount = Math.ceil(sortedOperators.length / pageSize);

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      await api.download(`/reports/excel/operators?${params.toString()}`, `Personel_Performans_Raporu.xlsx`);
    } catch (e) {
      alert('Dışa aktarma başarısız oldu.');
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in duration-700 bg-theme-base">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-theme-primary" /> PERSONEL VERİMLİLİK ANALİZİ
          </h2>
          <p className="text-theme-muted text-xs mt-1 font-medium">Personel bazlı üretim performansı, kalite skorları ve verimlilik karşılaştırmaları.</p>
        </div>
        <button
          onClick={exportToExcel}
          className="w-full lg:w-auto flex items-center justify-center gap-2 bg-theme-primary hover:bg-theme-primary-hover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
        >
          <Download className="w-5 h-5" /> EXCEL AKTAR
        </button>
      </div>

      <div className="modern-glass-card flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar size={12} /> BAŞLANGIÇ
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full bg-theme-base border border-theme rounded-xl px-4 py-2.5 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50"
          />
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar size={12} /> BİTİŞ
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full bg-theme-base border border-theme rounded-xl px-4 py-2.5 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50"
          />
        </div>
        <div className="flex-1 min-w-[240px] space-y-2">
          <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
            <User size={12} /> PERSONEL FİLTRESİ
          </label>
          <CustomSelect
            options={[{ id: 'all', label: 'Tüm Aktif Personeller' }, ...operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))]}
            value={filters.operatorId}
            onChange={(val) => setFilters(prev => ({ ...prev, operatorId: val }))}
          />
        </div>
      </div>

      {loadingRecords ? (
        <div className="py-20 flex flex-col items-center">
          <Loading size="lg" />
          <p className="text-theme-primary font-black text-xs uppercase tracking-widest mt-4">Veriler Analiz Ediliyor...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="modern-glass-card p-0 overflow-hidden">
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-surface/30">
              <h3 className="text-sm font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                <Trophy size={16} className="text-theme-primary" /> PERSONEL BAŞARI SIRALAMASI
              </h3>
              <span className="text-[10px] font-bold text-theme-dim uppercase tracking-widest">{sortedOperators.length} PERSONEL ANALİZ EDİLDİ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left density-aware-table resizable-table">
                <thead>
                  <tr className="bg-theme-surface/50">
                    <th className="px-6 py-5 text-[11px] font-black text-theme-dim uppercase tracking-widest">SIRA</th>
                    <th onClick={() => handleSort('name')} className="px-6 py-5 text-[11px] font-black text-theme-dim uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                      PERSONEL {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                    </th>
                    <th onClick={() => handleSort('produced')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                      TOPLAM ÜRETİM
                    </th>
                    <th onClick={() => handleSort('efficiency')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                      VERİMLİLİK %
                    </th>
                    <th onClick={() => handleSort('avgOee')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                      ORTALAMA OEE %
                    </th>
                    <th onClick={() => handleSort('defects')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                      HATA ADET
                    </th>
                    <th className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest">İŞLEM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme/40">
                  {paginatedOperators.map((o, index) => {
                    const idx = currentPage * pageSize + index;
                    return (
                      <tr key={o.id} className="group hover:bg-theme-primary/5 transition-all">
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : idx === 1 ? 'bg-slate-300 text-slate-950 shadow-lg shadow-slate-300/20' : idx === 2 ? 'bg-amber-800 text-white shadow-lg shadow-amber-800/20' : 'bg-theme-surface text-theme-dim'}`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-theme-main text-sm">
                          <div className="flex flex-col">
                            <span>{o.name}</span>
                            <span className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">{o.entries.length} Kayıt</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-theme-main font-bold text-sm">{o.produced.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-theme-main font-black text-xs">%{o.efficiency}</span>
                            <div className="w-20 h-1 bg-theme-base rounded-full overflow-hidden">
                              <div className="h-full bg-theme-primary transition-all duration-1000" style={{ width: `${Math.min(o.efficiency, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-3 py-1 rounded-lg font-black text-[11px] ${o.avgOee >= 80 ? 'bg-theme-success/10 text-theme-success' : o.avgOee >= 60 ? 'bg-theme-warning/10 text-theme-warning' : 'bg-theme-danger/10 text-theme-danger'}`}>
                            %{o.avgOee}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-theme-danger font-bold text-sm">{o.defects.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setSelectedOperator(o)} className="p-2 bg-theme-base hover:bg-theme-primary/20 text-theme-dim hover:text-theme-primary rounded-lg transition-all border border-theme">
                            <BarChart3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 order-2 md:order-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
                  <div className="w-24">
                    <CustomSelect
                      options={[
                        { id: 20, label: '20' },
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
                <span className="text-[11px] font-black text-theme-dim">
                  Toplam <span className="text-theme-primary">{sortedOperators.length}</span> Kayıt
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
      )}

      {selectedOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-theme-sidebar/80 backdrop-blur-md" onClick={() => setSelectedOperator(null)} />
          <div className="bg-theme-card border border-theme rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-10">
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-surface">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-theme-primary/20 rounded-2xl text-theme-primary">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-theme-main">{selectedOperator.name}</h3>
                  <p className="text-theme-dim text-[10px] font-bold uppercase tracking-widest mt-0.5">DETAYLI PERSONEL ANALİZİ</p>
                </div>
              </div>
              <button onClick={() => setSelectedOperator(null)} className="p-2 hover:bg-theme-surface rounded-xl transition-all text-theme-dim">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DetailCard title="TOPLAM ÜRETİM" value={selectedOperator.produced.toLocaleString()} unit="ADET" icon={Package} color="blue" />
                <DetailCard title="ORTALAMA OEE" value={`%${selectedOperator.avgOee}`} unit="VERİMLİLİK" icon={Activity} color="emerald" />
                <DetailCard title="KAYIP ZAMAN" value={selectedOperator.downtime.toLocaleString()} unit="DAKİKA" icon={Clock} color="rose" />
                <DetailCard title="BAŞARI SKORU" value={`%${selectedOperator.efficiency}`} unit="VERİMLİLİK" icon={Trophy} color="amber" />
              </div>

              <div className="bg-theme-base/50 rounded-2xl border border-theme p-6">
                <h4 className="text-xs font-black text-theme-dim uppercase tracking-widest mb-6 flex items-center gap-2">
                  <History size={14} /> SON KAYITLAR VE MAKİNE GEÇMİŞİ
                </h4>
                <div className="space-y-3">
                  {selectedOperator.entries.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-theme-card rounded-xl border border-theme hover:border-theme-primary/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="text-[10px] font-black text-theme-dim bg-theme-base px-3 py-1 rounded-full border border-theme">{new Date(r.productionDate).toLocaleDateString('tr-TR')}</div>
                        <div className="flex flex-col">
                          <span className="text-theme-main font-bold text-sm">{r.product?.productName}</span>
                          <div className="flex items-center gap-2">
                            <Factory size={10} className="text-theme-primary" />
                            <span className="text-[10px] text-theme-dim font-bold uppercase">{r.machine?.code} | {r.machine?.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div className="flex items-center gap-8 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-theme-dim uppercase font-mono">ADET</span>
                            <span className="text-theme-main font-black text-sm">{r.producedQuantity} / {r.plannedQuantity}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-theme-dim uppercase font-mono">OEE</span>
                            <span className={`text-sm font-black ${r.oee >= 80 ? 'text-theme-success' : r.oee >= 60 ? 'text-theme-warning' : 'text-theme-danger'}`}>%{r.oee}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({ title, value, unit, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'bg-theme-primary/10 text-theme-primary border-theme-primary/20',
    emerald: 'bg-theme-success/10 text-theme-success border-theme-success/20',
    rose: 'bg-theme-danger/10 text-theme-danger border-theme-danger/20',
    amber: 'bg-theme-warning/10 text-theme-warning border-theme-warning/20'
  };
  return (
    <div className={`p-6 rounded-2xl border ${colorMap[color]} flex items-center justify-between`}>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-black">{value}</h4>
          <span className="text-[10px] font-bold opacity-40">{unit}</span>
        </div>
      </div>
      <div className="p-2 bg-white/5 rounded-xl">
        <Icon size={24} />
      </div>
    </div>
  );
}

export default ReportsOperators;
