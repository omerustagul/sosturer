import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bolt, DiamondPlus, Logs, ChartArea, FileChartPie, ScanBarcode, CalendarRange,
  Settings, BarChart3, LogOut, TextAlignStart, Airplay,
  ChevronLeft, ChevronRight, Package, FileUser, User, ShieldCheck, Factory,
  Bell, Globe, Building2, Warehouse, ShoppingCart, History, LayoutGrid, Boxes, GanttChart, Wrench,
  Clock, Moon, Sun, Activity
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { ToastContainer } from './common/ToastContainer';
import { NotificationPanel } from './layout/NotificationPanel';
import { Tooltip } from './common/Tooltip';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';


export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, company, logout } = useAuthStore();

  if (!user) return null;

  const companyName = company?.name || 'Sosturer Metal Teknolojileri A.Ş.';
  const userFullName = user.fullName || '';
  const userEmail = user.email || '';
  const userAvatarUrl = user.avatarUrl || '';
  const userInitials = userFullName ? userFullName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase() : 'AD';


  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{ ip: string, port: string } | null>(null);
  const [workStatus, setWorkStatus] = useState<{
    type: 'shift' | 'overtime' | 'closed';
    label: string;
    details: string;
  }>({ type: 'closed', label: 'Tesis Kapalı', details: 'Mesai dışı' });
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const checkUnreadNotifications = async () => {
    try {
      const [activity, systemNotifications] = await Promise.all([
        api.get('/system/activity'),
        api.get('/notifications')
      ]);
      const hasUnread = activity.some((log: any) => !log.isRead) ||
        systemNotifications.some((n: any) => !n.isRead);
      setHasUnreadNotifications(hasUnread);
    } catch (err) { }
  };

  const fetchWorkStatus = async () => {
    try {
      const today = new Date();
      const nowTotal = today.getHours() * 60 + today.getMinutes();

      const [shifts, overtimePlans] = await Promise.all([
        api.get('/shifts'),
        api.get('/overtime')
      ]);

      // 1. Check Shifts
      const activeShift = shifts.find((shift: any) => {
        if (shift.status !== 'active') return false;
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        if (startTotal < endTotal) {
          return nowTotal >= startTotal && nowTotal <= endTotal;
        } else {
          // Overnight shift (e.g. 23:00 - 07:00)
          return nowTotal >= startTotal || nowTotal <= endTotal;
        }
      });

      if (activeShift) {
        setWorkStatus({
          type: 'shift',
          label: activeShift.shiftName.toUpperCase(),
          details: `${activeShift.startTime} - ${activeShift.endTime}`
        });
        return;
      }

      // 2. Check Overtime Plans for today
      // An overtime plan is active if current date is between startDate and endDate
      const activeOvertime = overtimePlans.find((plan: any) => {
        const start = new Date(plan.startDate);
        const end = new Date(plan.endDate);
        return today >= start && today <= end && plan.status !== 'cancelled';
      });

      if (activeOvertime) {
        setWorkStatus({
          type: 'overtime',
          label: 'MESAİ ÇALIŞMASI',
          details: activeOvertime.planName.toUpperCase()
        });
        return;
      }

      // 3. Otherwise Closed
      setWorkStatus({
        type: 'closed',
        label: 'ÜRETİM KAPALI',
        details: 'TESİS ÇALIŞMIYOR'
      });

    } catch (error) {
      console.error('Work status fetch error:', error);
    }
  };

  useEffect(() => {
    api.get('/system/info').then(setSystemInfo).catch(() => { });
    checkUnreadNotifications();
    fetchWorkStatus();

    // Poll for new notifications and work status every 60 seconds
    const interval = setInterval(() => {
      checkUnreadNotifications();
      fetchWorkStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update badge when panel is closed (user might have read some)
  useEffect(() => {
    if (!isNotificationOpen) {
      checkUnreadNotifications();
    }
  }, [isNotificationOpen]);

  useEffect(() => {
    if (!user) return;

    let timeoutId: any;
    const INACTIVITY_LIMIT = 60 * 60 * 1000;

    const resetIdleTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => window.addEventListener(event, resetIdleTimer));

    resetIdleTimer();

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  const navItems = [
    { icon: Bolt, label: t('nav.dashboard', 'KONTROL PANELİ'), path: '/' },
    {
      icon: Factory,
      label: 'ÜRETİM',
      path: '/records_menu',
      isDropdown: true,
      children: [
        { icon: DiamondPlus, label: t('nav.newRecord', 'Yeni Üretim Kaydı'), path: '/records/new' },
        { icon: Logs, label: t('nav.records', 'Üretim Kayıtları'), path: '/records' },
        { icon: DiamondPlus, label: 'Üretim Emirleri', path: '/production-orders' },
      ]
    },
    { icon: ChartArea, label: t('nav.analytics', 'ANALİTİK'), path: '/analytics' },
    {
      icon: FileChartPie,
      label: t('nav.reports', 'RAPORLAR'),
      path: '/reports',
      isDropdown: true,
      children: [
        { icon: BarChart3, label: t('reports.general', 'Raporlar'), path: '/reports/general' },
        { icon: Airplay, label: t('reports.machines', 'Makine Raporu'), path: '/reports/machines' },
        { icon: Package, label: t('reports.products', 'Ürün Raporu'), path: '/reports/products' },
        { icon: FileUser, label: t('reports.operators', 'Personel Raporu'), path: '/reports/operators' },
      ]
    },
    {
      icon: Warehouse,
      label: t('nav.inventory', 'STOK YÖNETİMİ'),
      path: '/inventory',
      isDropdown: true,
      children: [
        { icon: Package, label: t('inventory.dashboard', 'Depo Durumu'), path: '/inventory/dashboard' },
        { icon: History, label: t('inventory.movements', 'Stok Hareketleri'), path: '/inventory/movements' },
      ]
    },
    {
      icon: ShoppingCart,
      label: t('nav.sales', 'SATIŞ YÖNETİMİ'),
      path: '/sales',
      isDropdown: true,
      children: [
        { icon: ShoppingCart, label: t('sales.orders', 'Siparişler'), path: '/sales/orders' },
        { icon: User, label: t('sales.customers', 'Müşteri/Bayi'), path: '/sales/customers' },
      ]
    },
    { icon: ScanBarcode, label: t('nav.definitions', 'TANIMLAR'), path: '/definitions' },
    {
      icon: LayoutGrid,
      label: 'PLANLAMA',
      path: '/planning',
      isDropdown: true,
      children: [
        { icon: Logs, label: 'İş Listeleri (Birim Bazlı)', path: '/planning/work-plans' },
        { icon: GanttChart, label: 'Üretim Planlama', path: '/planning/production' },
        { icon: User, label: 'Personel Planlama', path: '/planning/personnel' },
        { icon: Settings, label: 'Üretim Tanımları', path: '/planning/definitions' },
        { icon: Boxes, label: 'Malzeme Planlama (MRP)', path: '/planning/mrp' },
        { icon: Wrench, label: 'Bakım Planlama', path: '/planning/maintenance' },
      ]
    },
    {
      icon: CalendarRange,
      label: t('nav.overtime', 'MESAİ PLANI'),
      path: '/overtime',
      isDropdown: true,
      children: [
        { icon: DiamondPlus, label: t('overtime.plan', 'Mesai Planla'), path: '/overtime/create' },
        { icon: TextAlignStart, label: t('overtime.list', 'Mesai Listesi'), path: '/overtime/list' },
        { icon: FileChartPie, label: t('overtime.reports', 'Mesai Raporları'), path: '/overtime/reports' },
      ]
    },
    {
      icon: ShieldCheck,
      label: 'YÖNETİM PANELİ',
      path: '/management',
      isDropdown: true,
      children: [
        ...(user.role === 'admin' || user.role === 'superadmin' ? [
          { icon: Building2, label: t('nav.company', 'Şirket Yönetimi'), path: '/company' },
          { icon: User, label: t('nav.users', 'Kullanıcılar'), path: '/users' },
        ] : []),
        { icon: Settings, label: t('nav.settings', 'Ayarlar'), path: '/settings' },
      ]
    }
  ];

  return (
    <div className="h-screen bg-theme-base text-theme-main font-sans w-full flex flex-col overflow-hidden selection:bg-theme-primary/30">
      {/* Header */}
      <header className="h-16 border-b border-theme bg-theme-surface/90 backdrop-blur-2xl px-6 flex items-center justify-between shrink-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-theme-primary/10 rounded-xl blur-lg group-hover:bg-theme-primary/20 transition-all duration-500" />
              <div className="relative w-10 h-10 bg-theme-base/40 border border-theme-primary/20 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:border-theme-primary/50 group-hover:scale-[1.05]">
                <img src="/logo.png" className="w-10 h-10 object-contain opacity-90 group-hover:opacity-100 transition-opacity" alt="Logo" />
              </div>
            </div>
            <div className="flex flex-col items-start justify-center vertical-align-middle mb-1">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-black tracking-[-0.015em] text-theme-main group-hover:text-theme-primary transition-colors duration-300">
                  SOSTURER
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-theme-primary mb-1 shadow-[0_0_8px_var(--primary-glow)]" />
              </div>
              <span className="text-[11px] font-semibold text-theme-main/65 group-hover:opacity-100 group-hover:text-theme-primary/70 transition-all duration-300 leading-none">
                Smart Manufacturing
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-3 pl-5 border-l border-theme h-8">
            <span className="text-xs font-black uppercase text-theme-main max-w-[400px]">
              {companyName}
            </span>
          </div>
        </div>

        <div className="flex gap-6 items-center vertical-align-middle">

          {/* Live Work / Shift Status */}
          <div className={`flex items-center h-10 gap-2.5 border p-1.5 rounded-xl backdrop-blur-xl shadow-2xl transition-all duration-700 group shadow-lg ${workStatus.type === 'closed'
            ? 'bg-theme-error/5 border-theme-error/20 hover:bg-theme-error/10 hover:border-theme-error/40'
            : workStatus.type === 'overtime'
              ? 'bg-theme-warning/5 border-theme-warning/30 hover:bg-theme-warning/10 hover:border-theme-warning/50'
              : 'bg-theme-success/5 border-theme-success/20 hover:bg-theme-success/10 hover:border-theme-success/40'
            }`}>
            <div className={`relative flex items-center justify-center h-7 w-7 rounded-lg border overflow-hidden ${workStatus.type === 'closed'
              ? 'bg-theme-error/10 border-theme-error/20'
              : workStatus.type === 'overtime'
                ? 'bg-theme-warning/10 border-theme-warning/30'
                : 'bg-theme-success/10 border-theme-success/20'
              }`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-20 scale-150 ${workStatus.type === 'closed' ? 'bg-theme-error' : workStatus.type === 'overtime' ? 'bg-theme-warning' : 'bg-theme-success'
                }`}></span>
              {workStatus.type === 'closed' ? (
                <Moon className="w-4 h-4 text-theme-error relative z-10" />
              ) : workStatus.type === 'overtime' ? (
                <Activity className="w-4 h-4 text-theme-warning relative z-10 animate-pulse" />
              ) : (
                <Sun className="w-4 h-4 text-theme-success relative z-10 animate-spin-slow" />
              )}
            </div>

            <div className="flex flex-col items-start vertical-align-middle pr-2">
              <span className={`text-[9px] font-black tracking-[0.2em] uppercase leading-none mt-0.5 ${workStatus.type === 'closed' ? 'text-theme-error' : workStatus.type === 'overtime' ? 'text-theme-warning' : 'text-theme-success'
                }`}>
                {workStatus.label}
              </span>
              <span className="font-mono text-[10px] font-black text-theme-main tracking-tight opacity-50 uppercase mt-0.25">
                {workStatus.details}
              </span>
            </div>
          </div>



          <div className="flex items-center gap-4 ml-2">
            <Link to="/profile" className="flex items-center gap-2 group transition-all duration-300">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-theme-main group-hover:text-theme-primary transition-colors">{userFullName}</p>
                <p className="text-[10px] font-bold text-theme-muted opacity-60 transition-colors">{userEmail}</p>
              </div>
              <div className="w-10 h-10 bg-theme-base/40 rounded-xl flex items-center justify-center text-xs font-bold border border-theme shadow-sm group-hover:shadow-theme-primary/10 group-hover:border-theme-primary/50 transition-all overflow-hidden group shadow-lg shrink-0">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} className="w-full h-full object-cover" alt="User" />
                ) : (
                  <span className="text-theme-primary group-hover:scale-110 transition-transform">{userInitials}</span>
                )}
              </div>
            </Link>

            <button
              ref={bellButtonRef}
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2.5 rounded-xl bg-theme-main/5 text-theme-muted hover:text-theme-primary hover:bg-theme-primary/10 border border-theme transition-all active:scale-95 group shadow-lg"
            >
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {hasUnreadNotifications && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-theme-surface shadow-lg shadow-rose-500/40 animate-pulse" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-theme-main/5 text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 border border-theme hover:border-rose-500/20 transition-all active:scale-95 group shadow-lg"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <ToastContainer />
        <NotificationPanel
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          anchorRef={bellButtonRef}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 z-[100] transition-all duration-500 pointer-events-none"
          style={{ left: isCollapsed ? '52.5px' : '205px' }}
        >
          <button
            onClick={toggleSidebar}
            className="pointer-events-auto w-8 h-8 bg-theme-surface/80 backdrop-blur-3xl border border-theme text-theme-main rounded-xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 group/toggle hover:border-theme-primary/50"
          >
            <div className="flex items-center justify-center relative overflow-hidden w-full h-full">
              <div className={`transition-all duration-500 flex items-center gap-0.5 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                <div className="w-1 h-3 bg-theme-primary/40 rounded-full group-hover/toggle:bg-theme-primary transition-colors" />
                <ChevronRight className="w-3 h-3 text-theme-primary group-hover/toggle:scale-125 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        <aside
          className={`relative z-40 border-r border-theme bg-theme-surface/40 backdrop-blur-3xl flex flex-col transition-all duration-300 ease-in-out hidden md:flex shrink-0 overflow-x-hidden ${isCollapsed ? 'w-15' : 'w-56'}`}
        >


          <div className="flex flex-col flex-1 py-3 px-2 gap-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            {navItems.map((item: any) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

              if (item.isDropdown) {
                return (
                  <div key={item.path} className="flex flex-col gap-1">
                    <Tooltip
                      content={isCollapsed ? item.label : ""}
                      position="right"
                      className="w-full"
                    >
                      <button
                        onClick={() => {
                          if (isCollapsed) {
                            setIsCollapsed(false);
                            setOpenDropdown(item.label);
                          } else {
                            setOpenDropdown(openDropdown === item.label ? null : item.label);
                          }
                        }}
                        className={`group relative flex items-center h-10 w-full gap-2 p-1 rounded-xl cursor-pointer transition-all duration-200 shrink-0 ${isActive || openDropdown === item.label ? 'bg-theme-primary text-white shadow-[0_8px_20px_-6px_var(--primary-glow)]' : 'text-theme-muted hover:bg-theme-main/5 hover:text-theme-main'} ${isCollapsed ? 'justify-center' : 'px-3'}`}
                      >
                        <item.icon className="shrink-0 transition-transform duration-200 group-hover:scale-110 w-4 h-4" />
                        {!isCollapsed && (
                          <>
                            <span className="font-bold text-[10.5px] whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 text-left uppercase mt-1">{item.label}</span>
                            <span className="shrink-0">
                              <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${openDropdown === item.label ? '-rotate-90' : ''}`} />
                            </span>
                          </>
                        )}
                      </button>
                    </Tooltip>

                    {!isCollapsed && openDropdown === item.label && (
                      <div className="flex flex-col gap-1 ml-0 pl-4 border-l border-theme/30 py-2 animate-dropdown">
                        {item.children.map((child: any) => {
                          const isChildActive = location.pathname === child.path;
                          return (
                            <Link key={child.path} to={child.path} className={`flex items-center gap-3 p-2 rounded-xl text-[10.5px] font-black transition-all shrink-0 ${isChildActive ? 'text-theme-primary bg-theme-primary/5 border border-theme-primary/20' : 'text-theme-muted hover:text-theme-main hover:bg-theme-main/5'}`}>
                              <child.icon className="w-3.5 h-3.5" />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Tooltip
                  key={item.path}
                  content={isCollapsed ? item.label : ""}
                  position="right"
                  className="w-full"
                >
                  <Link
                    to={item.path}
                    className={`group relative flex items-center h-10 w-full gap-2 p-1 rounded-xl cursor-pointer transition-all duration-200 overflow-hidden shrink-0 ${isActive ? 'bg-theme-primary/10 border border-theme-primary/30 text-theme-primary shadow-[0_8px_20px_-6px_var(--primary-glow)]' : 'text-theme-muted hover:bg-theme-main/5 hover:text-theme-main'} ${isCollapsed ? 'justify-center' : 'px-3'}`}
                  >
                    <item.icon className={`shrink-0 transition-transform duration-200 group-hover:scale-110 w-4 h-4 ${isActive ? 'text-theme-primary' : ''}`} />
                    {!isCollapsed && <span className="font-bold text-[10.5px] uppercase whitespace-nowrap overflow-hidden transition-all duration-300 mt-1">{item.label}</span>}
                    {isActive && !isCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-theme-primary animate-bounce" />}
                  </Link>
                </Tooltip>
              );
            })}
          </div>

          {!isCollapsed && user.role === 'superadmin' && (
            <div className="mt-auto p-4 border-t border-theme/50">
              <Link
                to="/superadmin"
                className="flex items-center gap-4 p-2 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500 group/admin transition-all duration-500 shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/30"
              >
                <div className="p-2 bg-indigo-500/20 rounded-xl group-hover/admin:bg-white/20 transition-all">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover/admin:text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-theme-main group-hover/admin:text-white">Sistem</span>
                  <span className="text-[10px] text-theme-muted font-black tracking-tight group-hover/admin:text-white/80 transition-colors">Kontrol Paneli</span>
                </div>
              </Link>
            </div>
          )}

          {!isCollapsed && user.role !== 'superadmin' && (
            <div className="mt-auto p-4 border-t border-theme/10 opacity-40">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-theme-muted">Sistem Aktif</span>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto w-full bg-theme-base relative">
          <div key={location.pathname} className="animate-premium-page min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
