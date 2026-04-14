import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Key, Smartphone, User, ArrowRight, RotateCcw, CheckCircle2, ChevronLeft } from 'lucide-react';
import { api } from '../../lib/api';

interface PasswordRecoveryProps {
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'secondary' | 'reset' | 'success';

export function PasswordRecovery({ onClose }: PasswordRecoveryProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [maskedData, setMaskedData] = useState({ phone: '', name: '' });
  const [timeLeft, setTimeLeft] = useState(120);
  const [canResend, setCanResend] = useState(false);

  // Timer logic for OTP
  useEffect(() => {
    let timer: any;
    if (step === 'otp' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('otp');
      setTimeLeft(120);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || 'E-posta gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-otp', { email, code });
      setMaskedData({ phone: res.maskedPhone, name: res.maskedName });
      setStep('secondary');
    } catch (err: any) {
      setError(err.message || 'Kod doğrulanamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySecondary = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-secondary', { email, code, fullName, phone });
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Bilgiler uyuşmuyor.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Şifreler uyuşmuyor.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email, code, fullName, phone, newPassword });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={step === 'success' ? onClose : undefined} 
      />
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full max-w-md bg-theme-card border border-theme rounded-2xl p-8 shadow-2xl overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-theme-primary/10 blur-[60px] rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-theme-primary/10 blur-[60px] rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-theme-main">Şifremi Unuttum</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-theme-hover rounded-lg transition-colors text-theme-muted"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-theme-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-theme-primary" />
                  </div>
                  <p className="text-theme-muted">Doğrulama kodu göndermek için e-posta adresinizi girin.</p>
                </div>
                
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
                  <input
                    type="email"
                    placeholder="E-posta Adresiniz"
                    className="input-primary h-10 w-full rounded-xl pl-12"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSendOTP}
                  disabled={loading || !email}
                  className="btn-primary w-full h-12 flex items-center justify-center gap-2 group"
                >
                  {loading ? 'Gönderiliyor...' : (
                    <>
                      Kod Gönder
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-theme-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Key className="w-8 h-8 text-theme-primary" />
                  </div>
                  <p className="text-theme-muted">
                    <strong>{email}</strong> adresine gönderilen 6 haneli kodu girin.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="input-primary w-full text-center text-3xl font-bold tracking-[1em] py-4"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className={`flex items-center gap-1.5 ${timeLeft === 0 ? 'text-red-400' : 'text-theme-muted'}`}>
                      <RotateCcw className={`w-4 h-4 ${timeLeft > 0 ? 'animate-spin-slow' : ''}`} />
                      {timeLeft > 0 ? `${formatTime(timeLeft)} kaldı` : 'Süre doldu'}
                    </span>
                    <button
                      onClick={handleSendOTP}
                      disabled={!canResend || loading}
                      className="text-theme-primary font-semibold hover:underline disabled:opacity-50"
                    >
                      Tekrar Gönder
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || code.length !== 6 || (timeLeft === 0 && !canResend)}
                  className="btn-primary w-full h-12"
                >
                  {loading ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
                </button>
              </motion.div>
            )}

            {step === 'secondary' && (
              <motion.div
                key="secondary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-theme-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-theme-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-theme-main">Ek Güvenlik Doğrulaması</h3>
                  <p className="text-theme-muted text-sm">Hesap güvenliğiniz için kayıtlı bilgilerinizi tam olarak girin.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-theme-muted mb-1 block uppercase tracking-wider font-bold">Kayıtlı İsim Soyisim: {maskedData.name}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
                      <input
                        placeholder="Tam İsim Soyisim"
                        className="input-primary h-10 w-full rounded-xl pl-12"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-theme-muted mb-1 block uppercase tracking-wider font-bold">Kayıtlı Telefon: {maskedData.phone}</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
                      <input
                        placeholder="Tam Telefon Numarası"
                        className="input-primary h-10 w-full rounded-xl pl-12"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleVerifySecondary}
                  disabled={loading || !fullName || !phone}
                  className="btn-primary w-full h-12"
                >
                  {loading ? 'Doğrulanıyor...' : 'Devam Et'}
                </button>
              </motion.div>
            )}

            {step === 'reset' && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-theme-main">Yeni Şifre Belirleyin</h3>
                  <p className="text-theme-muted text-sm">Lütfen güçlü bir şifre seçin.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
                    <input
                      type="password"
                      placeholder="Yeni Şifre"
                      className="input-primary h-10 w-full rounded-xl pl-12"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
                    <input
                      type="password"
                      placeholder="Şifreyi Onaylayın"
                      className="input-primary h-10 w-full rounded-xl pl-12"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || newPassword !== confirmPassword}
                  className="btn-primary w-full h-12"
                >
                  {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-theme-main">Başarılı!</h3>
                  <p className="text-theme-muted">Şifreniz başarıyla değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.</p>
                </div>
                <button
                  onClick={onClose}
                  className="btn-primary px-8 h-12"
                >
                  Giriş Yap
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20"
            >
              {error}
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
