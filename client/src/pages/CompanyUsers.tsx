import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronRight,
  Edit,
  Mail,
  Fingerprint,
  Calendar,
  Activity
} from 'lucide-react';
import { BulkActionBar } from '../components/common/BulkActionBar';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { CustomSelect } from '../components/common/CustomSelect';
import { cn } from '../lib/utils';
import { notify } from '../store/notificationStore';

interface CompanyUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  operatorId?: string;
  operator?: {
    fullName: string;
    employeeId: string;
  };
}

interface Operator {
  id: string;
  fullName: string;
  employeeId: string;
}

export default function CompanyUsers() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ id: '', email: '', fullName: '', role: 'user', password: '', operatorId: '', status: 'active' });
  const [operators, setOperators] = useState<Operator[]>([]);
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

  const fetchOperators = async () => {
    try {
      const data = await api.get('/operators');
      setOperators(data);
    } catch (error) {
      console.error('Failed to fetch operators');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOperators();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await api.post('/auth/company/users', formData);
      } else {
        await api.put(`/auth/company/users/${formData.id}`, {
          role: formData.role,
          status: formData.status,
          operatorId: formData.operatorId
        });
      }
      notify.success('Başarılı', modalMode === 'create' ? 'Kullanıcı oluşturuldu.' : 'Kullanıcı güncellendi.');
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      notify.error('Hata', error.message || 'İşlem başarısız.');
    }
  };

  const resetForm = () => {
    setFormData({ id: '', email: '', fullName: '', role: 'user', password: '', operatorId: '', status: 'active' });
  };

  const handleEdit = (u: CompanyUser) => {
    setModalMode('edit');
    setFormData({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      password: '', // Password not editable in this view
      operatorId: u.operatorId || '',
      status: u.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Kullanıcıyı Sil',
      message: 'Bu kullanıcıyı sistemden kalıcı olarak silmek istediğinize emin misiniz?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/auth/company/users/${userId}`);
          notify.success('Başarılı', 'Kullanıcı sistemden silindi.');
          fetchUsers();
        } catch (error) {
          notify.error('Hata', 'Silme işlemi başarısız.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBulkSave = async () => {
    setLoading(true);
    try {
      await api.post('/auth/company/users/bulk-update', { changes: localChanges });
      notify.success('Başarılı', 'Seçili kayıtlar güncellendi.');
      setIsBulkEditing(false);
      setLocalChanges({});
      fetchUsers();
    } catch (error) {
      notify.error('Hata', 'Güncelleme yapılamadı.');
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
      notify.success('Başarılı', 'Durumlar güncellendi.');
      fetchUsers();
    } catch (error) {
      notify.error('Hata', 'Durum güncellenemedi.');
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
          notify.success('Başarılı', 'Kullanıcılar silindi.');
          setSelectedIds(new Set());
          fetchUsers();
        } catch (error) {
          notify.error('Hata', 'Silme işlemi başarısız.');
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
      <div className="h-[80vh] flex flex-col items-center justify-center p-4 lg:p-6 text-center">
        <Shield className="w-16 h-16 text-theme-danger mx-auto mb-4" />
        <h2 className="text-2xl font-black text-theme-main">Yetkisiz Erişim</h2>
        <p className="text-theme-muted">Bu sayfayı görüntülemek için yönetici yetkisine sahip olmalısınız.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-in fade-in duration-700 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center shadow-xl shadow-theme-primary/5">
            <Users className="w-5 h-5 text-theme-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-theme-main uppercase">Kullanıcı Yönetimi</h1>
            <p className="text-theme-muted text-[11px] font-bold opacity-60 mt-[-0.2rem]">Sistem Kullanıcıları ve Yetki Yönetimi</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setModalMode('create'); resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-3 px-6 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-2xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20 group"
          >
            <UserPlus size={16} className="group-hover:rotate-12 transition-transform" />
            YENİ KULLANICI OLUŞTUR
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'TOPLAM KULLANICI', value: users.length, icon: Users, color: 'text-theme-primary', bg: 'bg-theme-primary/10' },
          { label: 'AKTİF KULLANICILAR', value: users.filter(u => u.status === 'active').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'YÖNETİCİLER', value: users.filter(u => u.role === 'admin').length, icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'PASİF / ASKIDA', value: users.filter(u => u.status === 'passive').length, icon: Activity, color: 'text-theme-muted', bg: 'bg-theme-muted/10' },
        ].map((stat, i) => (
          <div key={i} className="modern-glass-card p-3 flex items-center gap-4 group/s">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover/s:scale-110", stat.bg, stat.color)}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black text-theme-dim opacity-60">{stat.label}</p>
              <h4 className="text-xl font-black text-theme-main mt-[-0.2rem]">{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0 flex flex-col modern-glass-card p-0 overflow-hidden relative shadow-xl shadow-theme-primary/10">
        <div className="p-4 border-b border-theme flex flex-col sm:flex-row justify-between items-start sm:items-center bg-theme-base/20 gap-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-theme-main leading-tight truncate uppercase tracking-widest">
              KULLANICI LİSTESİ
            </h3>
            <p className="text-[11px] font-bold text-theme-muted mt-0.5 truncate opacity-60">
              Sistem erişim yetkilerini buradan izleyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative group flex-1 sm:flex-none sm:w-48 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ara..."
                className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-8 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-theme-base/95 backdrop-blur-md">
              <tr className="bg-theme-base/50 border-b border-theme">
                <th className="w-12 px-6 py-4">
                  <div
                    onClick={() => {
                      if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filteredUsers.map(u => u.id)));
                    }}
                    className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                      selectedIds.size === filteredUsers.length ? "bg-theme-primary border-theme-primary shadow-lg shadow-theme-primary/20" : "border-theme-border/40 hover:border-theme-primary"
                    )}
                  >
                    {selectedIds.size === filteredUsers.length && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Kullanıcı Bilgileri</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Yetki & Rol</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Durum</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">İlişkili Personel</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-right">Eylemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="w-10 h-10 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mx-auto shadow-primary-glow"></div>
                    <p className="mt-4 text-[10px] font-black text-theme-dim uppercase tracking-widest animate-pulse">Kullanıcılar Yükleniyor...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-4 opacity-50">
                      <Users className="w-12 h-12 mx-auto text-theme-dim" />
                      <p className="text-sm font-bold text-theme-dim italic">Aradığınız kriterlere uygun kullanıcı bulunamadı.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.map((u) => (
                <tr key={u.id} className={cn(
                  "hover:bg-theme-primary/[0.02] transition-all group",
                  selectedIds.has(u.id) && "bg-theme-primary/[0.05]"
                )}>
                  <td className="px-6 py-4">
                    <div
                      onClick={() => {
                        const newSelected = new Set(selectedIds);
                        if (newSelected.has(u.id)) newSelected.delete(u.id);
                        else newSelected.add(u.id);
                        setSelectedIds(newSelected);
                      }}
                      className={cn(
                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                        selectedIds.has(u.id) ? "bg-theme-primary border-theme-primary shadow-lg shadow-theme-primary/20" : "border-theme-border/40 hover:border-theme-primary"
                      )}
                    >
                      {selectedIds.has(u.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-theme-primary/20 to-theme-primary/5 border border-theme-primary/20 flex items-center justify-center text-theme-primary font-black text-md shadow-xl shadow-theme-primary/5 group-hover:scale-110 transition-transform duration-500">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-theme-card shadow-lg",
                          u.status === 'active' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-theme-muted shadow-theme-muted/20"
                        )} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-black text-theme-main text-sm tracking-tight group-hover:text-theme-primary transition-colors">{u.fullName}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-theme-dim">
                          <Mail size={12} className="opacity-60" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-purple-500/5">
                          <ShieldCheck size={12} /> YÖNETİCİ
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-theme-primary/5">
                          <UserCheck size={12} /> PERSONEL
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.status === 'active' ? (
                      <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10 w-fit">
                        <CheckCircle2 size={14} className="animate-pulse" /> AKTİF
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-theme-muted text-[10px] font-black uppercase tracking-widest bg-theme-muted/5 px-3 py-1.5 rounded-xl border border-theme-muted/10 w-fit">
                        <XCircle size={14} /> PASİF
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.operator ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-xs font-black text-theme-main">
                          <Fingerprint size={14} className="text-theme-primary opacity-60" />
                          {u.operator.fullName}
                        </div>
                        <span className="text-[10px] font-bold text-theme-dim pl-5">{u.operator.employeeId}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-theme-dim italic opacity-50 pl-1">— Tanımsız</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleEdit(u)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-theme-surface/50 border border-theme text-theme-dim hover:text-theme-primary hover:bg-theme-primary/10 hover:border-theme-primary/10 transition-all active:scale-90"
                        title="Düzenle"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-theme-surface/50 border border-theme text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 hover:border-theme-danger/10 transition-all active:scale-90"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
              <div className="min-w-fit">
                <CustomSelect
                  fullWidth={false}
                  options={[{ id: 20, label: '20' }, { id: 50, label: '50' }, { id: 250, label: '250' }, { id: 500, label: '500' }, { id: 1000, label: '1000' }, { id: 999999, label: 'Tümü' }]}
                  value={pageSize}
                  onChange={v => { setPageSize(Number(v)); setCurrentPage(0); }}
                  searchable={false}
                />
              </div>
            </div>
            <div className="h-6 w-px bg-theme opacity-50" />
            <span className="text-[11px] font-black text-theme-dim">
              Toplam <span className="text-theme-primary">{filteredUsers.length}</span> Kullanıcı
            </span>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border border-theme-border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">{currentPage + 1}</span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">{pageCount || 1}</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage >= pageCount - 1}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border border-theme-border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={18} />
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

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className="bg-theme-card border border-theme w-full max-w-lg rounded-3xl shadow-[0_32px_128px_rgba(0,0,0,0.4)] overflow-hidden scale-in animate-in slide-in-from-bottom-10 duration-500 ring-1 ring-white/10">
            <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-primary/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-theme-primary/10 flex items-center justify-center text-theme-primary border border-theme-primary/20 shadow-lg">
                  {modalMode === 'create' ? <UserPlus size={24} /> : <Edit size={24} />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-theme-main uppercase tracking-tight">
                    {modalMode === 'create' ? 'Yeni Ekip Üyesi Atayın' : 'Kullanıcı Düzenle'}
                  </h2>
                  <p className="text-[10px] font-bold text-theme-dim uppercase tracking-widest opacity-60">
                    {modalMode === 'create' ? 'Sisteme yeni erişim yetkisi tanımlayın' : `${formData.fullName} bilgilerini güncelleyin`}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2.5 rounded-xl text-theme-dim hover:bg-theme-danger/10 hover:text-theme-danger transition-all active:scale-90 border border-transparent hover:border-theme-danger/20">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">AD SOYAD</label>
                  <div className="relative group">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={16} />
                    <input
                      required
                      type="text"
                      disabled={modalMode === 'edit'}
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full h-12 bg-theme-base border border-theme rounded-2xl pl-12 pr-4 text-sm font-bold text-theme-main focus:border-theme-primary/50 outline-none transition-all disabled:opacity-50"
                      placeholder="Örn: Ahmet Yılmaz"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">E-POSTA ADRESİ</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={16} />
                    <input
                      required
                      type="email"
                      disabled={modalMode === 'edit'}
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full h-12 bg-theme-base border border-theme rounded-2xl pl-12 pr-4 text-sm font-bold text-theme-main focus:border-theme-primary/50 outline-none transition-all disabled:opacity-50"
                      placeholder="ahmet@sirket.com"
                    />
                  </div>
                </div>

                {modalMode === 'create' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">BAŞLANGIÇ ŞİFRESİ</label>
                    <div className="relative group">
                      <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={16} />
                      <input
                        required
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full h-12 bg-theme-base border border-theme rounded-2xl pl-12 pr-4 text-sm font-bold text-theme-main focus:border-theme-primary/50 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">PERSONEL İLİŞKİSİ (OPSİYONEL)</label>
                  <CustomSelect
                    options={operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))}
                    value={formData.operatorId}
                    onChange={(val) => setFormData(prev => ({ ...prev, operatorId: val }))}
                    placeholder="Personel seçin..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">YETKİ SEVİYESİ</label>
                    <CustomSelect
                      searchable={false}
                      options={[{ id: 'user', label: 'STANDART PERSONEL' }, { id: 'admin', label: 'YÖNETİCİ' }]}
                      value={formData.role}
                      onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">DURUM</label>
                    <CustomSelect
                      searchable={false}
                      options={[{ id: 'active', label: 'AKTİF' }, { id: 'passive', label: 'PASİF' }]}
                      value={formData.status}
                      onChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-theme text-theme-dim font-black rounded-2xl hover:bg-theme-danger/10 hover:border-theme-danger/20 hover:text-theme-danger active:bg-theme-danger/20 transition-all text-xs uppercase"
                >
                  İPTAL
                </button>
                <button
                  type="submit"
                  className="flex-[2] px-10 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-2xl shadow-xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20 text-xs uppercase"
                >
                  {modalMode === 'create' ? 'KULLANICIYI OLUŞTUR' : 'GÜNCELLEMELERİ KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
