import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Option {
  id: string | number;
  label: string;
  subLabel?: string;
  [key: string]: any;
}

interface CustomSelectProps {
  options: Option[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  isMulti?: boolean;
  variant?: 'default' | 'inline';
  fullWidth?: boolean;
}

export const CustomSelect = memo(({
  options,
  value,
  onChange,
  placeholder = 'Seçiniz...',
  label = '',
  error = '',
  disabled = false,
  className = '',
  searchable = true,
  isMulti = false,
  variant = 'default',
  fullWidth = true
}: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update position on open
  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const dropdownMaxHeight = 280; // Approximate max height (search + list + paddings)

      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;

      // Open up if there's no space below AND more space above
      const shouldOpenUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;

      setCoords({
        top: shouldOpenUp ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        openUp: shouldOpenUp
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Handle selection state
  const isSelected = (id: string | number) => {
    if (isMulti) {
      return Array.isArray(value) && value.includes(id);
    }
    return value === id;
  };

  const selectedLabels = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    if (isMulti) {
      if (!Array.isArray(value)) return [];
      return options.filter(opt => value.includes(opt.id)).map(opt => opt.label);
    }
    const found = options.find(opt => opt.id === value);
    return found ? [found.label] : [];
  }, [options, value, isMulti]);

  const selectedOption = !isMulti ? (options?.find(opt => opt.id === value) || null) : null;

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLocaleLowerCase('tr-TR');
    return options.filter(opt =>
      opt.label.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
      (opt.subLabel ?? '').toLocaleLowerCase('tr-TR').includes(lowerSearch)
    );
  }, [options, searchTerm]);

  // Handle outside click to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set focus on search when opened
  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  const handleSelect = (option: Option) => {
    if (isMulti) {
      const currentVal = Array.isArray(value) ? value : [];
      const newVal = currentVal.includes(option.id)
        ? currentVal.filter(id => id !== option.id)
        : [...currentVal, option.id];
      onChange(newVal);
    } else {
      onChange(option.id);
      setIsOpen(false);
    }
  };

  const dropdownMenu = (
    <div
      ref={dropdownRef}
      className="fixed z-[10001] bg-theme-form backdrop-blur-3xl border border-theme rounded-2xl shadow-2xl overflow-hidden animate-select-popup flex flex-col"
      style={{
        top: coords.openUp ? 'auto' : `${coords.top + 8}px`,
        bottom: coords.openUp ? `${window.innerHeight - coords.top + 8}px` : 'auto',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        minWidth: `${coords.width}px`,
        transformOrigin: coords.openUp ? 'bottom center' : 'top center'
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {searchable && (
        <div className="w-full p-2 border-b border-theme bg-theme-main/5 flex items-center gap-2 group shrink-0">
          <Search size={14} className="text-theme-dim group-focus-within:text-theme-primary transition-colors shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hızlı ara..."
            className="flex-1 min-w-0 bg-transparent border-none text-theme-main text-xs focus:outline-none placeholder:text-theme-dim font-bold"
          />
        </div>
      )}

      <div className="w-full max-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar-minimal py-2 flex-1">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const active = isSelected(option.id);
            return (
              <div
                key={option.id}
                onClick={() => handleSelect(option)}
                className={cn(
                  "px-2 py-2 flex items-center justify-between cursor-pointer transition-all duration-200 group/opt w-full",
                  active ? "bg-theme-primary/10 text-theme-primary border-l-4 border-theme-primary font-bold"
                    : "hover:bg-theme-main/5 text-theme-main hover:text-theme-primary border-l-4 border-transparent"
                )}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={cn("text-[11px] font-bold truncate leading-snug transition-colors", active ? "text-theme-primary" : "text-theme-main group-hover/opt:text-theme-primary")}>
                    {option.label}
                  </span>
                  {option.subLabel && (
                    <span className={cn(
                      "text-[9px] font-bold truncate mt-0.5 transition-colors",
                      active ? "text-theme-primary/60" : "text-theme-dim group-hover/opt:text-theme-muted"
                    )}>
                      {typeof option.subLabel === 'object' ? null : option.subLabel}
                    </span>
                  )}
                </div>
                {active && <Check size={12} className="text-theme-primary shrink-0" />}
              </div>
            );
          })
        ) : (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-theme-dim w-full">
            <Search size={16} className="opacity-20" />
            <span className="text-[10px] font-bold text-center">Sonuç Bulunamadı</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {label && <label className="block text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1 mb-1">{label}</label>}

      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "relative bg-theme-base border border-theme rounded-xl flex items-center justify-between cursor-pointer transition-all duration-300 group",
          fullWidth ? "w-full" : "min-w-[5rem] w-fit",
          variant === 'inline' ? "h-10 px-2 py-1" : "h-10 px-2 py-1",
          isOpen && "ring-4 ring-theme-primary/10 border-theme-primary/40 bg-theme-surface shadow-primary-glow",
          !isOpen && !disabled && "hover:border-theme-primary/40 hover:bg-theme-surface/50",
          disabled && "opacity-40 cursor-not-allowed grayscale",
          error && "border-red-500/40 ring-red-500/10"
        )}
      >
        <div className="flex-1 min-w-0 px-2">
          {selectedLabels.length > 0 ? (
            <div className="flex flex-col">
              <span className={cn(
                "text-theme-main font-bold truncate leading-tight mr-2",
                variant === 'inline' ? "text-[11px]" : "text-sm"
              )}>
                {isMulti && selectedLabels.length > 1 ? `${selectedLabels[0]} (+${selectedLabels.length - 1})` : selectedLabels[0]}
              </span>
              {!isMulti && selectedOption?.subLabel && (
                <span className="text-[10px] font-bold text-theme-dim truncate leading-tight mt-0">
                  {typeof selectedOption.subLabel === 'object' ? null : selectedOption.subLabel}
                </span>
              )}
            </div>
          ) : (
            <span className={cn(
              "text-theme-dim font-medium",
              variant === 'inline' ? "text-[11px]" : "text-sm"
            )}>{placeholder}</span>
          )}
        </div>

        <div className={cn(
          "flex items-center gap-1 ml-auto p-0 border-l border-theme group-hover:border-theme transition-colors",
          variant === 'inline' ? "pl-1" : "pl-1"
        )}>
          {selectedLabels.length > 0 && !disabled && (
            <div
              onClick={(e) => { e.stopPropagation(); onChange(isMulti ? [] : ''); }}
              className="p-1 rounded-full hover:bg-theme-main/10 text-theme-dim hover:text-theme-main transition-all cursor-pointer"
            >
              <X size={variant === 'inline' ? 10 : 12} />
            </div>
          )}
          <ChevronDown
            size={variant === 'inline' ? 14 : 16}
            className={cn("text-theme-dim transition-transform duration-500 ease-out", isOpen && "rotate-180 text-theme-primary")}
          />
        </div>
      </div>

      {isOpen && createPortal(dropdownMenu, document.body)}

      {error && <p className="mt-1 text-red-500 text-[9px] font-black uppercase tracking-[0.2em] pl-1">{error}</p>}
      <style>{`
        .custom-scrollbar-minimal::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar-minimal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-minimal::-webkit-scrollbar-thumb { background: var(--border-main); border-radius: 20px; border: 1px solid rgba(0,0,0,0); background-clip: padding-box; }
        .custom-scrollbar-minimal::-webkit-scrollbar-thumb:hover { background: var(--primary); }
      `}</style>
    </div>
  );
});
