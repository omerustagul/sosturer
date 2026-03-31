import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Lock, Building2, ShieldCheck, ChevronRight, Check, FileText, Fingerprint, MapPin, Phone, X as XIcon } from 'lucide-react';

export function Register() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    tc: '',
    personalAddress: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    taxNumber: '',
    companyAddress: '',
    acceptTerms: false,
    acceptKVKK: false,
    acceptTicari: false,
    acceptDPA: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showContract, setShowContract] = useState<string | null>(null);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.acceptTerms || !formData.acceptKVKK || !formData.acceptTicari || !formData.acceptDPA) {
      setError('Lütfen tüm sözleşmeleri onaylayın.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        tc: formData.tc,
        personalAddress: formData.personalAddress,
        companyName: formData.companyName,
        taxNumber: formData.taxNumber,
        companyAddress: formData.companyAddress,
        role: 'admin' // First registered user is owner/admin
      });

      login(res.token, res.user);
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'Kayıt işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      nextStep();
    } else {
      handleFinalSubmit(e);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.tc || !formData.personalAddress || !formData.password || !formData.confirmPassword) {
        setError('Lütfen tüm kişisel alanları eksiksiz girin.');
        return;
      }
      if (formData.tc.length !== 11) {
        setError('T.C. Kimlik No 11 haneli olmalıdır.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Şifreler uyuşmuyor.');
        return;
      }
    }
    if (step === 2) {
      if (!formData.companyName || !formData.taxNumber || !formData.companyAddress) {
        setError('Lütfen tüm şirket alanlarını eksiksiz girin.');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-theme-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl max-h-[min(95vh,850px)] relative z-10 transition-all duration-500 flex flex-col items-stretch">
        <div className="bg-theme-card backdrop-blur-xl border border-theme rounded-2xl p-6 shadow-2xl flex flex-col h-full overflow-hidden">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative inline-flex group">
              <div className="absolute inset-0 bg-theme-primary/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity animate-pulse"></div>
              <div className="relative p-0 rounded-2xl bg-theme-surface border border-white/10 overflow-hidden shadow-2xl shadow-black/40 transform transition-transform group-hover:scale-110 duration-500">
                <img src="/logo.png" className="w-12 h-12 rounded-2xl object-contain" alt="Sosturer Logo" />
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${step >= i ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/30' : 'bg-theme-surface text-theme-dim border border-theme'
                  }`}>
                  {step > i ? <Check size={18} /> : i}
                </div>
                {i < 3 && <div className={`w-10 h-1 rounded-full ${step > i ? 'bg-theme-primary' : 'bg-theme-surface'}`} />}
              </div>
            ))}
          </div>

          <div className="text-center space-y-2 mb-6 text-sm">
            <h1 className="text-3xl font-black text-theme-main tracking-tighter">
              {step === 1 ? 'Kişisel Bilgiler' : step === 2 ? 'Şirket Bilgileri' : 'Sözleşme Onayları'}
            </h1>
            <p className="text-theme-muted font-bold uppercase tracking-[0.2em] text-[10px]">
              {step === 1 ? 'Profilinizi oluşturun' : step === 2 ? 'Kurumsal detayları ekleyin' : 'Dijital sözleşmeleri onaylayın'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={onFormSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent py-1">
              {step === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AD *</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="text"
                          name="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="Ömer Baran"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SOYAD *</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="text"
                          name="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="Ustagül"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-POSTA *</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="iletisim@sosturer.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">TELEFON *</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="tel"
                          name="phone"
                          required
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="05xx xxx xx xx"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">T.C. KİMLİK NO *</label>
                      <div className="relative group">
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="text"
                          name="tc"
                          required
                          maxLength={11}
                          value={formData.tc}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="12345678901"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ŞİFRE *</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="password"
                          name="password"
                          required
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ŞİFRE TEKRAR *</label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="password"
                          name="confirmPassword"
                          required
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">KİŞİSEL ADRES *</label>
                      <div className="relative group">
                        <MapPin className="absolute left-4 top-3 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <textarea
                          name="personalAddress"
                          required
                          value={formData.personalAddress}
                          onChange={handleChange}
                          rows={1}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all resize-none"
                          placeholder="Mahalle, Sokak, No..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ŞİRKET ADI *</label>
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="text"
                          name="companyName"
                          required
                          value={formData.companyName}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="Sosturer Metal A.Ş."
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">VERGİ NUMARASI *</label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                        <input
                          type="text"
                          name="taxNumber"
                          required
                          value={formData.taxNumber}
                          onChange={handleChange}
                          className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all"
                          placeholder="1234567890"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ŞİRKET ADRESİ *</label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-3 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={18} />
                      <textarea
                        name="companyAddress"
                        required
                        value={formData.companyAddress}
                        onChange={handleChange}
                        rows={2}
                        className="w-full bg-theme-form/60 border border-theme focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/30 rounded-xl py-3 pl-11 pr-4 text-theme-main text-sm placeholder-theme-dim outline-none transition-all resize-none"
                        placeholder="Şirket merkezi adresi..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <div className="p-4 bg-theme-surface/40 rounded-2xl border border-theme space-y-3">
                    {[
                      { id: 'membership', label: 'Üyelik Sözleşmesi', flag: 'acceptTerms' },
                      { id: 'kvkk', label: 'KVKK Politikası', flag: 'acceptKVKK' },
                      { id: 'ticari', label: 'Elektronik İletişim İzni', flag: 'acceptTicari' },
                      { id: 'dpa', label: 'Veri İşleme Protokolü (DPA)', flag: 'acceptDPA' }
                    ].map((contract) => (
                      <div key={contract.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => setShowContract(contract.id)}>
                        <div className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${(formData as any)[contract.flag] ? 'bg-theme-primary border-theme-primary' : 'bg-theme-form/60 border-theme'
                          }`}>
                          {(formData as any)[contract.flag] && <Check size={12} className="text-white" />}
                        </div>
                        <div>
                          <span className="text-xs text-theme-muted font-bold group-hover:text-theme-primary transition-colors underline decoration-dotted capitalize">{contract.label}'ni okudum, onaylıyorum.</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-theme-primary/10 border border-theme-primary/20 rounded-2xl flex gap-3">
                    <ShieldCheck className="text-theme-primary shrink-0" size={18} />
                    <p className="text-[10px] text-theme-primary/80 leading-relaxed font-bold">
                      Tüm bilgileriniz 256-bit şifreleme ile korunmaktadır. Kayıt sonrası dijital sözleşmeleriniz otomatik oluşturulacaktır.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-theme flex-shrink-0">
              {step < 3 ? (
                <button
                  type="submit"
                  className="w-full py-3.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-2xl font-black shadow-xl shadow-theme-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  DEVAM ET <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-theme-primary hover:bg-theme-primary-hover disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-2xl font-black shadow-xl shadow-theme-primary/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {loading ? 'HESAP OLUŞTURULUYOR...' : 'KAYDI TAMAMLA'} <Check size={18} />
                </button>
              )}
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="w-full py-2 text-theme-dim hover:text-theme-main font-bold transition-all text-xs tracking-widest"
                >
                  GERİ DÖN
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-theme-dim text-sm mt-10">
            Zaten bir hesabınız var mı{' '}
            <Link to="/login" className="text-theme-primary font-black hover:underline tracking-tight">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>

      {showContract && (
        <div className="fixed inset-0 z-50 bg-theme-base/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-300">
          <div className="bg-theme-card border border-theme w-full max-w-4xl h-full max-h-[85vh] rounded-2xl flex flex-col shadow-[0_0_100px_var(--primary-glow)]">
            <div className="p-8 border-b border-theme flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20">
                  <FileText className="text-theme-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-theme-main uppercase tracking-tight">
                    {showContract === 'membership' ? 'Üyelik Sözleşmesi' :
                      showContract === 'kvkk' ? 'KVKK Politikası' :
                        showContract === 'ticari' ? 'Elektronik İletişim İzni' :
                          'Veri İşleme Protokolü (DPA)'}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-black tracking-[0.3em] uppercase">Son Sürüm: 2026.3.23</p>
                </div>
              </div>
              <button
                onClick={() => setShowContract(null)}
                className="w-12 h-12 rounded-2xl bg-theme-surface/60 hover:bg-theme-surface text-theme-main flex items-center justify-center transition-all"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 font-bold text-theme-muted space-y-6 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {showContract === 'membership' && (
                <>
                  <h4 className="text-theme-main text-lg">1. TARAFLAR VE KONU</h4>
                  <p>İşbu sözleşme, bir tarafta Sosturer Metal Teknolojileri (bundan sonra "Hizmet Sağlayıcı" olarak anılacaktır) ile diğer tarafta bu uygulamaya kayıt olan {formData.firstName} {formData.lastName} (T.C.: {formData.tc}) (bundan sonra "Hizmet Alan" olarak anılacaktır) arasında akdedilmiştir.</p>
                  <h4 className="text-theme-main text-lg">2. HİZMETİN KAPSAMI</h4>
                  <p>Hizmet sağlayıcı, bulut tabanlı OEE ve üretim takip yazılımını {formData.companyName} bünyesinde kullanılmak üzere sunmayı taahhüt eder.</p>
                </>
              )}

              {showContract === 'kvkk' && (
                <>
                  <h4 className="text-theme-main text-lg">1. VERİ SORUMLUSU</h4>
                  <p>Sosturer, 6698 sayılı KVKK uyarınca "Veri Sorumlusu" sıfatıyla hareket etmektedir.</p>
                  <h4 className="text-theme-main text-lg">2. İŞLEME AMAÇLARI</h4>
                  <p>Kişisel verileriniz (Ad, Soyad, TC, Telefon, E-posta, Adres), hizmetin ifası ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.</p>
                </>
              )}

              {showContract === 'ticari' && (
                <>
                  <h4 className="text-theme-main text-lg">TİCARİ ELEKTRONİK İLETİ İZNİ</h4>
                  <p>Sosturer tarafından sunulan ürün ve hizmetlerin tanıtımı, kampanya ve duyurulardan haberdar olmak amacıyla {formData.email} ve {formData.phone} üzerinden tarafıma ticari ileti gönderilmesine onay veriyorum.</p>
                </>
              )}

              {showContract === 'dpa' && (
                <>
                  <h4 className="text-theme-main text-lg">VERİ İŞLEME PROTOKOLÜ</h4>
                  <p>Bu protokol, Hizmet Alan'ın {formData.companyName} adına işlediği üretim verilerinin güvenliği ve tarafların sorumluluklarını belirler.</p>
                </>
              )}

              <div className="p-8 bg-theme-primary/5 rounded-2xl border border-theme-primary/10">
                <p className="text-theme-primary italic text-center">"Bu metni onaylayarak dijital imzanızla sözleşmeyi resmi olarak başlattığınızı kabul edersiniz."</p>
              </div>
            </div>

            <div className="p-8 border-t border-theme flex justify-end">
              <button
                onClick={() => {
                  if (showContract === 'membership') setFormData(prev => ({ ...prev, acceptTerms: true }));
                  if (showContract === 'kvkk') setFormData(prev => ({ ...prev, acceptKVKK: true }));
                  if (showContract === 'ticari') setFormData(prev => ({ ...prev, acceptTicari: true }));
                  if (showContract === 'dpa') setFormData(prev => ({ ...prev, acceptDPA: true }));
                  setShowContract(null);
                }}
                className="px-12 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-2xl shadow-xl shadow-theme-primary/20 active:scale-95 transition-all text-sm tracking-widest"
              >
                KABUL EDİYORUM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
