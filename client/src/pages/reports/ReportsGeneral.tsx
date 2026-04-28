import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  BarChart3,
  Activity,
  Clock,
  Package,
  Calendar,
  Download,
  CheckCircle2,
  TrendingUp,
  Factory,
  Target,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Filter,
  User,
  Tags,
  Layers,
  RotateCcw,
  Bookmark
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Legend
} from 'recharts';
import { Loading } from '../../components/common/Loading';
import { Tooltip } from '../../components/common/Tooltip';
import { CustomSelect } from '../../components/common/CustomSelect';
import { MissingProductionInsight } from '../../components/dashboard/MissingProductionInsight';

export function ReportsGeneral() {
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [missingProduction, setMissingProduction] = useState<any | null>(null);

  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    machineId: 'all',
    operatorId: 'all',
    shiftId: 'all',
    productId: 'all',
    productGroup: 'all',
    category: 'all',
    brand: 'all'
  });

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({
    key: 'produced',
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
        const [m, o, s, p] = await Promise.all([
          api.get('/machines'),
          api.get('/operators'),
          api.get('/shifts'),
          api.get('/products')
        ]);
        setMachines(m);
        setOperators(o);
        setShifts(s);
        setProducts(p);
      } catch (e) {
        console.error('Initial load failed', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const productMeta = useMemo(() => {
    const groups = new Set<string>();
    const categories = new Set<string>();
    const brands = new Set<string>();

    products.forEach(p => {
      if (p.productGroup) groups.add(p.productGroup);
      if (p.category) categories.add(p.category);
      if (p.brand) brands.add(p.brand);
    });

    return {
      groups: Array.from(groups).sort(),
      categories: Array.from(categories).sort(),
      brands: Array.from(brands).sort()
    };
  }, [products]);

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
        const mp = new URLSearchParams();
        if (filters.startDate) mp.set('start', filters.startDate);
        if (filters.endDate) mp.set('end', filters.endDate);
        if (filters.machineId !== 'all') mp.set('machineId', filters.machineId);
        if (filters.shiftId !== 'all') mp.set('shiftId', filters.shiftId);
        const missing = await api.get(`/analytics/missing-production?${mp.toString()}`);
        setMissingProduction(missing);
      } catch (e) {
        console.error('Failed to load records', e);
      } finally {
        setLoadingRecords(false);
      }
    }
    if (!loading) loadData();
  }, [filters.startDate, filters.endDate, filters.machineId, filters.shiftId, loading]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchMachine = filters.machineId === 'all' || r.machineId === filters.machineId;
      const matchOperator = filters.operatorId === 'all' || r.operatorId === filters.operatorId;
      const matchShift = filters.shiftId === 'all' || r.shiftId === filters.shiftId;
      const matchProduct = filters.productId === 'all' || r.productId === filters.productId;
      const matchGroup = filters.productGroup === 'all' || r.product?.productGroup === filters.productGroup;
      const matchCategory = filters.category === 'all' || r.product?.category === filters.category;
      const matchBrand = filters.brand === 'all' || r.product?.brand === filters.brand;

      return matchMachine && matchOperator && matchShift && matchProduct && matchGroup && matchCategory && matchBrand;
    });
  }, [records, filters]);

  const kpis = useMemo(() => {
    if (filteredRecords.length === 0) return { totalProduced: 0, avgOee: 0, totalDowntime: 0, avgQuality: 0 };

    const totalProduced = filteredRecords.reduce((sum, r) => sum + (r.producedQuantity || 0), 0);
    const avgOee = filteredRecords.reduce((sum, r) => sum + (r.oee || 0), 0) / filteredRecords.length;

    const shiftKeys = new Set<string>();
    let totalDowntime = 0;

    filteredRecords.forEach(r => {
      totalDowntime += r.downtimeMinutes || 0;
      const key = `${r.productionDate}-${r.machineId}-${r.shiftId}`;
      if (!shiftKeys.has(key)) {
        shiftKeys.add(key);
      }
    });

    const avgQuality = filteredRecords.reduce((sum, r) => sum + (r.quality || 0), 0) / filteredRecords.length;

    return {
      totalProduced,
      avgOee: avgOee.toFixed(1),
      totalDowntime,
      avgQuality: avgQuality.toFixed(1)
    };
  }, [filteredRecords]);

  const trendData = useMemo(() => {
    const daily: Record<string, any> = {};
    filteredRecords.forEach(r => {
      const date = new Date(r.productionDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
      if (!daily[date]) {
        daily[date] = { date, produced: 0, oeeSum: 0, count: 0 };
      }
      daily[date].produced += r.producedQuantity || 0;
      daily[date].oeeSum += r.oee || 0;
      daily[date].count += 1;
    });

    return Object.values(daily).map(d => ({
      ...d,
      oee: (d.oeeSum / d.count).toFixed(1)
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  const machineComparison = useMemo(() => {
    const stats: Record<string, any> = {};
    const machineShiftKeys = new Set<string>();
    const relevantRecords = filteredRecords;

    relevantRecords.forEach(r => {
      const mCode = r.machine?.code || 'Bilinmiyor';
      if (!stats[mCode]) {
        stats[mCode] = {
          name: mCode,
          produced: 0,
          planned: 0,
          totalTime: 0,
          oeeSum: 0,
          count: 0,
          downtime: 0,
          defects: 0,
          cycleTimeSum: 0
        };
      }

      stats[mCode].produced += r.producedQuantity || 0;
      stats[mCode].planned += r.plannedQuantity || 0;
      stats[mCode].oeeSum += r.oee || 0;
      stats[mCode].count += 1;
      stats[mCode].defects += r.defectQuantity || 0;
      stats[mCode].downtime += r.downtimeMinutes || 0;
      stats[mCode].cycleTimeSum += r.cycleTimeSeconds || 0;

      const shiftKey = `${r.productionDate}-${r.machineId}-${r.shiftId}`;
      if (!machineShiftKeys.has(shiftKey)) {
        machineShiftKeys.add(shiftKey);
        stats[mCode].totalTime += r.shift?.durationMinutes || 0;
      }
    });

    return Object.values(stats).map(s => ({
      ...s,
      oee: Number((s.oeeSum / (s.count || 1)).toFixed(1)),
      avgCycleTime: Number((s.cycleTimeSum / (s.count || 1)).toFixed(2))
    }));
  }, [filteredRecords]);

  const sortedMachineComparison = useMemo(() => {
    return [...machineComparison].sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA = a[key];
      let valB = b[key];

      if (typeof valA === 'string' || typeof valB === 'string') {
        const strA = String(valA || '');
        const strB = String(valB || '');
        const res = strA.localeCompare(strB);
        return direction === 'asc' ? res : -res;
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      const res = numA - numB;
      return direction === 'asc' ? res : -res;
    });
  }, [machineComparison, sortConfig]);

  const paginatedComparison = useMemo(() => {
    return sortedMachineComparison.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [sortedMachineComparison, currentPage, pageSize]);

  const pageCount = Math.ceil(sortedMachineComparison.length / pageSize);

  const footerTotals = useMemo(() => {
    if (sortedMachineComparison.length === 0) return null;
    return sortedMachineComparison.reduce((acc, curr) => ({
      totalTime: acc.totalTime + curr.totalTime,
      planned: acc.planned + curr.planned,
      produced: acc.produced + curr.produced,
      downtime: acc.downtime + curr.downtime,
      defects: acc.defects + (curr.defects || 0),
      count: acc.count + curr.count,
      oeeSum: acc.oeeSum + (Number(curr.oee) || 0),
      cycleSum: acc.cycleSum + (Number(curr.avgCycleTime) || 0)
    }), { totalTime: 0, planned: 0, produced: 0, downtime: 0, defects: 0, count: 0, oeeSum: 0, cycleSum: 0 });
  }, [sortedMachineComparison]);

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.machineId !== 'all') params.set('machineId', filters.machineId);
      if (filters.operatorId !== 'all') params.set('operatorId', filters.operatorId);
      if (filters.shiftId !== 'all') params.set('shiftId', filters.shiftId);
      if (filters.productId !== 'all') params.set('productId', filters.productId);
      if (filters.productGroup !== 'all') params.set('productGroup', filters.productGroup);
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.brand !== 'all') params.set('brand', filters.brand);

      await api.download(`/reports/excel/export?${params.toString()}`, `Genel_Uretim_Raporu_${filters.startDate}_${filters.endDate}.xlsx`);
    } catch (e) {
      alert('Dışa aktarma başarısız oldu.');
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      machineId: 'all',
      operatorId: 'all',
      shiftId: 'all',
      productId: 'all',
      productGroup: 'all',
      category: 'all',
      brand: 'all'
    });
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in duration-700 bg-theme-base">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-theme-primary" /> GENEL ÜRETİM RAPORU
          </h2>
          <p className="text-theme-muted text-xs mt-1 font-medium">Tüm işletme operasyonlarının konsolide görünümü ve karşılaştırmalı analizi.</p>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button
            onClick={exportToExcel}
            className="w-auto h-12 flex-1 lg:flex-none flex items-center justify-center gap-2 bg-theme-success hover:bg-theme-success/80 text-white px-8 py-3 rounded-xl font-black transition-all shadow-lg shadow-theme-success/20 active:scale-95"
          >
            <Download className="w-5 h-5" /> EXCEL AKTAR
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="modern-glass-card p-6 space-y-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
              <Calendar size={12} /> BAŞLANGIÇ
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="h-10 w-full bg-theme-base border border-theme rounded-xl px-4 py-2 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
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
              className="h-10 w-full bg-theme-base border border-theme rounded-xl px-4 py-2 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
              <Factory size={12} /> MAKİNE
            </label>
            <CustomSelect
              options={[{ id: 'all', label: 'Tüm Makinalar' }, ...machines.map(m => ({ id: m.id, label: m.code, subLabel: m.name }))]}
              value={filters.machineId}
              onChange={(val) => setFilters(prev => ({ ...prev, machineId: val }))}
            />
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={`h-10 px-6 rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center gap-2 transition-all border ${isAdvancedOpen
                ? 'bg-theme-primary text-white border-theme-primary shadow-lg shadow-theme-primary/20'
                : 'bg-theme-base text-theme-dim border-theme hover:border-theme-primary/40 hover:text-theme-main'
                }`}
            >
              <Filter size={14} className={isAdvancedOpen ? 'animate-pulse' : ''} />
              GELİŞMİŞ FİLTRELER
            </button>
            <button
              onClick={clearFilters}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-theme-danger/5 text-theme-danger border border-theme-danger/20 hover:bg-theme-danger hover:text-white transition-all group"
              title="Filtreleri Temizle"
            >
              <RotateCcw size={16} className="group-hover:rotate-[-180deg] transition-transform duration-500" />
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {isAdvancedOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-theme animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <User size={12} /> OPERATÖR
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Operatörler' }, ...operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))]}
                value={filters.operatorId}
                onChange={(val) => setFilters(prev => ({ ...prev, operatorId: val }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Clock size={12} /> VARDİYA
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Vardiyalar' }, ...shifts.map(s => ({ id: s.id, label: s.shiftName, subLabel: s.shiftCode }))]}
                value={filters.shiftId}
                onChange={(val) => setFilters(prev => ({ ...prev, shiftId: val }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Package size={12} /> ÜRÜN
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Ürünler' }, ...products.map(p => ({ id: p.id, label: p.productName, subLabel: p.productCode }))]}
                value={filters.productId}
                onChange={(val) => setFilters(prev => ({ ...prev, productId: val }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Layers size={12} /> ÜRÜN GRUBU
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Gruplar' }, ...productMeta.groups.map(g => ({ id: g, label: g }))]}
                value={filters.productGroup}
                onChange={(val) => setFilters(prev => ({ ...prev, productGroup: val }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Tags size={12} /> KATEGORİ
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Kategoriler' }, ...productMeta.categories.map(c => ({ id: c, label: c }))]}
                value={filters.category}
                onChange={(val) => setFilters(prev => ({ ...prev, category: val }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest flex items-center gap-2 px-1">
                <Bookmark size={12} /> MARKA
              </label>
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Markalar' }, ...productMeta.brands.map(b => ({ id: b, label: b }))]}
                value={filters.brand}
                onChange={(val) => setFilters(prev => ({ ...prev, brand: val }))}
              />
            </div>
          </div>
        )}
      </div>

      {loadingRecords ? (
        <div className="py-20 flex flex-col items-center">
          <Loading size="lg" />
          <p className="text-theme-primary font-black text-xs uppercase tracking-widest mt-4">Veriler Hazırlanıyor... ({records.length} kayıt okundu)</p>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="TOPLAM ÜRETİM" value={kpis.totalProduced.toLocaleString()} unit="Adet" icon={Package} color="blue" />
            <KpiCard title="GENEL OEE" value={`%${kpis.avgOee}`} unit="Ortalama" icon={Activity} color="indigo" />
            <KpiCard title="TOPLAM DURUŞ" value={kpis.totalDowntime.toLocaleString()} unit="Dakika" icon={Clock} color="rose" />
            <KpiCard title="KALİTE SKORU" value={`%${kpis.avgQuality}`} unit="Başarı" icon={CheckCircle2} color="emerald" />
          </div>



          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Trend Chart */}
            <div className="modern-glass-card">
              <h3 className="text-lg font-black text-theme-main mb-6 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-theme-primary" /> GÜNLÜK ÜRETİM TRENDİ
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '12px' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Area type="monotone" dataKey="produced" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Machine Bar Chart */}
            <div className="modern-glass-card">
              <h3 className="text-lg font-black text-theme-main mb-6 flex items-center gap-3">
                <Target className="w-5 h-5 text-theme-primary" /> MAKİNE PERFORMANS KIYASLAMASI
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={machineComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-dim)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '12px' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Bar yAxisId="left" dataKey="produced" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Üretilen Miktar" />
                    <Line yAxisId="right" type="monotone" dataKey="oee" stroke="var(--success)" strokeWidth={3} dot={{ fill: 'var(--success)', r: 4 }} name="OEE Oranı (%)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Matrix Table */}
          <div className="modern-glass-card p-0 overflow-hidden">
            <div className="p-6 border-b border-theme bg-theme-surface/30 flex items-center justify-between">
              <h3 className="text-sm font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                <Activity size={16} className="text-theme-primary" /> OPERASYONEL VERİMLİLİK MATRİSİ
              </h3>
              <span className="text-[10px] font-bold bg-theme-primary/10 text-theme-primary px-3 py-1 rounded-full border border-theme-primary/20 uppercase tracking-widest">
                {machineComparison.length} MAKİNE ANALİZ EDİLDİ
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed min-w-[1000px] resizable-table density-aware-table">
                <thead>
                  <tr className="bg-theme-surface/50 transition-colors">
                    <th
                      onClick={() => handleSort('name')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center gap-2">
                        Makine {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('totalTime')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Çalışma {sortConfig.key === 'totalTime' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('planned')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Planlanan {sortConfig.key === 'planned' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('produced')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Üretilen {sortConfig.key === 'produced' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('avgCycleTime')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Birim Süre {sortConfig.key === 'avgCycleTime' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('defects')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Hatalı {sortConfig.key === 'defects' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('downtime')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Duruş {sortConfig.key === 'downtime' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('count')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        Kayıt {sortConfig.key === 'count' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('oee')}
                      className="w-1/9 px-4 py-5 text-[11px] font-black text-theme-dim tracking-widest text-right cursor-pointer hover:text-theme-main transition-colors border-b border-theme"
                    >
                      <div className="flex items-center justify-end gap-2 text-right">
                        OEE % {sortConfig.key === 'oee' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme/30 font-bold overflow-hidden">
                  {paginatedComparison.map((m, idx) => (
                    <tr key={idx} className="group hover:bg-theme-primary/5 transition-all duration-300">
                      <td className="w-1/9 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-theme-primary/10 flex items-center justify-center font-black text-theme-primary text-[11px] border border-theme-primary/10 shrink-0">
                            {idx + 1}
                          </div>
                          <Tooltip content={m.name}>
                            <span className="text-theme-main font-black truncate text-[13px]">{m.name}</span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-main text-[13px]">{m.totalTime.toLocaleString()} <span className="text-[10px] text-theme-dim opacity-60">dk</span></td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-muted text-[13px]">{m.planned.toLocaleString()}</td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-main font-black text-[13px]">{m.produced.toLocaleString()}</td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-primary font-mono text-[13px]">{m.avgCycleTime} <span className="text-[10px] opacity-60">sn</span></td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-warning font-black text-[13px]">{m.defects || 0}</td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-danger font-bold text-[13px]">{m.downtime.toLocaleString()} <span className="text-[10px] opacity-60">dk</span></td>
                      <td className="w-1/9 px-4 py-4 text-right text-theme-dim font-bold text-[13px]">{m.count}</td>
                      <td className="w-1/9 px-4 py-4 text-right">
                        <span className={`px-3 py-1 rounded-lg font-black tracking-tighter text-[12px] border ${m.oee >= 80 ? 'bg-theme-success/10 text-theme-success border-theme-success/20' :
                          m.oee >= 60 ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' :
                            'bg-theme-danger/10 text-theme-danger border-theme-danger/20'
                          }`}>
                          %{m.oee}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {machineComparison.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Info size={48} className="text-theme-muted" />
                          <p className="text-theme-muted font-black uppercase tracking-widest text-[13px]">Veri bulunamadı.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {footerTotals && (
                  <tfoot className="bg-theme-surface font-black border-t-2 border-theme backdrop-blur-md">
                    <tr className="divide-x divide-theme/10">
                      <td className="w-1/9 px-4 py-6 text-[12px] text-theme-primary uppercase tracking-widest text-center font-black italic">GENEL TOPLAM</td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-main text-[13px] font-black">{footerTotals.totalTime.toLocaleString()} <span className="text-[10px] opacity-50 font-bold">dk</span></td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-muted text-[13px] font-black">{footerTotals.planned.toLocaleString()}</td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-main text-[13px] font-black">{footerTotals.produced.toLocaleString()}</td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-primary text-[13px] font-black">{(footerTotals.cycleSum / (sortedMachineComparison.length || 1)).toFixed(1)} <span className="text-[10px] opacity-50 font-bold">sn</span></td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-warning text-[13px] font-black">{footerTotals.defects.toLocaleString()}</td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-danger text-[13px] font-black">{footerTotals.downtime.toLocaleString()} <span className="text-[10px] opacity-50 font-bold">dk</span></td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-dim text-[13px] font-black">{footerTotals.count}</td>
                      <td className="w-1/9 px-4 py-6 text-right text-theme-success font-black text-[14px]">
                        <span className="bg-theme-success/10 px-3 py-1 rounded-lg border border-theme-success/20">
                          %{(footerTotals.oeeSum / (sortedMachineComparison.length || 1)).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
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
                  Toplam <span className="text-theme-primary">{sortedMachineComparison.length}</span> Kayıt
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
          {missingProduction?.summary?.missingEntries > 0 && (
            <div className="mt-8">
              <MissingProductionInsight
                data={missingProduction}
                machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name }))}
                title="Eksik Üretim Kayıtları (Rapor Tarih Aralığı)"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, unit, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'from-theme-primary/20 to-theme-primary/5 text-theme-primary border-theme-primary/20',
    indigo: 'from-theme-primary/20 to-theme-primary/5 text-theme-primary border-theme-primary/20',
    rose: 'from-theme-danger/20 to-theme-danger/5 text-theme-danger border-theme-danger/20',
    emerald: 'from-theme-success/20 to-theme-success/5 text-theme-success border-theme-success/20'
  };

  return (
    <div className={`bg-theme-card bg-gradient-to-br ${colorMap[color]} backdrop-blur-xl border border-theme p-6 rounded-2xl relative group hover:scale-[1.02] transition-all duration-300 overflow-hidden`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-theme-main/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 text-theme-dim">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-theme-main tracking-tighter">{value}</h4>
            <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">{unit}</span>
          </div>
        </div>
        <div className="p-3 bg-theme-main/5 rounded-2xl border border-theme-main/5">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 relative z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">CANLI ANALIZ AKTİF</span>
      </div>
    </div>
  );
}

export default ReportsGeneral;
