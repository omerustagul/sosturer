import { createPortal } from 'react-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-theme-success" />,
    error: <AlertCircle className="w-5 h-5 text-theme-danger" />,
    warning: <AlertTriangle className="w-5 h-5 text-theme-warning" />,
    info: <Info className="w-5 h-5 text-theme-primary" />
  };

  const borders = {
    success: 'border-theme-success/20 bg-theme-success/5',
    error: 'border-theme-danger/20 bg-theme-danger/5',
    warning: 'border-theme-warning/20 bg-theme-warning/5',
    info: 'border-theme-primary/20 bg-theme-primary/5'
  };

  return createPortal(
    <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
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
    </div>,
    document.body
  );
}
