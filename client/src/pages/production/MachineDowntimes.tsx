import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Clock, Plus, Trash2, Edit, Search, Filter,
  ChevronLeft, ChevronRight, Factory, AlertCircle,
  User, Calendar, List, X, CheckCircle2, MoreVertical
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { notify } from '../../store/notificationStore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function MachineDowntimes() {
  const [data, setData] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    status: 'active'
  });

  // Pagination
  const [pageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [downtimesRes, machinesRes, reasonsRes, operatorsRes, shiftsRes, ordersRes] = await Promise.all([
        api.get('/machine-downtimes').catch(() => []),
        api.get('/machines').catch(() => []),
        api.get('/downtime-reasons').catch(() => []),
        api.get('/operators?is_operator=true').catch(() => []),
        api.get('/shifts').catch(() => []),
        api.get('/production-orders').catch(() => [])
      ]);
      setData(Array.isArray(downtimesRes) ? downtimesRes : []);
      setMachines(Array.isArray(machinesRes) ? machinesRes : []);
      setReasons(Array.isArray(reasonsRes) ? reasonsRes : []);
      setOperators(Array.isArray(operatorsRes) ? operatorsRes : []);
      setShifts(Array.isArray(shiftsRes) ? shiftsRes : []);
      setProductionOrders(Array.isArray(ordersRes) ? ordersRes : []);
    } catch (error) {
      console.error('Error fetching machine downtimes:', error);
      notify.error('Hata', 'Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item =>
      item.machine?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const paginatedData = useMemo(() => {
    return filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/machine-downtimes/${formData.id}`, formData);
        notify.success('Güncellendi', 'Duruş kaydı başarıyla güncellendi.');
      } else {
        await api.post('/machine-downtimes', formData);
        notify.success('Kaydedildi', 'Yeni duruş kaydı oluşturuldu.');
      }
      setShowAddForm(false);
      fetchData();
    } catch (error: any) {
      notify.error('Hata', error.response?.data?.error || 'Kayıt sırasında bir hata oluştu.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu duruş kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/machine-downtimes/${id}`);
      notify.success('Silindi', 'Kayıt silindi.');
      fetchData();
    } catch (error) {
      notify.error('Hata', 'Silme işlemi başarısız oldu.');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      ...item,
      startTime: item.startTime ? format(new Date(item.startTime), "yyyy-MM-dd'T'HH:mm") : '',
      endTime: item.endTime ? format(new Date(item.endTime), "yyyy-MM-dd'T'HH:mm") : ''
    });
    setIsEditing(true);
    setShowAddForm(true);
  };

  const totalPages = Math.ceil(filteredData.length / pageSize);

  return (
    <div className="h-[calc(100vh-64px)] p-6 flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-theme-primary/10 rounded-2xl flex items-center justify-center text-theme-primary shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-theme-main tracking-tight uppercase">MAKİNE DURUŞLARI</h1>
            <p className="text-xs font-bold text-theme-muted mt-0.5">Üretim hattındaki makine duruş kayıtlarını yönetin ve izleyin.</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({
              startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
              status: 'active'
            });
            setIsEditing(false);
            setShowAddForm(true);
          }}
          className="bg-theme-primary hover:bg-theme-primary-hover text-white px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-2.5 group active:scale-95 uppercase tracking-wider"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> DURUŞ KAYDET
        </button>
      </div>

      {/* Stats & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="modern-glass-card p-4 flex items-center gap-4 border-theme-primary/10">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest">TOPLAM DURUŞ</p>
            <p className="text-xl font-black text-theme-main">{data.length}</p>
          </div>
        </div>
        <div className="modern-glass-card p-4 flex items-center gap-4 border-theme-primary/10">
          <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest">AKTİF DURUŞLAR</p>
            <p className="text-xl font-black text-theme-main">{data.filter(d => !d.endTime).length}</p>
          </div>
        </div>
        <div className="md:col-span-2 modern-glass-card p-2 flex items-center gap-2 border-theme-primary/5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Makine, sebep veya açıklama ara..."
              className="w-full h-12 bg-theme-base/20 border-0 rounded-xl pl-11 pr-4 text-xs font-bold text-theme-main placeholder:text-theme-dim/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
            />
          </div>
          <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-theme-base/30 text-theme-dim hover:text-theme-main transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 min-h-0 bg-theme-surface/30 backdrop-blur-md rounded-3xl border border-theme flex flex-col overflow-hidden shadow-2xl relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-theme-surface/60 backdrop-blur-sm">
            <Loading size="lg" />
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-theme-base/90 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Makine</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Duruş Sebebi</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Başlangıç</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Bitiş</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Süre</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20">Operatör / Vardiya</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim border-b border-theme/20 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {paginatedData.length > 0 ? paginatedData.map((item) => {
                const duration = item.endTime && item.startTime
                  ? Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000)
                  : null;

                return (
                  <tr key={item.id} className="group hover:bg-theme-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-theme-primary/10 flex items-center justify-center text-theme-primary">
                          <Factory className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-theme-main uppercase">{item.machine?.name || 'BELİRSİZ'}</p>
                          <p className="text-[10px] font-bold text-theme-dim uppercase">{item.machine?.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-theme-main uppercase">{item.reason?.name || 'BELİRSİZ'}</span>
                        {item.notes && <p className="text-[10px] text-theme-dim line-clamp-1">{item.notes}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-theme-main">
                        <Calendar className="w-3.5 h-3.5 text-theme-dim" />
                        <span className="text-xs font-mono">{item.startTime ? format(new Date(item.startTime), 'dd.MM HH:mm') : '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {item.endTime ? (
                          <>
                            <Calendar className="w-3.5 h-3.5 text-theme-dim" />
                            <span className="text-xs font-mono text-theme-main">{format(new Date(item.endTime), 'dd.MM HH:mm')}</span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-black animate-pulse uppercase">DEVAM EDİYOR</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {duration !== null ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-theme-dim" />
                          <span className="text-xs font-black text-theme-main">{duration} DK</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-theme-main font-bold">
                          <User className="w-3 h-3 text-theme-dim" />
                          {item.operator?.fullName || '-'}
                        </div>
                        <div className="text-[10px] text-theme-dim font-black uppercase">
                          {item.shift?.shiftName || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(item)} className="p-2 bg-theme-base/50 text-theme-dim rounded-xl hover:bg-theme-primary hover:text-white transition-all shadow-sm"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-theme-base/50 text-theme-dim rounded-xl hover:bg-theme-danger hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 p-16 text-theme-dim opacity-20">
                      <Clock className="w-12 h-12" />
                      <p className="text-xs font-black">Kayıtlı duruş bulunamadı</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-theme-base/20 border-t border-theme flex items-center justify-between shrink-0">
          <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest">
            TOPLAM <span className="text-theme-main">{filteredData.length}</span> KAYIT
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-xl bg-theme-surface border border-theme text-theme-dim hover:text-theme-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-theme-main px-4 py-2 bg-theme-primary/10 rounded-xl">
              {currentPage + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-xl bg-theme-surface border border-theme text-theme-dim hover:text-theme-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-theme-base/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowAddForm(false)} />
          <div className="relative w-full max-w-2xl bg-theme-card border border-theme rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-theme">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center text-theme-primary">
                  {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-theme-main uppercase tracking-tight">{isEditing ? 'DURUŞU DÜZENLE' : 'YENİ DURUŞ KAYDI'}</h3>
                  <p className="text-[10px] font-bold text-theme-dim">Makine duruş detaylarını girin.</p>
                </div>
              </div>
              <button onClick={() => setShowAddForm(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-theme-base/10 text-theme-dim hover:bg-theme-danger hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">MAKİNE</label>
                  <CustomSelect
                    options={machines.map(m => ({ id: m.id, label: m.name, subLabel: m.code }))}
                    value={formData.machineId || ''}
                    onChange={(val) => setFormData({ ...formData, machineId: val })}
                    placeholder="Makine Seçin"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">DURUŞ SEBEBİ</label>
                  <CustomSelect
                    options={reasons.map(r => ({ id: r.id, label: r.name, subLabel: r.code }))}
                    value={formData.reasonId || ''}
                    onChange={(val) => setFormData({ ...formData, reasonId: val })}
                    placeholder="Sebep Seçin"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">BAŞLANGIÇ ZAMANI</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="form-input h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">BİTİŞ ZAMANI (OPSİYONEL)</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime || ''}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="form-input h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">OPERATÖR</label>
                  <CustomSelect
                    options={operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))}
                    value={formData.operatorId || ''}
                    onChange={(val) => setFormData({ ...formData, operatorId: val })}
                    placeholder="Operatör Seçin"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">VARDİYA</label>
                  <CustomSelect
                    options={shifts.map(s => ({ id: s.id, label: s.shiftName, subLabel: `${s.startTime}-${s.endTime}` }))}
                    value={formData.shiftId || ''}
                    onChange={(val) => setFormData({ ...formData, shiftId: val })}
                    placeholder="Vardiya Seçin"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">BAĞLI ÜRETİM EMRİ (OPSİYONEL)</label>
                  <CustomSelect
                    options={productionOrders.map(o => ({ id: o.id, label: o.lotNumber, subLabel: o.product?.productName }))}
                    value={formData.productionOrderId || ''}
                    onChange={(val) => setFormData({ ...formData, productionOrderId: val })}
                    placeholder="İş Emri Seçin"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase ml-1">NOTLAR / AÇIKLAMA</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input min-h-[80px] py-3"
                    placeholder="Duruş ile ilgili detaylı bilgi..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-theme sticky bottom-0 bg-theme-card">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2.5 text-xs font-black text-theme-dim border border-theme rounded-xl hover:bg-theme-main/10 transition-all uppercase tracking-widest active:scale-95"
                >
                  İPTAL
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 text-xs font-black text-white bg-theme-primary rounded-xl hover:bg-theme-primary-hover transition-all shadow-xl shadow-theme-primary/20 uppercase tracking-widest active:scale-95"
                >
                  {isEditing ? 'GÜNCELLE' : 'DURUŞU KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
