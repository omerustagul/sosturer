import { AlertTriangle, Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'EVET, DEVAM ET',
  cancelLabel = 'VAZGEÇ',
  type = 'warning'
}: ConfirmModalProps) {

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const colorStyles = {
    danger: {
      bg: 'bg-theme-danger/10',
      border: 'border-theme-danger/20',
      icon: 'bg-theme-danger/10 text-theme-danger border-theme-danger/20',
      button: 'bg-theme-danger hover:bg-theme-danger/80 shadow-theme-danger/30',
      glow: 'shadow-theme-danger/20'
    },
    warning: {
      bg: 'bg-theme-warning/10',
      border: 'border-theme-warning/20',
      icon: 'bg-theme-warning/10 text-theme-warning border-theme-warning/20',
      button: 'bg-theme-warning hover:bg-theme-warning/80 shadow-theme-warning/30',
      glow: 'shadow-theme-warning/20'
    },
    info: {
      bg: 'bg-theme-primary/10',
      border: 'border-theme-primary/20',
      icon: 'bg-theme-primary/10 text-theme-primary border-theme-primary/20',
      button: 'bg-theme-primary hover:bg-theme-primary-hover shadow-theme-primary/30',
      glow: 'shadow-theme-primary/20'
    }
  };

  const style = colorStyles[type];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-500 overflow-hidden">
      {/* Background with deep blur and dark overlay */}
      <div
        className="absolute inset-0 bg-theme-surface/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className={`relative w-auto max-w-lg bg-theme-card border border-white/10 rounded-2xl p-4 shadow-[0_32px_128px_rgba(0,0,0,0.2)] animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 overflow-hidden ring-1 ring-white/10`}>

        {/* Animated background glow */}
        <div className={`absolute -top-32 -right-32 w-64 h-64 ${style.bg} transition-all duration-1000 blur-[120px] rounded-full animate-pulse`} />

        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-theme-dim hover:bg-white/5 hover:text-theme-main transition-all active:scale-95 z-10"
        >
          <X size={18} />
        </button>

        <div className="relative flex flex-col items-center text-center space-y-6">
          <div className={`w-14 h-14 ${style.icon} rounded-2xl flex items-center justify-center rotate-6 border shadow-2xl transition-transform duration-500 hover:rotate-0 hover:scale-110`}>
            <AlertTriangle className="w-8 h-8" />
            <div className={`absolute inset-0 ${style.glow} blur-2xl opacity-50`} />
          </div>

          <div className="space-y-3 px-2">
            <h3 className="text-xl font-black text-theme-main tracking-tight uppercase leading-tight">
              {title}
            </h3>
            <p className="text-theme-muted text-xs font-bold leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 h-10 bg-theme-main/5 hover:bg-theme-danger/10 text-theme-dim hover:text-theme-danger font-black rounded-xl border border-white/10 transition-all text-[10px] active:scale-95 uppercase"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2 h-10 ${style.button} text-white font-black rounded-xl shadow-2xl transition-all text-[10px] active:scale-95 flex items-center justify-center gap-3 uppercase`}
            >
              <Check className="w-4 h-4" />
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
