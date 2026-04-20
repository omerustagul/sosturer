import { useState, useEffect, useRef, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { History, BellOff, CheckCircle2, Search, Trash2, CheckSquare, Clock, Bell, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../lib/socket';

interface AuditLog {
  id: string;
  tableName: string;
  action: string;
  changedBy: string;
  changedAt: string;
  isRead: boolean;
}

interface SystemNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: string;
  isRead: boolean;
  isPinned: boolean;
  actionTaken: boolean;
  createdAt: string;
}

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="group/tooltip relative">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-theme-surface/95 backdrop-blur-md border border-theme rounded-md text-[8px] font-black text-theme-main uppercase tracking-widest opacity-0 scale-95 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-200 z-[1002] whitespace-nowrap shadow-xl">
        {text}
      </div>
    </div>
  );
}

export function NotificationPanel({ isOpen, onClose, anchorRef }: { isOpen: boolean; onClose: () => void, anchorRef: RefObject<HTMLButtonElement | null> }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking the notification bell (anchorRef) - toggle logic in Header handles that
      if (anchorRef.current?.contains(event.target as Node)) return;

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  useEffect(() => {
    const updateCoords = () => {
      if (isOpen && anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 12,
          right: window.innerWidth - rect.right
        });
      }
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    if (isOpen) fetchData();

    return () => window.removeEventListener('resize', updateCoords);
  }, [isOpen, anchorRef]);

  useEffect(() => {
    socket.on('activity:new', (newLog: AuditLog) => {
      setLogs(prev => [newLog, ...prev]);
      // Optional: Play subtle notification sound if needed
    });

    socket.on('notification:new', (newNotification: SystemNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
    });

    return () => {
      socket.off('activity:new');
      socket.off('notification:new');
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [activityData, notificationData] = await Promise.all([
        api.get('/system/activity'),
        api.get('/notifications')
      ]);
      setLogs(activityData);
      setNotifications(notificationData);
    } catch (err) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const updated = await api.post(`/notifications/${id}/action`, { action });
      setNotifications(prev => prev.map(n => n.id === id ? updated : n));

      if (action === 'edit' && updated.metadata) {
        const meta = JSON.parse(updated.metadata);
        navigate(`/overtime/edit/${meta.planId}`);
        onClose();
      }
    } catch (err) {
      console.error('Action failed');
    }
  };

  const markNotificationRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      await api.put(`/notifications/${id}/read`, {});
    } catch (err) {
      fetchData();
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      fetchData();
    }
  };

  const markLogRead = async (id: string) => {
    setLogs(prev => prev.map(log => log.id === id ? { ...log, isRead: true } : log));
    try {
      await api.put(`/system/activity/${id}/read`, {});
    } catch (err) {
      fetchData();
    }
  };

  const deleteLog = async (id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
    try {
      await api.delete(`/system/activity/${id}`);
    } catch (err) {
      fetchData();
    }
  };

  const markAllRead = async () => {
    setLogs(prev => prev.map(l => ({ ...l, isRead: true })));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await Promise.all([
        api.put('/system/activity/read-all', {}),
        api.put('/notifications/read-all', {})
      ]);
    } catch (err) {
      fetchData();
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Tüm bildirimleri silmek istediğinize emin misiniz?')) return;
    setLogs([]);
    setNotifications([]);
    try {
      await api.delete('/notifications/delete-all');
      // For activity logs, we might not have a delete-all endpoint yet, but we'll try to delete what we have
      // or just refresh.
      fetchData();
    } catch (err) {
      console.error('Delete all failed');
    }
  };

  const getLogDetails = (log: AuditLog) => {
    const tableKey = (log.tableName || '').toLowerCase();
    const actionKey = (log.action || '').toUpperCase();

    const tableNames: any = {
      'productionrecord': 'Üretim Kaydı',
      'production_records': 'Üretim Kaydı',
      'operator': 'Operatör',
      'operators': 'Operatör',
      'machine': 'Makine',
      'machines': 'Makine',
      'product': 'Ürün',
      'products': 'Ürün',
      'shift': 'Vardiya',
      'shifts': 'Vardiya',
      'user': 'Kullanıcı',
      'overtimeplan': 'Mesai Planı',
      'overtime_plans': 'Mesai Planı',
      'department': 'Departman',
      'departments': 'Departman',
      'company': 'Şirket',
      'companies': 'Şirket',
      'notification': 'Bildirim',
      'notifications': 'Bildirim',
      'location': 'Birim/Lokasyon',
      'locations': 'Birim/Lokasyon',
    };

    const actionText: any = {
      'CREATE': 'ekledi',
      'UPDATE': 'güncelledi',
      'DELETE': 'sildi'
    };

    const baseName = tableNames[tableKey] || tableKey;
    let title = baseName;
    if (actionKey === 'CREATE') title = 'Yeni ' + baseName;
    else if (actionKey === 'UPDATE') title = baseName + ' Ayarları Güncellendi';
    else if (actionKey === 'DELETE') title = baseName + ' Silindi';

    let userName = log.changedBy || 'Sistem';
    if (userName.includes(' (ID:')) {
      const email = userName.split(' ')[0];
      userName = email.split('@')[0];
      userName = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    const message = `${userName} ${baseName.toLowerCase()} ${actionText[actionKey] || actionKey.toLowerCase()}`;
    return { title, message };
  };

  const filteredLogs = logs.filter(log => {
    const details = getLogDetails(log);
    return details.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      details.message.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredNotifications = notifications.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unreadCount = logs.filter(l => !l.isRead).length + notifications.filter(n => !n.isRead).length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notification-panel"
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed z-[1001] mt-2 w-80 bg-theme-surface rounded-2xl p-0 border border-theme shadow-lg shadow-theme-main/20 overflow-hidden ring-1 ring-white/10 flex flex-col pointer-events-auto"
          style={{
            top: `${coords.top}px`,
            right: `${coords.right}px`,
            maxHeight: 'calc(100vh - 100px)'
          }}
        >
          {/* Header */}
          <div className="p-3 border-b border-theme bg-theme-surface/80 backdrop-blur-2xl shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center gap-2.5 vertical-align-middle">
                <div className="w-7 h-7 bg-theme-primary/10 rounded-lg flex items-center justify-center border border-theme-primary/20">
                  <Bell className="w-3.5 h-3.5 text-theme-primary" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-theme-main uppercase leading-none mt-0.75">Bildirim Merkezi</h3>
                  <p className="text-[9px] text-theme-dim mt-0.2 font-bold opacity-50">{unreadCount} Yeni Bildirim</p>
                </div>
              </div>
            </div>

            <div className="relative group/search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-muted group-focus-within/search:text-theme-primary transition-colors" />
              <input
                type="text"
                placeholder="ARAMA YAPIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 bg-theme-base/50 border border-theme rounded-lg pl-9 pr-4 text-[9px] font-black tracking-widest text-theme-main outline-none focus:border-theme-primary/50 transition-all placeholder:text-theme-muted/30"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 h-auto min-h-[calc(50vh-100px)] max-h-[calc(70vh-100px)] overflow-y-auto no-scrollbar p-3">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin"></div>
                <p className="text-[8px] font-black text-theme-dim uppercase tracking-widest">Yükleniyor...</p>
              </div>
            ) : (filteredLogs.length === 0 && filteredNotifications.length === 0) ? (
              <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
                <BellOff className="w-6 h-6 text-theme-dim" />
                <p className="font-black text-[9px] uppercase tracking-[0.2em]">BİLDİRİM YOK</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Pinned Action Notifications */}
                {filteredNotifications.filter(n => n.isPinned).map(n => {
                  const isOvertimeStarted = n.title.toLowerCase().includes('başladı');
                  const isApprovalRequired = n.title.toLowerCase().includes('onay');

                  return (
                    <div key={n.id} className="p-2 bg-theme-primary/5 border-2 border-theme-primary/10 rounded-xl group relative overflow-hidden transition-all hover:border-theme-primary/40 shadow-md shadow-theme-primary/10 mb-2">
                      {/* Active Pulse Indicator */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-theme-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.8)]" />
                        <span className="text-[7px] font-black text-theme-primary uppercase tracking-widest opacity-80">AKTİF</span>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-theme-primary rounded-xl shrink-0 shadow-md shadow-theme-primary/10">
                          {isOvertimeStarted ? <History className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[10px] font-black text-theme-primary uppercase mb-1">{n.title}</p>
                          <p className="text-[10px] font-bold text-theme-main leading-snug mb-2">{n.message}</p>

                          {!n.actionTaken ? (
                            <div className="flex flex-wrap items-end justify-end gap-2">
                              {isApprovalRequired && (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                  <button
                                    onClick={() => handleAction(n.id, 'approve')}
                                    className="h-8 bg-theme-primary text-white text-[9px] font-black uppercase rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-md shadow-theme-primary/20"
                                  >
                                    EVET, ONAYLA
                                  </button>
                                  <button
                                    onClick={() => handleAction(n.id, 'cancel')}
                                    className="h-8 bg-theme-danger/20 text-theme-danger border border-theme-danger/30 text-[9px] font-black uppercase rounded-lg hover:bg-theme-danger/30 active:scale-95 transition-all"
                                  >
                                    İPTAL ET
                                  </button>
                                  <button
                                    onClick={() => handleAction(n.id, 'edit')}
                                    className="col-span-2 h-8 bg-theme-surface border border-theme text-theme-main hover:border-theme-primary/50 flex items-center justify-center rounded-lg active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest"
                                  >
                                    PLANI DÜZENLE
                                  </button>
                                </div>
                              )}
                              {isOvertimeStarted && (
                                <button
                                  onClick={() => {
                                    if (n.metadata) {
                                      const meta = JSON.parse(n.metadata);
                                      navigate(`/overtime/edit/${meta.planId}`);
                                      onClose();
                                    }
                                  }}
                                  className="w-auto px-3 p-2 h-7 bg-theme-primary text-white text-[8px] font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-theme-main/5 flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  MESAİ DETAYINI GÖR
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-1.5 px-3 bg-emerald-500/10 rounded-lg w-fit border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">İŞLEM GERÇEKLEŞTİ</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Regular Notifications */}
                {filteredNotifications.filter(n => !n.isPinned).map(n => (
                  <div key={n.id}
                    onClick={() => !n.isRead && markNotificationRead(n.id)}
                    className={cn(
                      "p-2.5 transition-all duration-200 border rounded-xl flex items-center gap-3 relative group",
                      n.isRead ? "bg-black/5 border-theme/5 opacity-60" : "bg-theme-primary/5 border-theme-primary/10 hover:bg-theme-primary/10"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg border shrink-0",
                      n.isRead ? "bg-theme-base/70 border-theme/20" : "bg-theme-primary/10 border-theme-primary/20"
                    )}>
                      <Bell className={cn("w-3 h-3", n.isRead ? "text-theme-dim" : "text-theme-primary")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[9px] font-black mb-0.5", n.isRead ? "text-theme-main" : "text-theme-primary")}>{n.title}</p>
                      <p className={cn("text-[9px] font-medium leading-tight", n.isRead ? "text-theme-dim" : "text-theme-main")}>{n.message}</p>
                      <p className="text-[8px] text-theme-muted font-bold mt-1 uppercase opacity-50">
                        {new Date(n.createdAt).toLocaleDateString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <Tooltip text="OKUNDU">
                          <button
                            onClick={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}
                            className="p-1.5 text-theme-primary hover:bg-theme-primary/10 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip text="SİL">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="p-1.5 text-theme-muted hover:text-theme-danger hover:bg-theme-danger/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}

                {/* Divider if we have both types */}
                {(filteredNotifications.length > 0 && filteredLogs.length > 0) && (
                  <div className="flex items-center gap-3 py-2 px-2">
                    <div className="h-[1px] bg-theme flex-1 opacity-20"></div>
                    <span className="text-[8px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-30">AKTİVİTE</span>
                    <div className="h-[1px] bg-theme flex-1 opacity-20"></div>
                  </div>
                )}

                {/* Activity Logs */}
                {filteredLogs.map(log => {
                  const details = getLogDetails(log);
                  return (
                    <div key={log.id}
                      onClick={() => !log.isRead && markLogRead(log.id)}
                      className={cn(
                        "flex flex-row justify-center items-center hor vertical-align-middle min-h-15 p-2 transition-all duration-200 border rounded-[10px] flex items-center gap-3 relative group",
                        log.isRead ? "bg-theme-main/3 border-theme/5 hover:scale-101" : "bg-theme-primary/5 border-theme/20 hover:bg-theme-primary/10 hover:scale-101"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg border shrink-0",
                        log.isRead ? "bg-theme-base/50 border-theme/10" : "bg-theme-primary/10 border-theme/20"
                      )}>
                        <History className={cn("w-3 h-3", log.isRead ? "text-theme-dim/40" : "text-theme-main")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-[9px] font-black mb-0.5", log.isRead ? "text-theme-dim" : "text-theme-dim")}>{details.title}</p>
                        </div>
                        <p className={cn("text-[9px] font-medium leading-tight", log.isRead ? "text-theme-main" : "text-theme-main")}>{details.message}</p>
                      </div>

                      <div className="flex flex-col gap-2 justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {!log.isRead && (
                          <Tooltip text="OKUNDU">
                            <button
                              onClick={(e) => { e.stopPropagation(); markLogRead(log.id); }}
                              className="text-theme-main/50 hover:text-theme-approve rounded-[7px] transition-colors hover:scale-105"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip text="SİL">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteLog(log.id); }}
                            className="text-theme-main/50 hover:text-theme-danger rounded-[7px] transition-colors hover:scale-105"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-theme-surface/80 border-t border-theme p-2 backdrop-blur-2xl grid grid-cols-2 gap-2 shrink-0">
            <button
              onClick={markAllRead}
              disabled={!logs.some(l => !l.isRead) && !notifications.some(n => !n.isRead)}
              className="flex items-center justify-center gap-2 h-9 bg-theme-base hover:bg-theme border border-theme rounded-xl text-[9px] font-black text-theme-main uppercase tracking-widest transition-all disabled:opacity-20 active:scale-95"
            >
              <CheckSquare className="w-3 h-3" />
              OKUNDU
            </button>
            <button
              onClick={deleteAll}
              disabled={logs.length === 0 && notifications.length === 0}
              className="flex items-center justify-center gap-2 h-9 bg-theme-base hover:bg-theme-danger/10 hover:text-theme-danger border border-theme rounded-xl text-[9px] font-black text-theme-main uppercase tracking-widest transition-all disabled:opacity-20 active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              HEPSİNİ SİL
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
