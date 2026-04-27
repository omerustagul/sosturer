import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import {
  Building2, ShieldAlert, LayoutDashboard, Search,
  Edit, ShieldCheck, Users, Activity,
  Globe, Database, Server, Trash2, CheckCircle2, Clock, X, Plus, UserMinus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Loading } from '../components/common/Loading';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useNotificationStore } from '../store/notificationStore';
import { CustomSelect } from '../components/common/CustomSelect';
import { BulkActionBar } from '../components/common/BulkActionBar';
import { cn } from '../lib/utils';

interface Company {
  id: string;
  name: string;
  sector: string;
  _count: { users: number; productionRecords: number };
  createdAt: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  companyId?: string | null;
  company?: { name: string };
  createdAt: string;
}

interface SystemInfo {
  version: string;
  ip: string;
  port: string;
  os: string;
  uptime: number;
}

type Tab = 'overview' | 'companies' | 'users' | 'system';

export function SuperAdmin() {
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  // Modals
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAssignPopupOpen, setIsAssignPopupOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [companyForm, setCompanyForm] = useState({ name: '', sector: '' });
  const [userForm, setUserForm] = useState({ fullName: '', email: '', password: '', role: 'user', companyId: '', status: 'active' });

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => { }
  });

  const { addNotification } = useNotificationStore();

  const notify = {
    success: (title: string, message: string = '') => addNotification({ type: 'success', title, message }),
    error: (title: string, message: string = '') => addNotification({ type: 'error', title, message }),
    info: (title: string, message: string = '') => addNotification({ type: 'info', title, message }),
  };

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(0);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleBulkDelete = () => {
    const typeLabel = activeTab === 'companies' ? 'Şirketi' : 'Kullanıcıyı';
    setConfirmState({
      isOpen: true,
      type: 'danger',
      title: 'Toplu Sil',
      message: `${selectedIds.size} adet ${typeLabel.toLowerCase()} silmek istediğinize emin misiniz?`,
      onConfirm: async () => {
        try {
          const endpoint = activeTab === 'companies' ? '/system/companies/bulk-delete' : '/system/users/bulk-delete';
          await api.post(endpoint, { ids: Array.from(selectedIds) });
          notify.success('İşlem Başarılı', 'Seçili kayıtlar silindi.');
          setSelectedIds(new Set());
          fetchData();
        } catch (error) {
          notify.error('Hata', 'Toplu silme işlemi başarısız oldu.');
        } finally {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      const endpoint = activeTab === 'companies' ? '/system/companies/bulk-status' : '/system/users/bulk-status';
      await api.post(endpoint, { ids: Array.from(selectedIds), status });
      notify.success('Güncellendi', 'Seçili kayıtların durumu güncellendi.');
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      notify.error('Hata', 'Durum güncellenemedi.');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const cData = await api.get('/system/companies');
      console.log('[DEBUG] Companies fetched:', cData?.length);
      setCompanies(cData || []);

      const uData = await api.get('/system/users');
      console.log('[DEBUG] Users fetched:', uData?.length, uData);
      setUsers(uData || []);

      if (activeTab === 'system') {
        const sData = await api.get('/system/info');
        setSystemInfo(sData);
      }
    } catch (error) {
      console.error('Data fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Company Actions
  const handleSaveCompany = async () => {
    try {
      if (editingCompany) {
        await api.put(`/system/companies/${editingCompany.id}`, companyForm);
        notify.success('Şirket Güncellendi', `${companyForm.name} başarıyla güncellendi.`);
      } else {
        await api.post('/system/companies', companyForm);
        notify.success('Şirket Eklendi', `${companyForm.name} sisteme kaydedildi.`);
      }
      setIsCompanyModalOpen(false);
      setEditingCompany(null);
      setCompanyForm({ name: '', sector: '' });
      fetchData();
    } catch (error) {
      notify.error('Hata', 'Şirket kaydedilemedi');
    }
  };

  const handleDeleteCompany = (id: string, name: string) => {
    setConfirmState({
      isOpen: true,
      type: 'danger',
      title: 'Şirketi Arşivle',
      message: `${name} şirketini pasife alıp arşivlemek istediğinize emin misiniz? Bu işlem şirketin sisteme girişini engeller.`,
      onConfirm: async () => {
        try {
          await api.put(`/system/companies/${id}`, { status: 'archived' });
          notify.success('Şirket Arşivlendi', 'Şirket başarıyla arşive taşındı.');
          fetchData();
        } catch (error) {
          notify.error('Hata', 'Şirket arşivlenemedi. Alternatif olarak durumunu pasife çekebilirsiniz.');
        }
      }
    });
  };

  // User Assignment Actions
  const toggleUserToCompany = async (userId: string, companyId: string | null) => {
    try {
      await api.put(`/system/users/${userId}`, { companyId });
      notify.success('Atama Güncellendi', 'Kullanıcı şirket ataması başarıyla değiştirildi.');
      fetchData();
    } catch (error) {
      notify.error('Hata', 'Kullanıcı ataması değiştirilemedi');
    }
  };

  // User Actions
  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await api.put(`/system/users/${editingUser.id}`, userForm);
        notify.success('Kullanıcı Güncellendi', `${userForm.fullName} başarıyla güncellendi.`);
      } else {
        if (!userForm.password) {
          notify.error('Hata', 'Yeni kullanıcı için şifre gereklidir');
          return;
        }
        await api.post('/system/users', userForm);
        notify.success('Kullanıcı Eklendi', `${userForm.fullName} sisteme kaydedildi.`);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({ fullName: '', email: '', password: '', role: 'user', companyId: '', status: 'active' });
      fetchData();
    } catch (error: any) {
      notify.error('Hata', 'Kullanıcı kaydedilemedi: ' + error.message);
    }
  };

  const handleDeleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (id === currentUser?.id) {
      notify.error('İşlem Engellendi', 'Kendi hesabınızı sistemden silemezsiniz.');
      return;
    }

    setConfirmState({
      isOpen: true,
      type: 'danger',
      title: 'Kullanıcıyı Arşivle',
      message: `${userToDelete?.fullName} isimli kullanıcıyı pasife alıp arşivlemek istediğinize emin misiniz?`,
      onConfirm: async () => {
        try {
          await api.put(`/system/users/${id}`, { status: 'archived' });
          notify.success('Kullanıcı Arşivlendi', 'Kullanıcı erişimi iptal edildi ve arşive taşındı.');
          fetchData();
        } catch (error) {
          notify.error('Hata', 'Kullanıcı arşivlenemedi.');
        }
      }
    });
  };


  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 opacity-40 bg-rose-500/10 p-3 rounded-2xl" />
        <h2 className="text-2xl font-black text-theme-main tracking-tight">Yetkisiz Erişim</h2>
        <p className="text-theme-muted mt-2 max-w-sm">Bu bölüme sadece Sosturer Sistem Yöneticileri erişebilir.</p>
      </div>
    );
  }

  const filteredCompanies = companies.filter(c => {
    const name = (c.name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search);
  });

  const filteredUsers = users.filter(u => {
    const name = (u.fullName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const paginatedCompanies = useMemo(() => {
    return filteredCompanies.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredCompanies, currentPage, pageSize]);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredUsers, currentPage, pageSize]);

  const pageCount = Math.ceil(
    (activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length) / pageSize
  );

  // Modal Computed Data
  const assignedUsers = editingCompany
    ? users.filter(u => {
      const match = String(u.companyId) === String(editingCompany.id);
      if (match) console.log('[DEBUG] Assigned User Match:', u.fullName, 'for', editingCompany.name);
      return match;
    })
    : [];


  const unassignedUsers = users.filter(u => !u.companyId && u.role !== 'superadmin');

  return (
    <div className="min-h-full bg-theme-base/30 p-8 space-y-8 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-theme/50 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-theme-primary/10 rounded-2xl border border-theme-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <ShieldCheck className="w-6 h-6 text-theme-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-black tracking-[0.1em] text-theme-primary uppercase leading-none">SİSTEM YÖNETİMİ</span>
              <span className="text-[11px] font-bold text-theme-muted/50 mt-1 tracking-widest">Erişim Kontrol Paneli</span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-theme-main tracking-tighter leading-tight">
            Sistem Yönetim <span className="text-gradient-indigo">Merkezi</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-theme-main/5 p-2 rounded-2xl border border-theme">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Özet" />
          <TabButton active={activeTab === 'companies'} onClick={() => setActiveTab('companies')} icon={Building2} label={`Şirketler (${companies.length})`} />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={Users} label={`Kullanıcılar (${users.length})`} />
          <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={Server} label="Altyapı" />
        </div>
      </div>

      {loading && activeTab === 'overview' ? <Loading /> : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Toplam Şirket" value={companies.length} icon={Building2} color="indigo" />
                <StatCard label="Global Kullanıcı" value={users.length || '--'} icon={Users} color="emerald" />
                <StatCard label="Sistem Sürümü" value="v1.0.4" icon={CheckCircle2} color="blue" />
                <StatCard label="Sunucu Durumu" value="Aktif" icon={Activity} color="rose" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-theme-surface/50 border border-theme rounded-2xl p-8">
                  <h3 className="text-xl font-black text-theme-main mb-6 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    Son Eklenen Şirketler
                  </h3>
                  <div className="space-y-4">
                    {companies.filter(c => c.id !== 'archived').slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-4 bg-theme-main/5 rounded-2xl border border-theme hover:bg-theme-main/10 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20 group-hover:scale-110 transition-transform">
                            <Building2 className="w-5 h-5 text-theme-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-theme-main">{c.name}</p>
                            <p className="text-[10px] text-theme-muted uppercase tracking-wider">{c.sector}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-theme-muted">{format(new Date(c.createdAt), 'dd MMM yyyy', { locale: tr })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-theme-surface/50 border border-theme rounded-2xl p-8">
                  <h3 className="text-xl font-black text-theme-main mb-6 flex items-center gap-3">
                    <Database className="w-5 h-5 text-emerald-400" />
                    Global Metrikler
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-theme-main/5 rounded-2xl border border-theme text-center">
                      <p className="text-3xl font-black text-theme-main mb-1">
                        {companies.reduce((acc, c) => acc + c._count.productionRecords, 0)}
                      </p>
                      <p className="text-[11px] font-black text-theme-muted uppercase tracking-[0.2em]">Toplam Veri Kaydı</p>
                    </div>
                    <div className="p-6 bg-theme-main/5 rounded-2xl border border-theme text-center">
                      <p className="text-3xl font-black text-theme-main mb-1">
                        {Math.round(companies.reduce((acc, c) => acc + c._count.productionRecords, 0) / (companies.length || 1))}
                      </p>
                      <p className="text-[11px] font-black text-theme-muted uppercase tracking-[0.2em]">Şirket Başına Veri</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'companies' || activeTab === 'users') && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 border border-theme px-2 py-2 rounded-2xl backdrop-blur-md sticky top-0 z-20 shadow-xl">
                <div className="flex items-center gap-4 flex-1">
                  <Search className="w-5 h-5 text-theme-muted" />
                  <input
                    type="text"
                    placeholder={activeTab === 'companies' ? "Şirket ara..." : "İsim veya e-posta ara..."}
                    className="bg-transparent border-none outline-none text-theme-main font-bold placeholder:text-theme-muted/50 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    if (activeTab === 'companies') {
                      setEditingCompany(null);
                      setCompanyForm({ name: '', sector: '' });
                      setIsCompanyModalOpen(true);
                    } else {
                      setEditingUser(null);
                      setUserForm({ fullName: '', email: '', password: '', role: 'user', companyId: '', status: 'active' });
                      setIsUserModalOpen(true);
                    }
                  }}
                  className="px-6 py-3 bg-theme-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {activeTab === 'companies' ? 'ŞİRKET EKLE' : 'KULLANICI EKLE'}
                </button>
              </div>

              <div className="bg-theme-surface border border-theme rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-main/5 border-b border-theme/50">
                      <th className="w-12 px-6 py-4">
                        <div
                          onClick={() => {
                            const data = activeTab === 'companies' ? filteredCompanies : filteredUsers;
                            if (selectedIds.size === data.length) setSelectedIds(new Set());
                            else setSelectedIds(new Set(data.map(i => i.id)));
                          }}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                            selectedIds.size === (activeTab === 'companies' ? filteredCompanies : filteredUsers).length ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                          )}
                        >
                          {selectedIds.size === (activeTab === 'companies' ? filteredCompanies : filteredUsers).length && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">{activeTab === 'companies' ? 'Şirket' : 'Kullanıcı'}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">{activeTab === 'companies' ? 'Sektör' : 'Şirket'}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">{activeTab === 'companies' ? 'Üye / Kayıt' : 'Rol'}</th>
                      <th className="px-6 py-4 text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">Durum</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme/30">
                    {activeTab === 'companies' ? (
                      paginatedCompanies.map(c => (
                        <tr
                          key={c.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, input, select, a, .cursor-pointer, [role="button"]')) return;
                            const newSelected = new Set(selectedIds);
                            if (newSelected.has(c.id)) newSelected.delete(c.id);
                            else newSelected.add(c.id);
                            setSelectedIds(newSelected);
                          }}
                          className={cn(
                            "hover:bg-theme-main/5 transition-colors group cursor-pointer",
                            selectedIds.has(c.id) && "bg-theme-primary/5"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                selectedIds.has(c.id) ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                              )}
                            >
                              {selectedIds.has(c.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20 group-hover:scale-110 transition-transform shrink-0">
                                <Building2 className="w-5 h-5 text-theme-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-theme-main truncate">{c.name}</p>
                                <p className="text-[10px] text-theme-muted truncate">{format(new Date(c.createdAt), 'dd.MM.yyyy')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-theme-main uppercase tracking-widest">{c.sector || '---'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[40px]">
                                <p className="text-sm font-black text-theme-main">{c._count.users}</p>
                                <p className="text-[8px] font-black text-theme-muted uppercase">ÜYE</p>
                              </div>
                              <div className="h-6 w-px bg-theme mx-2" />
                              <div className="text-center min-w-[40px]">
                                <p className="text-sm font-black text-theme-main">{c._count.productionRecords}</p>
                                <p className="text-[8px] font-black text-theme-muted uppercase">KAYIT</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                              <span className="text-[10px] font-black text-theme-main uppercase tracking-widest">AKTİF</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={async () => {
                                  setEditingCompany(c);
                                  setCompanyForm({ name: c.name, sector: c.sector || '' });
                                  setIsCompanyModalOpen(true);
                                  const uData = await api.get('/system/users');
                                  setUsers(uData || []);
                                }}
                                className="p-2 bg-theme-main/5 rounded-lg border border-theme hover:bg-theme-primary/10 text-theme-primary transition-all"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteCompany(c.id, c.name)}
                                className="p-2 bg-theme-main/5 rounded-lg border border-theme hover:bg-rose-500/10 text-rose-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      paginatedUsers.map(u => (
                        <tr
                          key={u.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, input, select, a, .cursor-pointer, [role="button"]')) return;
                            const newSelected = new Set(selectedIds);
                            if (newSelected.has(u.id)) newSelected.delete(u.id);
                            else newSelected.add(u.id);
                            setSelectedIds(newSelected);
                          }}
                          className={cn(
                            "hover:bg-theme-main/5 transition-colors group cursor-pointer",
                            selectedIds.has(u.id) && "bg-theme-primary/5"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                selectedIds.has(u.id) ? "bg-theme-primary border-theme-primary" : "border-theme-border/40 hover:border-theme-primary"
                              )}
                            >
                              {selectedIds.has(u.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-theme-base rounded-xl flex items-center justify-center border border-theme group-hover:border-theme-primary/30 transition-colors shrink-0">
                                <Users className="w-5 h-5 text-theme-muted group-hover:text-theme-primary transition-colors" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-theme-main truncate">{u.fullName}</p>
                                <p className="text-[10px] text-theme-muted truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-theme-main">{u.company?.name || '---'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === 'superadmin' ? 'bg-theme-primary/10 text-theme-primary' : 'bg-theme-main/5 text-theme-muted'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-theme-dim'}`} />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'active' ? 'text-theme-main' : 'text-theme-dim'}`}>
                                {u.status === 'active' ? 'AKTİF' : 'PASİF'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setUserForm({ fullName: u.fullName, email: u.email, password: '', role: u.role, companyId: u.companyId || '', status: u.status });
                                  setIsUserModalOpen(true);
                                }}
                                className="p-2 bg-theme-main/5 rounded-lg border border-theme hover:bg-emerald-500/10 text-emerald-400 transition-all"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-2 bg-theme-main/5 rounded-lg border border-theme hover:bg-rose-500/10 text-rose-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 order-2 md:order-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase tracking-widest">SAYFADA:</span>
                    <div className="w-24">
                      <CustomSelect
                        options={[
                          { id: 10, label: '10' },
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
                    Toplam <span className="text-theme-primary">
                      {activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length}
                    </span> Kayıt
                  </span>
                </div>

                <div className="flex items-center gap-3 order-1 md:order-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
                  >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-2xl">
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
                    className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
                  >
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && systemInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-theme-surface border border-theme rounded-2xl p-8 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                    <Server className="w-10 h-10 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-theme-main tracking-tight">Sunucu Parametreleri</h3>
                    <p className="text-theme-muted font-bold text-[10px] uppercase tracking-widest">Altyapı ve Sürümler</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <SystemRow label="Uygulama Sürümü" value={systemInfo.version} />
                  <SystemRow label="Yerel IP Adresi" value={systemInfo.ip} />
                  <SystemRow label="Sunucu Portu" value={systemInfo.port} />
                  <SystemRow label="İşletim Sistemi" value={systemInfo.os} />
                  <SystemRow label="Çalışma Süresi" value={`${Math.floor(systemInfo.uptime / 3600)} saat`} />
                </div>
              </div>

              <div className="bg-theme-surface border border-theme rounded-2xl p-8 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <Globe className="w-10 h-10 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-theme-main tracking-tight">Ağ ve Güvenlik</h3>
                    <p className="text-theme-muted font-bold text-[10px] uppercase tracking-widest">Bağlantı Ayarları</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-6 bg-theme-main/5 rounded-2xl border border-theme">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-theme-main">LAN Erişimi</p>
                        <p className="text-xs text-theme-muted">Diğer cihazların ağ üzerinden bağlanmasına izin ver</p>
                      </div>
                      <div className="w-12 h-6 bg-theme-primary rounded-full relative p-1 cursor-pointer">
                        <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-theme-main/5 rounded-2xl border border-theme">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-theme-main">Hata Günlüğü (Logging)</p>
                        <p className="text-xs text-theme-muted">Sunucu hatalarını logs klasöründe sakla</p>
                      </div>
                      <div className="w-12 h-6 bg-theme-primary rounded-full relative p-1 cursor-pointer">
                        <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Company Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-theme-base/40 animate-in fade-in duration-300">
          <div className="bg-theme-surface border border-theme w-auto max-w-6xl rounded-2xl shadow-2xl p-10 animate-in slide-in-from-bottom-10 duration-500 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-theme-primary/10 rounded-2xl">
                  <Building2 className="text-theme-primary" size={24} />
                </div>
                <h2 className="text-2xl font-black text-theme-main tracking-tight">
                  {editingCompany ? `${editingCompany.name} - Şirket Yönetimi` : 'Yeni Şirket Kaydı'}
                </h2>
              </div>
              <button onClick={() => setIsCompanyModalOpen(false)} className="p-2 hover:bg-theme-main/5 rounded-xl transition-all">
                <X size={24} className="text-theme-muted" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-10">
              <div className="min-w-90 lg:col-span-4 space-y-6">
                <h3 className="text-[11px] font-black text-theme-muted uppercase tracking-[0.2em] pb-2 border-b border-theme/50">Şirket Künyesi</h3>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">ŞİRKET ADI</label>
                  <input
                    type="text"
                    className="w-full bg-theme-base border border-theme rounded-2xl px-5 py-3 text-theme-main font-bold outline-none focus:border-theme-primary/50 transition-all text-sm"
                    value={companyForm.name}
                    onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">SEKTÖR</label>
                  <input
                    type="text"
                    className="w-full bg-theme-base border border-theme rounded-2xl px-5 py-3 text-theme-main font-bold outline-none focus:border-theme-primary/50 transition-all text-sm"
                    value={companyForm.sector}
                    onChange={e => setCompanyForm({ ...companyForm, sector: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleSaveCompany}
                  className="w-full py-4 bg-theme-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-xl transition-all"
                >
                  {editingCompany ? 'ŞİRKETİ GÜNCELLE' : 'ŞİRKETİ OLUŞTUR'}
                </button>
              </div>

              {editingCompany && (
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="min-w-110 bg-theme-main/5 rounded-2xl border border-theme p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-black text-theme-muted uppercase tracking-[0.2em]">Atanmış Kullanıcılar ({assignedUsers.length})</h3>
                      <div className="relative">
                        <button
                          onClick={() => setIsAssignPopupOpen(!isAssignPopupOpen)}
                          className="flex items-center gap-3 bg-theme-primary hover:bg-theme-primary-hover text-white text-[11px] font-black rounded-xl px-5 py-3 hover:shadow-2xl hover:shadow-theme-primary/30 transition-all uppercase tracking-[0.1em] active:scale-95 border border-theme-primary/10"
                        >
                          <Plus className="w-4 h-4" />
                          PERSONEL ATAMASI YAP
                        </button>

                        {isAssignPopupOpen && (
                          <div className="absolute top-full right-0 mt-3 w-80 bg-theme-card border border-theme rounded-2xl shadow-[0_30px_100px_-20px_rgba(0,0,0,0.5)] z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-300 ring-1 ring-white/10 backdrop-blur-3xl">
                            <div className="p-4 border-b border-theme bg-theme-surface/50">
                              <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
                                <input
                                  type="text"
                                  placeholder="EKİP ARKADAŞI ARA..."
                                  className="w-full bg-theme-base border border-theme rounded-xl pl-9 pr-4 py-3 text-[10px] font-black text-theme-main outline-none focus:border-theme-primary/50 uppercase tracking-widest placeholder:opacity-30"
                                  autoFocus
                                  value={assignSearch}
                                  onChange={e => setAssignSearch(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto no-scrollbar py-2">
                              {unassignedUsers.filter(u =>
                                u.fullName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                u.email.toLowerCase().includes(assignSearch.toLowerCase())
                              ).length === 0 ? (
                                <div className="py-10 text-center space-y-3 opacity-40">
                                  <Users className="w-8 h-8 mx-auto text-theme-dim" />
                                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest">PERSONEL BULUNAMADI</p>
                                </div>
                              ) : (
                                <div className="px-2 space-y-1">
                                  {unassignedUsers.filter(u =>
                                    u.fullName.toLowerCase().includes(assignSearch.toLowerCase()) ||
                                    u.email.toLowerCase().includes(assignSearch.toLowerCase())
                                  ).map(u => (
                                    <button
                                      key={u.id}
                                      onClick={() => {
                                        toggleUserToCompany(u.id, editingCompany.id);
                                        setIsAssignPopupOpen(false);
                                        setAssignSearch('');
                                      }}
                                      className="w-full flex items-center gap-4 p-3 hover:bg-theme-primary/10 rounded-2xl transition-all group/opt text-left border border-transparent hover:border-theme-primary/10"
                                    >
                                      <div className="w-10 h-10 rounded-xl bg-theme-base border border-theme flex items-center justify-center font-black text-theme-primary text-xs group-hover/opt:border-theme-primary/30 transition-all shadow-sm">
                                        {u.fullName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-theme-main truncate uppercase tracking-tight">{u.fullName}</p>
                                        <p className="text-[9px] text-theme-muted truncate font-bold">{u.email}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="p-4 bg-theme-surface/50 border-t border-theme">
                              <p className="text-[9px] font-black text-theme-dim text-center uppercase tracking-widest opacity-40">
                                ATAMAK İÇİN KULLANICI SEÇİNİZ
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>


                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {assignedUsers.length === 0 ? (
                        <p className="text-[11px] text-theme-muted italic text-center py-8">Bu şirkete atanmış kullanıcı bulunmuyor.</p>
                      ) : assignedUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-theme group/user">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-theme-main">{u.fullName}</p>
                              <p className="text-[9px] text-theme-muted uppercase">{u.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleUserToCompany(u.id, null)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover/user:opacity-100 transition-all"
                            title="İlişiği Kes"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className="bg-theme-surface border border-theme w-full max-w-2xl rounded-2xl shadow-2xl p-10 animate-in slide-in-from-bottom-10 duration-500 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-theme-primary/10 rounded-2xl">
                  <Users className="text-theme-primary" size={24} />
                </div>
                <h2 className="text-2xl font-black text-theme-main tracking-tight">
                  {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Global Kullanıcı'}
                </h2>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-theme-main/10 rounded-xl transition-all">
                <X size={24} className="text-theme-muted" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">AD SOYAD</label>
                  <input
                    type="text"
                    className="w-full bg-theme-base border border-theme rounded-2xl px-5 py-3 text-theme-main font-bold outline-none focus:border-theme-primary/40 transition-all"
                    value={userForm.fullName}
                    onChange={e => setUserForm({ ...userForm, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">E-POSTA</label>
                  <input
                    type="email"
                    className="w-full bg-theme-base border border-theme rounded-2xl px-5 py-3 text-theme-main font-bold outline-none focus:border-theme-primary/40 transition-all"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">ŞİFRE {editingUser && '(Değiştirmek için yazın)'}</label>
                  <input
                    type="password"
                    className="w-full bg-theme-base border border-theme rounded-2xl px-5 py-3 text-theme-main font-bold outline-none focus:border-theme-primary/40 transition-all"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">ŞİRKET ATAMASI</label>
                  <CustomSelect
                    options={[
                      { id: '', label: 'Bağımsız (Şirketsiz)' },
                      ...companies.map(c => ({ id: c.id, label: c.name }))
                    ]}
                    value={userForm.companyId}
                    onChange={(val) => setUserForm({ ...userForm, companyId: val })}
                    searchable={true}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">YETKİ SEVİYESİ</label>
                  <CustomSelect
                    options={[
                      { id: 'user', label: 'Kullanıcı' },
                      { id: 'admin', label: 'Şirket Admini' },
                      { id: 'superadmin', label: 'Sistem Admini' }
                    ]}
                    value={userForm.role}
                    onChange={(val) => setUserForm({ ...userForm, role: val })}
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2 block">HESAP DURUMU</label>
                  <CustomSelect
                    options={[
                      { id: 'active', label: 'Aktif' },
                      { id: 'inactive', label: 'Pasif' },
                      { id: 'archived', label: 'Arşivlendi' }
                    ]}
                    value={userForm.status}
                    onChange={(val) => setUserForm({ ...userForm, status: val })}
                    searchable={false}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveUser}
              className="w-full mt-10 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-xl transition-all shadow-lg shadow-theme-primary/10"
            >
              {editingUser ? 'DEĞİŞİKLİKLERİ KAYDET' : 'KULLANICIYI OLUŞTUR'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmLabel="Evet, Sil"
        cancelLabel="Vazgeç"
      />
      <BulkActionBar
        selectedCount={selectedIds.size}
        isEditing={false}
        onSave={() => { }}
        onEditToggle={() => { }}
        onStatusUpdate={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        onCancel={() => setSelectedIds(new Set())}
      />
    </div>
  );
}


function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${active ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20 scale-105' : 'text-theme-muted hover:text-theme-main hover:bg-white/5'}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/5',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5',
  };

  return (
    <div className={`p-6 rounded-2xl border bg-theme-surface shadow-xl transition-all hover:scale-[1.02] ${colors[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white/10 rounded-2xl">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-2xl font-black text-theme-main">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
    </div>
  );
}

function SystemRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-theme/30">
      <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">{label}</span>
      <span className="text-xs font-mono font-bold text-theme-main bg-white/5 px-3 py-1 rounded-lg">{value}</span>
    </div>
  );
}
