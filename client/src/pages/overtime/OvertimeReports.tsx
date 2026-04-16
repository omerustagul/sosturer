import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { BarChart3, Users, Settings, Calendar, Filter, TrendingUp, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';

interface Operator { id: string; fullName: string; }
interface Machine { id: string; name: string; code: string; }
interface Product { id: string; productName: string; }
interface Shift { id: string; shiftName: string; }

interface ReportSummary {
  totalPlans: number;
  totalDays: number;
  totalOperators: number;
  totalMachines: number;
  topOperator: { name: string; count: number } | null;
  topMachine: { name: string; count: number } | null;
  plans: any[];
}

export function OvertimeReports() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [productId, setProductId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/operators'),
      api.get('/machines'),
      api.get('/products'),
      api.get('/shifts')
    ]).then(([o, m, p, s]) => {
      setOperators(o);
      setMachines(m);
      setProducts(p);
      setShifts(s);
    });
  }, []);

  useEffect(() => {
    fetchReport();
    setCurrentPage(0);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (operatorId) params.set('operatorId', operatorId);
      if (machineId) params.set('machineId', machineId);
      if (productId) params.set('productId', productId);
      if (shiftId) params.set('shiftId', shiftId);

      const data = await api.get(`/overtime/reports/summary?${params.toString()}`);
      setReport(data);
    } catch (err) {
      console.error('Rapor hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  const paginatedPlans = useMemo(() => {
    if (!report) return [];
    return report.plans.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [report, currentPage, pageSize]);

  const pageCount = report ? Math.ceil(report.plans.length / pageSize) : 0;

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setOperatorId('');
    setMachineId('');
    setProductId('');
    setShiftId('');
    setTimeout(fetchReport, 100);
  };

  return (
    <div className="p-4 lg:p-6 animate-premium-page">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-theme-primary/10 rounded-2xl border border-theme-primary/20">
          <BarChart3 className="w-7 h-7 text-theme-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-theme-main tracking-tight">MESAİ RAPORLARI</h1>
          <p className="text-sm text-theme-muted mt-1">Gelişmiş filtreleme ile mesai verilerinizi analiz edin.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="premium-card p-6 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <Filter className="w-4 h-4 text-theme-primary" />
          <h2 className="text-xs font-black text-theme-main uppercase tracking-widest">GELİŞMİŞ FİLTRELEME</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="label-sm mb-1 block">Başlangıç</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input text-xs" />
          </div>
          <div>
            <label className="label-sm mb-1 block">Bitiş</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input text-xs" />
          </div>
          <div>
            <label className="label-sm mb-1 block">Personel</label>
            <CustomSelect
              options={[{ id: '', label: 'Tümü' }, ...operators.map(o => ({ id: o.id, label: o.fullName }))]}
              value={operatorId}
              onChange={(val) => setOperatorId(val)}
              searchable={true}
            />
          </div>
          <div>
            <label className="label-sm mb-1 block">Makine</label>
            <CustomSelect
              options={[{ id: '', label: 'Tümü' }, ...machines.map(m => ({ id: m.id, label: m.name }))]}
              value={machineId}
              onChange={(val) => setMachineId(val)}
              searchable={true}
            />
          </div>
          <div>
            <label className="label-sm mb-1 block">Ürün</label>
            <CustomSelect
              options={[{ id: '', label: 'Tümü' }, ...products.map(p => ({ id: p.id, label: p.productName }))]}
              value={productId}
              onChange={(val) => setProductId(val)}
              searchable={true}
            />
          </div>
          <div>
            <label className="label-sm mb-1 block">Vardiya</label>
            <CustomSelect
              options={[{ id: '', label: 'Tümü' }, ...shifts.map(s => ({ id: s.id, label: s.shiftName }))]}
              value={shiftId}
              onChange={(val) => setShiftId(val)}
              searchable={false}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={() => { fetchReport(); setCurrentPage(0); }} className="btn-primary text-xs flex items-center gap-2 px-6">
            <Filter className="w-4 h-4" /> FİLTRELE
          </button>
          <button onClick={clearFilters} className="btn-secondary h-10 px-5 flex items-center gap-2 text-[9px] font-black text-theme-primary border-theme-primary/20">TEMİZLE</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-12 h-12 border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin" />
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {[
              { icon: BarChart3, label: 'TOPLAM PLAN', value: report.totalPlans, color: 'text-theme-primary' },
              { icon: Calendar, label: 'TOPLAM GÜN', value: report.totalDays, color: 'text-blue-400' },
              { icon: Users, label: 'TOPLAM PERSONEL', value: report.totalOperators, color: 'text-emerald-400' },
              { icon: Settings, label: 'TOPLAM MAKİNE', value: report.totalMachines, color: 'text-amber-400' },
              { icon: TrendingUp, label: 'EN ÇOK MESAİ', value: report.topOperator?.name || '–', sub: report.topOperator ? `${report.topOperator.count} kez` : '', color: 'text-purple-400' },
              { icon: TrendingUp, label: 'EN AKTİF MAKİNE', value: report.topMachine?.name || '–', sub: report.topMachine ? `${report.topMachine.count} kez` : '', color: 'text-rose-400' }
            ].map((card, i) => (
              <div key={i} className="premium-card p-5">
                <card.icon className={`w-5 h-5 mb-3 ${card.color}`} />
                <p className={`text-xl font-black text-theme-main ${typeof card.value === 'string' && card.value.length > 8 ? 'text-sm' : ''}`}>{card.value}</p>
                {card.sub && <p className="text-[10px] text-theme-primary font-bold mt-0.5">{card.sub}</p>}
                <p className="text-[9px] font-black text-theme-dim uppercase tracking-widest mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Plans Table */}
          <div className="premium-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme bg-theme-surface/50">
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Plan Adı</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Tarih Aralığı</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Vardiya</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Personel</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Makine</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Atama</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-theme-dim uppercase tracking-widest">Durum</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlans.map((plan: any) => {
                  const uniqueOps = [...new Set(plan.items.filter((i: any) => i.operator).map((i: any) => i.operator.fullName))] as string[];
                  const uniqueMachines = [...new Set(plan.items.filter((i: any) => i.machine).map((i: any) => i.machine.name))] as string[];
                  return (
                    <tr key={plan.id} className="border-b border-theme/50 hover:bg-theme-main/5 transition-colors">
                      <td className="px-5 py-3 text-xs font-bold text-theme-main">{plan.planName}</td>
                      <td className="px-5 py-3 text-xs text-theme-muted">
                        {new Date(plan.startDate).toLocaleDateString('tr-TR')} – {new Date(plan.endDate).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-5 py-3 text-xs text-theme-muted">{plan.shift.shiftName}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {uniqueOps.slice(0, 3).map((name: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-theme-primary/5 text-theme-primary text-[9px] font-bold rounded-lg border border-theme-primary/10">{name}</span>
                          ))}
                          {uniqueOps.length > 3 && <span className="px-2 py-0.5 bg-theme-base text-theme-dim text-[9px] font-bold rounded-lg border border-theme">+{uniqueOps.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {uniqueMachines.slice(0, 3).map((name: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-500/5 text-emerald-400 text-[9px] font-bold rounded-lg border border-emerald-500/10">{name}</span>
                          ))}
                          {uniqueMachines.length > 3 && <span className="px-2 py-0.5 bg-theme-base text-theme-dim text-[9px] font-bold rounded-lg border border-theme">+{uniqueMachines.length - 3}</span>}
                        </div>
                        {plan.items.some((i: any) => i.backupMachine) && (
                          <div className="mt-1 flex items-center gap-1 opacity-60">
                            <ShieldCheck className="w-2.5 h-2.5 text-theme-primary" />
                            <span className="text-[8px] font-bold text-theme-dim">Yedekli Çalışma</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs font-black text-theme-primary">{plan.items.length}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase tracking-widest ${plan.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          plan.status === 'completed' ? 'bg-theme-dim/10 text-theme-dim border-theme/20' :
                            plan.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                          {plan.status === 'active' ? 'Aktif' : plan.status === 'completed' ? 'Tamamlandı' : plan.status === 'cancelled' ? 'İptal' : 'Planlanmış'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
                  TOPLAM <span className="text-theme-primary">{report.plans.length}</span> KAYIT
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
            {report.plans.length === 0 && (
              <div className="text-center py-16 opacity-40">
                <p className="text-sm font-black text-theme-dim uppercase tracking-widest">Filtreye uygun sonuç bulunamadı</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default OvertimeReports;
