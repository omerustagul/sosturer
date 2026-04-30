import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bolt, DiamondPlus, ListOrdered, Logs, ChartArea, FileChartPie, CalendarRange,
  Settings, BarChart3, LogOut, TextAlignStart, Airplay,
  ChevronLeft, ChevronRight, ChevronUp, Package, FileUser, User, ShieldCheck, Factory,
  Bell, Building2, Warehouse, ShoppingCart, History, LayoutGrid, Boxes, GanttChart, Wrench, FileText,
  Moon, Sun, Activity, Menu, X, BookOpen, LayoutDashboard,
  Database, Workflow, Map, Layers, Handshake, FileUp, Users, Clock, List, AlertCircle, ClipboardList
} from 'lucide-react';
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { ToastContainer } from './common/ToastContainer';
import { NotificationPanel } from './layout/NotificationPanel';
import { Tooltip } from './common/Tooltip';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

// Separate Component for Nav Items to isolate state
const SidebarNavItem = memo(({ item, collapsed, isMobile, isActive, openDropdown, setOpenDropdown, setIsCollapsed, location }: any) => {
  if (item.isDropdown) {
    return (
      <div className="flex flex-col gap-1">
        <Tooltip
          content={collapsed ? (
            <div className="flex flex-col gap-0.5 min-w-[140px] p-0.5">
              <div className="px-2 py-1.5 border-b border-theme/20 mb-1 text-[10px] font-black text-theme-primary uppercase tracking-wider">{item.label}</div>
              {item.children.map((child: any) => (
                <Link
                  key={child.path}
                  to={child.path}
                  className="flex items-center gap-2.5 p-2 rounded-lg text-[10.5px] font-bold text-theme-muted hover:text-theme-primary hover:bg-theme-primary/5 transition-all"
                >
                  <child.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </Link>
              ))}
            </div>
          ) : ""}
          position="right"
          className="w-full"
          interactive={true}
        >
          <button
            onClick={() => {
              if (collapsed && !isMobile) {
                setIsCollapsed(false);
                setOpenDropdown(item.label);
              } else {
                setOpenDropdown(openDropdown === item.label ? null : item.label);
              }
            }}
            className={`group relative flex items-center h-10 w-full gap-2 p-1 rounded-xl cursor-pointer transition-all duration-200 shrink-0 ${isActive || openDropdown === item.label ? 'bg-theme-primary text-white shadow-[0_8px_20px_-6px_var(--primary-glow)]' : 'text-theme-muted hover:bg-theme-main/5 hover:text-theme-main'} ${collapsed ? 'justify-center' : 'px-3'}`}
          >
            <item.icon className="shrink-0 transition-transform duration-200 group-hover:scale-110 w-4 h-4" />
            {!collapsed && (
              <>
                <span className="font-bold text-[10.5px] whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 text-left uppercase mt-1">{item.label}</span>
                <span className="shrink-0">
                  <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${openDropdown === item.label ? '-rotate-90' : ''}`} />
                </span>
              </>
            )}
          </button>
        </Tooltip>

        {!collapsed && openDropdown === item.label && (
          <div className="flex flex-col gap-1 ml-0 pl-4 border-l border-theme/30 py-2 animate-dropdown-sidebar">
            {item.children.map((child: any) => {
              const isChildActive = location.pathname === child.path;
              return (
                <Link key={child.path} to={child.path} className={`flex items-center gap-2 p-2 rounded-xl text-[10.5px] font-black transition-all shrink-0 ${isChildActive ? 'text-theme-primary bg-theme-primary/5 border border-theme-primary/20' : 'text-theme-muted hover:text-theme-main hover:bg-theme-main/5'}`}>
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
      content={collapsed ? item.label : ""}
      position="right"
      className="w-full"
    >
      <Link
        to={item.path}
        className={`group relative flex items-center h-10 w-full gap-2 p-1 rounded-xl cursor-pointer transition-all duration-200 overflow-hidden shrink-0 ${isActive ? 'bg-theme-primary/10 border border-theme-primary/30 text-theme-primary shadow-[0_8px_20px_-6px_var(--primary-glow)]' : 'text-theme-muted hover:bg-theme-main/5 hover:text-theme-main'} ${collapsed ? 'justify-center' : 'px-3'}`}
      >
        <item.icon className={`shrink-0 transition-transform duration-200 group-hover:scale-110 w-4 h-4 ${isActive ? 'text-theme-primary' : ''}`} />
        {!collapsed && <span className="font-bold text-[10.5px] uppercase whitespace-nowrap overflow-hidden transition-all duration-300 mt-1">{item.label}</span>}
        {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-theme-primary animate-bounce" />}
      </Link>
    </Tooltip>
  );
});

// Separate Component for the Sidebar Content and Switcher
const SidebarContent = memo(({
  collapsed = false,
  isMobile = false,
  navItems,
  location,
  openDropdown,
  setOpenDropdown,
  setIsCollapsed,
  activeMenu,
  menuSwitcherOpen,
  setMenuSwitcherOpen,
  menuSwitcherRef,
  user,
  switchMenu
}: any) => (
  <div className="flex flex-col h-full">
    <div className="flex flex-col flex-1 py-3 px-2 gap-1 overflow-y-auto overflow-x-hidden no-scrollbar">
      {navItems.map((item: any) => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <SidebarNavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            isMobile={isMobile}
            isActive={isActive}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            setIsCollapsed={setIsCollapsed}
            location={location}
          />
        );
      })}
    </div>

    {/* Menu Switcher */}
    <div className="mt-auto shrink-0 p-2 border-t border-theme/20" ref={menuSwitcherRef}>
      {/* Upward Dropdown */}
      {menuSwitcherOpen && (
        <div className="mb-2 flex flex-col gap-1 animate-dropdown-switcher">
          {([
            { key: 'ana', label: 'Ana Menü', icon: LayoutDashboard, color: 'text-blue-600', activeBg: 'bg-blue-500/20', borderColor: 'border-blue-500/50', glow: 'shadow-[0_0_15px_-2px_rgba(59,130,246,0.2)]', inactiveBg: 'bg-blue-500/10' },
            { key: 'tanim', label: 'Tanım Menüsü', icon: BookOpen, color: 'text-amber-500', activeBg: 'bg-amber-500/20', borderColor: 'border-amber-500/50', glow: 'shadow-[0_0_15px_-2px_rgba(245,158,11,0.2)]', inactiveBg: 'bg-amber-500/10' },
            { key: 'rapor', label: 'Rapor Menüsü', icon: FileChartPie, color: 'text-emerald-500', activeBg: 'bg-emerald-500/20', borderColor: 'border-emerald-500/50', glow: 'shadow-[0_0_15px_-2px_rgba(16,185,129,0.2)]', inactiveBg: 'bg-emerald-500/10' },
            { key: 'yonetim', label: 'Yönetim Paneli', icon: ShieldCheck, color: 'text-indigo-500', activeBg: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', glow: 'shadow-[0_0_15px_-2px_rgba(99,102,241,0.2)]', inactiveBg: 'bg-indigo-500/10' },
          ] as const).map(({ key, label, icon: Icon, color, activeBg, borderColor, glow, inactiveBg }) => (
            <Tooltip
              key={key}
              content={collapsed ? label : ""}
              position="right"
              className="w-full"
            >
              <button
                onClick={() => switchMenu(key)}
                className={`flex items-center gap-2 w-full h-11 p-2.5 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 relative group/item overflow-hidden
                  ${activeMenu === key
                    ? `${activeBg} ${borderColor} ${glow} scale-[1.02] opacity-100 z-10`
                    : `${inactiveBg} border-theme/30 opacity-100 hover:bg-theme-main/10 hover:border-theme/60`}
                `}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover/item:translate-x-[100%] transition-transform duration-1000" />
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${activeMenu === key ? 'bg-white/30 shadow-inner' : 'bg-white/10'}`}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${color} ${activeMenu === key ? 'scale-110' : ''}`} />
                </div>
                {!collapsed && (
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeMenu === key ? color : 'text-theme-muted group-hover/item:text-theme-main'}`}>
                    {label}
                  </span>
                )}
                {activeMenu === key && (
                  <div className={`absolute right-3 w-1.5 h-1.5 rounded-full ${color.replace('text', 'bg')}  animate-bounce`} />
                )}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Trigger Card */}
      <Tooltip
        content={collapsed ? (activeMenu === 'ana' ? 'Ana Menü' : activeMenu === 'tanim' ? 'Tanım Menüsü' : activeMenu === 'rapor' ? 'Rapor Menüsü' : 'Yönetim Paneli') : ""}
        position="right"
        className="w-full"
      >
        <button
          onClick={() => setMenuSwitcherOpen(!menuSwitcherOpen)}
          className={`w-full flex items-center justify-center h-11 gap-2 p-2.5 rounded-xl border transition-all duration-500 group relative overflow-hidden
            ${activeMenu === 'ana' ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 shadow-lg shadow-blue-500/10'
              : activeMenu === 'tanim' ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 shadow-lg shadow-amber-500/10'
                : activeMenu === 'rapor' ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/10'
                  : 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 shadow-lg shadow-indigo-500/10'}
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          {activeMenu === 'ana' && <LayoutDashboard className="w-4 h-4 shrink-0 text-blue-400" />}
          {activeMenu === 'tanim' && <BookOpen className="w-4 h-4 shrink-0 text-amber-400" />}
          {activeMenu === 'rapor' && <FileChartPie className="w-4 h-4 shrink-0 text-emerald-400" />}
          {activeMenu === 'yonetim' && <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400" />}
          {!collapsed && (
            <>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="text-[8px] font-black uppercase tracking-widest text-theme-muted leading-none">Aktif Menü</span>
                <span className={`text-[10px] font-black uppercase truncate leading-tight mt-0.5
                  ${activeMenu === 'ana' ? 'text-blue-400'
                    : activeMenu === 'tanim' ? 'text-amber-400'
                      : activeMenu === 'rapor' ? 'text-emerald-400'
                        : 'text-indigo-400'}`}>
                  {activeMenu === 'ana' ? 'Ana Menü' : activeMenu === 'tanim' ? 'Tanım Menüsü' : activeMenu === 'rapor' ? 'Rapor Menüsü' : 'Yönetim Paneli'}
                </span>
              </div>
              <ChevronUp className={`w-3.5 h-3.5 shrink-0 text-theme-muted transition-transform duration-300 ${menuSwitcherOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
      </Tooltip>

      {user.role === 'superadmin' && (
        <Tooltip content={collapsed ? "Sistem Paneli" : ""} position="right" className="w-full">
          <Link
            to="/superadmin"
            className={`mt-2 flex items-center gap-2 p-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500 group/admin transition-all duration-300 ${collapsed ? 'justify-center' : ''}`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400 group-hover/admin:text-white shrink-0" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-theme-main group-hover/admin:text-white">Sistem Paneli</span>
              </div>
            )}
          </Link>
        </Tooltip>
      )}
    </div>
  </div>
));

