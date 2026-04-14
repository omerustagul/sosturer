import { cn } from '../../lib/utils';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const requirements = [
    { label: '8+ karakter', regex: /.{8,}/ },
    { label: 'Büyük harf', regex: /[A-Z]/ },
    { label: 'Küçük harf', regex: /[a-z]/ },
    { label: 'Rakam', regex: /[0-9]/ },
    { label: 'Sembol', regex: /[^A-Za-z0-9]/ },
  ];

  const score = requirements.filter(req => req.regex.test(password)).length;
  
  const getStrengthLabel = () => {
    if (password.length === 0) return 'Henüz girilmedi';
    if (score <= 2) return 'Zayıf';
    if (score <= 4) return 'Orta';
    return 'Güçlü Parola';
  };

  const getStrengthColor = () => {
    if (password.length === 0) return 'text-slate-500';
    if (score <= 2) return 'text-rose-500';
    if (score <= 4) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getBgColor = () => {
    if (password.length === 0) return 'bg-slate-700/30';
    if (score <= 2) return 'bg-rose-500';
    if (score <= 4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 h-1 bg-theme-surface rounded-full overflow-hidden flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div 
              key={level}
              className={cn(
                "h-full flex-1 transition-all duration-700",
                score >= level ? getBgColor() : "bg-white/5"
              )}
            />
          ))}
        </div>
        <span className={cn("text-[9px] font-black uppercase tracking-tighter whitespace-nowrap", getStrengthColor())}>
          {getStrengthLabel()}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {requirements.map((req, idx) => {
          const isMet = req.regex.test(password);
          return (
            <span key={idx} className={cn(
              "text-[8px] font-bold uppercase transition-all duration-300",
              isMet ? "text-emerald-500" : "text-theme-dim/40"
            )}>
              {req.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
