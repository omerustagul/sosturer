import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isCustomizing?: boolean;
  onRemove?: () => void;
  fullWidth?: boolean;
  onToggleFullWidth?: () => void;
  className?: string;
}

export function DashboardWidget({
  id,
  title,
  subtitle,
  icon: Icon,
  children,
  isCustomizing,
  onRemove,
  fullWidth,
  onToggleFullWidth,
  className
}: DashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "modern-glass-card flex flex-col relative overflow-hidden group transition-all duration-300",
        fullWidth ? "lg:col-span-2" : "col-span-1",
        isDragging ? "opacity-50 scale-95 shadow-2xl ring-2 ring-theme-primary/50" : "opacity-100",
        className
      )}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-theme-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-theme-primary/10 rounded-xl border border-theme-primary/20 shrink-0">
            <Icon className="w-5 h-5 text-theme-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black text-theme-main uppercase tracking-tight truncate">{title}</h3>
            {subtitle && (
              <p className="text-[10px] text-theme-dim font-bold uppercase tracking-widest mt-0.5 opacity-60 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {isCustomizing && (
          <div className="flex items-center gap-1.5 p-1.5 bg-theme-surface/80 backdrop-blur-md rounded-xl border border-theme shadow-sm">
            <button
              onClick={onToggleFullWidth}
              className={cn(
                "p-2 hover:bg-theme-primary/10 rounded-lg transition-all active:scale-95 group/btn",
                fullWidth ? "text-theme-primary bg-theme-primary/5" : "text-theme-muted hover:text-theme-primary"
              )}
              title={fullWidth ? "Daralt" : "Genişlet"}
            >
              {fullWidth ? <Minimize2 className="w-4 h-4 group-hover/btn:scale-110" /> : <Maximize2 className="w-4 h-4 group-hover/btn:scale-110" />}
            </button>
            <button
              onClick={onRemove}
              className="p-2 hover:bg-theme-danger/10 rounded-lg text-theme-muted hover:text-theme-danger transition-all active:scale-95 group/btn"
              title="Kaldır"
            >
              <X className="w-4 h-4 group-hover/btn:scale-110" />
            </button>
            <div
              {...attributes}
              {...listeners}
              className="p-2 cursor-grab active:cursor-grabbing hover:bg-theme-main/10 rounded-lg text-theme-muted hover:text-theme-main transition-all active:scale-95 group/btn"
            >
              <GripVertical className="w-4 h-4 group-hover/btn:scale-110" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col col-span-1 md:col-span-2 relative z-10 h-full min-h-[300px]">
        {children}
      </div>
    </div>
  );
}
