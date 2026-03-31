import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-theme-card backdrop-blur-xl border border-theme rounded-2xl p-8 shadow-2xl">
          <div className="mb-10 text-center space-y-2">
            <div className="relative inline-flex mb-4 group">
              <div className="absolute inset-0 bg-theme-primary/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
              <div className="relative p-0 rounded-2xl bg-theme-surface border border-white/10 overflow-hidden shadow-2xl shadow-black/40 transform transition-transform group-hover:scale-110 duration-500">
                <img src="/logo.png" className="w-16 h-16 rounded-2xl object-contain" alt="Sosturer Logo" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-theme-main tracking-tight">OEE Sistemine Giriş</h1>
            <p className="text-theme-muted">Devam etmek için e-posta ve şifrenizi girin</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">E-posta Adresi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-theme-dim" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/40 rounded-xl py-3 pl-12 pr-4 text-theme-main placeholder-theme-dim transition-colors"
                  placeholder="admin@neyesem.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-theme-dim" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/40 rounded-xl py-3 pl-12 pr-4 text-theme-main placeholder-theme-dim transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-70 disabled:cursor-not-allowed mt-2 active:scale-95">
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center text-theme-dim text-sm mt-8 border-t border-theme pt-6">
            Henüz bir hesabınız yok mu <br />
            <button onClick={() => navigate('/register')} className="text-theme-primary font-bold hover:text-theme-primary-hover transition-colors mt-2">
              Hemen Kayıt Olun
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

