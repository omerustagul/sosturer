import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import {
  Activity, Settings, Clock, Factory, BarChart3,
  Plus, ChevronRight, Layout as LayoutIcon,
  X, Check, Save
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Loading } from '../components/common/Loading';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from 'react-i18next';
import { notify } from '../store/notificationStore';

// Widget Types
type WidgetId = 'kpis' | 'performance_chart' | 'machine_status' | 'recent_records';

interface Widget {
  id: WidgetId;
  title: string;
  description: string;
  icon: any;
}

const AVAILABLE_WIDGETS: Widget[] = [
  { id: 'kpis', title: 'Temel Göstergeler (KPI)', description: 'Toplam tezgah, OEE ve duruş süreleri', icon: Activity },
  { id: 'performance_chart', title: 'Performans Haritası', description: 'Tezgahlara göre OEE ve verimlilik grafiği', icon: BarChart3 },
  { id: 'machine_status', title: 'Tezgah Durumları', description: 'Canlı tezgah çalışma ve arıza bilgileri', icon: Settings },
  { id: 'recent_records', title: 'Son Kayıtlar', description: 'Sisteme girilen en yeni üretim verileri', icon: Clock },
];

function Dashboard() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();
  const [machines, setMachines] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Parse layout from settings or use default
  const defaultLayout: WidgetId[] = ['kpis', 'performance_chart', 'machine_status', 'recent_records'];
  const [currentLayout, setCurrentLayout] = useState<WidgetId[]>([]);

  useEffect(() => {
    if (settings?.dashboardLayout) {
      try {
        const parsed = JSON.parse(settings.dashboardLayout);
        setCurrentLayout(Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultLayout);
      } catch (e) {
        setCurrentLayout(defaultLayout);
      }
    } else {
      setCurrentLayout(defaultLayout);
    }
  }, [settings?.dashboardLayout]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [machinesRes, recordsRes] = await Promise.all([
          api.get('/machines'),
          api.get('/production-records')
        ]);
        setMachines(machinesRes);
        setRecords(recordsRes);
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // SOCKET.IO REALTIME INTEGRATION
    const API_URL =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

    const socketioHost = API_URL.startsWith('http')
      ? API_URL.replace(/\/api\/$/, '')
      : window.location.origin;

    const socket: Socket = io(socketioHost);

    socket.on('connect', () => {
      socket.emit('joinDashboard');
    });

    socket.on('dashboardUpdate', (payload) => {
      if (payload.action === 'CREATED_RECORD' && payload.record) {
        setRecords(prev => [payload.record, ...prev]);
      }
    });

    return () => {
      socket.disconnect();
    };

  }, []);

  const handleSaveLayout = async () => {
    try {
      await updateSettings({
        ...settings!,
        dashboardLayout: JSON.stringify(currentLayout)
      });
      setIsCustomizing(false);
      notify.success('Düzen Kaydedildi', 'Dashboard düzeni başarıyla güncellendi.');
    } catch (error) {
      notify.error('Hata', 'Düzen kaydedilirken bir hata oluştu.');
    }
  };

  const toggleWidget = (id: WidgetId) => {
    if (currentLayout.includes(id)) {
      setCurrentLayout(prev => prev.filter(wId => wId !== id));
    } else {
      setCurrentLayout(prev => [...prev, id]);
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  // Calculate generic KPIs
  const totalMachines = machines.length;
  const activeMachines = machines.filter(m => m.status === 'active').length;
  const validOeeRecords = records.filter(r => r.oee !== null && r.oee !== undefined);
  const avgOee = validOeeRecords.length > 0
    ? (validOeeRecords.reduce((sum, r) => sum + r.oee, 0) / validOeeRecords.length).toFixed(1)
    : '0.0';
  const totalDowntimeMinutes = records.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);
  const totalDowntimeMinutesLong = totalDowntimeMinutes.toLocaleString('tr-TR');

  // Machine OEE data
  const machineOeeData = machines.map(machine => {
    const machineRecords = records.filter(r => r.machineId === machine.id && r.oee !== null);
    if (machineRecords.length === 0) return { name: machine.code, oee: 0, availability: 0, performance: 0, quality: 0 };
    const mAvgOee = machineRecords.reduce((sum, r) => sum + r.oee, 0) / machineRecords.length;
    const mAvgAvl = machineRecords.reduce((sum, r) => sum + (r.availability || 0), 0) / machineRecords.length;
    const mAvgPrf = machineRecords.reduce((sum, r) => sum + (r.performance || 0), 0) / machineRecords.length;
    const mAvgQlt = machineRecords.reduce((sum, r) => sum + (r.quality || 0), 0) / machineRecords.length;
    return {
      name: machine.code,
      oee: Number(mAvgOee.toFixed(1)),
      availability: Number(mAvgAvl.toFixed(1)),
      performance: Number(mAvgPrf.toFixed(1)),
      quality: Number(mAvgQlt.toFixed(1))
    };
  });

  return (
    <div className="p-6 lg:p-8 w-full space-y-8 bg-theme-base animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-theme-main tracking-tight uppercase italic">{t('dashboard.title', 'GENEL BAKIŞ')}</h2>
          <p className="text-theme-dim text-[10px] mt-1 font-bold uppercase tracking-[0.2em] opacity-60">
            {t('dashboard.subtitle', 'GERÇEK ZAMANLI ÜRETİM VERİ ANALİZİ VE PANEL YÖNETİMİ')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs transition-all border shadow-lg ${isCustomizing ? 'bg-theme-main text-theme-base border-theme-main' : 'bg-theme-surface/80 text-theme-main border-theme hover:border-theme-primary/40'}`}
          >
            {isCustomizing ? <X className="w-4 h-4" /> : <LayoutIcon className="w-4 h-4" />}
            {isCustomizing ? 'DÜZENLEMEDEN ÇIK' : 'PANELİ DÜZENLE'}
          </button>

          <div
            className="relative"
            onMouseEnter={() => setShowAddOptions(true)}
            onMouseLeave={() => setShowAddOptions(false)}
          >
            <button className="bg-theme-primary hover:opacity-90 text-white px-6 py-3 rounded-xl font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-3 active:scale-95 text-xs">
              {t('dashboard.newRecord', 'YENİ KAYIT')}
              <ChevronRight className={`w-4 h-4 transition-transform ${showAddOptions ? 'rotate-90' : ''}`} />
            </button>

            <div className={`absolute right-0 top-full mt-3 w-72 bg-theme-base border border-theme rounded-2xl p-2 shadow-2xl z-50 transition-all duration-300 origin-top-right ${showAddOptions ? 'scale-100 opacity-100 visible' : 'scale-95 opacity-0 invisible translate-y-2'}`}>
              <button onClick={() => navigate('/records/new')} className="w-full flex items-center gap-4 p-3 hover:bg-theme-primary/10 rounded-xl text-left transition-all group/btn">
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center group-hover/btn:bg-theme-primary/20 transition-colors"><Plus className="w-5 h-5 text-theme-primary" /></div>
                <div className="min-w-0"><p className="text-theme-main font-black text-xs uppercase tracking-widest truncate">Manuel Kayıt Ekle</p><p className="text-theme-dim text-[10px] font-bold mt-0.5 truncate">Tekil üretim kaydı oluşturun</p></div>
              </button>
              <button onClick={() => navigate('/records/bulk')} className="w-full flex items-center gap-4 p-3 hover:bg-theme-primary/10 rounded-xl text-left transition-all group/btn mt-1">
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center group-hover/btn:bg-theme-primary/20 transition-colors"><Activity className="w-5 h-5 text-theme-primary" /></div>
                <div className="min-w-0"><p className="text-theme-main font-black text-xs uppercase tracking-widest truncate">Hızlı Toplu Giriş</p><p className="text-theme-dim text-[10px] font-bold mt-0.5 truncate">Vardiya bazlı matris giriş</p></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customization Bar */}
      {isCustomizing && (
        <div className="bg-theme-primary/5 border border-theme-primary/20 rounded-2xl p-3 animate-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-theme-main uppercase tracking-tighter italic">BİLEŞEN YÖNETİMİ</h4>
              <p className="text-[10px] font-bold text-theme-dim uppercase tracking-widest">Dashboard'da görünmesini istediğiniz modülleri seçin</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {AVAILABLE_WIDGETS.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`flex items-center gap-3 p-3 h-11 rounded-xl border transition-all font-black text-[10px] tracking-widest ${currentLayout.includes(widget.id) ? 'bg-theme-primary text-white border-theme-primary shadow-lg shadow-theme-primary/20' : 'bg-theme-surface/50 text-theme-muted border-theme hover:border-theme-primary/40'}`}
                >
                  <widget.icon className="w-4 h-4" />
                  {widget.title.toUpperCase()}
                  {currentLayout.includes(widget.id) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveLayout}
              className="bg-theme-success h-11 w-auto min-w-42 text-white p-3 rounded-xl font-black text-xs tracking-widest shadow-xl shadow-theme-success/20 active:scale-95 transition-all flex items-center gap-3"
            >
              <Save className="w-4 h-4" /> DÜZENİ KAYDET
            </button>
          </div>
        </div>
      )}

      {/* Render Dynamic Widgets */}
      <div className="space-y-10">
        {currentLayout.map((widgetId) => (
          <div key={widgetId} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {widgetId === 'kpis' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: t('dashboard.totalMachines', 'TOPLAM TEZGAH'), value: totalMachines.toLocaleString('tr-TR'), icon: Factory, color: 'text-theme-primary', bg: 'bg-theme-primary/10', border: 'border-theme-primary/20' },
                  { label: t('dashboard.activeProduction', 'AKTİF ÜRETİM'), value: activeMachines.toLocaleString('tr-TR'), icon: Activity, color: 'text-theme-success', bg: 'bg-theme-success/10', border: 'border-theme-success/20' },
                  { label: t('dashboard.avgOee', 'ORTALAMA OEE'), value: `%${avgOee}`, icon: BarChart3, color: Number(avgOee) >= 75 ? 'text-theme-success' : 'text-theme-warning', bg: Number(avgOee) >= 75 ? 'bg-theme-success/10' : 'bg-theme-warning/10', border: Number(avgOee) >= 75 ? 'border-theme-success/20' : 'border-theme-warning/20' },
                  { label: t('dashboard.totalDowntime', 'TOPLAM DURUŞ'), value: `${totalDowntimeMinutesLong} dk`, icon: Clock, color: 'text-theme-danger', bg: 'bg-theme-danger/10', border: 'border-theme-danger/20' }
                ].map((kpi, i) => (
                  <div key={i} className={`bg-theme-card border ${kpi.border} rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden`}>
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest opacity-60 leading-none mb-2">{kpi.label}</p>
                        <h3 className="text-3xl font-black text-theme-main tracking-tighter italic">{kpi.value}</h3>
                      </div>
                      <div className={`p-3 rounded-2xl ${kpi.bg}`}>
                        <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {widgetId === 'performance_chart' && (
              <div className="bg-theme-card border border-theme rounded-[2.5rem] p-10 h-[550px] flex flex-col shadow-xl shadow-theme-main/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-theme-primary/5 rounded-full blur-[100px] -mr-48 -mt-48" />
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-theme-primary/10 rounded-2xl border border-theme-primary/20">
                      <BarChart3 className="w-7 h-7 text-theme-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-theme-main uppercase tracking-tighter italic">{t('dashboard.chart.title', 'Performans Haritası')}</h3>
                      <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-1 opacity-50">Metriklerin üretim hatları arası karşılaştırmalı analizi</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-[9px] font-black uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-theme-primary rounded-full" /> OEE</div>
                    <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-theme-success rounded-full" /> AVL</div>
                    <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-theme-warning rounded-full" /> PRF</div>
                    <div className="flex items-center gap-2"><div className="w-8 h-1.5 bg-purple-500 rounded-full" /> QLT</div>
                  </div>
                </div>
                <div className="flex-1 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={machineOeeData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" strokeOpacity={0.2} vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} height={60} angle={-35} textAnchor="end" tick={{ fontWeight: 900 }} />
                      <YAxis stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontWeight: 900 }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '20px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', padding: '5px 0' }}
                        labelStyle={{ fontSize: '14px', fontWeight: 900, marginBottom: '15px', color: 'var(--primary)', letterSpacing: '0.05em' }}
                        formatter={(v: any) => [`%${v}`, '']}
                      />
                      <Line type="monotone" dataKey="oee" stroke="var(--primary)" strokeWidth={4} dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--bg-card)', strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 4 }} />
                      <Line type="monotone" dataKey="availability" stroke="var(--success)" strokeWidth={3} strokeDasharray="8 4" dot={{ r: 3, fill: 'var(--success)', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="performance" stroke="var(--warning)" strokeWidth={3} strokeDasharray="4 4" dot={{ r: 3, fill: 'var(--warning)', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="quality" stroke="#a855f7" strokeWidth={3} strokeDasharray="2 2" dot={{ r: 3, fill: '#a855f7', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {widgetId === 'machine_status' && (
              <div className="bg-theme-card border border-theme rounded-[2.5rem] p-10 h-[550px] flex flex-col shadow-xl shadow-theme-main/5 relative overflow-hidden group">
                <div className="flex items-center gap-5 mb-10">
                  <div className="p-4 bg-theme-primary/10 rounded-2xl border border-theme-primary/20">
                    <Settings className="w-7 h-7 text-theme-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-theme-main uppercase tracking-tighter italic">{t('dashboard.machines.title', 'Tezgah Durumları')}</h3>
                    <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-1 opacity-50">Üretim hattındaki canlı çalışma verileri</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                  {machines.map((machine) => (
                    <div key={machine.id} className="bg-theme-surface/50 border border-theme p-6 rounded-2xl hover:border-theme-primary/30 transition-all flex items-center justify-between group/item">
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-sm border shadow-sm ${machine.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : 'bg-theme-warning/10 text-theme-warning border-theme-warning/20'}`}>
                          {machine.code.substring(0, 3)}
                        </div>
                        <div>
                          <h4 className="font-black text-theme-main text-lg uppercase tracking-tight italic">{machine.code}</h4>
                          <p className="text-[10px] text-theme-muted font-bold uppercase tracking-widest mt-1 opacity-60">{machine.name}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border ${machine.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/30' : 'bg-theme-warning/10 text-theme-warning border-theme-warning/30'}`}>
                          {machine.status === 'active' ? 'AKTİF ÇALIŞIYOR' : 'MOLA / BAKIM'}
                        </span>
                        <div className="flex gap-1.5 h-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`w-3 rounded-full ${machine.status === 'active' ? 'bg-theme-success/40' : 'bg-theme-warning/40'} ${i === 5 && 'animate-pulse'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {widgetId === 'recent_records' && (
              <div className="bg-theme-card border border-theme rounded-[2.5rem] overflow-hidden shadow-xl shadow-theme-main/5">
                <div className="p-10 border-b border-theme flex flex-col md:flex-row md:items-center justify-between gap-6 bg-theme-surface/20">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-theme-primary/10 rounded-2xl border border-theme-primary/20">
                      <Clock className="w-7 h-7 text-theme-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-theme-main uppercase tracking-tighter italic">Son Kayıtlar</h3>
                      <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-1 opacity-50">En son girilen 5 veri kaydı</p>
                    </div>
                  </div>
                  <Link to="/records" className="flex items-center gap-3 px-8 py-3.5 bg-theme-base border border-theme rounded-2xl text-[11px] font-black text-theme-primary hover:bg-theme-primary hover:text-white transition-all uppercase tracking-[0.2em]">
                    TÜMÜNÜ GÖR <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-theme-base/10">
                        <th className="px-10 py-6 text-[10px] font-black text-theme-dim uppercase tracking-[0.3em]">TARİH</th>
                        <th className="px-10 py-6 text-[10px] font-black text-theme-dim uppercase tracking-[0.3em]">TEZGAH</th>
                        <th className="px-10 py-6 text-[10px] font-black text-theme-dim uppercase tracking-[0.3em]">VARDİYA</th>
                        <th className="px-10 py-6 text-[10px] font-black text-theme-dim uppercase tracking-[0.3em]">ÜRETİM</th>
                        <th className="px-10 py-6 text-[10px] font-black text-theme-dim uppercase tracking-[0.3em] text-right">OEE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/20">
                      {records.slice(0, 5).map(r => (
                        <tr key={r.id} className="hover:bg-theme-primary/5 transition-all">
                          <td className="px-10 py-6"><span className="text-xs font-black text-theme-dim bg-theme-base px-3 py-1.5 rounded-lg border border-theme">{new Date(r.productionDate).toLocaleDateString('tr-TR')}</span></td>
                          <td className="px-10 py-6"><span className="text-sm font-black text-theme-main uppercase">{r.machine.code}</span></td>
                          <td className="px-10 py-6 text-xs font-bold text-theme-muted uppercase">{r.shift.shiftName}</td>
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 max-w-[100px] h-1.5 bg-theme-base rounded-full overflow-hidden"><div className="h-full bg-theme-primary" style={{ width: `${Math.min((r.producedQuantity / (r.plannedQuantity || 1)) * 100, 100)}%` }} /></div>
                              <span className="text-xs font-black text-theme-main italic">{r.producedQuantity}</span>
                            </div>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <span className={`px-4 py-1.5 rounded-xl text-xs font-black border ${r.oee >= 80 ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : r.oee >= 60 ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' : 'bg-theme-danger/10 text-theme-danger border-theme-danger/20'}`}>%{r.oee}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
