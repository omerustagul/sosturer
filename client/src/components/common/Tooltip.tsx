import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  interactive?: boolean;
}

export function Tooltip({ content, children, position = 'top', className = '', interactive = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<any>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords);
      window.addEventListener('resize', updateCoords);
    } else {
      setCoords(null);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    updateCoords();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (interactive) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 150);
    } else {
      setIsVisible(false);
    }
  };

  if (!content) return <>{children}</>;

  const getPositionStyles = () => {
    const el = triggerRef.current;
    if (!el || !coords) return {};

    const triggerRect = el.getBoundingClientRect();

    const offset = 8;
    switch (position) {
      case 'bottom':
        return {
          top: coords.top + triggerRect.height + offset,
          left: coords.left + triggerRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: coords.top + triggerRect.height / 2,
          left: coords.left - offset,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: coords.top + triggerRect.height / 2,
          left: coords.left + triggerRect.width + offset,
          transform: 'translateY(-50%)',
        };
      case 'top':
      default:
        return {
          top: coords.top - offset,
          left: coords.left + triggerRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
    }
  };

  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-theme-card border-x-transparent border-t-4 border-x-4 border-b-0',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-theme-card border-x-transparent border-b-4 border-x-4 border-t-0',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-theme-card border-y-transparent border-l-4 border-y-4 border-r-0',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-theme-card border-y-transparent border-r-4 border-y-4 border-l-0',
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && coords && createPortal(
        <div
          style={{ ...getPositionStyles(), position: 'absolute' }}
          className={`z-[9999] px-1 py-1 text-[11px] font-bold text-theme-main bg-theme-card/60 backdrop-blur-sm border border-theme-border rounded-xl whitespace-pre-line ${position === 'right' ? 'animate-tooltip-rtl' : 'animate-in fade-in zoom-in-95'} duration-500 w-max max-w-xs ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} text-center ring-1 ring-theme-border/50`}
          onMouseEnter={interactive ? handleMouseEnter : undefined}
          onMouseLeave={interactive ? handleMouseLeave : undefined}
        >
          {content}
          <div className={`absolute w-0 h-0 ${arrowClasses[position]} opacity-95`} />
        </div>,
        document.body
      )}
    </div>
  );
}
