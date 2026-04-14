import { Shield, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedAccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-theme-base animate-in fade-in duration-700">
      <div className="relative max-w-lg w-full">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-theme-danger/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-theme-primary/5 blur-[100px] rounded-full" />

        <div className="modern-glass-card p-12 text-center space-y-8 relative overflow-hidden group">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-theme-danger/20 rounded-3xl blur-2xl animate-pulse" />
            <div className="relative w-full h-full bg-theme-base/40 border border-theme-danger/30 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <Shield className="w-12 h-12 text-theme-danger" />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black text-theme-main tracking-tight uppercase">Yetkisiz Erişim</h2>
            <div className="h-1.5 w-20 bg-theme-danger/30 mx-auto rounded-full" />
            <p className="text-theme-muted font-bold leading-relaxed">
              Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz.<br />
              Lütfen sistem yöneticiniz ile iletişime geçin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-theme-surface border border-theme rounded-2xl text-theme-main font-black text-xs uppercase tracking-widest transition-all hover:bg-theme-main/5 active:scale-95"
            >
              <ArrowLeft size={16} /> Geri Dön
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-theme-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-theme-primary-hover shadow-xl shadow-theme-primary/20 active:scale-95"
            >
              <Home size={16} /> Kontrol Paneli
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
