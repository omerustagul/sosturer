import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Building2, Users, Database, ArrowLeft, Edit, Save, X,
  Plus, Trash2, UserMinus, CheckCircle2, BarChart3, Shield, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNotificationStore } from '../../store/notificationStore';

type Tab = 'info' | 'users' | 'stats' | 'access';

interface Company {
  id: string; name: string; sector: string; createdAt: string;
  _count: { users: number; productionRecords: number; departments?: number };
}
interface User {
  id: string; fullName: string; email: string; role: string;
  status: string; companyId: string | null; company?: { name: string }; createdAt: string;
}
interface Stats {
  machines: number; operators: number; records: number;
}

const TAB_ITEMS: { key: Tab; label: string; icon: any }[] = [
  { key: 'info', label: 'Genel Bilgiler', icon: Building2 },
  { key: 'users', label: 'Kullanıcılar', icon: Users },
  { key: 'stats', label: 'İstatistikler', icon: BarChart3 },
  { key: 'access', label: 'Erişim & İzinler', icon: Shield },
];

export default function SACompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotificationStore();

  const [tab, setTab] = useState<Tab>('info');
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', sector: '' });
  const [assignSearch, setAssignSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [allowSupportAccess, setAllowSupportAccess] = useState(false);

  const notify = {
    success: (t: string, m = '') => addNotification({ type: 'success', title: t, message: m }),
    error: (t: string, m = '') => addNotification({ type: 'error', title: t, message: m }),
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cData, uData, allU, statsData, accessData] = await Promise.all([
        api.get(`/system/companies/${id}`),
        api.get('/system/users'),
        api.get('/system/users'),
        api.get(`/system/companies/${id}/stats`).catch(() => null),
        api.get(`/system/companies/${id}/access`).catch(() => ({ allowSupportAccess: false })),
      ]);
      setCompany(cData);
      setForm({ name: cData.name, sector: cData.sector || '' });
      const companyUsers = (uData || []).filter((u: User) => String(u.companyId) === String(id));
      setUsers(companyUsers);
      setAllUsers(allU || []);
      if (statsData) setStats(statsData);
      setAllowSupportAccess(accessData?.allowSupportAccess || false);
    } catch (e) {
      notify.error('Hata', 'Şirket bilgileri alınamadı');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/system/companies/${id}`, form);
      notify.success('Güncellendi', `${form.name} başarıyla güncellendi.`);
      fetchData();
    } catch { notify.error('Hata', 'Güncelleme başarısız.'); }
    finally { setSaving(false); }
  };

  const handleUnassign = async (userId: string, userName: string) => {
    try {
      await api.put(`/system/users/${userId}`, { companyId: null });
      notify.success('Kullanıcı çıkarıldı', `${userName} şirketten ayrıldı.`);
      fetchData();
    } catch { notify.error('Hata', 'Kullanıcı çıkarılamadı.'); }
  };

  const handleAssign = async (userId: string, userName: string) => {
    try {
      await api.put(`/system/users/${userId}`, { companyId: id });
      notify.success('Atama yapıldı', `${userName} şirkete atandı.`);
      setIsAssigning(false);
      fetchData();
    } catch { notify.error('Hata', 'Atama başarısız.'); }
  };

  const unassignedUsers = allUsers.filter(u => !u.companyId && u.role !== 'superadmin');
  const filteredUnassigned = unassignedUsers.filter(u =>
    u.fullName.toLowerCase().includes(assignSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(assignSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 rounded-xl animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#6366F1' }} />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500">
        <Building2 size={48} className="mb-4 opacity-20" />
        <p className="font-bold">Şirket bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/companies')}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ArrowLeft size={15} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-indigo-300"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{company.name}</h1>
            <p className="text-[11px] text-slate-500 font-bold">ID: {company.id} • {company.sector || 'Sektör yok'}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={fetchData} className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 justify-center transition-all"
            style={tab === t.key ? {
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.1) 100%)',
              border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC'
            } : { color: '#64748B', border: '1px solid transparent' }}>
            <t.icon size={14} />
            <span className="text-[11px] font-black uppercase tracking-wider">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === 'info' && (
        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Şirket Bilgileri</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Şirket Adı *', key: 'name', value: form.name },
              { label: 'Sektör', key: 'sector', value: form.sector },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white outline-none transition-all"
                  style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.15)'; }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {[
              { label: 'Kayıt Tarihi', value: format(new Date(company.createdAt), 'dd MMM yyyy', { locale: tr }) },
              { label: 'Kullanıcı Sayısı', value: company._count.users },
              { label: 'Üretim Kaydı', value: company._count.productionRecords },
              { label: 'Şirket ID', value: company.id },
            ].map(row => (
              <div key={row.label} className="p-4 rounded-xl" style={{ background: '#0F1626', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{row.label}</p>
                <p className="text-[14px] font-black text-white">{row.value}</p>
              </div>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[12px] font-black text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
            <Save size={14} />
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      )}

      {/* Tab: Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black text-white">{users.length} Atanmış Kullanıcı</p>
            <button onClick={() => setIsAssigning(!isAssigning)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
              <Plus size={14} />
              Kullanıcı Ata
            </button>
          </div>

          {/* Assign Panel */}
          {isAssigning && (
            <div className="rounded-2xl p-5" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Atanmamış Kullanıcılar</p>
              <input
                value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                placeholder="İsim veya e-posta ara..."
                className="w-full px-4 py-2.5 rounded-xl text-[12px] text-white outline-none mb-3"
                style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
              />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredUnassigned.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-4">Atanabilir kullanıcı bulunamadı</p>
                ) : filteredUnassigned.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-slate-300 shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {u.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white truncate">{u.fullName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                    </div>
                    <button onClick={() => handleAssign(u.id, u.fullName)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black text-indigo-400 hover:bg-indigo-500/10 transition-all"
                      style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                      Ata
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Users size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-bold">Bu şirkete atanmış kullanıcı yok</p>
              </div>
            ) : users.map((u, i) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 border-b transition-all hover:bg-white/[0.02]"
                style={{ borderColor: i < users.length - 1 ? 'rgba(99,102,241,0.06)' : 'transparent' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black text-slate-200 shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {u.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white truncate">{u.fullName}</p>
                  <p className="text-[10px] text-slate-500">{u.email}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${u.role === 'admin' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 bg-slate-500/10'}`}>
                  {u.role}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-[10px] text-slate-400 font-bold">{u.status === 'active' ? 'Aktif' : 'Pasif'}</span>
                </div>
                <button onClick={() => handleUnassign(u.id, u.fullName)}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                  <UserMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Stats */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: 'Makine Sayısı', value: stats?.machines ?? '—', color: '#6366F1' },
            { label: 'Personel Sayısı', value: stats?.operators ?? '—', color: '#10B981' },
            { label: 'Üretim Kaydı', value: stats?.records ?? company._count.productionRecords, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="p-6 rounded-2xl" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                <BarChart3 style={{ color: s.color }} size={18} />
              </div>
              <p className="text-3xl font-black text-white mb-1">{s.value}</p>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Access */}
      {tab === 'access' && (
        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Erişim Ayarları</p>
          <div className="flex items-center justify-between p-5 rounded-xl" style={{ background: '#0F1626', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <p className="text-[13px] font-black text-white mb-1">Destek Erişimi</p>
              <p className="text-[11px] text-slate-500">SuperAdmin bu şirketin ekranlarına uzaktan erişebilir</p>
            </div>
            <div
              onClick={async () => {
                const newVal = !allowSupportAccess;
                setAllowSupportAccess(newVal);
                try {
                  await api.put(`/system/companies/${id}`, { allowSupportAccess: newVal });
                  notify.success('Güncellendi', `Destek erişimi ${newVal ? 'açıldı' : 'kapatıldı'}.`);
                } catch { setAllowSupportAccess(!newVal); }
              }}
              className="relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 shrink-0"
              style={{ background: allowSupportAccess ? '#6366F1' : 'rgba(255,255,255,0.1)' }}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${allowSupportAccess ? 'left-6' : 'left-0.5'}`} />
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
            <p className="text-[11px] text-indigo-300 font-bold">
              ℹ️ Destek erişimi açık olduğunda, Sosturer sistem yöneticileri bu şirketin arayüzünü yönetici rolünde görüntüleyebilir.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
