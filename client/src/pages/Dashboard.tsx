import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import {
  Activity, Settings, Clock, Factory, BarChart3,
  Plus, ChevronRight, Layout as LayoutIcon,
  Check, Save, TrendingUp, Package, Columns, Square, Maximize2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../components/common/Loading';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from 'react-i18next';
import { notify } from '../store/notificationStore';
import { DashboardWidget } from '../components/dashboard/DashboardWidget';
import { MissingProductionInsight } from '../components/dashboard/MissingProductionInsight';

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Widget Types
type WidgetId = 'kpis' | 'performance_chart' | 'machine_status' | 'recent_records' | 'stock_summary' | 'sales_trend';
type GridMode = 'single' | 'double';

interface LayoutItem {
  id: WidgetId;
  fullWidth: boolean;
}

interface DashboardConfig {
  items: LayoutItem[];
  gridMode: GridMode;
  equalHeight?: boolean;
}

interface WidgetDef {
  id: WidgetId;
  title: string;
  subtitle: string;
  icon: any;
  defaultFullWidth?: boolean;
}

const AVAILABLE_WIDGETS: WidgetDef[] = [
  { id: 'kpis', title: 'Temel Göstergeler (KPI)', subtitle: 'Giriş: Toplam makine, OEE ve duruş süreleri', icon: Activity, defaultFullWidth: true },
  { id: 'performance_chart', title: 'OEE Performans Haritası', subtitle: 'Makine bazlı verimlilik grafiği', icon: BarChart3, defaultFullWidth: true },
  { id: 'machine_status', title: 'Canlı Makine Durumları', subtitle: 'Anlık operasyonel durum verileri', icon: Settings },
  { id: 'stock_summary', title: 'Stok Durum Özeti', subtitle: 'En çok stoklanan 10 ürünün takibi', icon: Package },
  { id: 'sales_trend', title: 'Satış & Sipariş Analizi', subtitle: 'Son 30 günlük trend grafiği', icon: TrendingUp, defaultFullWidth: true },
  { id: 'recent_records', title: 'Son Üretim Kayıtları', subtitle: 'Sisteme girilen en yeni veri girişleri', icon: Clock },
];

function Dashboard() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();
  const [machines, setMachines] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [missingProduction, setMissingProduction] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Layout Management
  const defaultLayoutItems: LayoutItem[] = AVAILABLE_WIDGETS.map(w => ({ id: w.id, fullWidth: w.defaultFullWidth || false }));
  const [currentLayout, setCurrentLayout] = useState<LayoutItem[]>([]);
  const [gridMode, setGridMode] = useState<GridMode>('double');
  const [equalHeight, setEqualHeight] = useState(false);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (settings?.dashboardLayout) {
      try {
        const parsed = JSON.parse(settings.dashboardLayout);

        let items: LayoutItem[] = [];
        let mode: GridMode = 'double';

        // Migration handle: handle simple array or new object structure
        if (Array.isArray(parsed)) {
          items = parsed.map((item: any) => {
            if (typeof item === 'string') {
              const def = AVAILABLE_WIDGETS.find(w => w.id === item);
              return { id: item as WidgetId, fullWidth: def?.defaultFullWidth || false };
            }
            return item as LayoutItem;
          });
        } else if (parsed.items) {
          items = parsed.items;
          mode = parsed.gridMode || 'double';
        }

        setCurrentLayout(items.length > 0 ? items : defaultLayoutItems);
        setGridMode(mode);
        setEqualHeight(parsed.equalHeight || false);
      } catch (e) {
        setCurrentLayout(defaultLayoutItems);
        setGridMode('double');
      }
    } else {
      setCurrentLayout(defaultLayoutItems);
      setGridMode('double');
    }
  }, [settings?.dashboardLayout]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [machinesRes, recordsRes, stockRes, salesRes, , missingRes] = await Promise.all([
          api.get('/machines'),
          api.get('/production-records'),
          api.get('/analytics/stock-summary'),
          api.get('/analytics/sales-overview'),
          api.get('/shifts'),
          api.get('/analytics/missing-production?days=7')
        ]);
        setMachines(Array.isArray(machinesRes) ? machinesRes : []);
        setRecords(Array.isArray(recordsRes) ? recordsRes : []);
        setStockSummary(Array.isArray(stockRes) ? stockRes : []);
        setSalesTrend(Array.isArray(salesRes) ? salesRes : []);
        setMissingProduction(missingRes || null);
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // SOCKET.IO REALTIME INTEGRATION
    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:3005/api`);
    const socketioHost = API_URL.startsWith('http') ? API_URL.replace(/\/api$/, '') : window.location.origin;
    const socket: Socket = io(socketioHost);

    socket.on('connect', () => socket.emit('joinDashboard'));
    socket.on('dashboardUpdate', (payload) => {
      if (payload.action === 'CREATED_RECORD' && payload.record) {
        setRecords(prev => [payload.record, ...prev]);
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleSaveLayout = async () => {
    try {
      const config: DashboardConfig = { items: currentLayout, gridMode, equalHeight };
      await updateSettings({ ...settings!, dashboardLayout: JSON.stringify(config) });
      setIsCustomizing(false);
      notify.success('Panel Kaydedildi', 'Düzenleme başarıyla tamamlandı.');
    } catch (error) {
      notify.error('Hata', 'Düzen kaydedilirken bir hata oluştu.');
    }
  };

  const toggleWidget = (id: WidgetId) => {
    if (currentLayout.some(i => i.id === id)) {
      setCurrentLayout(prev => prev.filter(item => item.id !== id));
    } else {
      const def = AVAILABLE_WIDGETS.find(w => w.id === id);
      setCurrentLayout(prev => [...prev, { id, fullWidth: def?.defaultFullWidth || false }]);
    }
  };

  const toggleFullWidth = (id: WidgetId) => {
    setCurrentLayout(prev => prev.map(item => item.id === id ? { ...item, fullWidth: !item.fullWidth } : item));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCurrentLayout((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  // KPIS
  const totalMachines = machines.length;
  const activeMachines = machines.filter(m => m.status === 'active').length;
  const validOeeRecords = records.filter(r => r.oee !== null);
  const avgOee = validOeeRecords.length > 0 ? (validOeeRecords.reduce((sum, r) => sum + r.oee, 0) / validOeeRecords.length).toFixed(1) : '0.0';
  const totalDowntimeMinutes = records.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);

  const machineOeeData = machines.map(m => {
    const mRecords = records.filter(r => r.machineId === m.id && r.oee !== null);
    if (mRecords.length === 0) return { name: m.code, oee: 0 };
    return { name: m.code, oee: Number((mRecords.reduce((sum, r) => sum + r.oee, 0) / mRecords.length).toFixed(1)) };
  });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="p-4 lg:p-6 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-black text-theme-main uppercase tracking-tight">{t('dashboard.title', 'KONTROL PANELİ')}</h2>
            <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60 leading-none">
              {t('dashboard.subtitle', 'Gerçek Zamanlı Veri Analizi ve Panel Yönetimi')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={cn(
                "group flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-[0.2em] transition-all border shadow-lg",
                isCustomizing
                  ? "bg-theme-main text-theme-base border-theme-main"
                  : "bg-theme-surface/80 text-theme-main border-theme hover:border-theme-primary/40"
              )}
            >
              {isCustomizing ? <Check className="w-4 h-4" /> : <LayoutIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
              {isCustomizing ? 'DÜZENLEMEYİ BİTİR' : 'PANELİ DÜZENLE'}
            </button>

            <div className="relative" onMouseEnter={() => setShowAddOptions(true)} onMouseLeave={() => setShowAddOptions(false)}>
              <button className="bg-theme-primary hover:opacity-90 text-white px-6 py-3 rounded-xl font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-3 active:scale-95 text-[10px] tracking-[0.2em]">
                {t('dashboard.newRecord', 'YENİ KAYIT')}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAddOptions ? 'rotate-90' : ''}`} />
              </button>
              <div className={cn(
                "absolute right-0 top-full mt-3 w-72 bg-theme-base border border-theme rounded-2xl p-2 shadow-2xl z-50 transition-all duration-300 origin-top-right",
                showAddOptions ? 'scale-100 opacity-100 visible' : 'scale-95 opacity-0 invisible translate-y-2'
              )}>
                <button onClick={() => navigate('/records/new')} className="w-full flex items-center gap-2 p-2 border border-theme/50 hover:border-theme-primary/40 hover:bg-theme-primary/10 rounded-xl text-left transition-all group/bt group hover:scale-95">
                  <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center text-theme-primary group-hover/btn:bg-theme-primary/20 transition-colors"><Plus className="w-5 h-5" /></div>
                  <div className="min-w-0"><p className="text-theme-main font-black text-xs">Manuel Kayıt Ekle</p><p className="text-theme-dim text-[10px] font-bold mt-0.5 truncate">Tekil veri girişi</p></div>
                </button>
                <button onClick={() => navigate('/records/bulk')} className="w-full flex items-center gap-2 p-2 border border-theme/50 hover:border-theme-primary/40 hover:bg-theme-primary/10 rounded-xl text-left transition-all group/btn mt-1 group hover:scale-95">
                  <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center text-theme-primary group-hover/btn:bg-theme-primary/20 transition-colors"><Activity className="w-5 h-5" /></div>
                  <div className="min-w-0"><p className="text-theme-main font-black text-xs">Hızlı Toplu Giriş</p><p className="text-theme-dim text-[10px] font-bold mt-0.5 truncate">Vardiya bazlı veri girişi</p></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Management Panel */}
        {isCustomizing && (
          <div className="mb-12 animate-premium-page">
            <div className="modern-glass-card border-dashed border-2 border-theme-primary/30 bg-theme-primary/[0.02] p-8 relative overflow-hidden group/m">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-theme-primary/5 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none" />
              
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative z-10">
                <div className="flex flex-col gap-6 max-w-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-theme-primary/10 rounded-lg text-theme-primary">
                      <LayoutIcon className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-theme-main tracking-widest uppercase flex items-center gap-2">MODÜL YÖNETİMİ <Activity className="w-4 h-4 text-theme-primary" /></h2>
                      <p className="text-[10px] font-bold text-theme-muted opacity-60 uppercase tracking-tighter">
                        Görünmesini istediğiniz bileşenleri seçip sürükleyerek sıralayın
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pl-1">
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black text-theme-dim uppercase tracking-widest w-20">Sütun:</span>
                      <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme h-9">
                        <button
                          onClick={() => setGridMode('double')}
                          className={cn(
                            "px-4 rounded-lg text-[9px] font-black transition-all flex items-center gap-2",
                            gridMode === 'double' ? "bg-theme-primary text-white shadow-lg" : "text-theme-muted hover:text-theme-main"
                          )}
                        >
                          <Columns className="w-3 h-3" /> 2 SÜTUN
                        </button>
                        <button
                          onClick={() => setGridMode('single')}
                          className={cn(
                            "px-4 rounded-lg text-[9px] font-black transition-all flex items-center gap-2",
                            gridMode === 'single' ? "bg-theme-primary text-white shadow-lg" : "text-theme-muted hover:text-theme-main"
                          )}
                        >
                          <Square className="w-3 h-3" /> TEK SÜTUN
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black text-theme-dim uppercase tracking-widest w-20">Ölçeklendirme:</span>
                      <button
                        onClick={() => setEqualHeight(!equalHeight)}
                        className={cn(
                          "flex items-center gap-3 px-6 h-9 rounded-xl text-[9px] font-black transition-all border shadow-sm uppercase tracking-widest",
                          equalHeight
                            ? "bg-theme-success/10 text-theme-success border-theme-success/30"
                            : "bg-theme-base/60 text-theme-muted border-theme hover:border-theme-primary/30"
                        )}
                      >
                        <Maximize2 className="w-3 h-3" /> {equalHeight ? 'Eşit Yükseklik Aktif' : 'Esnek Yükseklik'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-wrap items-center justify-center gap-3 py-4 border-l border-theme/20 lg:px-8">
                  {AVAILABLE_WIDGETS.map(widget => {
                    const isActive = currentLayout.some(i => i.id === widget.id);
                    return (
                      <button
                        key={widget.id}
                        onClick={() => toggleWidget(widget.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 h-11 rounded-2xl border transition-all font-black text-[10px] tracking-widest group/w relative",
                          isActive
                            ? 'bg-theme-primary text-white border-theme-primary shadow-xl shadow-theme-primary/20 scale-[1.02]'
                            : 'bg-theme-surface/40 text-theme-muted border-theme hover:border-theme-primary/40 hover:bg-theme-surface'
                        )}
                      >
                        <widget.icon className={cn("w-4 h-4", isActive ? "text-white" : "group-hover/w:text-theme-primary")} />
                        {widget.title.toUpperCase()}
                        {isActive && (
                          <div className="bg-white/20 p-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <button
                    onClick={handleSaveLayout}
                    className="bg-theme-primary hover:bg-theme-primary-hover h-14 w-full text-white px-8 rounded-2xl font-black text-xs shadow-2xl shadow-theme-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10 group/s"
                  >
                    <div className="p-1.5 bg-white/20 rounded-lg group-hover/s:rotate-12 transition-transform">
                      <Save className="w-4 h-4" />
                    </div>
                    <span>DÜZENİ KAYDET</span>
                  </button>
                  <p className="text-[8px] font-bold text-center text-theme-dim opacity-40 uppercase tracking-[0.2em]">Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</p>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Dynamic Masonry Layout */}
        <div className={cn(
          "gap-8 items-start",
          gridMode === 'double' ? "columns-1 lg:columns-2" : "columns-1"
        )}>
          <SortableContext items={currentLayout.map(item => item.id)} strategy={verticalListSortingStrategy}>
            {currentLayout.map((item) => {
              const widget = AVAILABLE_WIDGETS.find(w => w.id === item.id);
              if (!widget) return null;

              // If global mode is 'single', everything is fullWidth implicitly
              const isFullWidth = gridMode === 'single' ? true : item.fullWidth;

              return (
                <DashboardWidget
                  key={widget.id}
                  id={widget.id}
                  title={widget.title}
                  subtitle={widget.subtitle}
                  icon={widget.icon}
                  isCustomizing={isCustomizing}
                  onRemove={() => toggleWidget(widget.id)}
                  fullWidth={isFullWidth}
                  onToggleFullWidth={() => toggleFullWidth(widget.id)}
                  className={cn(equalHeight && "h-full")}
                >
                  {item.id === 'kpis' && (
                    <div className={cn(
                      "grid gap-6 p-1",
                      isFullWidth ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
                    )}>
                      {[
                        { label: t('dashboard.totalMachines', 'TOPLAM MAKİNE'), value: totalMachines.toLocaleString('tr-TR'), icon: Factory, color: 'text-theme-primary', bg: 'bg-theme-primary/10' },
                        { label: t('dashboard.activeProduction', 'AKTİF ÜRETİM'), value: activeMachines.toLocaleString('tr-TR'), icon: Activity, color: 'text-theme-success', bg: 'bg-theme-success/10' },
                        { label: t('dashboard.avgOee', 'ORTALAMA OEE'), value: `%${avgOee}`, icon: BarChart3, color: Number(avgOee) >= 75 ? 'text-theme-success' : 'text-theme-warning', bg: Number(avgOee) >= 75 ? 'bg-theme-success/10' : 'bg-theme-warning/10' },
                        { label: t('dashboard.totalDowntime', 'TOPLAM DURUŞ'), value: `${totalDowntimeMinutes.toLocaleString('tr-TR')} dk`, icon: Clock, color: 'text-theme-danger', bg: 'bg-theme-danger/10' }
                      ].map((kpi, i) => (
                        <div key={i} className="p-4 bg-theme-surface/30 border border-theme rounded-2xl hover:border-theme-primary/30 transition-all group/k flex flex-col justify-between h-36">
                          <div className="flex items-center justify-between">
                            <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color}`}>
                              <kpi.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[8px] font-black text-theme-dim opacity-30 uppercase tracking-widest">{kpi.label.split(' ')[0]}</span>
                          </div>
                          <div className="mt-4">
                            <p className="text-[10px] font-black text-theme-dim opacity-60 uppercase mb-1 tracking-widest">{kpi.label}</p>
                            <h4 className="text-2xl font-black text-theme-main group-hover/k:translate-x-1 transition-transform">{kpi.value}</h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.id === 'performance_chart' && (
                    <div className="h-[400px] mt-4 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={machineOeeData}>
                          <defs>
                            <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" strokeOpacity={0.1} vertical={false} />
                          <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                          <YAxis stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontWeight: 900 }} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                            labelStyle={{ color: 'var(--text-main)', fontWeight: 900, marginBottom: '10px', fontSize: '12px' }}
                            itemStyle={{ color: 'var(--primary)', fontWeight: 900, fontSize: '11px' }}
                          />
                          <Area type="monotone" dataKey="oee" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--bg-card)' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {item.id === 'sales_trend' && (
                    <div className="h-[400px] mt-4 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" strokeOpacity={0.1} vertical={false} />
                          <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                          <YAxis yAxisId="left" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '20px' }} />
                          <Line yAxisId="left" type="monotone" dataKey="amount" name="Ciro" stroke="var(--success)" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line yAxisId="right" type="monotone" dataKey="count" name="Sipariş" stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {item.id === 'stock_summary' && (
                    <div className="h-[400px] mt-4 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockSummary} layout="vertical" margin={{ left: 40, right: 30 }}>
                          <XAxis type="number" stroke="var(--text-dim)" fontSize={10} hide />
                          <YAxis dataKey="name" type="category" stroke="var(--text-dim)" fontSize={10} width={80} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                          <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '15px' }} />
                          <Bar dataKey="quantity" name="Miktar" radius={[0, 10, 10, 0]} barSize={20}>
                            {stockSummary.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--primary)' : 'var(--primary-light)'} fillOpacity={1 - index * 0.1} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {item.id === 'machine_status' && (
                    <div className="flex flex-col col-span-1 lg:col-span-2 overflow-y-auto pr-2 space-y-3 h-[400px] custom-scrollbar mt-4">
                      {machines.map((m) => (
                        <div key={m.id} className="bg-theme-surface/50 border border-theme p-5 rounded-2xl flex items-center justify-between group/m transition-colors hover:border-theme-primary/30">
                          <div className="flex items-center gap-5">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center font-black text-[11px] border shadow-sm",
                              m.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/30' : 'bg-theme-warning/10 text-theme-warning border-theme-warning/20'
                            )}>
                              {m.code.substring(0, 3)}
                            </div>
                            <div>
                              <h4 className="font-black text-theme-main text-sm uppercase tracking-tight italic">{m.code}</h4>
                              <p className="text-[9px] text-theme-muted font-bold uppercase tracking-widest mt-0.5 opacity-50 truncate max-w-[120px]">{m.name}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border",
                            m.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/30' : 'bg-theme-warning/10 text-theme-warning border-theme-warning/30'
                          )}>
                            {m.status === 'active' ? 'ÇALIŞIYOR' : 'MOLA'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.id === 'recent_records' && (
                    <div className="space-y-3 mt-4 overflow-y-auto h-[400px] pr-2 custom-scrollbar">
                      {records.slice(0, 10).map((r) => (
                        <div key={r.id} className="p-4 bg-theme-surface/30 border border-theme rounded-2xl flex items-center justify-between hover:bg-theme-surface/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="text-center bg-theme-base/50 p-2 rounded-xl border border-theme min-w-[50px]">
                              <p className="text-[7px] font-black text-theme-muted uppercase tracking-tighter">GÜN</p>
                              <p className="text-sm font-black text-theme-main">{new Date(r.productionDate).getDate()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-theme-main uppercase">{r.machine.code}</p>
                              <p className="text-[8px] font-bold text-theme-dim uppercase opacity-50">{r.shift.shiftName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[8px] font-black text-theme-dim uppercase opacity-40 mb-1">ÜRETİM</p>
                              <p className="text-xs font-black text-theme-main italic">{r.producedQuantity}</p>
                            </div>
                            <div className={cn(
                              "w-12 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border",
                              r.oee >= 80 ? "bg-theme-success/10 text-theme-success border-theme-success/20" : "bg-theme-warning/10 text-theme-warning border-theme-warning/20"
                            )}>
                              %{r.oee}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DashboardWidget>
              );
            })}
          </SortableContext>
        </div>

        {missingProduction?.summary?.missingEntries > 0 && (
          <MissingProductionInsight
            data={missingProduction}
            machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name }))}
            compact
            title="Eksik Üretim Kaydı Uyarısı (Son 7 Gün)"
          />
        )}
      </div>
    </DndContext>
  );
}

export default Dashboard;
