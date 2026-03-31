import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  User as UserIcon,
  Calendar,
  ShieldCheck,
  FileLock2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Lock,
  ChevronRight,
  Download,
  CheckCircle2,
  History,
  Building2,
  Globe,
  Users,
  Edit3,
  X,
  Check,
  Fingerprint,
  Camera,
  LogOut
} from 'lucide-react';
import { CustomSelect } from '../components/common/CustomSelect';
import html2pdf from 'html2pdf.js';

export function Profile() {
  const { user, company, logout, saveProfile, saveCompany, refreshUser } = useAuthStore();
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Real States (Saved Data)
  const [personalData, setPersonalData] = useState({
    firstName: "",
    lastName: "",
    tc: "",
    gender: "Erkek",
    nationality: "T.C. Vatandaşı",
    birthDate: "",
    email: "",
    phone: "",
    address: ""
  });

  const [companyData, setCompanyData] = useState({
    name: "Şirket Adı",
    address: "",
    taxOffice: "",
    taxNumber: "",
    sicilNo: "",
    mersisNo: "",
    kepAddress: "",
    phone: "",
    email: "",
    website: "",
    sector: "",
    employees: "",
    founded: "",
    memberSince: "12 Ocak 2024"
  });

  // Sync initial data from global store
  useEffect(() => {
    const fetchData = async () => {
      await refreshUser();
      setLoadingProfile(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      const [first, ...rest] = (user.fullName || "").split(' ');
      setPersonalData({
        firstName: first || "Kullanıcı",
        lastName: rest.join(' ') || "",
        tc: user.tc || "",
        gender: user.gender || "Erkek",
        nationality: user.nationality || "T.C. Vatandaşı",
        birthDate: user.birthDate || "",
        email: user.email || "",
        phone: user.personalPhone || "",
        address: user.personalAddress || ""
      });
    }

    if (company) {
      setCompanyData({
        name: company.name || "Şirket Adı",
        address: company.companyAddress || "",
        taxOffice: company.taxOffice || "",
        taxNumber: company.taxNumber || "",
        sicilNo: company.sicilNo || "",
        mersisNo: company.mersisNo || "",
        kepAddress: company.kepAddress || "",
        phone: company.companyPhone || "",
        email: company.companyEmail || "",
        website: company.website || "",
        sector: company.sector || "",
        employees: company.employees || "",
        founded: company.founded || "",
        memberSince: company.createdAt ? new Date(company.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : "Bilinmiyor"
      });
    }
  }, [user, company]);

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalDraft, setPersonalDraft] = useState(personalData);

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyDraft, setCompanyDraft] = useState(companyData);

  const documents = [
    { title: "Üyelik Sözleşmesi", date: "23.03.2026", size: "2.4 MB", type: "PDF", key: 'membership' },
    { title: "KVKK Politikası", date: "23.03.2026", size: "1.1 MB", type: "PDF", key: 'kvkk' },
    { title: "Elektronik İletişim İzni", date: "23.03.2026", size: "850 KB", type: "PDF", key: 'ticari' },
    { title: "Veri İşleme Protokolü (DPA)", date: "23.03.2026", size: "3.2 MB", type: "PDF", key: 'dpa' }
  ];

  const personalFields = [
    { key: "firstName", label: "İSİM", icon: UserIcon },
    { key: "lastName", label: "SOYİSİM", icon: UserIcon },
    { key: "tc", label: "TC KİMLİK NO", icon: ShieldCheck },
    { key: "gender", label: "CİNSİYET", icon: UserIcon, type: "select", options: ["Erkek", "Kadın", "Belirtmek İstemiyorum"] },
    { key: "nationality", label: "UYRUK", icon: MapPin, type: "select", options: ["T.C. Vatandaşı", "Yabancı"] },
    { key: "birthDate", label: "DOĞUM TARİHİ", icon: Calendar, type: "date" },
    { key: "email", label: "KİŞİSEL E-POSTA", icon: Mail },
    { key: "phone", label: "İKİNCİ TELEFON", icon: Phone },
    { key: "address", label: "EV ADRESİ", icon: MapPin, isFullWidth: true }
  ];

  const companyFields = [
    { key: "taxOffice", label: "VERGİ DAİRESİ", icon: Building2 },
    { key: "taxNumber", label: "VERGİ NUMARASI", icon: ShieldCheck },
    { key: "sicilNo", label: "TİCARET SİCİL NO", icon: FileLock2 },
    { key: "mersisNo", label: "MERSİS NO", icon: Fingerprint },
    { key: "kepAddress", label: "KEP ADRESİ", icon: Mail },
    { key: "phone", label: "ŞİRKET TELEFONU", icon: Phone },
    { key: "email", label: "ŞİRKET E-POSTA", icon: Mail },
    { key: "website", label: "WEB SİTESİ", icon: Globe },
    { key: "sector", label: "SEKTÖR", icon: Briefcase },
    { key: "employees", label: "ÇALIŞAN SAYISI", icon: Users },
    { key: "founded", label: "KURULUŞ YILI", icon: Calendar },
    { key: "address", label: "ŞİRKET MERKEZİ", icon: MapPin, isFullWidth: true }
  ];

  const handlePersonalEdit = () => {
    setPersonalDraft(personalData);
    setIsEditingPersonal(true);
  };

  const handlePersonalCancel = () => {
    setIsEditingPersonal(false);
  };

  const handlePersonalSave = async () => {
    try {
      await saveProfile({
        fullName: `${personalDraft.firstName} ${personalDraft.lastName}`,
        tc: personalDraft.tc,
        gender: personalDraft.gender,
        nationality: personalDraft.nationality,
        birthDate: personalDraft.birthDate,
        personalPhone: personalDraft.phone,
        personalAddress: personalDraft.address
      });
      setIsEditingPersonal(false);
    } catch (error) {
      alert("Kişisel bilgiler kaydedilemedi.");
    }
  };

  const handleCompanyEdit = () => {
    setCompanyDraft(companyData);
    setIsEditingCompany(true);
  };

  const handleCompanyCancel = () => {
    setIsEditingCompany(false);
  };

  const handleCompanySave = async () => {
    try {
      await saveCompany({
        name: companyDraft.name,
        companyAddress: companyDraft.address,
        taxOffice: companyDraft.taxOffice,
        taxNumber: companyDraft.taxNumber,
        sicilNo: companyDraft.sicilNo,
        mersisNo: companyDraft.mersisNo,
        kepAddress: companyDraft.kepAddress,
        companyPhone: companyDraft.phone,
        companyEmail: companyDraft.email,
        website: companyDraft.website,
        sector: companyDraft.sector,
        employees: companyDraft.employees,
        founded: companyDraft.founded
      });
      setIsEditingCompany(false);
    } catch (error) {
      alert("Şirket bilgileri kaydedilemedi. Şube yöneticisi yetkisine sahip olmayabilirsiniz.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          if (type === 'avatar') {
            await saveProfile({ avatarUrl: base64String });
          } else {
            await saveCompany({ logoUrl: base64String });
          }
        } catch (error) {
          alert("Görsel yüklenemedi.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = (doc: any) => {
    const today = new Date().toLocaleDateString('tr-TR');
    const template = document.createElement('div');
    template.style.position = 'absolute';
    template.style.left = '-10000px';
    template.style.top = '-10000px';
    template.style.width = '700px';
    template.style.background = 'white';
    template.style.zIndex = '-9999';
    template.style.opacity = '1';
    template.style.pointerEvents = 'none';
    template.style.visibility = 'visible';
    document.body.appendChild(template);

    template.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: white; width: 700px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; margin: 0; color: #2563eb; letter-spacing: -0.025em; text-transform: uppercase;">SOSTURER</h1>
            <p style="font-size: 8px; font-weight: 800; letter-spacing: 0.2em; margin: 4px 0 0 0; color: #64748b; text-transform: uppercase;">Üretim Yönetim Sistemleri</p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 4px 12px; border-radius: 6px; background: #eff6ff; border: 1px solid #dbeafe; color: #2563eb; font-size: 10px; font-weight: 800; text-transform: uppercase;">Dijital Onaylı Belge</div>
            <p style="font-size: 9px; color: #94a3b8; margin: 6px 0 0 0; font-weight: 600;">REF: SOST/2026/${Math.floor(Math.random() * 90000) + 10000}</p>
          </div>
        </div>

        <!-- Title -->
        <div style="margin-bottom: 35px;">
          <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #1e293b; text-transform: uppercase; letter-spacing: -0.01em;">${doc.title}</h2>
          <div style="width: 40px; height: 3px; background: #2563eb; border-radius: 2px;"></div>
        </div>

        <!-- Parties Matrix -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 35px; background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #f1f5f9;">
          <div>
            <p style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em;">Sağlayıcı Taraf</p>
            <p style="font-size: 13px; font-weight: 800; margin: 0; color: #0f172a;">SOSTURER METAL TEKNOLOJİLERİ A.Ş.</p>
            <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0; line-height: 1.5;">İkitelli Org. San. Bölgesi, Metal İş San. Sit.<br/>2. Cadde No:34, Başakşehir/İstanbul<br/>VN: 7120658421</p>
          </div>
          <div>
            <p style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em;">Hizmet Alan Taraf</p>
            <p style="font-size: 13px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase;">${company?.name || 'Bireysel Kullanıcı'}</p>
            <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0; line-height: 1.5;">${company?.companyAddress || '-'}<br/>VN/TC: ${company?.taxNumber || user?.tc || '-'}</p>
          </div>
        </div>

        <!-- Contract Details Area -->
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 35px;">
          <div style="background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
             <p style="font-size: 10px; font-weight: 800; color: #475569; margin: 0; text-transform: uppercase;">Sözleşme Özeti ve Mutabakat</p>
          </div>
          <div style="padding: 20px; font-size: 11px; color: #334155; line-height: 1.6;">
            <p style="margin: 0 0 12px 0;">Bu belge, <strong>${doc.title}</strong> kapsamında tarafların hak ve yükümlülüklerini beyan eder. Dijital ortamda onaylanmış olup, aşağıdaki kayıtlar doğrulanmıştır:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
              <tr><td style="padding: 6px 0; font-weight: 700; color: #64748b; width: 140px;">Onaylayan Yetkili:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${user?.fullName}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 700; color: #64748b;">Kimlik / T.C. No:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${user?.tc || '-'}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 700; color: #64748b;">İşlem Tarihi:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${today}</td></tr>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div><p style="font-size: 9px; font-weight: 800; color: #94a3b8; margin: 0; text-transform: uppercase;">SOSTURER DIGITAL SERVICES</p></div>
          <p style="font-size: 10px; font-weight: 800; color: #2563eb; margin: 0;">SAYFA 01 / 01</p>
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `SOZLESME_${doc.title.toUpperCase().replace(/\s/g, '_')}_${today}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 700 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    setTimeout(() => {
      html2pdf().from(template).set(opt).save().then(() => {
        document.body.removeChild(template);
      }).catch((_err: any) => {
        if (template.parentNode) document.body.removeChild(template);
      });
    }, 800);
  };

  if (loadingProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="w-12 h-12 border-4 border-theme-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 w-full min-h-screen space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Header Profile Section */}
      <div className="relative group overflow-hidden bg-theme-card border border-theme rounded-2xl p-3 lg:p-6 backdrop-blur-3xl shadow-lg shadow-theme-main/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-theme-primary/5 blur-[150px] rounded-full -mr-64 -mt-64 transition-all duration-1000 group-hover:bg-theme-primary/10"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-theme-primary/5 blur-[150px] rounded-full -ml-64 -mb-64 transition-all duration-1000 group-hover:bg-theme-primary/10"></div>

        <div className="relative flex flex-col md:flex-row items-center gap-12">
          <div className="relative shrink-0 group/avatar">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-theme-primary p-0.75 shadow-lg shadow-theme-main/10 overflow-hidden relative">
              <div className="w-full h-full rounded-full bg-theme-base flex items-center justify-center text-3xl font-black text-theme-main overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} className="w-full h-full object-cover" alt="User Avatar" />
                ) : (
                  personalData.firstName.substring(0, 1).toUpperCase() + personalData.lastName.substring(0, 1).toUpperCase()
                )}
              </div>
              <label className="absolute inset-0 bg-theme-main/60 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all cursor-pointer rounded-full border-2 border-dashed border-theme-base/30">
                <Camera className="w-6 h-6 text-theme-base mb-1" />
                <span className="text-[8px] text-theme-base font-black tracking-widest">GÜNCELLE</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
              </label>
            </div>
            <div className="absolute bottom-0 right-0 w-[27px] h-[27px] bg-emerald-500 border-[3px] border-theme rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 z-10">
              <CheckCircle2 className="w-[18px] h-[18px] text-theme-base" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-5">
            <div>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mb-3">
                <h1 className="text-2xl lg:text-3xl font-black text-theme-main tracking-tighter drop-shadow-sm">{personalData.firstName} {personalData.lastName}</h1>
                <div className="px-5 py-2 rounded-2xl bg-theme-primary/15 border border-theme-primary/20 text-theme-primary text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-theme-primary/5">
                  {user?.role === 'admin' ? 'YÖNETİCİ' : user?.role === 'superadmin' ? 'SİSTEM YÖNETİCİSİ' : 'PERSONEL'}
                </div>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 text-theme-dim text-sm font-bold">
                <span className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-theme-primary/60" /> {companyData.name} {company?.id && <span className="opacity-100">({company.id})</span>}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-theme-base hidden md:block"></span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-theme-primary/60" /> {companyData.memberSince}'den beri üye
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Personal Information Card */}
          <div className="bg-theme-card border border-theme rounded-2xl p-10 backdrop-blur-xl shadow-sm group/card">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center shadow-sm shadow-theme-primary/5 transition-transform group-hover/card:rotate-6">
                  <UserIcon className="w-7 h-7 text-theme-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-theme-main tracking-tight">Kişisel Bilgiler</h3>
                  <p className="text-theme-muted text-[11px] font-black uppercase tracking-[0.3em]">Bireysel Profil Detayları</p>
                </div>
              </div>

              <button
                onClick={isEditingPersonal ? handlePersonalCancel : handlePersonalEdit}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all font-bold text-xs ${isEditingPersonal ? 'bg-theme-danger/10 border-theme-danger/30 text-theme-danger hover:bg-theme-danger/20' : 'bg-theme-surface/80 border-theme text-theme-main hover:bg-theme-surface-hover hover:text-theme-primary'}`}
              >
                {isEditingPersonal ? <><X size={14} /> Vazgeç</> : <><Edit3 size={14} /> Düzenle</>}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {personalFields.map((field) => (
                <div key={field.key} className={`flex gap-5 group/item ${field.isFullWidth ? 'md:col-span-2' : ''}`}>
                  <div className="w-11 h-11 rounded-xl bg-theme-surface/60 border border-theme flex items-center justify-center shrink-0 group-hover/item:border-theme-primary/30 group-hover/item:bg-theme-primary/5 transition-all">
                    <field.icon className="w-5 h-5 text-theme-dim group-hover/item:text-theme-primary" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">{field.label}</p>
                    {isEditingPersonal ? (
                      field.key === 'address' ? (
                        <textarea value={(personalDraft as any)[field.key]} onChange={(e) => setPersonalDraft(prev => ({ ...prev, [field.key]: e.target.value }))} rows={2} className="w-full bg-theme-form/60 border border-theme rounded-lg px-3 py-2 text-theme-main text-sm focus:outline-none focus:border-theme-primary/50 transition-all resize-none" />
                      ) : field.type === 'select' ? (
                        <CustomSelect value={(personalDraft as any)[field.key]} onChange={(val) => setPersonalDraft(prev => ({ ...prev, [field.key]: val }))} options={(field.options || []).map(opt => ({ id: opt, label: opt }))} searchable={false} />
                      ) : field.type === 'date' ? (
                        <input type="date" value={(personalDraft as any)[field.key]} onChange={(e) => setPersonalDraft(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full bg-theme-form/60 border border-theme rounded-lg px-3 py-1.5 text-theme-main text-sm focus:outline-none focus:border-theme-primary/50 transition-all" />
                      ) : (
                        <input type="text" value={(personalDraft as any)[field.key]} onChange={(e) => setPersonalDraft(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full bg-theme-form/60 border border-theme rounded-lg px-3 py-1.5 text-theme-main text-sm focus:outline-none focus:border-theme-primary/50 transition-all" />
                      )
                    ) : (
                      <p className="text-theme-main font-bold text-base group-hover/item:text-theme-primary break-words">
                        {field.key === 'birthDate' && (personalData as any)[field.key] ? new Date((personalData as any)[field.key]).toLocaleDateString('tr-TR') : (personalData as any)[field.key] || "-"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isEditingPersonal && (
              <div className="mt-10 flex justify-end">
                <button onClick={handlePersonalSave} className="flex items-center gap-2 px-8 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl shadow-lg shadow-theme-primary/20 active:scale-95 transition-all">
                  <Check size={18} /> GÜNCELLEMELERİ KAYDET
                </button>
              </div>
            )}
          </div>

          {/* Corporate Information Card */}
          <div className="bg-theme-card border border-theme rounded-2xl p-10 backdrop-blur-xl shadow-sm group/corp">
            <div className="flex items-start justify-between mb-12">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="relative group/logo">
                  <div className="w-16 h-16 rounded-2xl bg-theme-base border border-theme-primary/20 p-0.25 flex items-center justify-center shadow-2xl transition-all group-hover/corp:scale-105 overflow-hidden">
                    <img src={company?.logoUrl || "/logo.png"} className="w-full h-full rounded-2xl object-contain" alt="Company Logo" />
                    <label className="absolute inset-0 bg-theme-main/60 flex flex-col items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-all cursor-pointer border-2 border-dashed border-theme-primary/50 rounded-2xl">
                      <Camera className="w-4 h-4 text-theme-base mb-1" />
                      <span className="text-[6px] text-theme-base font-black tracking-widest">DEĞİŞTİR</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                    </label>
                  </div>
                </div>
                <div>
                  {isEditingCompany ? (
                    <input type="text" value={companyDraft.name} onChange={(e) => setCompanyDraft(prev => ({ ...prev, name: e.target.value }))} className="text-2xl font-black bg-theme-form/60 border border-theme rounded-lg px-4 py-2 text-theme-main focus:outline-none focus:border-theme-primary/50 w-full max-w-md" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold text-theme-main tracking-tighter">{companyData.name}</h3>
                      {company?.id && <span className="text-2xl font-bold text-theme-main tracking-tighter">({company.id})</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-lg">Şirket Hesabı</span>
                    <span className="px-3 py-1 bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-[9px] font-black uppercase tracking-widest rounded-lg">Uçtan Uca Şifreli</span>
                  </div>
                </div>
              </div>

              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <button
                  onClick={isEditingCompany ? handleCompanyCancel : handleCompanyEdit}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all font-bold text-xs ${isEditingCompany ? 'bg-theme-danger/10 border-theme-danger/30 text-theme-danger hover:bg-theme-danger/20' : 'bg-theme-surface/80 border-theme text-theme-main hover:bg-theme-surface-hover hover:text-theme-primary'}`}
                >
                  {isEditingCompany ? <><X size={14} /> Vazgeç</> : <><Edit3 size={14} /> Düzenle</>}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {companyFields.map((field) => (
                <div key={field.key} className={`flex gap-5 group/item ${field.isFullWidth ? 'md:col-span-2' : ''}`}>
                  <div className="w-11 h-11 rounded-xl bg-theme-surface/60 border border-theme flex items-center justify-center shrink-0 group-hover/item:border-theme-primary/30 group-hover/item:bg-theme-primary/5 transition-all">
                    <field.icon className="w-5 h-5 text-theme-dim group-hover/item:text-theme-primary" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">{field.label}</p>
                    {isEditingCompany ? (
                      field.key === 'address' || field.key === 'sector' ? (
                        <textarea value={(companyDraft as any)[field.key]} onChange={(e) => setCompanyDraft(prev => ({ ...prev, [field.key]: e.target.value }))} rows={2} className="w-full bg-theme-form/60 border border-theme rounded-lg px-3 py-2 text-theme-main text-sm focus:outline-none focus:border-theme-primary/50 transition-all resize-none" />
                      ) : (
                        <input type="text" value={(companyDraft as any)[field.key]} onChange={(e) => setCompanyDraft(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full bg-theme-form/60 border border-theme rounded-lg px-3 py-1.5 text-theme-main text-sm focus:outline-none focus:border-theme-primary/50 transition-all" />
                      )
                    ) : (
                      <p className="text-theme-main font-bold text-base group-hover/item:text-theme-primary break-words">{(companyData as any)[field.key] || "-"}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isEditingCompany && (
              <div className="mt-10 flex justify-end">
                <button onClick={handleCompanySave} className="flex items-center gap-2 px-8 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl shadow-lg shadow-theme-primary/20 active:scale-95 transition-all">
                  <Check size={18} /> GÜNCELLEMELERİ KAYDET
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Legal & Security */}
        <div className="lg:col-span-4 space-y-10">
          {/* Contracts Section */}
          <div className="bg-theme-card border border-theme rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-5 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center">
                <FileLock2 className="w-7 h-7 text-theme-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-theme-main tracking-tight">Belgeler</h3>
                <p className="text-theme-muted text-[10px] font-black uppercase tracking-[0.3em]">Hukuki Dokümantasyon</p>
              </div>
            </div>

            <div className="space-y-4">
              {documents.map((doc, idx) => (
                <div key={idx} onClick={() => handleDownload(doc)} className="group/item bg-theme-surface/60 border border-theme p-5 rounded-2xl hover:bg-theme-surface-hover hover:border-theme-primary/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 overflow-hidden pr-2">
                      <p className="text-[13px] font-bold text-theme-main group-hover/item:text-theme-primary truncate transition-colors">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-theme-muted font-bold uppercase">{doc.date}</span>
                        <span className="w-1 h-1 rounded-full bg-theme-base"></span>
                        <span className="text-[9px] text-theme-primary/70 font-black tracking-widest uppercase">{doc.type}</span>
                      </div>
                    </div>
                    <Download size={16} className="text-theme-dim group-hover/item:text-theme-primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-theme-card border border-theme rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <History className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-theme-main tracking-tight">Güvenlik</h3>
                <p className="text-theme-muted text-[10px] font-black uppercase tracking-[0.3em]">Hesap Erişimi</p>
              </div>
            </div>

            <div className="space-y-4">
              <button className="w-full h-16 flex items-center justify-between p-3 bg-theme-surface/40 border border-theme rounded-2xl hover:bg-theme-primary/5 hover:border-theme-primary/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-theme-base flex items-center justify-center border border-theme group-hover:border-theme-primary/40"><Lock className="w-4 h-4 text-theme-dim group-hover:text-theme-primary" /></div>
                  <span className="font-bold text-theme-muted group-hover:text-theme-main">Parola Güncelle</span>
                </div>
                <ChevronRight className="w-5 h-5 text-theme-dim group-hover:text-theme-primary" />
              </button>

              <button
                onClick={() => { if (confirm('Güvenli çıkış yapmak istediğinizden emin misiniz?')) { logout(); window.location.href = '/login'; } }}
                className="w-full h-16 flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 hover:border-red-500/40 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:border-red-500/40"><LogOut className="w-4 h-4 text-red-500" /></div>
                  <span className="font-bold text-red-400 group-hover:text-red-300">Güvenli Çıkış Yap</span>
                </div>
                <ChevronRight className="w-5 h-5 text-red-700 group-hover:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
