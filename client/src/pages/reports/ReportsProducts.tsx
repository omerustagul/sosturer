import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import {
  Package,
  Box,
  Factory,
  Calendar,
  Download,
  Activity,
  AlertCircle,
  Users,
  ChevronUp,
  ChevronDown,
  Target,
  X,
  History,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

export function ReportsProducts() {
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [filters, setFilters] = useState({
    productId: 'all',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
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
        const p = await api.get('/products');
        setProducts(p.filter((x: any) => x.status === 'active'));
      } catch (e) {
        console.error('Failed to load products', e);
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
    if (filters.productId === 'all') return records;
    return records.filter(r => r.productId === filters.productId);
  }, [records, filters.productId]);

  const productStats = useMemo(() => {
    const stats: Record<string, any> = {};

    filteredRecords.forEach(r => {
      const pId = r.productId || 'none';
      const pCode = r.product?.productCode || 'Bilinmiyor';
      const pName = r.product?.productName || '-';

      if (!stats[pId]) {
        stats[pId] = {
          id: pId,
          code: pCode,
          name: pName,
          produced: 0,
          planned: 0,
          oeeSum: 0,
          count: 0,
          downtime: 0,
          defects: 0,
          entries: [],
          cycleTimeSum: 0,
          cycleTimeCount: 0,
          allCycles: new Set<number>()
        };
      }

      stats[pId].produced += r.producedQuantity || 0;
      stats[pId].planned += r.plannedQuantity || 0;
      stats[pId].oeeSum += r.oee || 0;
      stats[pId].count += 1;
      stats[pId].downtime += r.downtimeMinutes || 0;
      stats[pId].defects += r.defectQuantity || 0;
      stats[pId].entries.push(r);

      if (r.cycleTimeSeconds) {
        stats[pId].cycleTimeSum += r.cycleTimeSeconds;
        stats[pId].cycleTimeCount += 1;
        stats[pId].allCycles.add(r.cycleTimeSeconds);
      }
    });

    return Object.values(stats).map(s => ({
      ...s,
      avgOee: Number((s.oeeSum / (s.count || 1)).toFixed(1)),
      qualityRate: Number(((1 - (s.defects / (s.produced || 1))) * 100).toFixed(1)),
      avgCycle: s.cycleTimeCount > 0 ? Number((s.cycleTimeSum / s.cycleTimeCount).toFixed(1)) : 0,
      uniqueCycles: Array.from(s.allCycles as Set<number>).sort((a, b) => b - a)
    }));
  }, [filteredRecords]);

  const sortedProducts = useMemo(() => {
    return [...productStats].sort((a, b) => {
      const { key, direction } = sortConfig;
      const valA = a[key] || 0;
      const valB = b[key] || 0;
      const res = valA > valB ? 1 : valA < valB ? -1 : 0;
      return direction === 'asc' ? res : -res;
    });
  }, [productStats, sortConfig]);

  const paginatedProducts = useMemo(() => {
    return sortedProducts.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [sortedProducts, currentPage, pageSize]);

  const pageCount = Math.ceil(sortedProducts.length / pageSize);

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      await api.download(`/reports/excel/products?${params.toString()}`, `Urun_Analiz_Raporu.xlsx`);
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
            <Package className="w-6 h-6 text-theme-primary" /> ÜRÜN BAZLI ANALİZ
          </h2>
          <p className="text-theme-muted text-xs mt-1 font-medium">Üretilen ürünlerin kalite oranları, üretim hacimleri ve verimlilik metrikleri.</p>
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
            <Box size={12} /> ÜRÜN FİLTRESİ
          </label>
          <CustomSelect
            options={[{ id: 'all', label: 'Tüm Aktif Ürünler' }, ...products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))]}
            value={filters.productId}
            onChange={(val) => setFilters(prev => ({ ...prev, productId: val }))}
          />
        </div>
      </div>

      {loadingRecords ? (
        <div className="py-20 flex flex-col items-center">
          <Loading size="lg" />
          <p className="text-theme-primary font-black text-xs uppercase tracking-widest mt-4">Ürün Verileri Hazırlanıyor...</p>
        </div>
      ) : (
        <div className="modern-glass-card p-0 ">
          <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-surface/30">
            <h3 className="text-sm font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
              <Target size={16} className="text-theme-primary" /> ÜRÜN ANALİZ MATRİSİ
            </h3>
            <span className="text-[10px] font-bold text-theme-dim uppercase tracking-widest">{sortedProducts.length} FARKLI ÜRÜN ANALİZ EDİLDİ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left density-aware-table resizable-table">
              <thead>
                <tr className="bg-theme-surface/50">
                  <th onClick={() => handleSort('code')} className="px-6 py-5 text-[11px] font-black text-theme-dim uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">
                    ÜRÜN KODU {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                  </th>
                  <th onClick={() => handleSort('name')} className="px-6 py-5 text-[11px] font-black text-theme-dim uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">ÜRÜN TANIMI</th>
                  <th onClick={() => handleSort('produced')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">ÜRETİM ADET</th>
                  <th onClick={() => handleSort('qualityRate')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">KALİTE %</th>
                  <th onClick={() => handleSort('avgCycle')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">BİRİM SÜRE (ORT)</th>
                  <th onClick={() => handleSort('avgOee')} className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest cursor-pointer hover:text-theme-main transition-colors">OEE %</th>
                  <th className="px-6 py-5 text-[11px] font-black text-theme-dim text-right uppercase tracking-widest">DETAY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme/40">
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className="group hover:bg-theme-primary/5 transition-all">
                    <td className="px-6 py-4 font-black text-theme-primary text-sm">{p.code}</td>
                    <td className="px-6 py-4 text-theme-main font-medium text-sm truncate max-w-[300px]">{p.name}</td>
                    <td className="px-6 py-4 text-right text-theme-main font-bold text-sm">{p.produced.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-lg font-black text-[11px] ${p.qualityRate >= 95 ? 'bg-theme-success/10 text-theme-success' : p.qualityRate >= 90 ? 'bg-theme-warning/10 text-theme-warning' : 'bg-theme-danger/10 text-theme-danger'}`}>
                        %{p.qualityRate}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <SmartCycleTooltip
                        value={p.avgCycle}
                        uniqueCycles={p.uniqueCycles}
                      />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-lg font-black text-[11px] ${p.avgOee >= 80 ? 'bg-theme-success/10 text-theme-success' : p.avgOee >= 60 ? 'bg-theme-warning/10 text-theme-warning' : 'bg-theme-danger/10 text-theme-danger'}`}>
                        %{p.avgOee}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedProduct(p)} className="p-2 bg-theme-base hover:bg-theme-primary/20 text-theme-dim hover:text-theme-primary rounded-lg transition-all border border-theme">
                        <BarChart3 className="w-4 h-4" />
                      </button>
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
                Toplam <span className="text-theme-primary">{sortedProducts.length}</span> Kayıt
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
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-theme-sidebar/80 backdrop-blur-md" onClick={() => setSelectedProduct(null)} />
          <div className="bg-theme-card border border-theme rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-10">
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-surface">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-theme-primary/20 rounded-2xl text-theme-primary">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-theme-main">{selectedProduct.code} - {selectedProduct.name}</h3>
                  <p className="text-theme-dim text-[10px] font-bold uppercase tracking-widest mt-0.5">DETAYLI ÜRÜN ÜRETİM ANALİZİ</p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-theme-surface rounded-xl transition-all text-theme-dim">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DetailCard title="TOPLAM ÜRETİM" value={selectedProduct.produced.toLocaleString()} unit="ADET" icon={Package} color="blue" />
                <DetailCard title="KALİTE SKORU" value={`%${selectedProduct.qualityRate}`} unit="BAŞARI" icon={Target} color="emerald" />
                <DetailCard title="TOPLAM HATA" value={selectedProduct.defects.toLocaleString()} unit="ADET" icon={AlertCircle} color="rose" />
                <DetailCard title="ANALİZ SAYISI" value={selectedProduct.entries.length} unit="KAYIT" icon={Activity} color="amber" />
              </div>

              <div className="bg-theme-base/50 rounded-2xl border border-theme p-6">
                <h4 className="text-xs font-black text-theme-dim uppercase tracking-widest mb-6 flex items-center gap-2">
                  <History size={14} /> ÜRÜNÜN ÜRETİLDİĞİ MAKİNELER VE PERFORMANS
                </h4>
                <div className="space-y-3">
                  {selectedProduct.entries.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-theme-card rounded-xl border border-theme hover:border-theme-primary/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="text-[10px] font-black text-theme-dim bg-theme-base px-3 py-1 rounded-full border border-theme">{new Date(r.productionDate).toLocaleDateString('tr-TR')}</div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Factory size={10} className="text-theme-primary" />
                            <span className="text-theme-main font-bold text-sm">{r.machine?.code} - {r.machine?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users size={10} className="text-theme-muted" />
                            <span className="text-[10px] text-theme-muted font-bold uppercase">{r.operator?.fullName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-theme-dim uppercase font-mono">NET MİKTAR</span>
                          <span className="text-theme-main font-black text-sm">{r.producedQuantity}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-theme-dim uppercase font-mono">KALİTE</span>
                          <span className={`text-sm font-black ${r.quality >= 95 ? 'text-theme-success' : 'text-theme-warning'}`}>%{r.quality}</span>
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

function SmartCycleTooltip({ value, uniqueCycles }: { value: number, uniqueCycles: number[] }) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={() => {
        updateCoords();
        setIsVisible(true);
      }}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="text-theme-primary font-black text-sm cursor-help hover:text-theme-primary-hover border-b border-dotted border-theme-primary/30">
        {value} sn
      </span>

      {isVisible && createPortal(
        <div
          className="fixed z-[9999] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300 pointer-events-none"
          style={{
            top: coords.top - 12,
            left: coords.left + coords.width,
            transform: 'translate(-100%, -100%)'
          }}
        >
          <div className="bg-theme-card border border-theme shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden p-5 backdrop-blur-2xl ring-1 ring-white/10 w-56">
            <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest mb-4 border-b border-theme pb-2 flex items-center gap-2">
              <History size={14} className="text-theme-primary" /> BİRİM SÜRE GEÇMİŞİ
            </p>
            <div className="space-y-2.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {uniqueCycles.map((cycle: number, idx: number) => (
                <div key={idx} className="flex items-center justify-between group/item p-1.5 rounded-xl transition-all border border-transparent hover:border-theme-primary/10">
                  <span className="text-[9px] font-black text-theme-dim uppercase opacity-60">Kayıt {idx + 1}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-black text-theme-main">{cycle}</span>
                    <span className="text-[9px] font-bold text-theme-dim italic uppercase">sn</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-theme-primary/10 flex items-center justify-between">
              <p className="text-[9px] font-black text-theme-primary uppercase tracking-widest">ANALİZ SONUCU</p>
              <p className="text-[9px] font-bold text-theme-muted">{uniqueCycles.length} FARKLI VERİ</p>
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute top-full right-8 w-4 h-4 bg-theme-card border-r border-b border-theme rotate-45 -translate-y-2 shadow-xl" />
        </div>,
        document.body
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

export default ReportsProducts;
