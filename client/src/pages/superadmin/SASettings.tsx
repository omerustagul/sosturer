import { useState } from 'react';
import { Settings, Shield, Bell, Database, Globe, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

type Section = 'general' | 'security' | 'notifications' | 'system';

const SECTIONS = [
  { key: 'general' as Section, label: 'Genel Ayarlar', icon: Settings, color: '#6366F1' },
  { key: 'security' as Section, label: 'Güvenlik', icon: Shield, color: '#10B981' },
  { key: 'notifications' as Section, label: 'Bildirimler', icon: Bell, color: '#F59E0B' },
  { key: 'system' as Section, label: 'Sistem', icon: Database, color: '#EC4899' },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)}
      className="relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 shrink-0"
      style={{ background: value ? '#6366F1' : 'rgba(255,255,255,0.1)' }}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${value ? 'left-6' : 'left-0.5'}`} />
    </div>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div>
        <p className="text-[13px] font-black text-white">{label}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white placeholder:text-slate-600 outline-none transition-all"
        style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
        onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
        onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.15)'; }}
      />
    </div>
  );
}

export default function SASettings() {
  const [activeSection, setActiveSection] = useState<Section>('general');
  const { addNotification } = useNotificationStore();

  // General
  const [appName, setAppName] = useState('Sosturer');
  const [supportEmail, setSupportEmail] = useState('destek@sosturer.com');
  const [maxCompanies, setMaxCompanies] = useState('100');

  // Security
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [requireStrongPwd, setRequireStrongPwd] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);

  // Notifications
  const [newCompanyAlert, setNewCompanyAlert] = useState(true);
  const [newUserAlert, setNewUserAlert] = useState(true);
  const [systemErrorAlert, setSystemErrorAlert] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // System
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [lanAccess, setLanAccess] = useState(true);
  const [errorLogging, setErrorLogging] = useState(true);

  const handleSave = () => {
    addNotification({ type: 'success', title: 'Ayarlar kaydedildi', message: 'Tüm değişiklikler uygulandı.' });
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase">Yapılandırma</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Uygulama Ayarları</h1>
          <p className="text-slate-400 text-sm mt-0.5">Sistem genelindeki yapılandırma ayarları</p>
        </div>
        <button onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[11px] font-black transition-all"
          style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
          <Save size={14} />Kaydet
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Sidebar Nav */}
        <div className="md:w-56 shrink-0 space-y-1.5">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
              style={activeSection === s.key ? {
                background: `${s.color}15`, border: `1px solid ${s.color}30`, color: s.color
              } : {
                color: '#64748B', border: '1px solid transparent'
              }}
              onMouseEnter={e => { if (activeSection !== s.key) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (activeSection !== s.key) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: activeSection === s.key ? `${s.color}20` : 'rgba(255,255,255,0.05)' }}>
                <s.icon size={14} style={{ color: activeSection === s.key ? s.color : '#64748B' }} />
              </div>
              <span className="text-[12px] font-black">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-2xl p-6" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          {activeSection === 'general' && (
            <div className="space-y-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Genel Ayarlar</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Uygulama Adı" value={appName} onChange={setAppName} placeholder="Sosturer" />
                <InputField label="Destek E-postası" value={supportEmail} onChange={setSupportEmail} type="email" />
                <InputField label="Maksimum Şirket Sayısı" value={maxCompanies} onChange={setMaxCompanies} placeholder="100" />
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <SettingRow label="LAN Ağ Erişimi" sub="Diğer cihazların ağ üzerinden uygulamaya bağlanmasına izin ver">
                  <Toggle value={lanAccess} onChange={setLanAccess} />
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Güvenlik Ayarları</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <InputField label="Oturum Zaman Aşımı (dakika)" value={sessionTimeout} onChange={setSessionTimeout} placeholder="60" />
              </div>
              <SettingRow label="Güçlü Şifre Zorunluluğu" sub="En az 8 karakter, büyük harf ve rakam içermeli">
                <Toggle value={requireStrongPwd} onChange={setRequireStrongPwd} />
              </SettingRow>
              <SettingRow label="İki Faktörlü Doğrulama" sub="E-posta veya TOTP ile ek güvenlik katmanı">
                <Toggle value={twoFactorEnabled} onChange={setTwoFactorEnabled} />
              </SettingRow>
              <SettingRow label="Otomatik Çıkış" sub="Hareketsizlik sonrası oturumu sonlandır">
                <Toggle value={autoLogout} onChange={setAutoLogout} />
              </SettingRow>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Bildirim Ayarları</p>
              <SettingRow label="Yeni Şirket Bildirimi" sub="Sisteme yeni şirket eklendiğinde bildirim al">
                <Toggle value={newCompanyAlert} onChange={setNewCompanyAlert} />
              </SettingRow>
              <SettingRow label="Yeni Kullanıcı Bildirimi" sub="Yeni kullanıcı kaydı oluşturulduğunda bildirim al">
                <Toggle value={newUserAlert} onChange={setNewUserAlert} />
              </SettingRow>
              <SettingRow label="Sistem Hata Uyarıları" sub="Kritik sistem hataları için anlık bildirim">
                <Toggle value={systemErrorAlert} onChange={setSystemErrorAlert} />
              </SettingRow>
              <SettingRow label="Haftalık Rapor" sub="Her Pazartesi özet rapor e-postası gönder">
                <Toggle value={weeklyReport} onChange={setWeeklyReport} />
              </SettingRow>
            </div>
          )}

          {activeSection === 'system' && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Sistem Ayarları</p>
              <SettingRow label="Bakım Modu" sub="Sistemi geçici olarak kullanıcılara kapatır">
                <Toggle value={maintenanceMode} onChange={setMaintenanceMode} />
              </SettingRow>
              <SettingRow label="Debug Modu" sub="Gelişmiş hata ayıklama logları yazar">
                <Toggle value={debugMode} onChange={setDebugMode} />
              </SettingRow>
              <SettingRow label="Hata Günlüğü" sub="Sunucu hatalarını logs/ klasöründe sakla">
                <Toggle value={errorLogging} onChange={setErrorLogging} />
              </SettingRow>
              {maintenanceMode && (
                <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-[12px] font-black text-rose-400">⚠️ Bakım modu aktif olduğunda hiçbir kullanıcı sisteme giremez.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-[12px] font-black text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
              <Save size={14} />Değişiklikleri Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
