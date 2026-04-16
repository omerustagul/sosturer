import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Activity,
  User as UserIcon,
  Calendar,
  ShieldCheck,
  Mail,
  Phone,
  Edit3,
  X,
  Check,
  Camera,
  LogOut,
  Smartphone,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { CustomSelect } from '../components/common/CustomSelect';

export function Profile() {
  const { user, logout, saveProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.personalPhone || '',
    tc: user?.tc || '',
    gender: user?.gender || 'Erkek',
    nationality: user?.nationality || 'T.C. Vatandaşı',
    birthDate: user?.birthDate || '',
    address: user?.personalAddress || '',
    memberSince: user?.memberSince || new Date().getFullYear().toString()
  });
  
  const [draftData, setDraftData] = useState(formData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.personalPhone || '',
        tc: user.tc || '',
        gender: user.gender || 'Erkek',
        nationality: user.nationality || 'T.C. Vatandaşı',
        birthDate: user.birthDate || '',
        address: user.personalAddress || '',
        memberSince: user.memberSince || ''
      });
    }
  }, [user]);

  useEffect(() => {
    setDraftData(formData);
  }, [formData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert("Profil resmi güncelleme özelliği yakında eklenecektir.");
    }
  };

  const handleSave = async () => {
    if (draftData.tc && draftData.tc.length !== 11) {
      alert("TC Kimlik Numarası 11 haneli olmalıdır.");
      return;
    }
    if (draftData.phone && draftData.phone.length !== 10) {
      alert("Telefon numarası 10 haneli olmalıdır (Örn: 5xx ...)");
      return;
    }

    setLoading(true);
    try {
      await saveProfile({
        fullName: draftData.fullName,
        personalPhone: draftData.phone,
        tc: draftData.tc,
        gender: draftData.gender,
        nationality: draftData.nationality,
        birthDate: draftData.birthDate,
        personalAddress: draftData.address
      });
      setIsEditing(false);
    } catch (error) {
      alert("Bilgiler kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const formatTC = (val: string) => val.replace(/\D/g, '').slice(0, 11);
  const formatPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Enhanced Profile Header */}
      <section className="modern-glass-card relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-theme-primary/10 blur-[100px] -mr-48 -mt-48 transition-all duration-1000 group-hover:bg-theme-primary/20" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group/avatar">
            <div className="w-32 h-32 rounded-full border-4 border-theme-primary/20 p-2 bg-theme-base shadow-2xl relative transition-transform duration-500 group-hover/avatar:scale-105">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-theme-primary/10 to-theme-primary/5 flex items-center justify-center text-3xl font-black text-theme-primary">
                {formData.fullName ? (
                  formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                ) : (
                  "U"
                )}
              </div>
              <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-full opacity-0 group-hover/avatar:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                <Camera className="w-6 h-6 text-white mb-1" />
                <span className="text-[8px] text-white font-black tracking-widest uppercase">DEĞİŞTİR</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-theme-surface flex items-center justify-center shadow-lg">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-2">
                <h1 className="text-lg lg:text-xl font-black text-theme-main">{formData.fullName}</h1>
                <div className="px-2 py-1 rounded-full bg-theme-primary/15 border border-theme-primary/20 text-theme-primary text-[10px] font-bold">
                  {user?.role === 'admin' ? 'YÖNETİCİ' : user?.role === 'superadmin' ? 'SİSTEM YÖNETİCİSİ' : 'PERSONEL'}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-theme-dim text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-theme-primary/60" /> {user?.email}
                </span>
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-theme-primary/60" /> +90 {formData.phone}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-theme-primary/60" /> Üyelik: {formData.memberSince || '2026'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (confirm('Güvenli çıkış yapılsın mı?')) { logout(); window.location.href = '/login'; } }}
              className="h-12 w-12 flex items-center justify-center bg-theme-danger/10 border border-theme-danger/20 text-theme-danger rounded-2xl group hover:bg-theme-danger/20 hover:scale-105 transition-all"
            >
              <LogOut className="w-5 h-5 group hover:scale-115" />
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Control */}
      <div className="flex justify-center md:justify-start">
        <div className="modern-pill-tabs">
          {[
            { id: 'personal', label: 'Genel Bilgiler', icon: UserIcon },
            { id: 'documents', label: 'Sözleşme & Hukuki', icon: FileText },
            { id: 'security', label: 'Hesap & Güvenlik', icon: ShieldCheck }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "modern-pill-tab-btn",
                activeTab === tab.id && "active"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="min-h-[500px]"
        >
          {activeTab === 'personal' && (
            <div className="modern-glass-card space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-xl font-black text-theme-main">Profil Bilgileri</h2>
                  <p className="text-theme-muted text-[11px] font-semibold">Kişisel verileriniz ve iletişim bilgileriniz</p>
                </div>
                <button
                  onClick={isEditing ? () => setIsEditing(false) : () => setIsEditing(true)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all active:scale-95",
                    isEditing
                      ? "bg-theme-danger/10 border-theme-danger/20 text-theme-danger"
                      : "bg-theme-primary/10 border-theme-primary/20 text-theme-primary hover:bg-theme-primary/20"
                  )}
                >
                  {isEditing ? <><X size={14} /> VAZGEÇ</> : <><Edit3 size={14} /> DÜZENLE</>}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6">
                {[
                  { key: 'fullName', label: 'AD SOYAD', icon: UserIcon },
                  { key: 'phone', label: 'TELEFON NUMARASI', icon: Phone, prefix: '+90' },
                  { key: 'email', label: 'E-POSTA ADRESİ', icon: Mail, type: 'email', readOnly: true },
                  { key: 'tc', label: 'TC KİMLİK NUMARASI', icon: ShieldCheck },
                  { key: 'gender', label: 'CİNSİYET', icon: UserIcon, type: 'select', options: ['Erkek', 'Kadın', 'Diğer'] },
                  { key: 'birthDate', label: 'DOĞUM TARİHİ', icon: Calendar, type: 'date' },
                  { key: 'nationality', label: 'UYRUK', icon: MapPin, type: 'select', options: ['T.C. Vatandaşı', 'Diğer'] },
                  { key: 'startDate', label: 'ÜYELİK / BAŞLAMA', icon: Clock, readOnly: true },
                  { key: 'address', label: 'EV ADRESİ', icon: MapPin, fullWidth: true },
                ].map((field) => (
                  <div key={field.key} className={cn("space-y-2", field.fullWidth && "md:col-span-2 lg:col-span-2")}>
                    <div className="flex items-center gap-1 opacity-60">
                      <field.icon className="w-3 h-3 text-theme-primary" />
                      <span className="text-[11px] font-black text-theme-muted">{field.label}</span>
                    </div>
                    {isEditing && !field.readOnly ? (
                      <div className="relative">
                        {field.prefix && (
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-theme-muted">
                            {field.prefix}
                          </div>
                        )}
                        {field.type === 'select' ? (
                          <CustomSelect
                            value={(draftData as any)[field.key]}
                            options={(field.options || []).map(o => ({ id: o, label: o }))}
                            onChange={(val) => setDraftData(prev => ({ ...prev, [field.key]: val }))}
                          />
                        ) : (
                          <input
                            type={field.type || "text"}
                            value={(draftData as any)[field.key]}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (field.key === 'tc') val = formatTC(val);
                              if (field.key === 'phone') val = formatPhone(val);
                              setDraftData(prev => ({ ...prev, [field.key]: val }));
                            }}
                            className={cn(
                              "next-gen-input w-full",
                              field.prefix && "pl-12"
                            )}
                            placeholder={field.key === 'phone' ? "5xx ..." : ""}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-theme-main bg-theme-base/30 px-4 py-2.5 rounded-xl border border-theme-border/10">
                        {field.key === 'phone' ? `+90 ${(formData as any)[field.key]}` : (formData as any)[field.key] || '---'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="flex justify-end h-10 rounded-xl border-t border-theme-border/20">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-3 h-10 p-2 px-4 bg-theme-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 hover:shadow-xl transition-all shadow-lg shadow-theme-primary/20 disabled:opacity-50"
                  >
                    <Check size={18} /> DEĞİŞİKLİKLERİ KAYDET
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="modern-glass-card">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-10 h-10 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-theme-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-theme-main">Hukuki Belgeler</h3>
                    <p className="text-theme-muted text-[11px] font-semibold">Dijital onaylı sözleşmeleriniz</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { title: "Üyelik Sözleşmesi", date: "Ocak 2026", size: "2.4 MB" },
                    { title: "KVKK Aydınlatma Metni", date: "Şubat 2026", size: "1.1 MB" },
                    { title: "Elektronik İleti Onayı", date: "Mart 2026", size: "850 KB" }
                  ].map((doc, idx) => (
                    <div key={idx} className="group flex items-center justify-between p-4 rounded-xl border border-theme-border/20 bg-theme-base/20 hover:bg-theme-surface/40 hover:border-theme-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-theme-surface/50 flex items-center justify-center border border-theme transition-transform group-hover:scale-110">
                          <Download className="w-4 h-4 text-theme-muted group-hover:text-theme-primary" />
                        </div>
                        <div>
                          <p className="text-[12px] font-black text-theme-main group-hover:text-theme-primary transition-colors uppercase tracking-wider">{doc.title}</p>
                          <span className="text-[9px] text-theme-muted font-bold uppercase tracking-widest">{doc.date} • {doc.size}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-theme-muted opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="modern-glass-card bg-gradient-to-br from-indigo-500/10 to-theme-primary/15">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-10 h-10 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-theme-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-theme-main">Hesap İstatistikleri</h3>
                    <p className="text-theme-muted text-[11px] font-semibold">Kişisel kullanım ve veri özeti</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-theme-card/50 backdrop-blur-sm border border-theme-border/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">HAFTALIK AKTİVİTE</span>
                      <span className="px-3 py-1 bg-theme-primary/10 text-theme-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-theme-primary/20">%92 VERİMLİLİK</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">TOPLAM VERİ GİRİŞİ</span>
                      <span className="text-xs font-black text-theme-main tracking-widest">1,248 KAYIT</span>
                    </div>
                    <div className="w-full bg-theme-muted/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-theme-primary h-full w-[92%]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-theme-border/10 bg-theme-card/50 backdrop-blur-sm text-center">
                      <p className="text-[9px] font-black text-theme-muted uppercase mb-1">SİSTEM PUANI</p>
                      <p className="text-sm font-black text-theme-main uppercase">980 XP</p>
                    </div>
                    <div className="p-4 rounded-xl border border-theme-border/10 bg-theme-card/50 backdrop-blur-sm text-center">
                      <p className="text-[9px] font-black text-theme-muted uppercase mb-1">SON AKTİVİTE</p>
                      <p className="text-sm font-black text-theme-main uppercase">BUGÜN</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-12 modern-glass-card p-4 lg:p-8">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-theme-main">Güvenlik Ayarları</h3>
                    <p className="text-theme-muted text-[11px] font-semibold">Giriş güvenliği ve erişim yetkileri</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <button className="w-full h-20 flex items-center justify-between p-4 bg-theme-surface/40 border border-theme/20 rounded-2xl hover:bg-theme-primary/5 hover:border-theme-primary/30 transition-all group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-theme-base flex items-center justify-center border border-theme group-hover:border-theme-primary/40"><Lock className="w-5 h-5 text-theme-dim group-hover:text-theme-primary" /></div>
                        <div className="text-left">
                          <p className="font-black text-theme-main uppercase text-[11px] mb-0.5">PAROLA GÜNCELLE</p>
                          <p className="text-[9px] text-theme-muted font-bold uppercase">Hesap güvenliğini artırın</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-theme-dim group-hover:text-theme-primary" />
                    </button>

                    <button className="w-full h-20 flex items-center justify-between p-4 bg-theme-surface/40 border border-theme/20 rounded-2xl hover:bg-theme-primary/5 hover:border-theme-primary/30 transition-all group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl bg-theme-base flex items-center justify-center border border-theme group-hover:border-theme-primary/40"><Smartphone className="w-5 h-5 text-theme-dim group-hover:text-theme-primary" /></div>
                        <div className="text-left">
                          <p className="font-black text-theme-main uppercase text-[11px] mb-0.5">İKİ FAKTÖRLÜ DOĞRULAMA</p>
                          <p className="text-[9px] text-theme-success font-bold uppercase tracking-tight">ŞU AN AKTİF</p>
                        </div>
                      </div>
                      <div className="w-10 h-5 bg-theme-success/20 rounded-full flex items-center px-1">
                        <div className="w-3.5 h-3.5 bg-theme-success rounded-full ml-auto" />
                      </div>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-theme-primary/5 border border-theme-primary/10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-6 h-6 bg-theme-primary/20 rounded flex items-center justify-center">
                          <Eye className="w-3.5 h-3.5 text-theme-primary" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-theme-main">SON OTURUMLAR</span>
                      </div>
                      <div className="space-y-3">
                        {[
                          { device: 'Windows PC • İstanbul', time: 'Şimdi aktif', icon: Layout },
                          { device: 'iPhone 15 • Bursa', time: '2 saat önce', icon: Smartphone }
                        ].map((session, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-theme/5 last:border-0">
                            <div className="flex items-center gap-3">
                              <session.icon className="w-3.5 h-3.5 text-theme-dim" />
                              <div>
                                <p className="text-[10px] font-black text-theme-main uppercase tracking-tight">{session.device}</p>
                                <p className="text-[8px] text-theme-muted font-bold uppercase">{session.time}</p>
                              </div>
                            </div>
                            <span className={cn("text-[7px] font-black px-1.5 py-0.5 rounded border uppercase", i == 0 ? "bg-theme-success/10 border-theme-success/20 text-theme-success" : "bg-theme-muted/10 border-theme/20 text-theme-muted")}>
                              {i == 0 ? 'AKTİF' : 'KAPAT'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default Profile;
