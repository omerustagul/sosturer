import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  MoreVertical,
  Trash2,
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BulkActionBar } from '../components/common/BulkActionBar';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { CustomSelect } from '../components/common/CustomSelect';
import { cn } from '../lib/utils';

interface CompanyUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export default function CompanyUsers() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', fullName: '', role: 'user', password: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, any>>({});
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'danger' | 'warning'; onConfirm: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => { }
  });

  const fetchUsers = async () => {
    try {
      const data = await api.get('/auth/company/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/company/users', inviteData);
      setIsInviteModalOpen(false);
      setInviteData({ email: '', fullName: '', role: 'user', password: '' });
      fetchUsers();
    } catch (error) {
      alert('Kullanıcı eklenemedi. E-posta adresi sistemde kayıtlı olabilir.');
    }
  };

  const handleBulkSave = async () => {
    setLoading(true);
    try {
      // API call to update multiple users
      await api.post('/auth/company/users/bulk-update', { changes: localChanges });
      setIsBulkEditing(false);
      setLocalChanges({});
      fetchUsers();
    } catch (error) {
      alert('Güncelleme yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'passive') => {
    try {
      await api.post('/auth/company/users/bulk-status', {
        ids: Array.from(selectedIds),
        status
      });
      fetchUsers();
    } catch (error) {
      alert('Durum güncellenemedi.');
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Kullanıcıları Sil',
      message: `${selectedIds.size} kullanıcıyı kalıcı olarak silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.post('/auth/company/users/bulk-delete', { ids: Array.from(selectedIds) });
          setSelectedIds(new Set());
          fetchUsers();
        } catch (error) {
          alert('Silme işlemi başarısız.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const filteredUsers = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(lowerSearchTerm) ||
        u.email.toLowerCase().includes(lowerSearchTerm)
    );
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredUsers, currentPage, pageSize]);

  const pageCount = Math.ceil(filteredUsers.length / pageSize);

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="h-[100vh] flex flex-col items-center justify-center p-4 lg:p-6 text-center">
        <Shield className="w-16 h-16 text-theme-danger mx-auto mb-4" />
        <h2 className="text-2xl font-black text-theme-main">Yetkisiz Erişim</h2>
        <p className="text-theme-muted">Bu sayfayı görüntülemek için yönetici yetkisine sahip olmalısınız.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500 pb-32">
      {/* Header */}
      <div className="modern-glass-card flex flex-col md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center shadow-xl shadow-theme-primary/10">
            <Users className="w-6 h-6 text-theme-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-theme-main tracking-tight">Kullanıcı Yönetimi</h1>
            <p className="text-theme-muted text-xs font-bold">Sistem Kullanıcılarını ve Yetkilerini Yönetin</p>
          </div>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center h-10 gap-2 px-3 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white text-sm font-bold rounded-xl shadow-xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20 group hover:scale-105"
        >
          <UserPlus size={18} /> Yeni Kullanıcı Oluştur
        </button>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="relative group">
            <Search className="absolute left-3 bottom-0.5 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="next-gen-input w-full bg-theme-card border border-theme-border/70 rounded-xl pl-10 pr-3 py-2 text-theme-main placeholder:text-theme-muted/50 focus:outline-none focus:border-theme-primary/50 transition-all"
            />
          </div>
        </div>
        <div className="lg:col-span-4 flex gap-4">
          <div className="modern-glass-card w-full flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-theme-primary">{users.length}</span>
            <span className="text-[12px] font-black text-theme-muted">Toplam Kullanıcı</span>
          </div>
          <div className="modern-glass-card w-full flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-emerald-500">{users.filter(u => u.status === 'active').length}</span>
            <span className="text-[12px] font-black text-theme-muted">Aktif</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-dim/5 border-b border-theme">
                <th className="w-10 px-4 py-3">
                  <div
                    onClick={() => {
                      if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filteredUsers.map(u => u.id)));
                    }}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                      selectedIds.size === filteredUsers.length ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary font-black"
                    )}
                  >
                    {selectedIds.size === filteredUsers.length && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </th>
                <th className="px-4 py-2 text-[11px] font-black text-theme-muted uppercase tracking-widest">Kullanıcı</th>
                <th className="px-4 py-2 text-[11px] font-black text-theme-muted uppercase tracking-widest">Rol</th>
                <th className="px-4 py-2 text-[11px] font-black text-theme-muted uppercase tracking-widest">Durum</th>
                <th className="px-4 py-2 text-[11px] font-black text-theme-muted uppercase tracking-widest text-right">Eylemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center">
                    <div className="w-8 h-8 border-3 border-theme-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-theme-muted font-bold italic">Kullanıcı bulunamadı.</td>
                </tr>
              ) : paginatedUsers.map((u) => (
                <tr key={u.id} className={cn(
                  "hover:bg-theme-surface/50 transition-all group",
                  selectedIds.has(u.id) && "bg-theme-primary/5"
                )}>
                  <td className="px-4 py-2">
                    <div
                      onClick={() => {
                        const newSelected = new Set(selectedIds);
                        if (newSelected.has(u.id)) newSelected.delete(u.id);
                        else newSelected.add(u.id);
                        setSelectedIds(newSelected);
                      }}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                        selectedIds.has(u.id) ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                      )}
                    >
                      {selectedIds.has(u.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center text-theme-primary font-black text-md shadow-lg group-hover:scale-105 transition-transform">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        {isBulkEditing && selectedIds.has(u.id) ? (
                          <input
                            value={localChanges[u.id]?.fullName ?? u.fullName}
                            onChange={(e) => setLocalChanges(prev => ({ ...prev, [u.id]: { ...prev[u.id], fullName: e.target.value } }))}
                            className="bg-theme-base/50 border border-theme rounded-xl px-4 py-2 text-sm font-bold w-full focus:border-theme-primary/50 outline-none"
                          />
                        ) : (
                          <p className="font-black text-theme-main text-xs group-hover:text-theme-primary transition-colors">{u.fullName}</p>
                        )}
                        <p className="text-[10px] font-bold text-theme-dim">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {isBulkEditing && selectedIds.has(u.id) ? (
                        <CustomSelect variant="inline"
                          options={[{ id: 'admin', label: 'YÖNETİCİ' }, { id: 'user', label: 'PERSONEL' }]}
                          value={localChanges[u.id]?.role ?? u.role}
                          onChange={(val) => setLocalChanges(prev => ({ ...prev, [u.id]: { ...prev[u.id], role: val } }))}
                          className="w-40" />
                      ) : u.role === 'admin' ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          <ShieldCheck size={12} /> YÖNETİCİ
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-[10px] font-black rounded-lg uppercase tracking-wider">
                          <UserCheck size={12} /> PERSONEL
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {u.status === 'active' ? (
                        <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 size={14} /> Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-theme-muted text-[10px] font-black uppercase tracking-widest">
                          <XCircle size={14} /> Pasif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!isBulkEditing && (
                      <div className="flex items-center justify-end gap-2 text-center">
                        <button className="p-2.5 rounded-xl bg-theme-surface/50 border border-theme text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 hover:border-theme-danger/10 transition-all">
                          <Trash2 size={16} />
                        </button>
                        <button className="p-2.5 rounded-xl bg-theme-surface/50 border border-theme text-theme-dim hover:text-theme-primary hover:bg-theme-primary/10 hover:border-theme-primary/10 transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
              <div className="min-w-fit">
                <CustomSelect fullWidth={false} options={[ { id: 20, label: '20' }, { id: 50, label: '50' }, { id: 250, label: '250' }, { id: 500, label: '500' }, { id: 1000, label: '1000' }, { id: 999999, label: 'Tümü' } ]} value={pageSize} onChange={value => { setPageSize(Number(value)); setCurrentPage(0); }} searchable={false} />
              </div>
            </div>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredUsers.length}</span> Kayıt
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
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        isEditing={isBulkEditing}
        onSave={handleBulkSave}
        onEditToggle={setIsBulkEditing}
        onStatusUpdate={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setIsBulkEditing(false);
          setLocalChanges({});
        }}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className="bg-theme-card border border-theme w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden scale-in animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-8 border-b border-theme flex items-center justify-between bg-theme-primary/5">
              <div className="flex items-center gap-4">
                <UserPlus className="text-theme-primary" size={24} />
                <h2 className="text-xl font-black text-theme-main uppercase">Yeni Ekip Üyesi Atayın</h2>
              </div>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-theme-surface rounded-xl text-theme-dim hover:text-white transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 block">AD SOYAD</label>
                  <input
                    required
                    type="text"
                    value={inviteData.fullName}
                    onChange={(e) => setInviteData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 block">E-POSTA ADRESİ</label>
                  <input
                    required
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    placeholder="ahmet@sirket.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 block">ŞİFRE (MİSAFİR GİRİŞİ İÇİN)</label>
                  <input
                    required
                    type="password"
                    value={inviteData.password}
                    onChange={(e) => setInviteData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 block">YETKİ SEVİYESİ</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setInviteData(prev => ({ ...prev, role: 'user' }))}
                      className={`p-4 rounded-xl border font-black text-[10px] tracking-widest transition-all flex flex-col items-center gap-2 uppercase ${inviteData.role === 'user' ? 'bg-theme-primary/10 border-theme-primary text-theme-primary' : 'bg-theme-surface border-theme text-theme-muted hover:border-theme-primary/30'}`}
                    >
                      <UserCheck size={20} />
                      STANDART PERSONEL
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteData(prev => ({ ...prev, role: 'admin' }))}
                      className={`p-4 rounded-xl border font-black text-[10px] tracking-widest transition-all flex flex-col items-center gap-2 uppercase ${inviteData.role === 'admin' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-theme-surface border-theme text-theme-muted hover:border-purple-500/30'}`}
                    >
                      <ShieldCheck size={20} />
                      YÖNETİCİ
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 px-6 py-4 border border-theme text-theme-main font-black rounded-2xl hover:bg-theme-surface transition-all text-sm">İPTAL</button>
                <button type="submit" className="flex-[2] px-10 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-2xl shadow-xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20 text-sm">DAVETİ GÖNDER & KAYDET</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
