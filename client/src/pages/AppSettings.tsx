import { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { notify } from '../store/notificationStore';
import {
  Settings, Monitor, Share2, Shield, Bell,
  Database, Save, RefreshCw, Cpu,
  Zap, Lock, Palette, Download,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { CustomSelect } from '../components/common/CustomSelect';

export function AppSettings() {
  useTranslation();
  const {
    settings,
    updateSettings,
    loading,
    isInitialized,
    applyTheme,
    applyDensity,
    applyColorMode,
    applyAnimations,
    applyLanguage
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState('display');
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [locations, setLocations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [locRes, shiftRes] = await Promise.all([
          api.get('/system/company/locations'),
          api.get('/shifts')
        ]);
        setLocations(locRes);
        setShifts(shiftRes.filter((s: any) => s.status === 'active'));
      } catch (error) {
        console.error('Data fetch failed');
      }
    }
    fetchData();
  }, []);

  if (loading && !isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="w-12 h-12 border-4 border-theme-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!settings || !localSettings) {
    return (
      <div className="p-4 lg:p-6 text-center space-y-4">
        <h2 className="text-xl font-black text-theme-main uppercase">AYARLAR YÜKLENEMEDİ</h2>
        <p className="text-theme-muted font-bold">Şirket bilgileriniz ulaşılamıyor. Lütfen çıkış yapıp tekrar girmeyi deneyin.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      notify.success('Ayarlar Kaydedildi', 'Uygulama tercihleri başarıyla güncellendi.');
    } catch (error) {
      notify.error('Hata Oluştu', 'Ayarlar kaydedilirken bir problem yaşandı.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Use the new export endpoint we added
      const response = await api.get('/app-settings/export');

      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sosturer_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notify.success('Yükleme Tamamlandı', 'Şirket verileriniz başarıyla paketlendi ve indirildi.');
    } catch (error) {
      console.error('Export failed:', error);
      notify.error('İndirme Hatası', 'Veriler dışa aktarılırken bir hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  const sections = [
    { id: 'system', label: 'SİSTEM', icon: Cpu, description: 'Temel uygulama ve sunucu ayarları' },
    { id: 'display', label: 'GÖRÜNÜM', icon: Monitor, description: 'Ekran, tema ve tablo tercihleri' },
    { id: 'notifications', label: 'BİLDİRİMLER', icon: Bell, description: 'E-posta ve sistem uyarıları' },
    { id: 'security', label: 'GÜVENLİK', icon: Shield, description: 'Erişim kontrolü ve oturum yönetimi' },
    { id: 'integration', label: 'ENTEGRASYON', icon: Share2, description: 'Harici sistem bağlantıları' },
    { id: 'connections', label: 'BAĞLANTILAR', icon: Share2, description: 'Sistem parametreleri ve eşleşmeler' }
  ];

  return (
    <div className="p-6 lg:p-8 w-full mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-theme">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
              <Settings className="w-6 h-6 text-theme-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-theme-main uppercase">Genel Ayarlar</h2>
              <p className="text-theme-muted text-xs font-medium opacity-70 mt-0.15">Uygulama tercihlerini ve sistem parametrelerini buradan özelleştirin.</p>
            </div>

          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center w-auto h-10 gap-2 p-4 bg-theme-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-theme-primary/20 hover:scale-105 active:scale-95 group"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform mb-0.5" />}
          {isSaving ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left group transition-all duration-300 ${activeSection === s.id ? 'bg-theme-primary/15 border-theme-primary/30 shadow-lg shadow-theme-primary/5'
                : 'hover:bg-theme-surface/40 border-transparent'
                } border px-4 py-2 rounded-2xl relative overflow-hidden`}
            >
              {activeSection === s.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-theme-primary" />
              )}
              <div className="flex items-center gap-3 mb-1">
                <s.icon className={`w-5 h-5 ${activeSection === s.id ? 'text-theme-primary' : 'text-theme-muted group-hover:text-theme-main'}`} />
                <span className={`font-black text-sm ${activeSection === s.id ? 'text-theme-main' : 'text-theme-muted group-hover:text-theme-main'}`}>
                  {s.label}
                </span>
              </div>
              <p className="text-[10px] font-bold text-theme-muted group-hover:text-theme-main truncate">{s.description}</p>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-theme-surface/30 backdrop-blur-xl border border-theme rounded-2xl p-6 shadow-xl shadow-theme-surface/5 space-y-12 min-h-[calc(55vh)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-theme-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-theme-primary/5 rounded-full blur-[100px] -ml-32 -mb-32" />

            {activeSection === 'system' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-3 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Database className="w-5 h-5 text-theme-primary" />
                    </div>
                    Sistem Parametreleri
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <SettingItem label="UYGULAMA DİLİ" description="Tüm modüllerin ve arayüzün varsayılan dili">
                    <CustomSelect
                      options={[
                        { id: 'tr', label: 'Türkçe (TR)' },
                        { id: 'en', label: 'English (EN)' },
                        { id: 'de', label: 'Deutsch (DE)' }
                      ]}
                      value={localSettings.language}
                      onChange={(lang) => {
                        setLocalSettings({ ...localSettings, language: lang });
                        applyLanguage(lang);
                      }}
                      searchable={false}
                    />
                  </SettingItem>

                  <SettingItem label="SAAT DİLİMİ" description="Kayıtlar ve vardiya zamanlamaları için">
                    <CustomSelect
                      options={[
                        { id: 'Europe/Istanbul', label: '(GMT+03:00) ISTANBUL' },
                        { id: 'UTC', label: '(GMT+00:00) UTC' },
                        { id: 'Europe/Berlin', label: '(GMT+01:00) BERLIN' },
                        { id: 'Europe/London', label: '(GMT+00:00) LONDON' }
                      ]}
                      value={localSettings.timezone}
                      onChange={(tz) => setLocalSettings({ ...localSettings, timezone: tz })}
                      searchable={true}
                    />
                  </SettingItem>

                  <SettingItem label="VERİ SAKLAMA SÜRESİ" description="Veritabanı kayıtlarının arşivlenme periyodu">
                    <CustomSelect
                      options={[
                        { id: 24, label: '2 YIL (STANDART PLAN)' },
                        { id: 60, label: '5 YIL (PROFESYONEL)' },
                        { id: 120, label: '10 YIL (TAM ARŞİV)' }
                      ]}
                      value={localSettings.dataRetentionMonths}
                      onChange={(val) => setLocalSettings({ ...localSettings, dataRetentionMonths: parseInt(val) })}
                      searchable={false}
                    />
                  </SettingItem>

                  <SettingItem label="OTOMATİK YEDEKLEME" description="Sistem veritabanının bulut yedekleme sıklığı">
                    <CustomSelect
                      options={[
                        { id: 'daily', label: 'HER GÜN (GECE 03:00)' },
                        { id: 'weekly', label: 'HAFTALIK (PAZARTESİ)' },
                        { id: 'monthly', label: 'AYLIK (AYIN 1. GÜNÜ)' },
                        { id: 'manual', label: 'SADECE MANUEL' }
                      ]}
                      value={localSettings.autoBackup}
                      onChange={(val) => setLocalSettings({ ...localSettings, autoBackup: val })}
                      searchable={false}
                    />
                  </SettingItem>

                  <SettingItem label="VERİ TAŞINABİLİRLİĞİ" description="Tüm şirket verilerini paket olarak dışa aktar">
                    <button
                      onClick={handleExportData}
                      disabled={isExporting}
                      className="flex items-center gap-4 px-6 py-4 bg-theme-success/10 hover:bg-theme-success/20 border border-theme-success/30 text-theme-success font-black rounded-2xl transition-all w-full justify-center disabled:opacity-50 group/export active:scale-[0.98] shadow-lg shadow-theme-success/5"
                    >
                      {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover/export:-translate-y-1 transition-transform" />}
                      <span className="uppercase tracking-widest text-xs">{isExporting ? 'HAZIRLANIYOR...' : 'ŞİRKET VERİLERİNİ İNDİR (JSON)'}</span>
                    </button>
                  </SettingItem>
                </div>
              </div>
            )}

            {activeSection === 'display' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-4 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Palette className="w-5 h-5 text-theme-primary" />
                    </div>
                    Görünüm & Tema Ayarları
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <SettingItem label="ARAYÜZ TEMASI" description="Uygulamanın genel renk paleti ve atmosferi">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: 'dark', color: '#1068ffff', label: 'OKYANUS' },
                        { id: 'blue', color: '#0ea5e9', label: 'MERCAN' },
                        { id: 'emerald', color: '#10b981', label: 'DOĞA' },
                        { id: 'amber', color: '#f59e0b', label: 'ALTIN' }
                      ].map(t => (
                        <ThemeOption
                          key={t.id}
                          color={t.color}
                          label={t.label}
                          active={localSettings.theme === t.id}
                          onClick={() => {
                            setLocalSettings({ ...localSettings, theme: t.id });
                            applyTheme(t.id); // Real-time preview
                          }}
                        />
                      ))}
                    </div>
                  </SettingItem>

                  <SettingItem label="TABLO YOĞUNLUĞU" description="Veri listelerinin ekrandaki yerleşim sıklığı">
                    <div className="flex h-10 bg-theme-base/50 p-1 rounded-xl border border-theme shadow-inner">
                      {[
                        { id: 'large', label: 'GENİŞ' },
                        { id: 'medium', label: 'ORTA' },
                        { id: 'compact', label: 'SIKI' }
                      ].map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setLocalSettings({ ...localSettings, tableDensity: d.id });
                            applyDensity(d.id); // Real-time preview
                          }}
                          className={`flex-1 h-8 p-2 rounded-[8px] text-[10px] font-black tracking-widest transition-all ${localSettings.tableDensity === d.id ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-muted hover:text-theme-main'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </SettingItem>

                  <SettingItem label="ANİMASYONLAR" description="Görsel geçiş efektlerini tamamen kapatın veya açın">
                    <Toggle
                      active={localSettings.animationsEnabled}
                      onClick={() => {
                        const newVal = !localSettings.animationsEnabled;
                        setLocalSettings({ ...localSettings, animationsEnabled: newVal });
                        applyAnimations(newVal); // Real-time preview toggle
                      }}
                      label={localSettings.animationsEnabled ? "AKTİF" : "DEVRE DIŞI"}
                    />
                  </SettingItem>

                  <SettingItem label="RENK MODU" description="Karanlık veya Aydınlık tema tercihi">
                    <Toggle
                      active={localSettings.colorMode === 'dark'}
                      onClick={() => {
                        const newMode = localSettings.colorMode === 'dark' ? 'light' : 'dark';
                        setLocalSettings({ ...localSettings, colorMode: newMode });
                        applyColorMode(newMode);
                      }}
                      label={localSettings.colorMode === 'dark' ? "KOYU" : "AÇIK"}
                    />
                  </SettingItem>

                  <SettingItem label="DASHBOARD WİDGET'LAR" description="Ana panel göstergelerini özelleştirin">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => notify.info('Yapılandırma Modu', 'Dashboard düzenleyici bir sonraki güncellemede aktif olacaktır.')}
                        className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-theme-primary/10 border border-theme-primary/20 text-theme-primary font-black text-xs tracking-widest hover:bg-theme-primary/20 transition-all group/zap"
                      >
                        <Zap className="w-4 h-4 group-hover/zap:scale-125 transition-transform" />
                        MODÜLER PANEL YÖNETİMİ
                      </button>
                    </div>
                  </SettingItem>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-4 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Bell className="w-5 h-5 text-theme-primary" />
                    </div>
                    Bildirim Yapılandırması
                  </h3>
                </div>
                <div className="space-y-10">
                  <SettingItem label="SİSTEM BİLDİRİMLERİ" description="Önemli olaylarda ve rapor hazırlıklarında anlık bildirim al">
                    <Toggle
                      active={localSettings.notificationsEnabled}
                      onClick={() => setLocalSettings({ ...localSettings, notificationsEnabled: !localSettings.notificationsEnabled })}
                      label={localSettings.notificationsEnabled ? "AKTİF SESTE" : "SESSİZ MOD"}
                    />
                  </SettingItem>

                  <div className="space-y-6 pt-6 border-t border-theme">
                    <div>
                      <h4 className="text-sm font-black text-theme-main uppercase tracking-widest flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-theme-primary" />
                        SMTP MAİL SUNUCU AYARLARI
                      </h4>
                      <p className="text-[10px] font-bold text-theme-muted mt-1 opacity-60">Sistemden gönderilecek e-postalar için kendi sunucunuzu kullanın.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SettingItem label="SMTP HOST" description="Örn: smtp.gmail.com">
                        <input
                          type="text"
                          value={localSettings.smtpHost || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, smtpHost: e.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main outline-none focus:ring-2 focus:ring-theme-primary transition-all"
                        />
                      </SettingItem>

                      <SettingItem label="SMTP PORT" description="Standart: 587 veya 465">
                        <input
                          type="number"
                          value={localSettings.smtpPort || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, smtpPort: parseInt(e.target.value) })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main outline-none focus:ring-2 focus:ring-theme-primary transition-all"
                        />
                      </SettingItem>

                      <SettingItem label="SMTP KULLANICI" description="E-posta adresi veya kullanıcı adı">
                        <input
                          type="text"
                          value={localSettings.smtpUser || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, smtpUser: e.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main outline-none focus:ring-2 focus:ring-theme-primary transition-all"
                        />
                      </SettingItem>

                      <SettingItem label="SMTP ŞİFRE" description="Sunucu erişim şifresi">
                        <input
                          type="password"
                          value={localSettings.smtpPass || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, smtpPass: e.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main outline-none focus:ring-2 focus:ring-theme-primary transition-all"
                        />
                      </SettingItem>

                      <SettingItem label="GÖNDEREN E-POSTA" description="Alıcının göreceği 'From' adresi">
                        <input
                          type="text"
                          value={localSettings.smtpFrom || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, smtpFrom: e.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-4 text-xs font-bold text-theme-main outline-none focus:ring-2 focus:ring-theme-primary transition-all"
                        />
                      </SettingItem>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-4 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Lock className="w-5 h-5 text-theme-primary" />
                    </div>
                    Erişim & Güvenlik
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                  <SettingItem label="İKİ FAKTÖRLÜ DOĞRULAMA" description="Hesabınızı ek bir güvenlik katmanı ile koruyun">
                    <Toggle
                      active={localSettings.twoFactorEnabled}
                      onClick={() => setLocalSettings({ ...localSettings, twoFactorEnabled: !localSettings.twoFactorEnabled })}
                      label={localSettings.twoFactorEnabled ? "KORUMALI" : "STANDART"}
                    />
                  </SettingItem>

                  <SettingItem label="STATİK IP KISITLAMASI" description="Sisteme sadece belirli ağ adreslerinden erişilsin">
                    <Toggle
                      active={localSettings.ipRestrictionEnabled}
                      onClick={() => setLocalSettings({ ...localSettings, ipRestrictionEnabled: !localSettings.ipRestrictionEnabled })}
                      label={localSettings.ipRestrictionEnabled ? "FİLTRELEMELİ" : "SERBEST"}
                    />
                  </SettingItem>

                  <SettingItem label="DESTEK ERİŞİM İZNİ" description="Teknik sorunlarda Sosturer ekibine geçici erişim yetkisi ver">
                    <Toggle
                      active={localSettings.allowSupportAccess}
                      onClick={() => setLocalSettings({ ...localSettings, allowSupportAccess: !localSettings.allowSupportAccess })}
                      label={localSettings.allowSupportAccess ? "YETKİLİ" : "KAPALI"}
                    />
                  </SettingItem>
                </div>
                <div className="p-2 bg-theme-primary/10 border border-theme-primary/20 rounded-2xl flex items-center gap-6">
                  <div className="w-12 h-12 bg-theme-primary/20 rounded-2xl flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-theme-primary" />
                  </div>
                  <div className="space-y-0">
                    <h5 className="font-black text-theme-main uppercase text-sm">GÜVENLİK NOTU</h5>
                    <p className="text-xs font-bold text-theme-muted leading-relaxed opacity-70">
                      Sistemimiz 256-bit AES şifreleme ve düzenli sızma testleri ile korunmaktadır. Tüm erişim logları 12 ay boyunca saklanmaktadır.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'integration' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-4 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Share2 className="w-5 h-5 text-theme-primary" />
                    </div>
                    Endüstri Entegrasyonları
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="h-20 p-3 bg-theme-base/40 border border-theme rounded-2xl flex items-center justify-between group hover:border-theme-primary/30 transition-all hover:bg-theme-base/60">
                    <div className="flex items-center gap-3">
                      <div className="w-13 h-13 bg-theme-dim/10 backdrop-blur-xl rounded-xl p-2 flex items-center justify-center shadow-2xl ring-1 ring-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/8f/SAP-Logo.svg" className="w-full h-full object-contain" alt="SAP" />
                      </div>
                      <div>
                        <h6 className="font-black text-theme-main text-[13px] uppercase tracking-tighter">SAP S/4HANA</h6>
                        <p className="text-[11px] text-theme-muted font-black mt-0.5">Lisans Gerekli</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, sapIntegrationEnabled: !localSettings.sapIntegrationEnabled })}
                      className={`text-[10px] font-black py-2 px-4 rounded-[8px] transition-all ${localSettings.sapIntegrationEnabled ? 'bg-rose-500/10 text-rose-500' : 'bg-theme-primary/10 text-theme-primary'} uppercase tracking-widest`}
                    >
                      {localSettings.sapIntegrationEnabled ? 'BAĞLANTIYI KES' : 'BAĞLA'}
                    </button>
                  </div>

                  <div className="h-20 p-3 bg-theme-base/40 border border-theme rounded-2xl flex items-center justify-between group hover:border-theme-primary/30 transition-all hover:bg-theme-base/60">
                    <div className="flex items-center gap-3">
                      <div className="w-13 h-13 bg-theme-dim/10 backdrop-blur-xl rounded-xl p-2 flex items-center justify-center shadow-2xl ring-1 ring-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/8f/SAP-Logo.svg" className="w-full h-full object-contain" alt="SAP" />
                      </div>
                      <div>
                        <h6 className="font-black text-theme-main text-[13px] uppercase tracking-tighter">SAP S/4HANA</h6>
                        <p className="text-[11px] text-theme-muted font-black mt-0.5">Lisans Gerekli</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, sapIntegrationEnabled: !localSettings.sapIntegrationEnabled })}
                      className={`text-[10px] font-black py-2 px-4 rounded-[8px] transition-all ${localSettings.sapIntegrationEnabled ? 'bg-rose-500/10 text-rose-500' : 'bg-theme-primary/10 text-theme-primary'} uppercase tracking-widest`}
                    >
                      {localSettings.sapIntegrationEnabled ? 'BAĞLANTIYI KES' : 'BAĞLA'}
                    </button>
                  </div>

                  <div className="h-20 p-3 bg-theme-base/40 border border-theme rounded-2xl flex items-center justify-between group hover:border-theme-primary/30 transition-all hover:bg-theme-base/60">
                    <div className="flex items-center gap-3">
                      <div className="w-13 h-13 bg-theme-dim/10 backdrop-blur-xl rounded-xl p-2 flex items-center justify-center shadow-2xl ring-1 ring-black/5">
                        <RefreshCw className="w-6 h-6 text-theme-primary" />
                      </div>
                      <div>
                        <h6 className="font-black text-theme-main text-[13px] uppercase tracking-tighter">API WEBHOOKS</h6>
                        <p className={`text-[11px] ${localSettings.webhooksEnabled ? 'text-emerald-500' : 'text-theme-muted'} font-black mt-0.5`}>{localSettings.webhooksEnabled ? 'Aktif' : 'Pasif'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, webhooksEnabled: !localSettings.webhooksEnabled })}
                      className={`text-[10px] font-black py-2 px-4 rounded-[8px] transition-all ${localSettings.webhooksEnabled ? 'bg-rose-500/10 text-rose-500' : 'bg-theme-primary/10 text-theme-primary'} uppercase tracking-widest`}
                    >
                      {localSettings.webhooksEnabled ? 'DURDUR' : 'YAPILANDIR'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'connections' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 relative z-10">
                <div className="flex items-center justify-between border-b border-theme pb-6">
                  <h3 className="text-xl font-bold text-theme-main flex items-center gap-4 uppercase">
                    <div className="p-2 bg-theme-primary/10 rounded-xl border border-theme-primary/20">
                      <Share2 className="w-5 h-5 text-theme-primary" />
                    </div>
                    Bağlantılar ve Parametreler
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <SettingItem
                    label="ÜRETİM TAKVİMİ REFERANS LOKASYONU"
                    description="Eksik üretim kayıtları ve OEE hesaplamaları için hangi lokasyonun (Örn. Merkez Üretim Tesisi) çalışma saatleri referans alınsın?"
                  >
                    <CustomSelect
                      options={[
                        { id: '', label: 'Varsayılan (Tüm Takvim Aktif)' },
                        ...locations.map(l => ({ id: l.id, label: l.name, subLabel: l.type === 'factory' ? 'Fabrika' : 'Depo' }))
                      ]}
                      value={localSettings.referenceLocationId || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, referenceLocationId: val })}
                      searchable={true}
                    />
                  </SettingItem>

                  <SettingItem
                    label="STANDART ÇALIŞMA VARDİYALARI"
                    description="Üretim takvimi içerisinde kayıt girilmesi zorunlu olan vardiyaları seçin. Seçtiğiniz vardiyalardan herhangi birine kayıt girilmesi o gün için yeterli sayılacaktır."
                  >
                    <CustomSelect
                      options={shifts.map(s => ({ id: s.id, label: s.shiftName, subLabel: `${s.startTime}-${s.endTime}` }))}
                      value={(() => {
                        try {
                          return JSON.parse(localSettings.standardShiftIds || '[]');
                        } catch (e) {
                          return [];
                        }
                      })()}
                      onChange={(val) => setLocalSettings({ ...localSettings, standardShiftIds: JSON.stringify(val) })}
                      isMulti={true}
                      searchable={true}
                    />
                  </SettingItem>

                  <SettingItem
                    label="ÜRETİM EMİRLERİNDE DEPO SEÇİMİ ZORUNLU OLSUN MU?"
                    description="Olaylar (Red, Numune vb.) girilirken bir depo seçilmesini zorunlu tutar."
                  >
                    <Toggle
                      active={localSettings.productionEventWarehouseRequired || false}
                      onClick={() => setLocalSettings({ ...localSettings, productionEventWarehouseRequired: !localSettings.productionEventWarehouseRequired })}
                      label={localSettings.productionEventWarehouseRequired ? "ZORUNLU" : "İSTEĞE BAĞLI"}
                    />
                  </SettingItem>
                </div>

                <div className="mt-6 flex items-start gap-4 p-6 bg-theme-primary/5 border border-theme-primary/10 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-theme-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-theme-muted leading-relaxed uppercase tracking-wide">
                    SEÇİLEN LOKASYONUN ÇALIŞMA SAATLERİ (PAZARTESİ-PAZAR) SİSTEMİN GENELİNDE AKTİF İŞ GÜNLERİNİ BELİRLEMEK İÇİN KULLANILACAK VE ANALİZ RAPORLARINA BU ŞEKİLDE YANSIYACAKTIR.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function SettingItem({ label, description, children }: { label: string, description: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4 group">
      <div>
        <h5 className="text-[13px] font-black text-theme-main group-hover:text-theme-primary transition-colors flex items-center gap-2">
          {label}
        </h5>
        <p className="text-[10px] font-bold text-theme-muted mt-0 opacity-60 leading-relaxed">{description}</p>
      </div>
      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}

function ThemeOption({ color, label, active = false, onClick }: { color: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${active ? 'bg-theme-primary/10 border-theme-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]' : 'bg-theme-base/30 border-theme hover:border-theme-primary/40'
        }`}
    >
      <div className={`w-12 h-12 aspect-square rounded-full border border-white/10 shadow-lg`} style={{ backgroundColor: color }} />
      <span className={`text-[9px] font-black tracking-widest ${active ? 'text-theme-primary' : 'text-theme-muted'}`}>{label}</span>
      {active && (
        <div className="absolute -top-1.5 -right-1.5 bg-theme-primary text-white p-1 rounded-full shadow-lg">
          <CheckCircle2 className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

function Toggle({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <div className="flex items-center gap-5">
      <button
        onClick={onClick}
        className={`w-16 h-8 rounded-full relative transition-all duration-500 ease-out px-1 ${active ? 'bg-theme-primary shadow-lg shadow-theme-primary/20' : 'bg-theme-muted/10 border border-theme'}`}
      >
        <div className={`w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl flex items-center justify-center ${active ? 'translate-x-8' : 'translate-x-0'}`}>
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-theme-primary' : 'bg-theme-muted opacity-40'}`} />
        </div>
      </button>
      <span className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

export default AppSettings;
