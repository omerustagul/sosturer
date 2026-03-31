import { useState, useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { History, AlertCircle, TrendingDown, BellOff, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AuditLog {
  id: string;
  tableName: string;
  action: string;
  changedBy: string;
  changedAt: string;
  isRead: boolean;
}

export function NotificationPanel({ isOpen, onClose, anchorRef }: { isOpen: boolean; onClose: () => void, anchorRef: RefObject<HTMLButtonElement | null> }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

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
    if (isOpen) fetchLogs();

    return () => window.removeEventListener('resize', updateCoords);
  }, [isOpen, anchorRef]);

  const fetchLogs = async () => {
    try {
      const data = await api.get('/system/activity');
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistik Update: Sunucu cevabını beklemeden UI'ı güncelle
    setLogs(prev => prev.map(log =>
      log.id === id ? { ...log, isRead: true } : log
    ));

    try {
      await api.put(`/system/activity/${id}/read`, {});
      console.log('Bildirim okundu işaretlendi:', id);
    } catch (err) {
      console.error('Okundu işaretleme hatası:', err);
      // Hata durumunda (isteğe bağlı) geri alabiliriz ya da fetchLogs çağırabiliriz
      fetchLogs();
    }
  };

  const deleteLog = async (id: string) => {
    try {
      await api.delete(`/system/activity/${id}`);
      setLogs(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      console.error('Silme hatası');
    }
  };

  const getNotificationDetails = (log: AuditLog) => {
    const tableKey = (log.tableName || '').toLowerCase();
    const actionKey = (log.action || '').toUpperCase();

    const tableNames: any = {
      'productionrecord': 'Üretim Kaydı',
      'production_records': 'Üretim Kaydı',
      'operator': 'Operatör',
      'operators': 'Operatör',
      'machine': 'Tezgah',
      'machines': 'Tezgah',
      'product': 'Ürün',
      'products': 'Ürün',
      'shift': 'Vardiya',
      'shifts': 'Vardiya',
      'user': 'Kullanıcı'
    };

    const actionText: any = {
      'CREATE': 'ekledi',
      'UPDATE': 'güncelledi',
      'DELETE': 'sildi'
    };

    const baseName = tableNames[tableKey] || tableKey;

    let title = baseName;
    if (actionKey === 'CREATE') title = 'Yeni ' + baseName;
    else if (actionKey === 'UPDATE') title = baseName + ' Güncellendi';
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

  const markAllAsRead = async () => {
    // Optimistik Update: Tümünü anında okundu yap
    setLogs(prev => prev.map(log => ({ ...log, isRead: true })));

    try {
      await api.put('/system/activity/read-all', {});
    } catch (err) {
      console.error('Tümünü okundu işaretleme hatası');
      fetchLogs();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1000] bg-theme-base/30" onClick={onClose} />
      <div
        className="fixed z-[1001] mt-2 w-96 bg-theme-base border border-theme rounded-2xl shadow-[0_30px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-select-popup ring-1 ring-white/10"
        style={{
          top: `${coords.top}px`,
          right: `${coords.right}px`
        }}
      >
        <div className="h-16 px-4 py-6 border-b border-theme bg-theme-surface backdrop-blur-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20">
              <History className="w-4 h-4 text-theme-primary" />
            </div>
            <h3 className="text-sm font-black text-theme-main tracking-widest leading-none">SİSTEM BİLDİRİMLERİ</h3>
          </div>
          {logs.some(log => !log.isRead) ? (
            <span className="px-3 py-1 bg-theme-primary/10 text-theme-primary text-[9px] font-black rounded-full border border-theme-primary/20 uppercase tracking-widest animate-pulse">YENİ</span>
          ) : (
            <span className="px-3 py-1 bg-theme-base text-theme-dim text-[9px] font-black rounded-full border border-theme uppercase tracking-widest">GÜNCEL</span>
          )}
        </div>

        <div className="max-h-[550px] overflow-y-auto no-scrollbar resizable-table">
          <div className="bg-theme-base/75 max-h-[calc(80vh-100px)] p-4 space-y-4">
            {/* System Insights */}
            <div className="p-5 bg-theme-danger/5 border border-theme-danger/10 rounded-2xl group relative overflow-hidden transition-all hover:bg-theme-danger/10">
              <div className="absolute top-0 right-0 w-24 h-24 bg-theme-danger/10 blur-3xl -mr-12 -mt-12"></div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-theme-danger/10 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                  <TrendingDown className="w-5 h-5 text-theme-danger" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-theme-danger uppercase tracking-[0.2em] mb-1 opacity-80">KRİTİK VERİMLİLİK</p>
                  <p className="text-xs font-bold text-theme-main leading-relaxed">CNC-03 tezgahında üretim verimliliği %70'in altına düştü.</p>
                  <p className="text-[9px] text-theme-dim mt-3 font-black uppercase tracking-widest opacity-40 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-theme-danger animate-pulse"></span>
                    AZ ÖNCE
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-theme-warning/5 border border-theme-warning/10 rounded-2xl group relative overflow-hidden transition-all hover:bg-theme-warning/10">
              <div className="absolute top-0 right-0 w-24 h-24 bg-theme-warning/10 blur-3xl -mr-12 -mt-12"></div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-theme-warning/10 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-5 h-5 text-theme-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-theme-warning uppercase tracking-[0.2em] mb-1 opacity-80">PERFORMANS ÖZETİ</p>
                  <p className="text-xs font-bold text-theme-main leading-relaxed">Geçen hafta CNC-11 verimliliği en düşük tezgahtı (%78).</p>
                  <p className="text-[9px] text-theme-dim mt-3 font-black uppercase tracking-widest opacity-40">2 SAAT ÖNCE</p>
                </div>
              </div>
            </div>

            {/* Recent Activity Header */}
            <div className="pt-2 px-2 flex items-center gap-3">
              <div className="h-px bg-theme flex-1 opacity-50"></div>
              <h4 className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] whitespace-nowrap opacity-40">SON İŞLEMLER</h4>
              <div className="h-px bg-theme flex-1 opacity-50"></div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Veriler çekiliyor...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 text-center opacity-40 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-theme-base rounded-2xl flex items-center justify-center border border-theme mb-2">
                  <BellOff className="w-8 h-8 text-theme-dim" />
                </div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em]">BİLDİRİM BULUNAMADI</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map(log => {
                  const details = getNotificationDetails(log);
                  return (
                    <div key={log.id}
                      onClick={() => !log.isRead && markAsRead(log.id)}
                      className={cn(
                        "p-4 transition-all duration-300 cursor-default group border rounded-2xl ring-inset",
                        log.isRead
                          ? "bg-black/20 border-theme/10 hover:bg-black/40 transition-colors"
                          : "bg-theme-primary/10 border-theme-primary/30 shadow-lg shadow-theme-primary/10 hover:bg-theme-primary/20 cursor-pointer"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-2.5 rounded-xl border h-fit transition-all duration-300 shadow-sm",
                          log.isRead ? "bg-theme-base/40 border-theme/20" : "bg-theme-primary/20 border-theme-primary/40 scale-110"
                        )}>
                          <CheckCircle2 className={cn(
                            "w-4 h-4 transition-colors",
                            log.isRead ? "text-theme-dim/60" : "text-theme-primary shadow-primary-glow"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className={cn(
                              "text-[10px] font-black uppercase tracking-[0.1em] truncate transition-colors",
                              log.isRead ? "text-theme-dim" : "text-theme-primary"
                            )}>
                              {details.title}
                            </p>
                            <p className="text-[9px] text-theme-dim font-black uppercase tracking-tighter shrink-0 opacity-60">
                              {new Date(log.changedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <p className={cn(
                            "text-xs font-bold leading-tight mb-3 pr-2 transition-colors",
                            log.isRead ? "text-theme-dim" : "text-theme-main"
                          )}>
                            {details.message}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {!log.isRead && (
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  "bg-theme-primary animate-ping"
                                )}></span>
                              )}
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest transition-opacity",
                                log.isRead ? "text-theme-dim/60" : "text-theme-primary opacity-60"
                              )}>
                                {log.isRead ? 'OKUNDU' : 'YENİ İŞLEM'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!log.isRead && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markAsRead(log.id); }}
                                  className="text-[9px] font-black text-theme-primary bg-theme-primary/10 hover:bg-theme-primary/20 px-3 py-1.5 rounded-xl border border-theme-primary/30 transition-all active:scale-95"
                                >
                                  OKUNDU
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteLog(log.id); }}
                                className="text-[9px] font-black text-theme-danger bg-theme-danger/10 hover:bg-theme-danger/20 px-3 py-1.5 rounded-xl border border-theme-danger/30 transition-all active:scale-95"
                              >
                                SİL
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[50px] bg-theme-surface border-t border-theme backdrop-blur-2xl">
          <button
            onClick={markAllAsRead}
            disabled={!logs.some(log => !log.isRead)}
            className="w-full h-full py-4 text-[11px] font-black text-theme-primary hover:text-white hover:bg-theme-primary transition-all uppercase tracking-[0.2em] active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
          >
            TÜMÜNÜ OKUNDU İŞARETLE
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
