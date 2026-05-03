import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Users, Search, Plus, Edit, Trash2, X, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle2, Building2, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNotificationStore } from '../../store/notificationStore';
import { cn } from '../../lib/utils';

interface User {
  id: string; fullName: string; email: string; role: string;
  status: string; companyId: string | null; company?: { name: string }; createdAt: string;
}
interface Company { id: string; name: string; }

const ROLES = ['superadmin', 'admin', 'user', 'viewer', 'grafik'];
const ROLE_COLORS: Record<string, string> = {
  superadmin: '#6366F1', admin: '#F59E0B', user: '#10B981', viewer: '#3B82F6', grafik: '#EC4899'
};

function UserModal({ user, companies, onClose, onSave }: {
  user: User | null; companies: Company[]; onClose: () => void; onSave: () => void;
}) {
  const { addNotification } = useNotificationStore();
  const [form, setForm] = useState({
    fullName: user?.fullName || '', email: user?.email || '',
    password: '', role: user?.role || 'user',
    companyId: user?.companyId || '', status: user?.status || 'active'
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.fullName || !form.email) return;
    if (!user && !form.password) { addNotification({ type: 'error', title: 'Şifre gerekli', message: '' }); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, companyId: form.companyId || null };
      if (!form.password) delete payload.password;
      if (user) {
        await api.put(`/system/users/${user.id}`, payload);
        addNotification({ type: 'success', title: 'Kullanıcı güncellendi', message: form.fullName });
      } else {
        await api.post('/system/users', payload);
        addNotification({ type: 'success', title: 'Kullanıcı oluşturuldu', message: form.fullName });
      }
      onSave();
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Hata', message: e.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Users className="text-indigo-400" size={18} />
            </div>
            <div>
              <p className="text-[13px] font-black text-white">{user ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}</p>
              <p className="text-[10px] text-slate-500">{user ? user.email : 'Sistem kullanıcısı oluştur'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Ad Soyad *', key: 'fullName', type: 'text', placeholder: 'Ad Soyad' },
            { label: 'E-posta *', key: 'email', type: 'email', placeholder: 'ornek@email.com' },
            { label: user ? 'Yeni Şifre (opsiyonel)' : 'Şifre *', key: 'password', type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.key} className={f.key === 'email' || f.key === 'password' ? '' : 'col-span-2'}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder}
                value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white placeholder:text-slate-600 outline-none transition-all"
                style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.15)'; }}
              />
            </div>
          ))}

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white outline-none"
              style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">Durum</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white outline-none"
              style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}>
              <option value="active">Aktif</option>
              <option value="passive">Pasif</option>
              <option value="archived">Arşiv</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 block">Şirket Ataması</label>
            <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white outline-none"
              style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}>
              <option value="">— Atanmamış —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-[12px] font-black text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>İptal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-[12px] font-black text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
            {saving ? 'Kaydediliyor...' : (user ? 'Güncelle' : 'Oluştur')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SAUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 15;
  const { addNotification } = useNotificationStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([api.get('/system/users'), api.get('/system/companies')]);
      setUsers(u || []); setCompanies(c || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    return (
      (!search || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)) &&
      (!roleFilter || u.role === roleFilter) &&
      (!companyFilter || String(u.companyId) === companyFilter) &&
      (!statusFilter || u.status === statusFilter)
    );
  }), [users, search, roleFilter, companyFilter, statusFilter]);

  const paginated = useMemo(() => filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize), [filtered, currentPage]);
  const pageCount = Math.ceil(filtered.length / pageSize);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" kullanıcısını arşivlemek istiyor musunuz?`)) return;
    try {
      await api.put(`/system/users/${id}`, { status: 'archived' });
      addNotification({ type: 'success', title: 'Kullanıcı arşivlendi', message: name });
      fetchData();
    } catch { addNotification({ type: 'error', title: 'Hata', message: 'İşlem başarısız.' }); }
  };

  const toggleSelect = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase">Yönetim</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Kullanıcılar</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} kullanıcı kayıtlı</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditingUser(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[11px] font-black transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
            <Plus size={14} />Kullanıcı Ekle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl"
          style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          <Search className="text-slate-500 shrink-0" size={15} />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(0); }}
            placeholder="İsim veya e-posta ara..."
            className="flex-1 bg-transparent outline-none text-[13px] text-white font-bold placeholder:text-slate-600" />
          {search && <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white"><X size={14} /></button>}
        </div>
        {[
          { val: roleFilter, set: setRoleFilter, placeholder: 'Tüm Roller', options: ROLES.map(r => ({ v: r, l: r })) },
          { val: statusFilter, set: setStatusFilter, placeholder: 'Tüm Durumlar', options: [{ v: 'active', l: 'Aktif' }, { v: 'passive', l: 'Pasif' }, { v: 'archived', l: 'Arşiv' }] },
        ].map((f, i) => (
          <select key={i} value={f.val} onChange={e => { f.set(e.target.value); setCurrentPage(0); }}
            className="px-4 py-3 rounded-xl text-[12px] font-bold text-slate-300 outline-none"
            style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
            <option value="">{f.placeholder}</option>
            {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl animate-in slide-in-from-top-2"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <CheckCircle2 className="text-indigo-400" size={16} />
          <span className="text-[12px] font-black text-indigo-300">{selectedIds.size} kullanıcı seçildi</span>
          <div className="flex-1" />
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] font-black text-slate-400 hover:text-white">Seçimi Temizle</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-xl animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#6366F1' }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          {/* Head */}
          <div className="grid grid-cols-[40px_1fr_180px_90px_90px_120px] gap-4 px-5 py-3 border-b"
            style={{ borderColor: 'rgba(99,102,241,0.1)', background: 'rgba(0,0,0,0.2)' }}>
            <div onClick={() => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(u => u.id))); }}
              className={cn("w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all mt-0.5",
                selectedIds.size === filtered.length ? "bg-indigo-600 border-indigo-600" : "border-slate-600 hover:border-indigo-500"
              )}>
              {selectedIds.size === filtered.length && <CheckCircle2 size={12} className="text-white" />}
            </div>
            {['Kullanıcı', 'Şirket', 'Rol', 'Durum', 'İşlem'].map(h => (
              <p key={h} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-bold">Kullanıcı bulunamadı</p>
            </div>
          ) : paginated.map((u, i) => {
            const roleColor = ROLE_COLORS[u.role] || '#64748B';
            return (
              <div key={u.id} onClick={e => { if ((e.target as HTMLElement).closest('button, select, [data-no-select]')) return; toggleSelect(u.id); }}
                className={cn("grid grid-cols-[40px_1fr_180px_90px_90px_120px] gap-4 px-5 py-4 border-b items-center transition-all cursor-pointer group",
                  selectedIds.has(u.id) ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"
                )}
                style={{ borderColor: i < paginated.length - 1 ? 'rgba(99,102,241,0.06)' : 'transparent' }}>
                <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  selectedIds.has(u.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-700 group-hover:border-indigo-500"
                )}>
                  {selectedIds.has(u.id) && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0"
                    style={{ background: `${roleColor}15`, border: `1px solid ${roleColor}30`, color: roleColor }}>
                    {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-white truncate group-hover:text-indigo-300 transition-colors">{u.fullName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-slate-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-300 truncate">{u.company?.name || '—'}</span>
                </div>
                <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest inline-block"
                  style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}>
                  {u.role}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className={`text-[10px] font-black uppercase ${u.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {u.status === 'active' ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" data-no-select>
                  <button onClick={e => { e.stopPropagation(); setEditingUser(u); setModalOpen(true); }}
                    className="p-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                    <Edit size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(u.id, u.fullName); }}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-slate-500">
            Toplam <span className="text-indigo-400">{filtered.length}</span> kullanıcı
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12px] font-black text-white px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              {currentPage + 1} / {pageCount}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(pageCount - 1, p + 1))} disabled={currentPage >= pageCount - 1}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <UserModal
          user={editingUser}
          companies={companies}
          onClose={() => { setModalOpen(false); setEditingUser(null); }}
          onSave={() => { setModalOpen(false); setEditingUser(null); fetchData(); }}
        />
      )}
    </div>
  );
}
