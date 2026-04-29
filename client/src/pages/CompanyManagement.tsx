import { useState, useEffect, useMemo } from 'react';
import {
  Building2, MapPin,
  Save, RefreshCw,
  Plus, Trash2,
  Factory, Store, Warehouse, Building,
  Settings2,
  CheckCircle2, Camera, ExternalLink,
  Map as MapIcon, ClipboardList,
  Globe, Phone, Mail, CreditCard, Pencil,
  Hash, FileText, AtSign, Landmark, MapPinned,
  User as UserIcon, X, LayoutGrid, List, History as HistoryIcon,
  Layers, Zap, Clock,
  ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { CustomSelect } from '../components/common/CustomSelect';
import { SortableTableProvider, SortableRow } from '../components/common/SortableTable';
import { BulkActionBar } from '../components/common/BulkActionBar';
import { Tooltip } from '../components/common/Tooltip';

import { useAuthStore } from '../store/authStore';
import { Loading } from '../components/common/Loading';
import { useNotificationStore } from '../store/notificationStore';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface Unit {
  id: string;
  name: string;
  status: string;
  compact?: boolean;
  locationId?: string | null;
  code?: string | null;
  openingDate?: string | null;
  notes?: string | null;
  headcountPlanned?: number | null;
}

/** API: prisma `locations` model (snake_case fields) */
interface LocationNode {
  id: string;
  name: string;
  type: string;
  address?: string | null;
  location_code?: string | null;
  operational_status?: string | null;
  opening_date?: string | null;
  closure_date?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  floor_area_sqm?: number | null;
  phone?: string | null;
  email?: string | null;
  working_hours?: WorkingHours | null;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, start: '08:00', end: '17:00' },
  tuesday: { enabled: true, start: '08:00', end: '17:00' },
  wednesday: { enabled: true, start: '08:00', end: '17:00' },
  thursday: { enabled: true, start: '08:00', end: '17:00' },
  friday: { enabled: true, start: '08:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
};

const DAY_LABELS: { key: keyof WorkingHours; label: string; short: string }[] = [
  { key: 'monday', label: 'Pazartesi', short: 'Pzt' },
  { key: 'tuesday', label: 'Salı', short: 'Sal' },
  { key: 'wednesday', label: 'Çarşamba', short: 'Çar' },
  { key: 'thursday', label: 'Perşembe', short: 'Per' },
  { key: 'friday', label: 'Cuma', short: 'Cum' },
  { key: 'saturday', label: 'Cumartesi', short: 'Cts' },
  { key: 'sunday', label: 'Pazar', short: 'Paz' },
];

const UNIT_TYPES = [
  { id: 'factory', label: 'ÜRETİM TESİSİ', icon: Factory, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { id: 'warehouse', label: 'DEPO / LOJİSTİK', icon: Warehouse, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'office', label: 'MERKEZ OFİS', icon: Building, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'store', label: 'SHOWROOM / MAĞAZA', icon: Store, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const OPERATIONAL_STATUS = [
  { id: 'active', label: 'Aktif' },
  { id: 'passive', label: 'Pasif / Kapalı' },
  { id: 'temporarily_closed', label: 'Geçici Kapalı' },
  { id: 'planned', label: 'Planlanan / Yapım' },
  { id: 'maintenance', label: 'Bakım Modu' },
];

function operationalStatusLabel(id?: string | null) {
  if (!id) return '—';
  return OPERATIONAL_STATUS.find((o) => o.id === id)?.label ?? id;
}

function dateInputValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

export function CompanyManagement() {
  const { company } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'units' | 'subscription' | 'schedule'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    fetchCompanyData();
    fetchUnits();
    fetchLocations();
  }, [company?.id]);

  const fetchCompanyData = async () => {
    if (!company?.id) return;
    try {
      const data = await api.get(`/system/companies/${company.id}`);
      setCompanyData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnits = async () => {
    try {
      const data = await api.get('/system/company/units');
      setUnits(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await api.get('/system/company/locations');
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.put(`/system/companies/${company?.id}`, companyData);
      setIsEditing(false);
      addNotification({ type: 'success', title: 'Başarılı', message: 'Şirket profil bilgileri güncellendi.' });
    } catch (err) {
      addNotification({ type: 'error', title: 'Hata', message: 'Güncelleme yapılamadı.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUnit = async () => {
    try {
      const newUnit = await api.post('/system/company/units', {
        name: 'Yeni Birim',
        locationId: null
      });
      setUnits([...units, newUnit]);
      addNotification({ type: 'success', title: 'Birim Eklendi', message: 'Düzenlemek için ayarlar simgesine tıklayın.' });
    } catch (err) {
      console.error(err);
    }
  };

  if (!companyData) return <Loading size="lg" fullScreen />;

  return (
    <div className="min-h-screen bg-theme-base">
      <header className="bg-theme-surface/30 border-b border-theme/50">
        <div className="mx-auto px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-[1.02]">
                  <img src={companyData.logo_url || "/logo.png"} className="w-full h-full object-contain" alt="Logo" />
                  <div className="absolute inset-0 bg-black/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-theme-main">
                    {companyData.name}
                  </h1>
                  <div className="flex items-center justify-center h-6 px-2 py-1 bg-theme-primary/10 border border-theme-primary/20 rounded-lg">
                    <span className="text-[10px] font-black text-theme-primary tracking-widest">Bussines ID: {companyData.id}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 group cursor-pointer">
                    <Phone className="w-4 h-4 text-theme-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs font-bold text-theme-muted group-hover:text-theme-main transition-colors">{companyData.companyPhone || 'Telefon Eklenmedi'}</span>
                  </div>
                  <div className="w-1 h-1 bg-black/10 rounded-full" />
                  <div className="flex items-center gap-2 group cursor-pointer">
                    <Mail className="w-4 h-4 text-theme-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span className="text-xs font-bold text-theme-muted group-hover:text-theme-main transition-colors">{companyData.companyEmail || 'E-Posta Eklenmedi'}</span>
                  </div>
                  <div className="w-1 h-1 bg-black/10 rounded-full" />
                  <div className="flex items-center gap-2 p-0 bg-transparent rounded-full text-theme-muted">
                    <MapPin className="w-3.5 h-3.5 text-theme-primary" />
                    <span className="text-xs font-bold">{companyData.companyAddress || 'Adres bilgisi eksik'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-6">
              <div className="modern-pill-tabs">
                <button onClick={() => setActiveTab('profile')} className={cn("modern-pill-tab-btn", activeTab === 'profile' && "active")}>
                  <UserIcon className="w-4 h-4" />
                  PROFİL
                </button>
                <button onClick={() => setActiveTab('units')} className={cn("modern-pill-tab-btn", activeTab === 'units' && "active")}>
                  <MapIcon className="w-4 h-4" />
                  BİRİMLER
                </button>
                <button onClick={() => setActiveTab('subscription')} className={cn("modern-pill-tab-btn", activeTab === 'subscription' && "active")}>
                  <CreditCard className="w-4 h-4" />
                  ABONELİK
                </button>
                <button onClick={() => setActiveTab('schedule')} className={cn("modern-pill-tab-btn", activeTab === 'schedule' && "active")}>
                  <CalendarDays className="w-4 h-4" />
                  TAKVİM
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto p-6 lg:p-8">
        {activeTab === 'profile' && <NextGenProfile data={companyData} setData={setCompanyData} isEditing={isEditing} setIsEditing={setIsEditing} isSaving={isSaving} onSave={handleSaveProfile} />}
        {activeTab === 'units' && <NextGenUnits units={units} locations={locations} onAdd={handleAddUnit} onDelete={fetchUnits} onUpdate={setUnits} onRefreshLocations={fetchLocations} />}
        {activeTab === 'subscription' && <NextGenSubscription data={companyData} />}
        {activeTab === 'schedule' && <NextGenSchedule />}
      </main>
    </div>
  );
}

function NextGenSubscription({ data: _data }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
      <div className="lg:col-span-8 space-y-8">
        <div className="modern-glass-card bg-gradient-to-br from-indigo-500/5 to-theme-primary/10 border-theme-primary/20">
          <div className="flex items-center gap-6 mb-12">
            <div className="w-14 h-14 bg-theme-primary/10 rounded-2xl flex items-center justify-center border border-theme-primary/20 shadow-xl">
              <CreditCard className="w-7 h-7 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-theme-main uppercase">Lisans & Abonelik</h3>
              <p className="text-theme-muted text-[11px] font-bold uppercase tracking-widest mt-1">Kurumsal hizmet ve paket detaylarınız</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-theme-base/40 border border-theme-border/20 backdrop-blur-md">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-1">AKTİF PLAN</p>
                  <h4 className="text-xl font-black text-theme-primary uppercase">KURUMSAL PLATINUM</h4>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 text-[9px] font-black tracking-widest">
                  AKTİF
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-theme/5">
                  <span className="text-[11px] font-bold text-theme-muted uppercase">Yıllık Ödeme</span>
                  <span className="text-sm font-black text-theme-main">₺45.000 / Yıl</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-theme/5">
                  <span className="text-[11px] font-bold text-theme-muted uppercase">Sonraki Ödeme</span>
                  <span className="text-sm font-black text-theme-main">12 NİSAN 2026</span>
                </div>
              </div>

              <button className="w-full mt-8 py-3.5 bg-theme-primary text-white text-[10px] font-black tracking-widest rounded-xl shadow-lg shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase">
                PLANI YÜKSELT VEYA YÖNET
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-theme-base/40 border border-theme-border/20 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <HistoryIcon className="w-4 h-4 text-theme-primary" />
                <h5 className="text-[10px] font-black text-theme-muted uppercase tracking-widest">SON FATURA</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-theme-base/30 rounded-xl border border-theme">
                  <div className="flex items-center gap-4">
                    <FileText className="w-4 h-4 text-theme-dim" />
                    <div>
                      <p className="text-[10px] font-black text-theme-main">MART 2026</p>
                      <p className="text-[9px] text-theme-muted font-bold">ÖDENDİ</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-theme-primary/10 rounded-lg text-theme-primary transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
                <button className="text-[10px] font-black text-theme-primary uppercase hover:underline">Tüm Faturaları Görüntüle</button>
              </div>
            </div>
          </div>
        </div>

        <div className="modern-glass-card">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-theme-primary" />
            </div>
            <h4 className="text-sm font-black text-theme-main uppercase tracking-tight">KULLANIM LİMİTLERİ</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <UsageCard label="KULLANICI KOTASI" current={14} max={50} unit="Kişi" />
            <UsageCard label="BİRİMLER / LOKASYON" current={4} max={10} unit="Birim" />
            <UsageCard label="BULUT DEPOLAMA" current={245} max={500} unit="GB" />
            <UsageCard label="API ERİŞİMİ" current={8500} max={10000} unit="İstek / Gün" />
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="modern-glass-card p-4 border-theme-primary/20 bg-theme-primary/5">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-theme-primary/20 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-theme-primary" />
            </div>
            <h4 className="text-sm font-black text-theme-main uppercase tracking-tight">HIZLI DESTEK</h4>
          </div>
          <p className="text-xs font-bold text-theme-muted leading-relaxed mb-6 uppercase">
            Aboneliğinizle ilgili teknik destek veya finansal sorularınız için doğrudan müşteri temsilcinize ulaşabilirsiniz.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-theme-base/40 rounded-xl border border-theme">
              <div className="w-8 h-8 rounded-lg bg-theme-surface flex items-center justify-center"><UserIcon className="w-4 h-4 text-theme-dim" /></div>
              <div>
                <p className="text-[10px] font-black text-theme-main italic uppercase">Can Atakan</p>
                <p className="text-[8px] text-theme-muted font-bold uppercase">Hesap Yöneticisi</p>
              </div>
            </div>
            <button className="w-full py-3 bg-theme-base border border-theme-primary text-theme-primary text-[10px] font-black tracking-widest rounded-xl hover:bg-theme-primary hover:text-white transition-all uppercase">DESTEK TALEBİ AÇ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageCard({ label, current, max, unit }: any) {
  const percentage = (current / max) * 100;
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-lg font-black text-theme-main italic uppercase tabular-nums">
            {current} <span className="text-[10px] font-bold text-theme-muted lowercase tracking-normal">{unit}</span>
          </p>
        </div>
        <span className="text-[10px] font-black text-theme-dim uppercase">{max} {unit} Limit</span>
      </div>
      <div className="w-full h-2 bg-theme-muted/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(var(--theme-primary-rgb),0.3)]",
            percentage > 90 ? "bg-rose-500" : percentage > 70 ? "bg-amber-500" : "bg-theme-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function NextGenProfile({ data, setData, isEditing, setIsEditing, isSaving, onSave }: any) {
  return (
    <div className="animate-in fade-in duration-700">
      <div className="space-y-8">
        <div className="modern-glass-card">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-theme-primary" />
            </div>
            <h4 className="text-base font-black text-theme-main uppercase">RESMİ BİLGİLER</h4>
            {isEditing ? (
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center h-9 gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">DÜZENLEME MODU</span>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-theme-surface/50 border border-theme hover:bg-theme-base transition-all text-theme-muted hover:text-rose-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="ml-auto flex items-center gap-3 px-6 h-10 bg-theme-primary/10 border border-theme-primary/20 hover:bg-theme-primary hover:text-white transition-all rounded-xl text-[11px] font-black tracking-widest uppercase text-theme-primary group/edit shadow-lg active:scale-95"
              >
                <Pencil className="w-4 h-4 group-hover/edit:rotate-12 transition-transform" />
                DÜZENLE
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-6">
            <Item label="ŞİRKET KİMLİK (ID)" icon={Hash} editing={isEditing}>
              <input value={data.id} readOnly className="next-gen-input text-md font-bold next-gen-input-readonly opacity-60" />
            </Item>
            <Item label="Şirket Tam Ünvanı" icon={Building2} span={2} editing={isEditing}>
              <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} disabled={!isEditing} className={cn("next-gen-input text-md font-bold", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="Vergi Dairesi" icon={Landmark} editing={isEditing}>
              <input value={data.taxOffice} onChange={e => setData({ ...data, taxOffice: e.target.value })} disabled={!isEditing} className={cn("next-gen-input", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="Vergi Kimlik No" icon={Hash} editing={isEditing}>
              <input value={data.taxNumber} onChange={e => setData({ ...data, taxNumber: e.target.value })} disabled={!isEditing} className={cn("next-gen-input tracking-widest font-bold", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="İnternet Adresi" icon={Globe} editing={isEditing}>
              <input value={data.website} onChange={e => setData({ ...data, website: e.target.value })} disabled={!isEditing} className={cn("next-gen-input", !isEditing && "next-gen-input-readonly")} placeholder="https://..." />
            </Item>
            <Item label="Kurumsal E-Posta" icon={AtSign} editing={isEditing}>
              <input value={data.companyEmail} onChange={e => setData({ ...data, companyEmail: e.target.value })} disabled={!isEditing} className={cn("next-gen-input", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="Şirket Telefonu" icon={Phone} editing={isEditing}>
              <input value={data.companyPhone} onChange={e => setData({ ...data, companyPhone: e.target.value })} disabled={!isEditing} className={cn("next-gen-input", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="Sicil No" icon={FileText} editing={isEditing}>
              <input value={data.sicilNo} onChange={e => setData({ ...data, sicilNo: e.target.value })} disabled={!isEditing} className={cn("next-gen-input", !isEditing && "next-gen-input-readonly")} />
            </Item>
            <Item label="Tebligat Adresi" icon={MapPinned} span={2} editing={isEditing}>
              <textarea value={data.companyAddress} onChange={e => setData({ ...data, companyAddress: e.target.value })} disabled={!isEditing} rows={3} className={cn("next-gen-input h-auto resize-none py-5 font-bold", !isEditing && "next-gen-input-readonly")} />
            </Item>
          </div>

          {isEditing && (
            <div className="flex justify-end mt-3 pt-2 border-t border-theme-border/30">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center h-10 gap-3 px-4 py-2 bg-theme-success text-white rounded-xl font-black text-xs shadow-xl shadow-theme-success/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                DEĞİŞİKLİKLERİ KAYDET
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Working Hours Editor ───────────────────────────────────────────────
function WorkingHoursEditor({ value, onChange }: { value: WorkingHours; onChange: (wh: WorkingHours) => void }) {
  const update = (day: keyof WorkingHours, field: keyof DaySchedule, val: any) => {
    onChange({ ...value, [day]: { ...value[day], [field]: val } });
  };

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-black text-theme-dim uppercase tracking-widest mb-2 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-theme-primary" />
        ÇALIŞMA SAATLERİ
      </div>
      <div className="space-y-1.5">
        {DAY_LABELS.map(({ key, label, short }) => {
          const day = value[key];
          return (
            <div key={key} className={cn(
              "flex items-center gap-2 p-2 rounded-lg border transition-all",
              day.enabled
                ? "bg-theme-primary/5 border-theme-primary/20"
                : "bg-theme-base/30 border-theme/30 opacity-60"
            )}>
              <button
                type="button"
                onClick={() => update(key, 'enabled', !day.enabled)}
                className={cn(
                  "w-8 h-5 rounded-full transition-all duration-300 relative shrink-0",
                  day.enabled ? "bg-theme-primary" : "bg-theme-muted/30"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300",
                  day.enabled ? "left-3.5" : "left-0.5"
                )} />
              </button>
              <Tooltip content={label} position="right">
                <span className={cn(
                  "text-[10px] font-black w-10 shrink-0 cursor-help",
                  day.enabled ? "text-theme-primary" : "text-theme-dim"
                )}>
                  {short}
                </span>
              </Tooltip>
              {day.enabled ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="time"
                    value={day.start}
                    onChange={e => update(key, 'start', e.target.value)}
                    className="flex-1 bg-theme-base border border-theme rounded-lg px-2 py-1 text-[11px] font-bold text-theme-main focus:outline-none focus:border-theme-primary/50 min-w-0"
                  />
                  <span className="text-[10px] text-theme-dim font-bold shrink-0">–</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={e => update(key, 'end', e.target.value)}
                    className="flex-1 bg-theme-base border border-theme rounded-lg px-2 py-1 text-[11px] font-bold text-theme-main focus:outline-none focus:border-theme-primary/50 min-w-0"
                  />
                </div>
              ) : (
                <span className="text-[10px] font-bold text-theme-dim italic flex-1">Kapalı</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextGenUnits({ units, locations, onAdd, onDelete, onUpdate, onRefreshLocations }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState('');
  const [editingLocationType, setEditingLocationType] = useState('factory');
  const [editingLocationAddress, setEditingLocationAddress] = useState('');
  const [editingLocationCode, setEditingLocationCode] = useState('');
  const [editingOperationalStatus, setEditingOperationalStatus] = useState('active');
  const [editingOpeningDate, setEditingOpeningDate] = useState('');
  const [editingClosureDate, setEditingClosureDate] = useState('');
  const [editingContactName, setEditingContactName] = useState('');
  const [editingLocationNotes, setEditingLocationNotes] = useState('');
  const [editingFloorArea, setEditingFloorArea] = useState('');
  const [editingLocationPhone, setEditingLocationPhone] = useState('');
  const [editingLocationEmail, setEditingLocationEmail] = useState('');
  const [editingWorkingHours, setEditingWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationType, setNewLocationType] = useState('factory');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationCode, setNewLocationCode] = useState('');
  const [newOperationalStatus, setNewOperationalStatus] = useState('active');
  const [newOpeningDate, setNewOpeningDate] = useState('');
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newLocationNotes, setNewLocationNotes] = useState('');
  const [newFloorArea, setNewFloorArea] = useState('');
  const [newLocationPhone, setNewLocationPhone] = useState('');
  const [newLocationEmail, setNewLocationEmail] = useState('');
  const [newWorkingHours, setNewWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [showNewWorkingHours, setShowNewWorkingHours] = useState(false);
  const { addNotification } = useNotificationStore();

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, any>>({});

  const paginatedUnits = useMemo(() => {
    return units.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [units, currentPage, pageSize]);

  const pageCount = Math.ceil(units.length / pageSize);
  const isAllPageSelected = paginatedUnits.length > 0 && paginatedUnits.every((u: any) => selectedIds.has(u.id));
  const locationOptions = useMemo(
    () => [{ id: '__none__', label: 'Lokasyon Seçin' }, ...(locations || []).map((l: any) => ({ id: l.id, label: l.name, subLabel: l.type }))],
    [locations]
  );

  const resetLocationEditState = () => {
    setEditingLocationId(null);
    setEditingLocationName('');
    setEditingLocationType('factory');
    setEditingLocationAddress('');
    setEditingLocationCode('');
    setEditingOperationalStatus('active');
    setEditingOpeningDate('');
    setEditingClosureDate('');
    setEditingContactName('');
    setEditingLocationNotes('');
    setEditingFloorArea('');
    setEditingLocationPhone('');
    setEditingLocationEmail('');
    setEditingWorkingHours(DEFAULT_WORKING_HOURS);
  };

  const handleUpdateUnit = async (unit: any) => {
    try {
      await api.put(`/system/company/units/${unit.id}`, {
        name: unit.name,
        code: unit.code ?? null,
        status: unit.status || 'active',
        locationId: unit.locationId ?? null,
        openingDate: unit.openingDate || null,
        notes: unit.notes ?? null,
        headcountPlanned: unit.headcountPlanned != null && unit.headcountPlanned !== '' ? Number(unit.headcountPlanned) : null
      });
      setEditingId(null);
      onDelete();
      addNotification({ type: 'success', title: 'Güncellendi', message: 'Birim bilgileri sisteme işlendi.' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLocation = async () => {
    try {
      if (!newLocationName.trim()) return;
      await api.post('/system/company/locations', {
        name: newLocationName.trim(),
        type: newLocationType,
        address: newLocationAddress.trim(),
        location_code: newLocationCode.trim() || null,
        operational_status: newOperationalStatus,
        opening_date: newOpeningDate || null,
        closure_date: newClosureDate || null,
        contact_name: newContactName.trim() || null,
        notes: newLocationNotes.trim() || null,
        floor_area_sqm: newFloorArea.trim() !== '' ? Number(newFloorArea) : null,
        phone: newLocationPhone.trim() || null,
        email: newLocationEmail.trim() || null,
        working_hours: newWorkingHours
      });
      setNewLocationName('');
      setNewLocationType('factory');
      setNewLocationAddress('');
      setNewLocationCode('');
      setNewOperationalStatus('active');
      setNewOpeningDate('');
      setNewClosureDate('');
      setNewContactName('');
      setNewLocationNotes('');
      setNewFloorArea('');
      setNewLocationPhone('');
      setNewLocationEmail('');
      setNewWorkingHours(DEFAULT_WORKING_HOURS);
      setShowNewWorkingHours(false);
      onRefreshLocations();
      addNotification({ type: 'success', title: 'Lokasyon Eklendi', message: 'Yeni lokasyon oluşturuldu.' });
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', title: 'Hata', message: 'Lokasyon eklenemedi.' });
    }
  };

  const handleUpdateLocation = async (location: any) => {
    try {
      await api.put(`/system/company/locations/${location.id}`, {
        name: editingLocationName || location.name,
        type: editingLocationType || location.type,
        address: editingLocationAddress,
        location_code: editingLocationCode.trim() || null,
        operational_status: editingOperationalStatus,
        opening_date: editingOpeningDate || null,
        closure_date: editingClosureDate || null,
        contact_name: editingContactName.trim() || null,
        notes: editingLocationNotes.trim() || null,
        floor_area_sqm: editingFloorArea.trim() !== '' ? Number(editingFloorArea) : null,
        phone: editingLocationPhone.trim() || null,
        email: editingLocationEmail.trim() || null,
        working_hours: editingWorkingHours
      });
      resetLocationEditState();
      onRefreshLocations();
      addNotification({ type: 'success', title: 'Lokasyon Güncellendi', message: 'Lokasyon bilgileri kaydedildi.' });
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', title: 'Hata', message: 'Lokasyon güncellenemedi.' });
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!window.confirm('Bu lokasyonu silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/system/company/locations/${locationId}`);
      onRefreshLocations();
      addNotification({ type: 'info', title: 'Lokasyon Silindi', message: 'Lokasyon başarıyla kaldırıldı.' });
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', title: 'Hata', message: 'Lokasyon silinemedi.' });
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!window.confirm('Bu birimi silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/system/company/units/${id}`);
      onDelete();
      addNotification({ type: 'info', title: 'Silindi', message: 'Birim başarıyla kaldırıldı.' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkSave = async () => {
    try {
      const selectedRows = units.filter((u: any) => selectedIds.has(u.id));
      await Promise.all(
        selectedRows.map((u: any) => {
          const ch = localChanges[u.id] || {};
          const locId = ch.locationId !== undefined ? ch.locationId : u.locationId;
          return api.put(`/system/company/units/${u.id}`, {
            name: ch.name ?? u.name,
            code: ch.code !== undefined ? ch.code : u.code,
            status: ch.status ?? u.status,
            locationId: locId,
            openingDate: ch.openingDate !== undefined ? ch.openingDate : u.openingDate,
            notes: ch.notes !== undefined ? ch.notes : u.notes,
            headcountPlanned:
              ch.headcountPlanned !== undefined
                ? ch.headcountPlanned === '' || ch.headcountPlanned === null
                  ? null
                  : Number(ch.headcountPlanned)
                : u.headcountPlanned
          });
        })
      );
      setIsBulkEditing(false);
      setSelectedIds(new Set());
      setLocalChanges({});
      onDelete();
      addNotification({ type: 'success', title: 'Kaydedildi', message: 'Seçilen birimler güncellendi.' });
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', title: 'Hata', message: 'Toplu güncelleme başarısız.' });
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} birimi silmek istediğinize emin misiniz?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.delete(`/system/company/units/${id}`)));
      setSelectedIds(new Set());
      setIsBulkEditing(false);
      setLocalChanges({});
      onDelete();
      addNotification({ type: 'info', title: 'Silindi', message: 'Seçilen birimler kaldırıldı.' });
    } catch (err) {
      console.error(err);
      addNotification({ type: 'error', title: 'Hata', message: 'Toplu silme başarısız.' });
    }
  };

  const handleReorder = async (newItems: any[]) => {
    onUpdate(newItems);
    try {
      await api.post('/system/company/units/reorder', {
        orders: newItems.map((item, index) => ({ id: item.id, displayOrder: index }))
      });
      addNotification({ type: 'success', title: 'Başarılı', message: 'Sıralama güncellendi.' });
    } catch (err) {
      console.error(err);
      onDelete();
    }
  };

  const toggleRowSelection = (unitId: string) => {
    const next = new Set(selectedIds);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setSelectedIds(next);
  };

  // Parse working hours helper
  const parseWorkingHours = (loc: LocationNode): WorkingHours => {
    if (!loc.working_hours) return DEFAULT_WORKING_HOURS;
    if (typeof loc.working_hours === 'object') return loc.working_hours as WorkingHours;
    try { return JSON.parse(loc.working_hours as any); } catch { return DEFAULT_WORKING_HOURS; }
  };

  // Compute summary for a working hours schedule
  const computeWorkingHoursSummary = (wh: WorkingHours) => {
    const activeDays = DAY_LABELS.filter(d => wh[d.key]?.enabled);
    if (activeDays.length === 0) return 'Kapalı';
    if (activeDays.length === 7) {
      const first = wh[activeDays[0].key];
      return `Her gün ${first.start}–${first.end}`;
    }
    return `${activeDays.map(d => d.short).join(', ')} · ${wh[activeDays[0].key]?.start}–${wh[activeDays[0].key]?.end}`;
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* ─── Locations Section ─── */}
      <div className="modern-glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">Lokasyonlar</h3>
          <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">{locations.length} Lokasyon</span>
        </div>
        <div className="space-y-3">
          {/* Add form */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="Lokasyon adı (örn. Üretim Fabrikası)"
            />
            <CustomSelect
              value={newLocationType}
              onChange={setNewLocationType}
              options={UNIT_TYPES.map((t) => ({ id: t.id, label: t.label }))}
              searchable={false}
            />
            <input
              value={newLocationCode}
              onChange={(e) => setNewLocationCode(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="Lokasyon kodu (örn. TR-IZM-01)"
            />
            <CustomSelect
              value={newOperationalStatus}
              onChange={setNewOperationalStatus}
              options={OPERATIONAL_STATUS.map((o) => ({ id: o.id, label: o.label }))}
              searchable={false}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={newLocationAddress}
              onChange={(e) => setNewLocationAddress(e.target.value)}
              className="next-gen-input text-xs font-bold md:col-span-2"
              placeholder="Açık adres"
            />
            <input
              type="date"
              value={newOpeningDate}
              onChange={(e) => setNewOpeningDate(e.target.value)}
              className="next-gen-input text-xs font-bold"
            />
            <input
              type="date"
              value={newClosureDate}
              onChange={(e) => setNewClosureDate(e.target.value)}
              className="next-gen-input text-xs font-bold"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="Saha / tesis sorumlusu"
            />
            <input
              value={newFloorArea}
              onChange={(e) => setNewFloorArea(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="Kapalı alan (m²)"
              inputMode="decimal"
            />
            <input
              value={newLocationPhone}
              onChange={(e) => setNewLocationPhone(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="Telefon"
            />
            <input
              type="email"
              value={newLocationEmail}
              onChange={(e) => setNewLocationEmail(e.target.value)}
              className="next-gen-input text-xs font-bold"
              placeholder="E-posta"
            />
          </div>
          <textarea
            value={newLocationNotes}
            onChange={(e) => setNewLocationNotes(e.target.value)}
            className="next-gen-input text-xs font-bold min-h-[56px] resize-y w-full"
            placeholder="Notlar (ERP senkron, ISO bölge kodu, vb.)"
          />
          {/* Working hours toggle for new location */}
          <button
            type="button"
            onClick={() => setShowNewWorkingHours(p => !p)}
            className="flex items-center gap-2 text-[10px] font-black text-theme-primary hover:underline uppercase tracking-widest"
          >
            <Clock className="w-3.5 h-3.5" />
            {showNewWorkingHours ? 'Çalışma Saatlerini Gizle' : 'Çalışma Saatlerini Tanımla'}
          </button>
          {showNewWorkingHours && (
            <div className="p-4 bg-theme-base/40 rounded-xl border border-theme">
              <WorkingHoursEditor value={newWorkingHours} onChange={setNewWorkingHours} />
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleAddLocation} className="h-10 px-6 bg-theme-primary text-white rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg">+ LOKASYON EKLE</button>
          </div>
        </div>

        {/* Location cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(locations || []).map((loc: any) => {
            const wh = parseWorkingHours(loc);
            return (
              <div key={loc.id} className="p-3 rounded-xl border border-theme bg-theme-base/20 space-y-2">
                {editingLocationId === loc.id ? (
                  <>
                    <input
                      value={editingLocationName}
                      onChange={(e) => setEditingLocationName(e.target.value)}
                      className="next-gen-input text-xs font-bold"
                      placeholder="Lokasyon adı"
                    />
                    <CustomSelect
                      value={editingLocationType}
                      onChange={(val) => setEditingLocationType(String(val))}
                      options={UNIT_TYPES.map((t) => ({ id: t.id, label: t.label }))}
                      searchable={false}
                    />
                    <input
                      value={editingLocationCode}
                      onChange={(e) => setEditingLocationCode(e.target.value)}
                      className="next-gen-input text-xs font-bold"
                      placeholder="Lokasyon kodu"
                    />
                    <CustomSelect
                      value={editingOperationalStatus}
                      onChange={setEditingOperationalStatus}
                      options={OPERATIONAL_STATUS.map((o) => ({ id: o.id, label: o.label }))}
                      searchable={false}
                    />
                    <input
                      value={editingLocationAddress}
                      onChange={(e) => setEditingLocationAddress(e.target.value)}
                      className="next-gen-input text-xs font-bold"
                      placeholder="Adres"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editingOpeningDate}
                        onChange={(e) => setEditingOpeningDate(e.target.value)}
                        className="next-gen-input text-xs font-bold"
                      />
                      <input
                        type="date"
                        value={editingClosureDate}
                        onChange={(e) => setEditingClosureDate(e.target.value)}
                        className="next-gen-input text-xs font-bold"
                      />
                    </div>
                    <input
                      value={editingContactName}
                      onChange={(e) => setEditingContactName(e.target.value)}
                      className="next-gen-input text-xs font-bold"
                      placeholder="Sorumlu"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editingFloorArea}
                        onChange={(e) => setEditingFloorArea(e.target.value)}
                        className="next-gen-input text-xs font-bold"
                        placeholder="m²"
                      />
                      <input
                        value={editingLocationPhone}
                        onChange={(e) => setEditingLocationPhone(e.target.value)}
                        className="next-gen-input text-xs font-bold"
                        placeholder="Tel"
                      />
                    </div>
                    <input
                      type="email"
                      value={editingLocationEmail}
                      onChange={(e) => setEditingLocationEmail(e.target.value)}
                      className="next-gen-input text-xs font-bold"
                      placeholder="E-posta"
                    />
                    <textarea
                      value={editingLocationNotes}
                      onChange={(e) => setEditingLocationNotes(e.target.value)}
                      className="next-gen-input text-xs font-bold min-h-[48px] w-full"
                      placeholder="Notlar"
                    />
                    {/* Working hours editor in edit mode */}
                    <div className="border-t border-theme pt-2">
                      <WorkingHoursEditor value={editingWorkingHours} onChange={setEditingWorkingHours} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleUpdateLocation(loc)} className="flex-1 h-8 rounded-lg bg-theme-primary text-white text-[10px] font-black uppercase">Kaydet</button>
                      <button type="button" onClick={resetLocationEditState} className="flex-1 h-8 rounded-lg bg-theme-base border border-theme text-[10px] font-black text-theme-dim uppercase">
                        İptal
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-black text-theme-main uppercase leading-tight">{loc.name}</p>
                      {loc.location_code && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-theme-primary/10 text-theme-primary shrink-0">{loc.location_code}</span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-theme-dim uppercase mt-0.5">{UNIT_TYPES.find((t) => t.id === loc.type)?.label ?? loc.type}</p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted uppercase">
                      {operationalStatusLabel(loc.operational_status)}
                    </span>
                    <p className="text-[10px] font-bold text-theme-muted line-clamp-2">{loc.address || 'Adres yok'}</p>
                    {(loc.opening_date || loc.floor_area_sqm != null) && (
                      <p className="text-[9px] font-bold text-theme-dim">
                        {loc.opening_date ? `Açılış: ${dateInputValue(loc.opening_date)}` : ''}
                        {loc.opening_date && loc.floor_area_sqm != null ? ' · ' : ''}
                        {loc.floor_area_sqm != null ? `${loc.floor_area_sqm} m²` : ''}
                      </p>
                    )}
                    {(loc.contact_name || loc.phone || loc.email) && (
                      <p className="text-[9px] font-bold text-theme-muted line-clamp-2">
                        {[loc.contact_name, loc.phone, loc.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {loc.notes && <p className="text-[9px] font-bold text-theme-dim/80 line-clamp-2 italic">{loc.notes}</p>}
                    {/* Working Hours Summary */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-theme/20">
                      <Clock className="w-3 h-3 text-theme-primary/60 shrink-0" />
                      <span className="text-[9px] font-bold text-theme-muted line-clamp-1">{computeWorkingHoursSummary(wh)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(loc.id);
                          setEditingLocationName(loc.name || '');
                          setEditingLocationType(loc.type || 'factory');
                          setEditingLocationAddress(loc.address || '');
                          setEditingLocationCode(loc.location_code || '');
                          setEditingOperationalStatus(loc.operational_status || 'active');
                          setEditingOpeningDate(dateInputValue(loc.opening_date));
                          setEditingClosureDate(dateInputValue(loc.closure_date));
                          setEditingContactName(loc.contact_name || '');
                          setEditingLocationNotes(loc.notes || '');
                          setEditingFloorArea(loc.floor_area_sqm != null && loc.floor_area_sqm !== '' ? String(loc.floor_area_sqm) : '');
                          setEditingLocationPhone(loc.phone || '');
                          setEditingLocationEmail(loc.email || '');
                          setEditingWorkingHours(parseWorkingHours(loc));
                        }}
                        className="flex-1 h-8 rounded-lg bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-[10px] font-black uppercase"
                      >
                        Düzenle
                      </button>
                      <button type="button" onClick={() => handleDeleteLocation(loc.id)} className="flex-1 h-8 rounded-lg bg-theme-danger/10 border border-theme-danger/20 text-theme-danger text-[10px] font-black uppercase">Sil</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-theme-primary/10 rounded-xl shadow-lg flex items-center justify-center border border-theme-primary/20">
            <MapIcon className="w-6 h-6 text-theme-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black text-theme-main uppercase tracking-tight">TESİS & LOKASYONLAR</h2>
            <p className="text-[12px] font-bold text-theme-muted mt-0.5">Aktif operasyonel merkezlerin yönetimi</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-theme-surface/50 p-1 rounded-xl border border-theme-border/30 flex items-center gap-1 shadow-sm">
            <button onClick={() => setViewMode('grid')} className={cn("w-9 h-9 flex items-center justify-center rounded-lg transition-all", viewMode === 'grid' ? "bg-theme-base text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-main")}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={cn("w-9 h-9 flex items-center justify-center rounded-lg transition-all", viewMode === 'list' ? "bg-theme-base text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-main")}>
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={onAdd} className="h-10 px-6 bg-theme-primary hover:bg-theme-primary/90 text-white rounded-xl flex items-center gap-3 text-[10px] font-black tracking-widest transition-all shadow-xl active:scale-95 group uppercase">
            <Plus className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            YENİ BİRİM EKLE
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedUnits.map((unit: any) => {
            const linkedLocation = locations.find((l: any) => l.id === unit.locationId);
            const type = UNIT_TYPES.find(t => t.id === linkedLocation?.type) || UNIT_TYPES[2];
            const isEditing = editingId === unit.id;
            return (
              <div key={unit.id} className="modern-glass-card p-4 group flex flex-col h-full hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-500 border-theme-border/20">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg border border-black/5 shadow-sm transition-all duration-500 group-hover:scale-110", type.bg)}>
                    <type.icon className={cn("w-5 h-5", type.color)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingId(isEditing ? null : unit.id)} className="flex items-center justify-center h-8 w-8 bg-theme-main/5 hover:bg-theme-primary/10 rounded-lg transition-all text-theme-muted hover:text-theme-primary group hover:scale-105">
                      {isEditing ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Settings2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDeleteUnit(unit.id)} className="flex items-center justify-center h-8 w-8 bg-theme-main/5 hover:bg-theme-danger/10 rounded-lg transition-all text-theme-muted hover:text-rose-500 group hover:scale-105">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-3 flex-1">
                    <input
                      value={unit.name}
                      onChange={e => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, name: e.target.value } : u))}
                      className="next-gen-input text-xs font-black shadow-none border-theme-border/20 active:border-theme-primary/40 focus:border-theme-primary/40"
                      placeholder="Birim adı"
                    />
                    <input
                      value={unit.code ?? ''}
                      onChange={e => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, code: e.target.value || null } : u))}
                      className="next-gen-input text-xs font-black"
                      placeholder="Birim kodu (örn. CNC-GRP)"
                    />
                    <CustomSelect
                      value={unit.status || 'active'}
                      options={OPERATIONAL_STATUS.map((o) => ({ id: o.id, label: o.label }))}
                      onChange={val => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, status: String(val) } : u))}
                      searchable={false}
                    />
                    <CustomSelect
                      value={unit.locationId || '__none__'}
                      options={locationOptions}
                      onChange={val => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, locationId: val === '__none__' ? null : val } : u))}
                    />
                    <input
                      type="date"
                      value={dateInputValue(unit.openingDate)}
                      onChange={e => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, openingDate: e.target.value || null } : u))}
                      className="next-gen-input text-xs font-black"
                    />
                    <input
                      type="number"
                      min={0}
                      value={unit.headcountPlanned ?? ''}
                      onChange={e =>
                        onUpdate(
                          units.map((u: any) =>
                            u.id === unit.id ? { ...u, headcountPlanned: e.target.value === '' ? null : Number(e.target.value) } : u
                          )
                        )
                      }
                      className="next-gen-input text-xs font-black"
                      placeholder="Planlanan kapasite (kişi)"
                    />
                    <textarea
                      value={unit.notes ?? ''}
                      onChange={e => onUpdate(units.map((u: any) => u.id === unit.id ? { ...u, notes: e.target.value || null } : u))}
                      className="next-gen-input text-xs font-bold min-h-[56px] resize-y"
                      placeholder="Notlar (vardiya, hat eşlemesi, ISO alanı…)"
                    />
                    <button type="button" onClick={() => handleUpdateUnit(units.find((u: any) => u.id === unit.id) || unit)} className="w-full py-3.5 bg-theme-primary text-white text-[10px] font-black tracking-widest rounded-xl mt-1 shadow-lg shadow-theme-primary/20 active:scale-95 transition-all">BİRİMİ GÜNCELLE</button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-black text-theme-main uppercase leading-tight">{unit.name}</h4>
                      {unit.code && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-theme-surface border border-theme text-theme-muted shrink-0">{unit.code}</span>
                      )}
                    </div>
                    <span className="inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted uppercase">
                      {operationalStatusLabel(unit.status)}
                    </span>
                    <p className="text-[9px] font-black text-theme-primary uppercase tracking-widest mt-2">{linkedLocation?.name || 'Lokasyon Atanmamış'}</p>
                    <span className="inline-block px-2 py-0.5 bg-theme-surface/50 border border-theme text-[10px] font-bold text-theme-dim rounded-md mt-2 uppercase">{type.label}</span>
                    {(unit.openingDate || unit.headcountPlanned != null) && (
                      <p className="text-[9px] font-bold text-theme-dim mt-2">
                        {unit.openingDate ? `Açılış: ${dateInputValue(unit.openingDate)}` : ''}
                        {unit.openingDate && unit.headcountPlanned != null ? ' · ' : ''}
                        {unit.headcountPlanned != null ? `Kapasite: ${unit.headcountPlanned} kişi` : ''}
                      </p>
                    )}
                    {unit.notes && <p className="text-[9px] font-bold text-theme-muted line-clamp-2 mt-1 italic">{unit.notes}</p>}
                    <div className="mt-2 pt-2 border-t border-theme-border/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">SİSTEME BAĞLI</span>
                      </div>
                      <span className="text-[9px] font-black text-theme-dim/30">{unit.id.substring(0, 8)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="modern-glass-card p-0 overflow-hidden border-theme-border/20">
          <SortableTableProvider items={units} onReorder={handleReorder}>
            <table className="w-full text-left border-collapse density-aware-table">
              <thead className="bg-theme-surface/30 border-b border-theme-border/30">
                <tr>
                  <th className="w-2 px-2 py-4"></th>
                  <th className="px-2 py-2 text-[10px] font-black text-theme-dim uppercase tracking-widest">
                    <button
                      type="button"
                      onClick={() => {
                        if (isAllPageSelected) {
                          const next = new Set(selectedIds);
                          paginatedUnits.forEach((u: any) => next.delete(u.id));
                          setSelectedIds(next);
                          return;
                        }
                        const next = new Set(selectedIds);
                        paginatedUnits.forEach((u: any) => next.add(u.id));
                        setSelectedIds(next);
                      }}
                      className={cn(
                        "w-5 h-5 rounded-md border border-theme-border flex items-center justify-center shadow shadow-theme-main/10",
                        isAllPageSelected ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                      )}
                    >
                      {isAllPageSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </th>
                  <th className="px-2 py-3 text-[10px] font-black text-theme-dim">AD</th>
                  <th className="px-2 py-3 text-[10px] font-black text-theme-dim">KOD</th>
                  <th className="px-2 py-3 text-[10px] font-black text-theme-dim">DURUM</th>
                  <th className="px-2 py-3 text-[10px] font-black text-theme-dim whitespace-nowrap">AÇILIŞ</th>
                  <th className="px-2 py-3 text-[10px] font-black text-theme-dim">BAĞLI LOKASYON</th>
                  <th className="px-2 py-3 text-center text-[10px] font-black text-theme-dim w-32">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/10">
                {paginatedUnits.map((unit: any) => {
                  const linkedLocation = locations.find((l: any) => l.id === unit.locationId);
                  const type = UNIT_TYPES.find(t => t.id === linkedLocation?.type) || UNIT_TYPES[2];
                  const isSelected = selectedIds.has(unit.id);
                  const isInlineEditing = isBulkEditing && isSelected;
                  return (
                    <SortableRow
                      key={unit.id}
                      id={unit.id}
                      className={cn("hover:bg-theme-primary/5 transition-all", isSelected && "bg-theme-primary/5")}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, input, select, a, .cursor-pointer, [role="button"]')) return;
                        toggleRowSelection(unit.id);
                      }}
                    >
                      <td className="w-8 px-2 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedIds);
                            if (next.has(unit.id)) next.delete(unit.id);
                            else next.add(unit.id);
                            setSelectedIds(next);
                          }}
                          className={cn(
                            "w-5 h-5 rounded-md border border-theme-border flex items-center justify-center shadow shadow-theme-main/10",
                            isSelected ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        {isInlineEditing ? (
                          <input
                            value={localChanges[unit.id]?.name ?? unit.name}
                            onChange={(e) => setLocalChanges((prev: any) => ({ ...prev, [unit.id]: { ...(prev[unit.id] || {}), name: e.target.value } }))}
                            className="next-gen-input text-xs font-black"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-theme-main">{unit.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {isInlineEditing ? (
                          <input
                            value={localChanges[unit.id]?.code ?? (unit.code ?? '')}
                            onChange={(e) => setLocalChanges((prev: any) => ({ ...prev, [unit.id]: { ...(prev[unit.id] || {}), code: e.target.value || null } }))}
                            className="next-gen-input text-xs font-black"
                          />
                        ) : (
                          <span className="text-xs font-bold text-theme-muted">{unit.code || '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 min-w-[120px]">
                        {isInlineEditing ? (
                          <CustomSelect
                            value={localChanges[unit.id]?.status ?? (unit.status || 'active')}
                            options={OPERATIONAL_STATUS.map((o) => ({ id: o.id, label: o.label }))}
                            onChange={val => setLocalChanges((prev: any) => ({ ...prev, [unit.id]: { ...(prev[unit.id] || {}), status: String(val) } }))}
                            searchable={false}
                          />
                        ) : (
                          <span className="text-[10px] font-black text-theme-dim uppercase">{operationalStatusLabel(unit.status)}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {isInlineEditing ? (
                          <input
                            type="date"
                            value={dateInputValue(localChanges[unit.id]?.openingDate ?? unit.openingDate)}
                            onChange={(e) =>
                              setLocalChanges((prev: any) => ({
                                ...prev,
                                [unit.id]: { ...(prev[unit.id] || {}), openingDate: e.target.value || null }
                              }))
                            }
                            className="next-gen-input text-xs font-black"
                          />
                        ) : (
                          <span className="text-xs font-bold text-theme-muted">{unit.openingDate ? dateInputValue(unit.openingDate) : '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {isInlineEditing ? (
                          <CustomSelect
                            value={localChanges[unit.id]?.locationId ?? (unit.locationId || '__none__')}
                            options={locationOptions}
                            onChange={val => setLocalChanges((prev: any) => ({ ...prev, [unit.id]: { ...(prev[unit.id] || {}), locationId: val === '__none__' ? null : val } }))}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-theme-main">{linkedLocation?.name || '-'}</span>
                            <span className="text-[10px] font-black text-theme-dim uppercase">({type.label})</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingId(unit.id); setViewMode('grid'); }} className="p-2 bg-theme-primary/5 rounded-lg text-theme-muted hover:text-theme-primary"><Settings2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteUnit(unit.id)} className="p-2 bg-theme-danger/5 rounded-lg text-theme-muted hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </SortableRow>
                  );
                })}
              </tbody>
            </table>
          </SortableTableProvider>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="modern-glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-6 border-theme-border/20">
        <div className="flex items-center gap-6 order-2 md:order-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
            <div className="min-w-fit">
              <CustomSelect
                options={[
                  { id: 20, label: '20' },
                  { id: 50, label: '50' },
                  { id: 250, label: '250' },
                  { id: 500, label: '500' },
                  { id: 1000, label: '1000' },
                  { id: 999999, label: 'Tümü' }
                ]}
                value={pageSize}
                onChange={value => {
                  setPageSize(Number(value));
                  setCurrentPage(0);
                }}
                searchable={false}
              />
            </div>
          </div>
          <div className="h-4 w-px bg-theme hidden md:block" />
          <span className="text-[11px] font-black text-theme-dim">
            Toplam <span className="text-theme-primary">{units.length}</span> Kayıt
          </span>
        </div>

        <div className="flex items-center gap-3 order-1 md:order-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
            <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
              {currentPage + 1}
            </span>
            <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
            <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
              {pageCount || 1}
            </span>
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
            disabled={currentPage >= pageCount - 1}
            className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
          >
            <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        isEditing={isBulkEditing}
        onSave={handleBulkSave}
        onEditToggle={setIsBulkEditing}
        onDelete={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setIsBulkEditing(false);
          setLocalChanges({});
        }}
      />
    </div>
  );
}




function NextGenSchedule() {
  const [offDays, setOffDays] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalLabel, setModalLabel] = useState("");
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    fetchOffDays();
  }, []);

  const fetchOffDays = async () => {
    try {
      const data = await api.get('/system/company/off-days');
      setOffDays(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleDay = async (date: Date) => {
    const isOff = offDays.some(od => isSameDay(new Date(od.date), date));

    if (!isOff) {
      setModalDate(date);
      setModalLabel("");
      return;
    }

    await executeToggle(date, null);
  };

  const executeToggle = async (date: Date, label: string | null) => {
    try {
      const res = await api.post('/system/company/off-days/toggle', { date, label: label || 'KAPALI' });
      if (res.action === 'created') {
        setOffDays([...offDays, res.data]);
        addNotification({ type: 'success', title: 'Gün Eklendi', message: `"${label || 'KAPALI'}" olarak işaretlendi.` });
      } else {
        setOffDays(offDays.filter(d => !isSameDay(new Date(d.date), date)));
        addNotification({ type: 'info', title: 'Gün Kaldırıldı', message: 'Çalışma günü olarak geri alındı.' });
      }
      setModalDate(null);
    } catch (err) {
      addNotification({ type: 'error', title: 'Hata', message: 'İşlem gerçekleştirilemedi.' });
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  return (
    <div className="modern-glass-card animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20 shadow-xl">
            <CalendarDays className="w-6 h-6 text-theme-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black text-theme-main">Üretim Takvimi</h3>
            <p className="text-theme-muted text-[11px] font-bold mt-0.2">Tatil ve özel izin günlerinizi yönetin</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-theme-base/40 p-1.5 rounded-2xl border border-theme">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2.5 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-theme-surface transition-all text-theme-muted hover:text-theme-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-8 min-w-[180px] text-center">
            <span className="text-sm font-black text-theme-main uppercase tracking-widest">
              {format(currentMonth, 'MMMM yyyy', { locale: tr })}
            </span>
          </div>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2.5 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-theme-surface transition-all text-theme-muted hover:text-theme-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CTS', 'PAZ'].map(day => (
          <div key={day} className="text-center py-4 text-[10px] font-black text-theme-dim tracking-[0.2em] uppercase">
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const isOff = offDays.some(od => isSameDay(new Date(od.date), day));
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={i}
              onClick={() => handleToggleDay(day)}
              className={cn(
                "group relative min-h-[80px] p-2 rounded-xl border transition-all duration-500 flex flex-col items-start justify-between",
                !isCurrentMonth ? "opacity-10 grayscale pointer-events-none" : "hover:scale-[1.03] hover:shadow-2xl hover:z-10",
                isOff
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-xl shadow-rose-500/5 ring-1 ring-rose-500/20"
                  : isToday
                    ? "bg-theme-primary/10 border-theme-primary/40 text-theme-primary ring-1 ring-theme-primary/20"
                    : "bg-theme-base/30 border-theme-border/10 text-theme-main hover:border-theme-primary/40 hover:bg-theme-primary/5"
              )}
            >
              <span className={cn(
                "text-lg font-black transition-all",
                isOff ? "scale-110 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" : ""
              )}>
                {format(day, 'd')}
              </span>

              <div className="w-full mt-auto flex flex-col gap-1.5 pt-4">
                {isOff && (
                  <div className="px-3 py-1 bg-rose-500/20 rounded-xl text-[8px] font-black text-center border border-rose-500/20 animate-in fade-in zoom-in slide-in-from-bottom-1 truncate" title={offDays.find(od => isSameDay(new Date(od.date), day))?.label}>
                    {offDays.find(od => isSameDay(new Date(od.date), day))?.label || 'KAPALI'}
                  </div>
                )}
                {isToday && !isOff && (
                  <div className="px-3 py-1 bg-theme-primary/20 rounded-xl text-[8px] font-black text-center border border-theme-primary/20">
                    BUGÜN
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-2 rounded-2xl bg-gradient-to-r from-theme-primary/10 to-transparent border border-theme-primary/20 flex items-start gap-3 backdrop-blur-xl">
        <div className="w-8 h-8 rounded-xl bg-theme-primary/20 flex items-center justify-center shadow-lg shrink-0">
          <Zap className="w-4 h-4 text-theme-primary" />
        </div>
        <div className="items-center justify-center space-y-0">
          <h4 className="text-xs font-black text-theme-primary">AKILLI ANALİZ ENTEGRASYONU</h4>
          <p className="text-[11px] font-bold text-theme-muted leading-relaxed max-w-4xl">
            Burada işaretlediğiniz günler sistem tarafından <span className="text-theme-primary font-black underline decoration-2 underline-offset-4">"Çalışılmayan Gün"</span> olarak kabul edilecek ve analiz raporlarında, eksik üretim kaydı uyarılarında dikkate alınmayacaktır.
          </p>
        </div>
      </div>

      {/* Full-Screen Immersive Reason Modal */}
      {modalDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-theme-base/95 backdrop-blur-2xl" onClick={() => setModalDate(null)} />

          <div className="relative z-10 w-full max-w-2xl px-6 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20 mx-auto mb-6 shadow-2xl shadow-theme-primary/10">
                <CalendarDays className="w-8 h-8 text-theme-primary" />
              </div>
              <h2 className="text-xl font-black text-theme-main mb-2">TATİL VE İZİN TANIMI</h2>
              <p className="text-sm font-bold text-theme-dim opacity-90">
                {format(modalDate, 'EEEE, d MMMM yyyy', { locale: tr })}
              </p>
            </div>

            <div className="space-y-8">
              <div className="relative group">
                <label className="absolute -top-3 left-6 px-2 bg-theme-base text-[10px] font-black text-theme-primary uppercase z-10">KAPALI OLMA GEREKÇESİ</label>
                <input
                  autoFocus
                  value={modalLabel}
                  onChange={(e) => setModalLabel(e.target.value)}
                  placeholder="YAZMAYA BAŞLAYIN... (ÖRN: RAMAZAN BAYRAMI)"
                  className="w-full h-12 bg-theme-surface/30 border-2 border-theme-primary/20 rounded-xl px-4 text-lg font-black text-theme-main placeholder:text-theme-main/10 outline-none focus:border-theme-primary transition-all text-center shadow-xl shadow-theme-primary/10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') executeToggle(modalDate, modalLabel);
                    if (e.key === 'Escape') setModalDate(null);
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setModalDate(null)}
                  className="flex-1 h-12 rounded-xl border-2 border-theme text-theme-dim text-sm font-black uppercase hover:bg-theme-surface transition-all active:scale-95 flex items-center justify-center gap-2 group hover:scale-105"
                >
                  VAZGEÇ
                </button>
                <button
                  onClick={() => executeToggle(modalDate, modalLabel)}
                  className="flex-[2] h-12 rounded-xl bg-theme-primary text-theme-base text-sm font-black uppercase hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-theme-primary/10 flex items-center justify-center gap-2 group hover:scale-105"
                >
                  DEĞİŞİKLİKLERİ KAYDET
                </button>
              </div>

              <p className="text-center text-[11px] font-bold text-theme-dim/40 pt-8">
                ESC ile çıkabilir veya ENTER ile onaylayabilirsiniz
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, icon: IconComponent, children, span = 1, editing }: any) {

  return (
    <div className={cn("space-y-4", span === 2 ? "md:col-span-1" : span === 3 ? "md:col-span-2" : "")}>
      <div className="flex items-center gap-3">
        <IconComponent className={cn("w-4 h-4 transition-colors", editing ? "text-amber-500" : "text-theme-primary/60")} />
        <label className="text-[10px] font-black text-theme-main/60 uppercase block px-1">{label}</label>
      </div>
      {children}
    </div>
  );
}

export default CompanyManagement;