export function Layout() {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [menuSwitcherOpen, setMenuSwitcherOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'ana' | 'tanim' | 'rapor' | 'yonetim'>(() => {
    return (localStorage.getItem('activeMenu') as any) || 'ana';
  });
  const menuSwitcherRef = useRef<HTMLDivElement>(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [workStatus, setWorkStatus] = useState<{
    type: 'shift' | 'overtime' | 'closed';
    label: string;
    details: string;
  }>({ type: 'closed', label: 'Tesis Kapalı', details: 'Mesai dışı' });
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const switchMenu = (menu: 'ana' | 'tanim' | 'rapor' | 'yonetim') => {
    setActiveMenu(menu);
    localStorage.setItem('activeMenu', menu);
    setMenuSwitcherOpen(false);
    setOpenDropdown(null);
  };

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

      const activeShift = shifts.find((shift: any) => {
        if (shift.status !== 'active') return false;
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        if (startTotal < endTotal) {
          return nowTotal >= startTotal && nowTotal <= endTotal;
        } else {
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
    checkUnreadNotifications();
    fetchWorkStatus();
    const interval = setInterval(() => {
      checkUnreadNotifications();
      fetchWorkStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isNotificationOpen) {
      checkUnreadNotifications();
    }
  }, [isNotificationOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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

  const menuGroups = useMemo(() => ({
    ana: [
      { icon: Bolt, label: 'KONTROL PANELİ', path: '/' },
      {
        icon: Factory, label: 'ÜRETİM', path: '/records_menu', isDropdown: true,
        children: [
          { icon: DiamondPlus, label: 'Yeni Üretim Kaydı', path: '/records/new' },
          { icon: Logs, label: 'Üretim Kayıtları', path: '/records' },
          { icon: ListOrdered, label: 'Üretim Emirleri', path: '/production-orders' },
          { icon: ClipboardList, label: 'Tüketim İşlemleri', path: '/production/consumption-transactions' },
          { icon: Activity, label: 'Ölçüm Cihazları', path: '/production/measurement-tools' },
          { icon: Wrench, label: 'Ekipmanlar', path: '/production/equipment' },
        ]
      },
      {
        icon: Warehouse, label: 'STOK YÖNETİMİ', path: '/inventory', isDropdown: true,
        children: [
          { icon: Package, label: 'Depo Durumu', path: '/inventory/dashboard' },
          { icon: FileText, label: 'Stok Fişleri', path: '/inventory/stock-vouchers' },
          { icon: History, label: 'Stok Hareketleri', path: '/inventory/movements' },
        ]
      },
      {
        icon: ShoppingCart, label: 'SATIŞ YÖNETİMİ', path: '/sales', isDropdown: true,
        children: [
          { icon: ShoppingCart, label: 'Siparişler', path: '/sales/orders' },
          { icon: User, label: 'Müşteri/Bayi', path: '/sales/customers' },
        ]
      },
      {
        icon: LayoutGrid, label: 'PLANLAMA', path: '/planning', isDropdown: true,
        children: [
          { icon: Logs, label: 'Çalışma Planı', path: '/planning/work-plans' },
          { icon: GanttChart, label: 'Üretim Planı', path: '/planning/production' },
          { icon: User, label: 'Personel Planı', path: '/planning/personnel' },
          { icon: Settings, label: 'Üretim Tanımları', path: '/planning/definitions' },
          { icon: Boxes, label: 'Malzeme Planı (MRP)', path: '/planning/mrp' },
          { icon: Wrench, label: 'Bakım Planı', path: '/planning/maintenance' },
        ]
      },
      {
        icon: CalendarRange, label: 'MESAİ PLANI', path: '/overtime', isDropdown: true,
        children: [
          { icon: DiamondPlus, label: 'Mesai Planla', path: '/overtime/create' },
          { icon: TextAlignStart, label: 'Mesai Listesi', path: '/overtime/list' },
          { icon: FileChartPie, label: 'Mesai Raporları', path: '/overtime/reports' },
        ]
      },
    ],
    tanim: [
      {
        icon: Database, label: 'TEMEL TANIMLAR', path: '/definitions/base', isDropdown: true,
        children: [
          { icon: Factory, label: 'Makineler', path: '/definitions/machines' },
          { icon: Users, label: 'Personeller', path: '/definitions/operators' },
          { icon: Clock, label: 'Vardiyalar', path: '/definitions/shifts' },
          { icon: Package, label: 'Stok Kartları', path: '/definitions/products' },
          { icon: Handshake, label: 'Firmalar', path: '/definitions/firms' },
        ]
      },
      {
        icon: Building2, label: 'DEPARTMANLAR', path: '/definitions/dept', isDropdown: true,
        children: [
          { icon: Building2, label: 'İş Merkezleri', path: '/definitions/work-centers' },
          { icon: List, label: 'İstasyonlar', path: '/definitions/stations' },
          { icon: Warehouse, label: 'Depolar', path: '/definitions/warehouses' },
          { icon: Settings, label: 'Roller / Görevler', path: '/definitions/department-roles' },
        ]
      },
      {
        icon: Workflow, label: 'ÜRETİM TANIMLARI', path: '/definitions/prod', isDropdown: true,
        children: [
          { icon: Workflow, label: 'Operasyonlar', path: '/definitions/operations' },
          { icon: Map, label: 'Reçeteler', path: '/definitions/routes' },
          { icon: ClipboardList, label: 'Planlama Türleri', path: '/definitions/plan-types' },
          { icon: ClipboardList, label: 'Tüketim Tipleri', path: '/definitions/consumption-types' },
          { icon: Activity, label: 'Ölçüm Aracı Türleri', path: '/definitions/measurement-tools' },
          { icon: Wrench, label: 'Ekipmanlar', path: '/definitions/equipment' },
          { icon: Layers, label: 'Olay Grupları', path: '/definitions/event-groups' },
          { icon: AlertCircle, label: 'Olay Sebepleri', path: '/definitions/event-reasons' },
        ]
      },
      {
        icon: ShieldCheck, label: 'KALİTE TANIMLARI', path: '/definitions/quality', isDropdown: true,
        children: [
          { icon: Activity, label: 'Ölçüm Yöntemleri', path: '/definitions/measurement-methods' },
        ]
      },
      {
        icon: FileUp, label: 'SİSTEM ARAÇLARI', path: '/definitions/tools', isDropdown: true,
        children: [
          { icon: FileUp, label: 'Veri Aktarımı', path: '/definitions/import' },
        ]
      },
    ],
    rapor: [
      { icon: ChartArea, label: 'ANALİZ', path: '/analytics' },
      {
        icon: FileChartPie, label: 'RAPORLAMA', path: '/reports', isDropdown: true,
        children: [
          { icon: BarChart3, label: 'Raporlar', path: '/reports/general' },
          { icon: Airplay, label: 'Makine Raporu', path: '/reports/machines' },
          { icon: Package, label: 'Ürün Raporu', path: '/reports/products' },
          { icon: FileUser, label: 'Personel Raporu', path: '/reports/operators' },
        ]
      },
    ],
    yonetim: [
      {
        icon: ShieldCheck, label: 'YÖNETİM PANELİ', path: '/management', isDropdown: true,
        children: [
          ...(user?.role === 'admin' || user?.role === 'superadmin' ? [
            { icon: Building2, label: 'Şirket Yönetimi', path: '/company' },
            { icon: User, label: 'Kullanıcılar', path: '/users' },
          ] : []),
          { icon: Settings, label: 'Ayarlar', path: '/settings' },
        ]
      }
    ],
  }), [user?.role]);

  const navItems = menuGroups[activeMenu];

  return (
    <div className="h-screen bg-theme-base text-theme-main font-sans w-full flex flex-col overflow-hidden selection:bg-theme-primary/30">
      {/* Header */}
      <header className="h-16 border-b border-theme bg-theme-surface/90 backdrop-blur-2xl px-3 sm:px-4 flex items-center justify-between shrink-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-theme-main/5 text-theme-muted hover:text-theme-primary hover:bg-theme-primary/10 border border-theme transition-all active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-theme-primary/10 blur-lg group-hover:bg-theme-primary/20 transition-all duration-500" />
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 bg-transparent flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:border-theme-primary/50 group-hover:scale-[1.05]">
                <img src="/logo.png" className="w-7 h-7 sm:w-9 sm:h-9 object-contain opacity-90 group-hover:opacity-100 transition-opacity" alt="Logo" />
              </div>
            </div>
            <div className="flex flex-col items-start justify-center vertical-align-middle mb-1">
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg sm:text-xl font-black tracking-[-0.015em] text-theme-main group-hover:text-theme-primary transition-colors duration-300">
                  SOSTURER
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-theme-primary mb-1 shadow-[0_0_8px_var(--primary-glow)]" />
              </div>
              <span className="hidden sm:block text-[11px] font-semibold text-theme-main/65 group-hover:opacity-100 group-hover:text-theme-primary/70 transition-all duration-300 leading-none">
                Smart Manufacturing
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2 pl-5 border-l border-theme h-8">
            <span className="text-xs font-bold text-theme-muted max-w-[400px]">
              {companyName}
            </span>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-6 items-center vertical-align-middle">
          <div className="flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 group transition-all duration-300">
              <div className="text-right hidden xl:block">
                <p className="text-xs font-bold text-theme-main group-hover:text-theme-primary transition-colors underline-offset-4 leading-none">{userFullName}</p>
                <p className="text-[10px] font-bold text-theme-muted opacity-60 transition-colors">{userEmail}</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-theme-base rounded-xl flex items-center justify-center text-xs font-bold border border-theme shadow-sm group-hover:shadow-theme-primary/10 group-hover:border-theme-primary/50 transition-all overflow-hidden group shadow-lg shrink-0">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} className="w-full h-full object-cover" alt="User" />
                ) : (
                  <span className="text-theme-primary group-hover:scale-110 transition-transform">{userInitials}</span>
                )}
              </div>
            </Link>

            <div className={`flex items-center h-9 sm:h-10 gap-2 sm:gap-2.5 border p-1 sm:p-1.5 rounded-xl backdrop-blur-xl shadow-lg transition-all duration-700 group shadow-lg ${workStatus.type === 'closed'
              ? 'bg-theme-danger/5 border-theme-danger/20 hover:bg-theme-danger/10 hover:border-theme-danger/40'
              : workStatus.type === 'overtime'
                ? 'bg-theme-warning/5 border-theme-warning/30 hover:bg-theme-warning/10 hover:border-theme-warning/50'
                : 'bg-theme-success/5 border-theme-success/20 hover:bg-theme-success/10 hover:border-theme-success/40'
              }`}>
              <div className={`relative flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-lg border overflow-hidden ${workStatus.type === 'closed'
                ? 'bg-theme-danger/10 border-theme-danger/20'
                : workStatus.type === 'overtime'
                  ? 'bg-theme-warning/10 border-theme-warning/30'
                  : 'bg-theme-success/10 border-theme-success/20'
                }`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-20 scale-150 ${workStatus.type === 'closed' ? 'bg-theme-danger' : workStatus.type === 'overtime' ? 'bg-theme-warning' : 'bg-theme-success'}`}></span>
                {workStatus.type === 'closed' ? (
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-danger relative z-10" />
                ) : workStatus.type === 'overtime' ? (
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-warning relative z-10 animate-pulse" />
                ) : (
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-success relative z-10 animate-spin-slow" />
                )}
              </div>
              <div className="flex flex-col items-start vertical-align-middle pr-1 sm:pr-2">
                <span className={`text-[8px] sm:text-[9px] font-black tracking-[0.1em] sm:tracking-[0.2em] uppercase leading-none mt-0.5 ${workStatus.type === 'closed' ? 'text-theme-danger' : workStatus.type === 'overtime' ? 'text-theme-warning' : 'text-theme-success'}`}>
                  {workStatus.label}
                </span>
                <span className="hidden sm:block font-mono text-[10px] font-black text-theme-main tracking-tight opacity-50 uppercase mt-0.25">
                  {workStatus.details}
                </span>
              </div>
            </div>

            <button
              ref={bellButtonRef}
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative h-9 w-9 sm:h-10 sm:w-10 p-2 rounded-xl bg-theme-main/5 text-theme-muted hover:text-theme-primary hover:bg-theme-primary/10 border border-theme transition-all active:scale-95 group shadow-lg"
            >
              <Bell className="w-4 h-4 sm:w-5 h-5 group-hover:scale-110 transition-transform" />
              {hasUnreadNotifications && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-500 rounded-full border-2 border-theme-surface shadow-lg shadow-rose-500/40 animate-pulse" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="hidden sm:flex h-10 w-10 p-2 rounded-xl bg-theme-main/5 text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 border border-theme hover:border-rose-500/20 transition-all active:scale-95 group shadow-lg items-center justify-center"
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

        {/* Mobile Menu Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-[60] bg-theme-base/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Menu Drawer Content */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-[70] w-72 bg-theme-surface border-r border-theme transform transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-theme shrink-0">
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-8 h-8 object-contain" alt="Logo" />
              <span className="text-lg font-black text-theme-main tracking-tighter">SOSTURER</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-xl bg-theme-main/5 text-theme-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar py-4">
            <SidebarContent
              isMobile={true}
              navItems={navItems}
              location={location}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              setIsCollapsed={setIsCollapsed}
              activeMenu={activeMenu}
              menuSwitcherOpen={menuSwitcherOpen}
              setMenuSwitcherOpen={setMenuSwitcherOpen}
              menuSwitcherRef={menuSwitcherRef}
              user={user}
              switchMenu={switchMenu}
            />
          </div>
          <div className="p-4 border-t border-theme">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-sm"
            >
              <LogOut className="w-4 h-4" /> ÇIKIŞ YAP
            </button>
          </div>
        </aside>

        {/* Desktop Sidebar Toggle Button */}
        <div
          className="absolute top-1/2 -translate-y-1/2 z-[100] transition-all duration-500 pointer-events-none hidden md:block"
          style={{ left: isCollapsed ? '52.5px' : '190px' }}
        >
          <button
            onClick={toggleSidebar}
            className="pointer-events-auto w-8 h-8 bg-theme-surface/80 backdrop-blur-3xl border border-theme text-theme-main rounded-xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 group/toggle hover:border-theme-primary/50"
          >
            <div className="flex items-center justify-center relative overflow-hidden w-full h-full">
              <div className={cn("transition-all duration-500 flex items-center gap-0.5", !isCollapsed && "rotate-180")}>
                <div className="w-1 h-3 bg-theme-primary/40 rounded-full group-hover/toggle:bg-theme-primary transition-colors" />
                <ChevronRight className="w-3 h-3 text-theme-primary group-hover/toggle:scale-125 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "relative z-40 border-r border-theme bg-theme-surface/40 backdrop-blur-3xl flex flex-col transition-all duration-300 ease-in-out hidden md:flex shrink-0 overflow-x-hidden",
            isCollapsed ? "w-16" : "w-51"
          )}
        >

          <div className="flex-1 min-h-0">
            <SidebarContent
              collapsed={isCollapsed}
              navItems={navItems}
              location={location}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              setIsCollapsed={setIsCollapsed}
              activeMenu={activeMenu}
              menuSwitcherOpen={menuSwitcherOpen}
              setMenuSwitcherOpen={setMenuSwitcherOpen}
              menuSwitcherRef={menuSwitcherRef}
              user={user}
              switchMenu={switchMenu}
            />
          </div>

          {!isCollapsed && (
            <div className="p-4 border-t border-theme/20 bg-theme-base/20">
              <div className="flex items-center justify-between text-[10px] font-black text-theme-dim">
                <span>sosturer.com</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1 rounded-full bg-green-500 animate-bounce" />
                  <span>v26.4.28</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col w-full bg-theme-base relative overflow-y-auto">
          <div key={location.pathname} className="animate-premium-page flex-1 flex flex-col">
            <Outlet />
          </div>
        </main>
      </div >
    </div >
  );
}
