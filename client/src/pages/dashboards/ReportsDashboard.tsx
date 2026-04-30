import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  TrendingUp, FileText, Airplay, Package, FileUser,
  ArrowRight, Download, Filter, RefreshCw,
  Activity, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../../components/common/Loading';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

export function ReportsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [machineData, setMachineData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [salesRes, machinesRes, recordsRes] = await Promise.all([
          api.get('/analytics/sales-overview'),
          api.get('/machines'),
          api.get('/production-records')
        ]);

        setProductionData(Array.isArray(salesRes) ? salesRes : []);

        // Calculate machine performance for bar chart
        const machines = Array.isArray(machinesRes) ? machinesRes : [];
        const records = Array.isArray(recordsRes) ? recordsRes : [];

        const mData = machines.map(m => {
          const mRecords = records.filter(r => r.machineId === m.id && r.oee !== null);
          const avgOee = mRecords.length > 0
            ? (mRecords.reduce((sum, r) => sum + r.oee, 0) / mRecords.length)
            : 0;
          return { name: m.code, oee: Math.round(avgOee) };
        }).sort((a, b) => b.oee - a.oee).slice(0, 5);

        setMachineData(mData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const reportCards = [
    { title: 'GENEL RAPORLAR', desc: 'Üretim, fire ve duruş özetleri', icon: FileText, path: '/reports/general', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'MAKİNE ANALİZİ', desc: 'OEE ve makine bazlı verimlilik', icon: Airplay, path: '/reports/machines', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'ÜRÜN RAPORLARI', desc: 'Lot izlenebilirliği ve miktar analizi', icon: Package, path: '/reports/products', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'PERSONEL RAPORU', desc: 'Operatör performans ve süreleri', icon: FileUser, path: '/reports/operators', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  ];

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase tracking-tight">Raporlar</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60 leading-none">
            Operasyonel Verimlilik ve Performans Analizi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 p-2 rounded-xl bg-theme-surface border border-theme text-theme-muted hover:text-theme-primary hover:bg-theme-primary/10 hover:border-theme-primary/30 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="h-9 flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-[0.2em] bg-theme-primary text-white shadow-xl shadow-theme-primary/20">
            <Download className="w-4 h-4" /> DIŞA AKTAR
          </button>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportCards.map((card, i) => (
          <button
            key={i}
            onClick={() => navigate(card.path)}
            className="modern-glass-card p-6 flex flex-col items-start gap-4 hover:border-theme-primary/40 transition-all group/c text-left"
          >
            <div className={`w-12 h-12 rounded-2xl ${card.bg} ${card.color} flex items-center justify-center group-hover/c:scale-110 transition-transform`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-theme-main uppercase tracking-tight">{card.title}</h4>
              <p className="text-[10px] font-bold text-theme-dim opacity-60 mt-1 leading-tight">{card.desc}</p>
            </div>
            <div className="mt-auto pt-2 flex items-center gap-2 text-[10px] font-black text-theme-primary opacity-0 group-hover/c:opacity-100 transition-all translate-x-[-10px] group-hover/c:translate-x-0">
              İNCELE <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Production Trend */}
        <div className="modern-glass-card p-6 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-theme-main uppercase flex items-center gap-2">
                ÜRETİM TRENDİ <TrendingUp className="w-4 h-4 text-theme-success" />
              </h3>
              <p className="text-[10px] font-bold text-theme-dim opacity-60">Son 30 Günlük Veri Akışı</p>
            </div>
            <div className="flex bg-theme-main/3 p-0.75 rounded-lg border border-theme">
              <button className="px-3 py-1 rounded-md text-[9px] font-black bg-theme-base text-theme-main shadow-sm">GÜNLÜK</button>
              <button className="px-3 py-1 rounded-md text-[9px] font-black text-theme-muted">HAFTALIK</button>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionData}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={9} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                <YAxis stroke="var(--text-dim)" fontSize={9} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '15px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 900, fontSize: '12px', color: 'var(--text-main)' }}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Machines */}
        <div className="modern-glass-card p-6 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-theme-main uppercase flex items-center gap-2">
                MAKİNE PERFORMANSI <Activity className="w-4 h-4 text-theme-primary" />
              </h3>
              <p className="text-[10px] font-bold text-theme-dim opacity-60">En Yüksek OEE Değerine Sahip 5 Makine</p>
            </div>
            <Filter className="w-4 h-4 text-theme-muted cursor-pointer hover:text-theme-primary" />
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} width={60} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px' }} />
                <Bar dataKey="oee" radius={[0, 8, 8, 0]} barSize={24}>
                  {machineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.oee >= 80 ? 'var(--success)' : entry.oee >= 60 ? 'var(--warning)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 p-4 bg-theme-main/5 border border-theme rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-theme-warning" />
              <span className="text-[10px] font-bold text-theme-main uppercase">Düşük Performanslı Makineler Tespit Edildi</span>
            </div>
            <button className="text-[10px] font-black text-theme-primary hover:underline uppercase">DETAYLARI GÖR</button>
          </div>
        </div>
      </div>
    </div>
  );
}
