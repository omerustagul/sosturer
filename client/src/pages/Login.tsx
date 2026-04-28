import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { PasswordRecovery } from '../components/auth/PasswordRecovery';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load remembered credentials
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPass = localStorage.getItem('rememberedPass');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedPass) {
      setPassword(savedPass);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = twoFactorToken
        ? await api.post('/auth/login/verify-2fa', { twoFactorToken, code: twoFactorCode })
        : await api.post('/auth/login', { email, password });

      if (res.twoFactorRequired) {
        setTwoFactorToken(res.twoFactorToken);
        setTwoFactorCode('');
        setError('');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberedPass', password);
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberedPass');
      }

      login(res.token, res.user, res.company);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center p-4 selection:bg-theme-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="modern-glass-card">
          <div className="mb-10 text-center space-y-4">
            <div className="relative inline-flex group">
              <div className="absolute inset-0 bg-theme-primary/30 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
              <div className="relative bg-transparent overflow-hidden hover:scale-105 transition-transform duration-500 rotate-0 hover:rotate-5">
                <img src="/logo.png" className="w-16 h-16 rounded-xl object-contain" alt="Sosturer Logo" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-theme-main tracking-tight">Giriş Yapın</h1>
              <p className="text-theme-muted mt-2">Modüler Üretim Yönetim Sistemi</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-start flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {twoFactorToken && (
              <div className="p-3 rounded-xl bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-xs font-bold">
                İki faktörlü doğrulama aktif. E-posta adresinize gelen 6 haneli kodu girin.
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-theme-muted flex items-center gap-2 px-1">
                <Mail className="w-4 h-4" /> E-posta Adresi
              </label>
              <input
                type="email"
                required
                value={email}
                disabled={!!twoFactorToken}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 bg-theme-form/40 border-2 border-theme hover:border-theme-primary/30 focus:border-theme-primary/50 focus:ring-4 focus:ring-theme-primary/10 rounded-xl py-2 px-4 text-theme-main placeholder-theme-dim transition-all duration-300 outline-none"
                placeholder="is@sirketiniz.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-medium text-theme-muted flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Şifre
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                disabled={!!twoFactorToken}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 bg-theme-form/40 border-2 border-theme hover:border-theme-primary/30 focus:border-theme-primary/50 focus:ring-4 focus:ring-theme-primary/10 rounded-xl py-2 px-4 text-theme-main placeholder-theme-dim transition-all duration-300 outline-none"
                placeholder="••••••••"
              />
            </div>

            {twoFactorToken && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-theme-muted flex items-center gap-2 px-1">
                  <ShieldCheck className="w-4 h-4" /> Doğrulama Kodu
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full h-12 bg-theme-form/40 border-2 border-theme hover:border-theme-primary/30 focus:border-theme-primary/50 focus:ring-4 focus:ring-theme-primary/10 rounded-xl py-2 px-4 text-xl text-theme-main placeholder-theme-dim transition-all duration-300 outline-none tracking-[0.4em] font-black text-center"
                  placeholder="000000"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <label className="relative flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 border-2 border-theme rounded-md bg-theme-surface peer-checked:bg-theme-primary peer-checked:border-theme-primary transition-all group-hover:border-theme-primary/50 shrink-0" />
                <Check className="absolute left-[3px] top-[3px] w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" strokeWidth={4} />
                <span className="text-sm text-theme-muted group-hover:text-theme-main transition-colors font-medium">Beni Hatırla</span>
              </label>

              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-xs font-bold text-theme-primary hover:text-theme-primary-hover transition-all flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-theme-primary/10"
              >
                Giriş Yapamıyor Musun?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-theme-primary/20 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>{twoFactorToken ? 'Doğrula ve Giriş Yap' : 'Giriş Yap'}</>
              )}
            </button>
          </form>

          <div className="mt-10 pt-4 border-t border-theme text-center">
            <p className="text-theme-dim text-sm">
              Sisteme henüz üye değil misiniz?
            </p>
            <button
              onClick={() => navigate('/register')}
              className="text-theme-primary font-bold rotate-0 hover:rotate-2 hover:underline hover:scale-105 tracking-tight transition-all duration-300"
            >
              Hemen Kayıt Olun
            </button>
          </div>
        </div>
      </motion.div >

      <AnimatePresence>
        {showRecovery && (
          <PasswordRecovery onClose={() => setShowRecovery(false)} />
        )}
      </AnimatePresence>
    </div >
  );
}
