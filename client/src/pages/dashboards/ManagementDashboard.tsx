import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  ShieldCheck, Users, Building2, Database, Mail,
  Activity, CheckCircle2, ArrowRight, UserPlus, Cog
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../../components/common/Loading';
import { cn } from '../../lib/utils';

export function ManagementDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    activeUsers: 0,
    roles: 0
  });
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [users, company, roles] = await Promise.all([
          api.get('/auth/company/users'),
          api.get('/auth/company'),
          api.get('/department-roles')
        ]);

        setStats({
          users: users.length,
          activeUsers: users.filter((u: any) => u.status === 'active').length,
          roles: roles.length
        });

        setCompanyInfo(company);
        setRecentUsers(users.slice(0, 4));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const systemStatus = [
    { label: 'Veritabanı', status: 'Bağlı', icon: Database, color: 'text-theme-success' },
    { label: 'E-posta Servisi', status: 'Aktif', icon: Mail, color: 'text-theme-success' },
    { label: 'Güvenlik Katmanı', status: 'Korunuyor', icon: ShieldCheck, color: 'text-theme-primary' },
    { label: 'Yedekleme', status: 'Güncel', icon: Activity, color: 'text-theme-success' },
  ];

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase tracking-tight">YÖNETİM DASHBOARD</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60 leading-none">
            Sistem Yönetimi ve Kurumsal Yapılandırma
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-[0.2em] bg-theme-surface border border-theme text-theme-main hover:border-theme-primary/40 transition-all shadow-lg"
          >
            <Cog className="w-4 h-4" /> SİSTEM AYARLARI
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Users */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: 'TOPLAM KULLANICI', value: stats.users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'AKTİF OTURUM', value: stats.activeUsers, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'TANIMLI ROL', value: stats.roles, icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            ].map((stat, i) => (
              <div key={i} className="modern-glass-card p-6 flex flex-col gap-4">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest opacity-60">{stat.label}</p>
                  <h4 className="text-2xl font-black text-theme-main">{stat.value}</h4>
                </div>
              </div>
            ))}
          </div>

          <div className="modern-glass-card">
            <div className="p-3 bg-theme-base rounded-2xl border-b border-theme/20 flex items-center justify-between">
              <h3 className="text-sm font-black text-theme-main uppercase">SON KULLANICI HAREKETLERİ</h3>
              <button
                onClick={() => navigate('/users')}
                className="text-[10px] font-black text-theme-primary hover:underline uppercase flex items-center gap-2"
              >
                TÜMÜNÜ GÖR <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recentUsers.map((u, i) => (
                  <div key={i} className="p-4 rounded-2xl hover:bg-theme-main/5 transition-all flex items-center justify-between group/u border border-transparent hover:border-theme/20">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-theme-surface border border-theme flex items-center justify-center font-black text-theme-primary text-[10px]">
                        {u.fullName.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-black text-theme-main">{u.fullName}</p>
                        <p className="text-[10px] font-bold text-theme-dim opacity-60 uppercase">{u.role}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      u.status === 'active' ? 'bg-theme-success shadow-[0_0_8px_var(--success-glow)]' : 'bg-theme-muted'
                    )} />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-theme/20">
              <button
                onClick={() => navigate('/users')}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-theme-main hover:text-theme-primary transition-colors"
              >
                <UserPlus className="w-4 h-4" /> YENİ KULLANICI DAVET ET
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Company & System */}
        <div className="space-y-8">
          <div className="modern-glass-card p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-theme-main/5 rounded-3xl border border-theme flex items-center justify-center">
                <Building2 className="w-10 h-10 text-theme-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-theme-main uppercase leading-tight">{companyInfo?.name || 'YÜKLENİYOR...'}</h3>
                <p className="text-[10px] font-bold text-theme-dim opacity-60 uppercase tracking-[0.2em] mt-1">KURUMSAL KİMLİK</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-theme-surface/50 border border-theme rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-black text-theme-dim uppercase">E-POSTA</span>
                <span className="text-[10px] font-bold text-theme-main">{companyInfo?.email || '-'}</span>
              </div>
              <div className="p-3 bg-theme-surface/50 border border-theme rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-black text-theme-dim uppercase">TELEFON</span>
                <span className="text-[10px] font-bold text-theme-main">{companyInfo?.phone || '-'}</span>
              </div>
              <div className="p-3 bg-theme-surface/50 border border-theme rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-black text-theme-dim uppercase">VERGİ NO</span>
                <span className="text-[10px] font-bold text-theme-main">{companyInfo?.taxNumber || '-'}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/company')}
              className="w-full py-3 rounded-xl border border-theme-primary/30 text-theme-primary font-black text-[10px] tracking-widest hover:bg-theme-primary/5 transition-all"
            >
              ŞİRKET BİLGİLERİNİ DÜZENLE
            </button>
          </div>

          <div className="modern-glass-card overflow-hidden">
            <div className="p-4 bg-theme-main/5 border-b border-theme/20">
              <h3 className="text-[10px] font-black text-theme-main tracking-widest uppercase">SİSTEM DURUMU</h3>
            </div>
            <div className="p-4 space-y-4">
              {systemStatus.map((s, i) => (
                <div key={i} className="flex items-center justify-between group/status">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-theme-main/5 text-theme-muted group-hover/status:text-theme-primary transition-colors">
                      <s.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-theme-main uppercase tracking-tight">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase ${s.color}`}>{s.status}</span>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${s.color}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-theme/20 text-center">
              <p className="text-[9px] font-bold text-theme-dim opacity-50 italic">Sistem en son 5 dakika önce kontrol edildi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

