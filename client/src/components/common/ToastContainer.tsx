import { useNotificationStore } from '../../store/notificationStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  };

  const borders = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    error: 'border-rose-500/20 bg-rose-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-blue-500/20 bg-blue-500/5'
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => (
        <div 
          key={n.id}
          className={`pointer-events-auto flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-10 fade-in duration-500 ${borders[n.type]}`}
        >
          <div className="mt-0.5 shrink-0">
            {icons[n.type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-theme-main leading-tight tracking-tight uppercase">{n.title}</h4>
            {n.message && <p className="text-xs font-bold text-theme-muted mt-1 leading-relaxed">{n.message}</p>}
          </div>
          <button 
            onClick={() => removeNotification(n.id)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-theme-dim hover:text-theme-main"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
