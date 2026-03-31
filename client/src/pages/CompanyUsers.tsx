import { useState, useEffect } from 'react';
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
  XCircle
} from 'lucide-react';

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
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', fullName: '', role: 'user', password: '' });

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

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'admin') {
    return (
      <div className="p-10 text-center">
        <Shield className="w-16 h-16 text-theme-danger mx-auto mb-4" />
        <h2 className="text-2xl font-black text-theme-main">Yetkisiz Erişim</h2>
        <p className="text-theme-muted">Bu sayfayı görüntülemek için yönetici yetkisine sahip olmalısınız.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-theme-card border border-theme p-8 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center shadow-xl shadow-theme-primary/10">
            <Users className="w-8 h-8 text-theme-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-theme-main tracking-tight">Ekip Yönetimi</h1>
            <p className="text-theme-muted text-xs font-bold uppercase tracking-[0.2em]">Şirket Çalışanlarını ve Yetkilerini Yönetin</p>
          </div>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-3 px-8 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-2xl shadow-xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20"
        >
          <UserPlus size={20} /> YENİ KİŞİ EKLE
        </button>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-theme-dim group-focus-within:text-theme-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="İsim veya e-posta ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-theme-card/80 border border-theme rounded-2xl pl-14 pr-6 py-4 text-theme-main placeholder:text-theme-muted focus:outline-none focus:border-theme-primary/50 transition-all shadow-xl"
            />
          </div>
        </div>
        <div className="lg:col-span-4 flex gap-4">
          <div className="flex-1 bg-theme-card border border-theme p-4 rounded-2xl flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-theme-primary">{users.length}</span>
            <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">TOPLAM EKİP</span>
          </div>
          <div className="flex-1 bg-theme-card border border-theme p-4 rounded-2xl flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-emerald-500">{users.filter(u => u.status === 'active').length}</span>
            <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">AKTİF</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-theme-card border border-theme rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-primary/5 border-b border-theme">
                <th className="px-8 py-5 text-[11px] font-black text-theme-muted uppercase tracking-widest">Kullanıcı</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-muted uppercase tracking-widest">Rol</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-muted uppercase tracking-widest">Durum</th>
                <th className="px-8 py-5 text-[11px] font-black text-theme-muted uppercase tracking-widest text-right">Eylemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center">
                    <div className="w-8 h-8 border-3 border-theme-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-theme-muted font-bold italic">Kullanıcı bulunamadı.</td>
                </tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-theme-surface/50 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-theme-primary/10 border border-theme-primary/20 flex items-center justify-center text-theme-primary font-black text-xl shadow-lg group-hover:scale-105 transition-transform">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-theme-main group-hover:text-theme-primary transition-colors">{u.fullName}</p>
                        <p className="text-xs font-bold text-theme-dim">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
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
                  <td className="px-8 py-5">
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
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2.5 rounded-xl bg-theme-surface border border-theme text-theme-dim hover:text-white hover:bg-theme-danger hover:border-theme-danger transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2.5 rounded-xl bg-theme-surface border border-theme text-theme-dim hover:text-theme-primary transition-all">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className="bg-theme-card border border-theme w-full max-w-lg rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden scale-in animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-8 border-b border-theme flex items-center justify-between bg-theme-primary/5">
              <div className="flex items-center gap-4">
                <UserPlus className="text-theme-primary" size={24} />
                <h2 className="text-xl font-black text-theme-main">Yeni Ekip Üyesi Atayın</h2>
              </div>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-theme-surface rounded-xl text-theme-dim hover:text-white transition-all">
                <XCircle size={24} />
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
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all"
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
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all"
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
                    className="w-full bg-theme-form border border-theme rounded-xl px-4 py-3 text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 block">YETKİ SEVİYESİ</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setInviteData(prev => ({ ...prev, role: 'user' }))}
                      className={`p-4 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-2 ${inviteData.role === 'user' ? 'bg-theme-primary/10 border-theme-primary text-theme-primary' : 'bg-theme-surface border-theme text-theme-dim hover:border-theme-primary/30'}`}
                    >
                      <UserCheck size={20} />
                      STANDART PERSONEL
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteData(prev => ({ ...prev, role: 'admin' }))}
                      className={`p-4 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-2 ${inviteData.role === 'admin' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-theme-surface border-theme text-theme-dim hover:border-purple-500/30'}`}
                    >
                      <ShieldCheck size={20} />
                      YÖNETİCİ
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 px-6 py-4 border border-theme text-theme-main font-black rounded-2xl hover:bg-theme-surface transition-all">İPTAL</button>
                <button type="submit" className="flex-2 px-10 py-4 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-2xl shadow-xl shadow-theme-primary/20 transition-all active:scale-95 border border-theme-primary/20">DAVETİ GÖNDER & KAYDET</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
