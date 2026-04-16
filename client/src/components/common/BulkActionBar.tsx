import {
  Settings,
  Edit,
  CheckCircle2,
  AlertCircle,
  Trash2,
  XCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

import { createPortal } from 'react-dom';

interface BulkActionBarProps {
  selectedCount: number;
  isEditing: boolean;
  onSave: () => void;
  onEditToggle: (editing: boolean) => void;
  onStatusUpdate?: (status: 'active' | 'passive') => void;
  onDelete: () => void;
  onCancel: () => void;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  isEditing,
  onSave,
  onEditToggle,
  onStatusUpdate,
  onDelete,
  onCancel,
  className
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return createPortal(
    <div className={cn(
      "fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-fit",
      "animate-in slide-in-from-bottom-10 fade-in duration-500",
      className
    )}>
      <div className="modern-glass-card p-3 bg-theme-surface/80 backdrop-blur-xl border border-theme-primary/30 flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/10">
        {/* Selection Count Info */}
        <div className="flex items-center gap-3 border-r border-theme-border/20 pr-6">
          <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center font-black text-white text-sm shadow-xl shadow-theme-primary/30 animate-pulse">
            {selectedCount}
          </div>
          <div className="whitespace-nowrap">
            <p className="text-[10px] font-black text-theme-primary uppercase leading-none text-shadow-glow">HIZLI İŞLEM</p>
            <p className="text-theme-main font-semibold text-[12px]">Seçilenler</p>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <button
              onClick={onSave}
              className="flex items-center h-9 gap-2 px-3 py-2 bg-theme-success text-white border border-theme-success/20 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-theme-success/20 hover:shadow-theme-success/40"
            >
              <Settings className="w-3.5 h-3.5" />
              Kaydet
            </button>
          ) : (
            <button
              onClick={() => onEditToggle(true)}
              className="w-[170px] h-10 flex items-center justify-center gap-2 px-2 py-1 bg-theme-primary/10 hover:bg-theme-primary/20 border border-theme-primary/20 rounded-xl text-theme-primary font-black text-[10px] uppercase tracking-wider transition-all group hover:scale-95"
            >
              <Edit className="w-3.5 h-3.5 text-theme-primary group-hover:rotate-12 transition-transform" />
              Tabloyu Düzenle
            </button>
          )}

          {onStatusUpdate && (
            <>
              <div className="w-px h-6 bg-theme-border/10 mx-1" />

              <button
                onClick={() => onStatusUpdate('active')}
                className="w-[120px] h-10 flex items-center justify-center gap-2 px-2 py-1 bg-theme-approve/10 hover:bg-theme-approve/20 border border-theme-approve/20 rounded-xl text-theme-approve font-black text-[10px] uppercase tracking-wider transition-all group hover:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aktif Yap
              </button>

              <button
                onClick={() => onStatusUpdate('passive')}
                className="w-[120px] h-10 flex items-center justify-center gap-2 px-2 py-1 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-xl text-amber-500 font-black text-[10px] uppercase tracking-wider transition-all group hover:scale-95"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Pasif Yap
              </button>
            </>
          )}

          <button
            onClick={onDelete}
            className="w-[80px] h-9 flex items-center justify-center gap-2 px-2 py-1 bg-theme-danger/5 hover:bg-theme-danger/10 border border-theme-danger/10 rounded-xl text-theme-danger font-black text-[10px] uppercase tracking-wider transition-all group hover:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Sil
          </button>

          <div className="w-px h-6 bg-theme-border/10 mx-2" />

          <button
            onClick={onCancel}
            className="w-[100px] h-9 flex items-center justify-center gap-2 px-2 py-1 bg-theme-danger/5 hover:bg-theme-danger/10 border border-theme-danger/10 rounded-xl text-theme-danger font-black text-[10px] uppercase tracking-wider transition-all group hover:scale-95"
          >
            <XCircle className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            İptal
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
