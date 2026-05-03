import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Building2, Users, Server,
  Settings, ArrowLeft, LogOut, Activity, Globe, Database,
  ChevronRight, Zap, Lock, BarChart3, Eye
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ToastContainer } from '../../components/common/ToastContainer';
import { cn } from '../../lib/utils';

const navItems = [
  {
    section: 'ANA PANEL',
    items: [
      { icon: LayoutDashboard, label: 'Genel Bakış', path: '/superadmin', exact: true },
    ]
  },
  {
    section: 'YÖNETİM',
    items: [
      { icon: Building2, label: 'Şirketler', path: '/superadmin/companies' },
      { icon: Users, label: 'Kullanıcılar', path: '/superadmin/users' },
    ]
  },
  {
    section: 'ALTYAPI',
    items: [
      { icon: Server, label: 'Sistem & Altyapı', path: '/superadmin/system' },
      { icon: Settings, label: 'Uygulama Ayarları', path: '/superadmin/settings' },
    ]
  },
];


export default function SuperAdminLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="h-screen bg-[#0B0F1A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Yetkisiz Erişim</h2>
          <p className="text-slate-400 text-sm">Bu alana yalnızca Süper Yöneticiler erişebilir.</p>
          <button onClick={() => navigate('/')} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition-colors">
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const userInitials = user.fullName
    ? user.fullName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SA';

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#0B0F1A', fontFamily: "'Inter', sans-serif" }}>
      <ToastContainer />

      {/* ── Premium Sidebar ── */}
      <aside className="w-[260px] shrink-0 flex flex-col border-r relative z-40"
        style={{
          background: 'linear-gradient(180deg, #0D1220 0%, #0B0F1A 100%)',
          borderColor: 'rgba(99,102,241,0.12)'
        }}>

        {/* Ambient glow effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }} />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, #818CF8 0%, transparent 70%)' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10 p-5 border-b" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
              <ShieldCheck className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: '#6366F1' }}>SOSTURER</p>
              <p className="text-[11px] font-black text-white leading-tight tracking-tight">Kontrol Merkezi</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[10px] font-black text-slate-300 tracking-widest uppercase">Sistem Aktif</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 overflow-y-auto py-4 px-3 space-y-5 no-scrollbar">
          {navItems.map((section) => (
            <div key={section.section}>
              <p className="text-[9px] font-black tracking-[0.25em] px-3 mb-2" style={{ color: 'rgba(148,163,184,0.4)' }}>
                {section.section}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden",
                        active
                          ? "text-white"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                      style={active ? {
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.1) 100%)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        boxShadow: '0 4px 15px rgba(99,102,241,0.1)'
                      } : {
                        border: '1px solid transparent'
                      }}
                    >
                      {active && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.05) 0%, transparent 100%)' }} />
                      )}
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                        active ? "bg-indigo-500/20" : "bg-slate-800/50 group-hover:bg-slate-700/50"
                      )}>
                        <item.icon className={cn("w-3.5 h-3.5", active ? "text-indigo-400" : "")} size={14} />
                      </div>
                      <span className="text-[11px] font-bold tracking-wide flex-1">{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" size={14} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: User + Actions */}
        <div className="relative z-10 p-3 border-t space-y-2" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
          {/* Back to App */}
          <Link
            to="/"
            className="group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white w-full"
            style={{ border: '1px solid rgba(148,163,184,0.08)' }}
          >
            <div className="w-7 h-7 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/50 flex items-center justify-center shrink-0 transition-all">
              <ArrowLeft className="w-3.5 h-3.5" size={14} />
            </div>
            <span className="text-[11px] font-bold">Ana Uygulamaya Dön</span>
          </Link>

          {/* User Card */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(15,22,38,0.8)', border: '1px solid rgba(99,102,241,0.1)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-indigo-300 shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(79,70,229,0.2) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white truncate">{user.fullName}</p>
              <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#6366F1' }}>Süper Yönetici</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0F1626' }}>
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b"
          style={{ background: 'rgba(13,18,32,0.9)', borderColor: 'rgba(99,102,241,0.1)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {navItems.flatMap(s => s.items).find(item =>
                item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
              ) && (() => {
                const currentItem = navItems.flatMap(s => s.items).find(item =>
                  item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
                )!;
                const Icon = currentItem.icon;
                return (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <Icon className="text-indigo-400" size={14} />
                    </div>
                    <span className="text-[13px] font-black text-slate-200">{currentItem.label}</span>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <Zap className="text-indigo-400" size={12} />
              <span className="text-[10px] font-black text-slate-300 tracking-widest uppercase">SÜPER YÖNETİCİ MODU</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
