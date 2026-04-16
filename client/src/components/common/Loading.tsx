import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function Loading({ size = 'md', fullScreen = false }: LoadingProps) {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer Glow Ring */}
        <div className={`absolute inset-0 rounded-full bg-theme-primary/30 blur-xl animate-pulse ${sizeMap[size]}`}></div>

        {/* Modern Spinning Ring */}
        <div className={`relative ${sizeMap[size]} border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin shadow-primary-glow`}></div>

        {/* Inner Lucide Spinner for extra coolness */}
        <div className={`absolute inset-0 flex items-center justify-center`}>
          <Loader2 className={`animate-spin text-theme-primary/50 ${size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-5 h-5' : 'w-3 h-3'}`} strokeWidth={1} />
        </div>
      </div>

      {size === 'lg' && (
        <p className="text-theme-primary font-medium animate-pulse tracking-widest text-xs">Yükleniyor...</p>
      )}
    </div>
  );

  if (fullScreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-theme-surface/80 backdrop-blur-md">
        {content}
      </div>,
      document.body
    );
  }

  return <div className="flex-1 flex items-center justify-center p-12 min-h-[300px]">{content}</div>;
}
