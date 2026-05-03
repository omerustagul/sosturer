import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Search, Plus, Edit, Trash2, ChevronRight,
  Users, Database, Grid3X3, List, RefreshCw, X, CheckCircle2,
  Filter, ChevronLeft, Eye, MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNotificationStore } from '../../store/notificationStore';
import { cn } from '../../lib/utils';

interface Company {
  id: string;
  name: string;
  sector: string;
  createdAt: string;
  _count: { users: number; productionRecords: number };
}

const SECTORS = ['Tüm Sektörler', 'Metal İşleme', 'Plastik', 'Tekstil', 'Gıda', 'İlaç', 'Elektronik', 'Otomotiv', 'Diğer'];

function CompanyModal({ company, onClose, onSave }: {
  company: Company | null; onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState({ name: company?.name || '', sector: company?.sector || '' });
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotificationStore();

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (company) {
        await api.put(`/system/companies/${company.id}`, form);
        addNotification({ type: 'success', title: 'Şirket güncellendi', message: `${form.name} başarıyla güncellendi.` });
      } else {
        await api.post('/system/companies', form);
        addNotification({ type: 'success', title: 'Şirket eklendi', message: `${form.name} sisteme kaydedildi.` });
      }
      onSave();
    } catch {
      addNotification({ type: 'error', title: 'Hata', message: 'İşlem başarısız.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Building2 className="text-indigo-400" size={18} />
            </div>
            <div>
              <p className="text-[13px] font-black text-white">{company ? 'Şirketi Düzenle' : 'Yeni Şirket'}</p>
              <p className="text-[10px] text-slate-500">{company ? company.name : 'Yeni kayıt oluştur'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Şirket Adı *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Şirket adını girin..."
              className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white placeholder:text-slate-600 outline-none transition-all"
              style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Sektör</label>
            <input
              type="text"
              value={form.sector}
              onChange={e => setForm({ ...form, sector: e.target.value })}
              placeholder="Ör: Metal İşleme, Tekstil..."
              className="w-full px-4 py-3 rounded-xl text-[13px] font-bold text-white placeholder:text-slate-600 outline-none transition-all"
              style={{ background: '#0F1626', border: '1px solid rgba(99,102,241,0.15)' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.15)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-[12px] font-black text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-3 rounded-xl text-[12px] font-black text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
          >
            {saving ? 'Kaydediliyor...' : (company ? 'Güncelle' : 'Oluştur')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SACompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('Tüm Sektörler');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pageSize = 12;
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const data = await api.get('/system/companies');
      setCompanies(data || []);
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const filtered = useMemo(() => {
    return companies.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.sector || '').toLowerCase().includes(search.toLowerCase());
      const matchesSector = sectorFilter === 'Tüm Sektörler' || c.sector === sectorFilter;
      return matchesSearch && matchesSector;
    });
  }, [companies, search, sectorFilter]);

  const paginated = useMemo(() =>
    filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [filtered, currentPage]);

  const pageCount = Math.ceil(filtered.length / pageSize);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" şirketini silmek istiyor musunuz? Bu işlem geri alınamaz.`)) return;
    try {
      await api.put(`/system/companies/${id}`, { status: 'archived' });
      addNotification({ type: 'success', title: 'Şirket arşivlendi', message: `${name} arşive taşındı.` });
      fetchCompanies();
    } catch {
      addNotification({ type: 'error', title: 'Hata', message: 'Şirket arşivlenemedi.' });
    }
  };

  const toggleSelect = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  const sectorColors: Record<number, string> = {
    0: '#6366F1', 1: '#10B981', 2: '#F59E0B', 3: '#EC4899',
    4: '#14B8A6', 5: '#8B5CF6', 6: '#EF4444', 7: '#3B82F6',
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase">Yönetim</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Şirketler</h1>
          <p className="text-slate-400 text-sm mt-0.5">{companies.length} şirket kayıtlı</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchCompanies} className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setEditingCompany(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[11px] font-black transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}
          >
            <Plus size={14} />
            Şirket Ekle
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl"
          style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          <Search className="text-slate-500 shrink-0" size={15} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(0); }}
            placeholder="Şirket adı veya sektör ara..."
            className="flex-1 bg-transparent outline-none text-[13px] text-white font-bold placeholder:text-slate-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-xl overflow-hidden p-1" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
            <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white")}>
              <List size={15} />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white")}>
              <Grid3X3 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl animate-in slide-in-from-top-2"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <CheckCircle2 className="text-indigo-400" size={16} />
          <span className="text-[12px] font-black text-indigo-300">{selectedIds.size} şirket seçildi</span>
          <div className="flex-1" />
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] font-black text-slate-400 hover:text-white">
            Seçimi Temizle
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-xl animate-spin"
            style={{ border: '2px solid transparent', borderTopColor: '#6366F1' }} />
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_160px_120px_100px_120px] gap-4 px-5 py-3 border-b"
            style={{ borderColor: 'rgba(99,102,241,0.1)', background: 'rgba(0,0,0,0.2)' }}>
            <div
              onClick={() => {
                if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(filtered.map(c => c.id)));
              }}
              className={cn("w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all mt-0.5",
                selectedIds.size === filtered.length ? "bg-indigo-600 border-indigo-600" : "border-slate-600 hover:border-indigo-500"
              )}
            >
              {selectedIds.size === filtered.length && <CheckCircle2 size={12} className="text-white" />}
            </div>
            {['Şirket', 'Sektör', 'Üye / Kayıt', 'Oluşturma', 'İşlem'].map(h => (
              <p key={h} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{h}</p>
            ))}
          </div>

          {/* Table Rows */}
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building2 size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-bold">Şirket bulunamadı</p>
            </div>
          ) : (
            paginated.map((company, idx) => {
              const color = sectorColors[idx % Object.keys(sectorColors).length];
              return (
                <div
                  key={company.id}
                  className={cn(
                    "grid grid-cols-[40px_1fr_160px_120px_100px_120px] gap-4 px-5 py-4 border-b items-center transition-all cursor-pointer group",
                    selectedIds.has(company.id) ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"
                  )}
                  style={{ borderColor: 'rgba(99,102,241,0.06)' }}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('button, [data-no-select]')) return;
                    toggleSelect(company.id);
                  }}
                >
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    selectedIds.has(company.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-700 group-hover:border-indigo-500"
                  )}>
                    {selectedIds.has(company.id) && <CheckCircle2 size={12} className="text-white" />}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px]"
                      style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-white group-hover:text-indigo-300 transition-colors truncate">{company.name}</p>
                      <p className="text-[10px] text-slate-500">ID: {company.id}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      {company.sector || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-[13px] font-black text-white">{company._count.users}</p>
                      <p className="text-[9px] text-slate-500 uppercase">Üye</p>
                    </div>
                    <div className="w-px h-5 bg-slate-700" />
                    <div className="text-center">
                      <p className="text-[13px] font-black text-white">{company._count.productionRecords}</p>
                      <p className="text-[9px] text-slate-500 uppercase">Kayıt</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400">
                      {format(new Date(company.createdAt), 'dd MMM yyyy', { locale: tr })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5" data-no-select>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/superadmin/companies/${company.id}`); }}
                      className="p-2 rounded-lg transition-all text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                      title="Detay"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingCompany(company); setModalOpen(true); }}
                      className="p-2 rounded-lg transition-all text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
                      title="Düzenle"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(company.id, company.name); }}
                      className="p-2 rounded-lg transition-all text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Arşivle"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map((company, idx) => {
            const color = sectorColors[idx % Object.keys(sectorColors).length];
            return (
              <div
                key={company.id}
                className="group relative rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1"
                style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}30`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.12)'; }}
              >
                {/* Checkbox */}
                <div
                  onClick={() => toggleSelect(company.id)}
                  className={cn("absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    selectedIds.has(company.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-700 hover:border-indigo-500 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {selectedIds.has(company.id) && <CheckCircle2 size={12} className="text-white" />}
                </div>

                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 font-black text-lg"
                  style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
                  {company.name.charAt(0).toUpperCase()}
                </div>

                <p className="text-[14px] font-black text-white mb-1 truncate group-hover:text-indigo-300 transition-colors">{company.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-4 font-bold">{company.sector || 'Sektör yok'}</p>

                <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-center flex-1">
                    <p className="text-[15px] font-black text-white">{company._count.users}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Üye</p>
                  </div>
                  <div className="w-px h-6 bg-slate-700" />
                  <div className="text-center flex-1">
                    <p className="text-[15px] font-black text-white">{company._count.productionRecords}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Kayıt</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/superadmin/companies/${company.id}`)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-black text-indigo-400 transition-all hover:bg-indigo-500/10"
                    style={{ border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    Detay
                  </button>
                  <button
                    onClick={() => { setEditingCompany(company); setModalOpen(true); }}
                    className="p-2 rounded-xl text-slate-500 hover:text-amber-400 transition-all hover:bg-amber-500/10"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <Edit size={13} />
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
            Toplam <span className="text-indigo-400">{filtered.length}</span> şirket
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12px] font-black text-white px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all"
              style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <CompanyModal
          company={editingCompany}
          onClose={() => { setModalOpen(false); setEditingCompany(null); }}
          onSave={() => { setModalOpen(false); setEditingCompany(null); fetchCompanies(); }}
        />
      )}
    </div>
  );
}
