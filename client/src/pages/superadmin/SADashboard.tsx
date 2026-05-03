import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Building2, Users, Database, Server, TrendingUp, Activity,
  Clock, ArrowUpRight, Zap, AlertCircle, CheckCircle2, RefreshCw,
  Plus, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface DashStats {
  companies: Company[];
  users: User[];
  systemInfo: SystemInfo | null;
}

interface Company {
  id: string;
  name: string;
  sector: string;
  createdAt: string;
  _count: { users: number; productionRecords: number };
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  company?: { name: string };
}

interface SystemInfo {
  version: string;
  ip: string;
  port: string;
  os: string;
  uptime: number;
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{count.toLocaleString('tr-TR')}</>;
}

function StatCard({
  label, value, sub, icon: Icon, gradient, glow, trend
}: {
  label: string; value: string | number; sub?: string;
  icon: any; gradient: string; glow: string; trend?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
      style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
      {/* BG Gradient */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ background: gradient }} />
      {/* Glow */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 pointer-events-none blur-xl"
        style={{ background: glow }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${glow}20`, border: `1px solid ${glow}30` }}>
            <Icon size={20} style={{ color: glow }} />
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
              style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
              <TrendingUp size={10} />
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
        <p className="text-3xl font-black text-white mb-1 tracking-tight">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </p>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">{label}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function SADashboard() {
  const [data, setData] = useState<DashStats>({ companies: [], users: [], systemInfo: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [companies, users, systemInfo] = await Promise.all([
        api.get('/system/companies'),
        api.get('/system/users'),
        api.get('/system/info'),
      ]);
      setData({ companies: companies || [], users: users || [], systemInfo });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const totalRecords = data.companies.reduce((acc, c) => acc + c._count.productionRecords, 0);
  const activeUsers = data.users.filter(u => u.status === 'active').length;
  const recentCompanies = [...data.companies].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  const recentUsers = [...data.users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const uptimeHours = data.systemInfo ? Math.floor(data.systemInfo.uptime / 3600) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center animate-spin"
            style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid transparent', borderTopColor: '#6366F1' }} />
          <p className="text-slate-400 text-sm font-bold">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase">Kontrol Merkezi</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Genel Bakış</h1>
          <p className="text-slate-400 text-sm mt-1">Tüm sistem metriklerini ve şirket aktivitelerini görüntüleyin.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAll(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white transition-all text-[11px] font-bold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Yenile
          </button>
          <button
            onClick={() => navigate('/superadmin/companies')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white transition-all text-[11px] font-black"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
          >
            <Plus size={13} />
            Şirket Ekle
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Toplam Şirket"
          value={data.companies.length}
          sub={`${data.companies.length} kayıtlı şirket`}
          icon={Building2}
          gradient="linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)"
          glow="#6366F1"
        />
        <StatCard
          label="Aktif Kullanıcı"
          value={activeUsers}
          sub={`${data.users.length} toplam kullanıcı`}
          icon={Users}
          gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
          glow="#10B981"
        />
        <StatCard
          label="Toplam Üretim Kaydı"
          value={totalRecords}
          sub="Tüm şirketler"
          icon={Database}
          gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
          glow="#F59E0B"
        />
        <StatCard
          label="Sistem Uptime"
          value={`${uptimeHours}s`}
          sub={data.systemInfo?.os || '---'}
          icon={Server}
          gradient="linear-gradient(135deg, #EC4899 0%, #DB2777 100%)"
          glow="#EC4899"
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent Companies */}
        <div className="xl:col-span-2 rounded-2xl overflow-hidden"
          style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Building2 className="text-indigo-400" size={16} />
              </div>
              <div>
                <p className="text-[13px] font-black text-white">Son Eklenen Şirketler</p>
                <p className="text-[10px] text-slate-500 font-bold">{data.companies.length} şirket kayıtlı</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/superadmin/companies')}
              className="flex items-center gap-1 text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
            >
              Tümü <ChevronRight size={12} />
            </button>
          </div>

          <div className="p-4 space-y-2">
            {recentCompanies.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
                Henüz şirket eklenmemiş
              </div>
            ) : (
              recentCompanies.map((company, idx) => (
                <div
                  key={company.id}
                  onClick={() => navigate(`/superadmin/companies/${company.id}`)}
                  className="group flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all hover:-translate-x-0"
                  style={{ border: '1px solid transparent' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.05)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-indigo-300"
                    style={{
                      background: `linear-gradient(135deg, ${['rgba(99,102,241,0.2)', 'rgba(16,185,129,0.2)', 'rgba(245,158,11,0.2)', 'rgba(236,72,153,0.2)', 'rgba(14,165,233,0.2)', 'rgba(168,85,247,0.2)'][idx % 6]} 0%, transparent 100%)`,
                      border: `1px solid ${['rgba(99,102,241,0.3)', 'rgba(16,185,129,0.3)', 'rgba(245,158,11,0.3)', 'rgba(236,72,153,0.3)', 'rgba(14,165,233,0.3)', 'rgba(168,85,247,0.3)'][idx % 6]}`
                    }}>
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white group-hover:text-indigo-300 transition-colors truncate">{company.name}</p>
                    <p className="text-[10px] text-slate-500 truncate font-bold uppercase tracking-wider">{company.sector || 'Sektör belirtilmemiş'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-[13px] font-black text-white">{company._count.users}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">Üye</p>
                    </div>
                    <div className="w-px h-6 bg-slate-700" />
                    <div className="text-center">
                      <p className="text-[13px] font-black text-white">{company._count.productionRecords}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">Kayıt</p>
                    </div>
                    <ChevronRight className="text-slate-600 group-hover:text-indigo-400 transition-colors" size={14} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* System Health */}
          <div className="rounded-2xl p-5"
            style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <Activity className="text-emerald-400" size={14} />
              </div>
              <p className="text-[12px] font-black text-white">Sistem Sağlığı</p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'API Sunucu', value: 'Çevrimiçi', ok: true },
                { label: 'Veritabanı', value: 'Bağlı', ok: true },
                { label: 'Sürüm', value: data.systemInfo?.version || 'v1.0', ok: true },
                { label: 'Port', value: data.systemInfo?.port || '3001', ok: true },
                { label: 'IP Adresi', value: data.systemInfo?.ip || '127.0.0.1', ok: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px] font-bold text-slate-400">{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${row.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="text-[11px] font-black text-white">{row.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Users */}
          <div className="rounded-2xl p-5"
            style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Users className="text-indigo-400" size={14} />
                </div>
                <p className="text-[12px] font-black text-white">Son Kullanıcılar</p>
              </div>
              <button onClick={() => navigate('/superadmin/users')} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300">
                Tümü →
              </button>
            </div>
            <div className="space-y-2">
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-300 shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-200 truncate">{u.fullName}</p>
                    <p className="text-[9px] text-slate-500 truncate">{u.company?.name || 'Atanmamış'}</p>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${u.role === 'superadmin' ? 'text-indigo-400 bg-indigo-500/10' : u.role === 'admin' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 bg-slate-500/10'}`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Hızlı Eylemler</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Yeni Şirket', sub: 'Sisteme şirket ekle', icon: Building2, color: '#6366F1', path: '/superadmin/companies' },
            { label: 'Yeni Kullanıcı', sub: 'Global kullanıcı oluştur', icon: Users, color: '#10B981', path: '/superadmin/users' },
            { label: 'Sistem Durumu', sub: 'Altyapı detayları', icon: Server, color: '#F59E0B', path: '/superadmin/system' },
            { label: 'Ayarlar', sub: 'Uygulama yapılandırması', icon: Zap, color: '#EC4899', path: '/superadmin/settings' },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="group flex flex-col gap-3 p-5 rounded-2xl text-left transition-all hover:-translate-y-1"
              style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${action.color}30`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.12)'; }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                <action.icon size={18} style={{ color: action.color }} />
              </div>
              <div>
                <p className="text-[12px] font-black text-white">{action.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{action.sub}</p>
              </div>
              <ArrowUpRight className="text-slate-600 group-hover:text-slate-300 transition-colors ml-auto" size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
