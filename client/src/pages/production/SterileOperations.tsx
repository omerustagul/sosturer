import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ShieldCheck, Plus, Search, RefreshCw, ChevronLeft, ChevronRight,
  Trash2, Edit2, FileText, ExternalLink, User, Calendar
} from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';
import { SterileOperationForm } from './SterileOperationForm';

const statusOptions = [
  { id: 'all', label: 'Tüm Durumlar' },
  { id: 'Draft', label: 'Taslak' },
  { id: 'Completed', label: 'Tamamlandı' },
  { id: 'Cancelled', label: 'İptal Edildi' }
];

const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('tr-TR');

export function SterileOperations() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [processTypes, setProcessTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingProcess, setEditingProcess] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, typeRes] = await Promise.all([
        api.get('/sterile-processes'),
        api.get('/sterile-process-types')
      ]);
      setProcesses(Array.isArray(processRes) ? processRes : []);
      setProcessTypes(Array.isArray(typeRes) ? typeRes : []);
    } catch (error) {
      notify.error('Veri Alınamadı', 'Steril işlemler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProcesses = useMemo(() => {
    const search = normalize(searchTerm.trim());
    return processes.filter((item) => {
      const matchesSearch = !search ||
        normalize(item.processNo).includes(search) ||
        normalize(item.type?.name).includes(search) ||
        normalize(item.personnelName).includes(search) ||
        normalize(item.documentName).includes(search) ||
        item.items?.some((i: any) => normalize(i.productionOrder?.lotNumber).includes(search));

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.typeId === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [processes, searchTerm, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProcesses.length / pageSize));
  const paginatedProcesses = filteredProcesses.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu steril işlem listesini silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/sterile-processes/${id}`);
      notify.success('Silindi', 'Steril işlem listesi kaldırıldı.');
      fetchData();
    } catch (error: any) {
      notify.error('Silinemedi', error.message || 'İşlem başarısız.');
    }
  };

  const handleEdit = (process: any) => {
    setEditingProcess(process);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingProcess(null);
    setShowForm(true);
  };

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-theme-main tracking-tight uppercase">STERİL İŞLEMLER</h1>
          <p className="text-xs font-bold text-theme-muted mt-0.5">Süreç Takibi ve Lot Yönetimi</p>
        </div>
        <button
          onClick={handleAddNew}
          className="px-6 py-3 bg-theme-primary text-white rounded-xl font-black text-xs tracking-[0.2em] transition-all flex items-center gap-2 shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover active:scale-95"
        >
          <Plus className="w-4 h-4 mb-0.5" /> YENİ LİSTE OLUŞTUR
        </button>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-theme bg-theme-base/20 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="No, Tip, Personel veya Lot Ara..."
                className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-theme-primary/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl h-10">
                <CustomSelect
                  variant="inline"
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Durum"
                />
                <div className="w-px h-5 bg-theme/30 mx-1" />
                <CustomSelect
                  variant="inline"
                  options={[{ id: 'all', label: 'Tüm Tipler' }, ...processTypes.map(t => ({ id: t.id, label: t.name }))]}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="İşlem Tipi"
                />
              </div>

              <button
                onClick={fetchData}
                className="h-10 px-4 rounded-xl border border-theme bg-theme-surface text-theme-muted hover:text-theme-primary hover:bg-theme-main/5 flex items-center gap-2 text-xs font-bold transition-all shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[100px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-theme-base/40 border-b border-theme">
              <tr className="text-[10px] font-black text-theme-muted">
                <th className="px-4 py-4 text-center w-16">No</th>
                <th className="px-4 py-4">İşlem Türü</th>
                <th className="px-4 py-4">İşlem Tarihi</th>
                <th className="px-4 py-4">Personel</th>
                <th className="px-4 py-4">İlişkili Lotlar</th>
                <th className="px-4 py-4">Dökümantasyon</th>
                <th className="px-4 py-4 text-center">Durum</th>
                <th className="px-4 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-32 text-center">
                    <Loading size="lg" />
                    <p className="text-xs font-bold text-theme-dim mt-4 uppercase tracking-widest animate-pulse">Veriler Yükleniyor...</p>
                  </td>
                </tr>
              ) : paginatedProcesses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center opacity-20">
                    <div className="flex flex-col items-center justify-center p-20">
                      <ShieldCheck className="w-12 h-12 mb-4 text-theme-muted" />
                      <p className="font-black text-lg tracking-tight">Steril işlem kaydı bulunamadı.</p>
                      <p className="text-xs font-bold mt-2">Arama kriterlerini değiştirin veya yeni bir liste oluşturun.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProcesses.map((process) => (
                  <tr key={process.id} className="group hover:bg-theme-primary/5 transition-all duration-300">
                    <td className="px-4 py-5">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-theme-primary font-mono tracking-tighter bg-theme-primary/5 px-2 py-1 rounded-lg border border-theme-primary/10">{process.processNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-7 rounded-full bg-theme-primary shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.3)]" />
                        <span className="text-[12px] font-bold text-theme-main">{process.type?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-theme-main font-bold text-xs">
                          <Calendar className="w-3.5 h-3.5 text-theme-primary" />
                          {process.processDate ? format(new Date(process.processDate), 'dd.MM.yyyy') : '-'}
                        </div>
                        <div className="text-[10px] text-theme-muted font-bold ml-5">
                          {process.processDate ? format(new Date(process.processDate), 'HH:mm') : '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-theme-base border border-theme flex items-center justify-center shadow-inner group-hover:border-theme-primary/30 transition-colors">
                          <User className="w-4 h-4 text-theme-dim group-hover:text-theme-primary transition-colors" />
                        </div>
                        <span className="text-xs font-bold text-theme-main uppercase tracking-tight">{process.personnelName || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-wrap gap-2 max-w-[320px]">
                        {process.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex flex-col px-2.5 py-1.5 rounded-xl bg-theme-base/60 border border-theme shadow-sm hover:border-theme-primary/30 transition-colors">
                            <span className="text-[10px] font-black text-theme-primary uppercase leading-none mb-1">{item.productionOrder?.lotNumber}</span>
                            <span className="text-[9px] font-bold text-theme-muted truncate max-w-[140px] uppercase">{item.productionOrder?.product?.productName}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      {process.documentUrl ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={process.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-theme-primary/5 text-theme-primary hover:bg-theme-primary hover:text-white transition-all border border-theme-primary/10 group/btn shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{process.documentName || 'BELGE'}</span>
                            <ExternalLink className="w-3 h-3 opacity-50 group-hover/btn:opacity-100" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[11px] font-black text-theme-dim opacity-30">Belge Yok</span>
                      )}
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="flex justify-center">
                        <div className={`
                          px-3 py-1.5 rounded-lg border flex items-center gap-2 shadow-sm
                          ${process.status === 'Completed' ? 'bg-theme-success/5 border-theme-success/20 text-theme-success' :
                            process.status === 'Cancelled' ? 'bg-theme-danger/5 border-theme-danger/20 text-theme-danger' :
                              'bg-theme-warning/5 border-theme-warning/20 text-theme-warning'}
                        `}>
                          <div className={`w-1.5 h-1.5 rounded-full ${process.status === 'Completed' ? 'bg-theme-success' :
                            process.status === 'Cancelled' ? 'bg-theme-danger' :
                              'bg-theme-warning animate-pulse'}
                          `} />
                          <span className="text-[9px] font-black uppercase tracking-widest">
                            {process.status === 'Completed' ? 'TAMAMLANDI' : process.status === 'Cancelled' ? 'İPTAL EDİLDİ' : 'TASLAK'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex justify-end gap-2 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => handleEdit(process)}
                          className="p-2.5 bg-theme-surface border border-theme text-theme-dim hover:text-theme-primary hover:border-theme-primary/40 rounded-xl transition-all disabled:opacity-20 shadow-sm hover:shadow-lg hover:shadow-theme-primary/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(process.id)}
                          className="p-2.5 bg-theme-surface border border-theme text-theme-dim hover:text-theme-danger hover:border-theme-danger/40 rounded-xl transition-all shadow-sm hover:shadow-lg hover:shadow-theme-danger/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-theme flex flex-col md:flex-row items-center justify-between bg-theme-surface/30 gap-6">
          <div className="flex flex-wrap items-center gap-6 order-2 md:order-1">
            <p className="text-[11px] font-black text-theme-muted whitespace-nowrap">
              {filteredProcesses.length} Kayıt Bulundu
            </p>
            <div className="h-4 w-px bg-theme hidden md:block" />
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
              <div className="min-w-fit">
                <CustomSelect fullWidth={false} options={[{ id: 10, label: '10' }, { id: 20, label: '20' }, { id: 50, label: '50' }, { id: 100, label: '100' }]} value={pageSize} onChange={value => setPageSize(Number(value))} searchable={false} placeholder="Seç" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border rounded-2xl">
              <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                {currentPage + 1}
              </span>
              <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
              <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                {pageCount || 1}
              </span>
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1 || pageCount === 0}
              className="w-9 h-9 p-2 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
            >
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {
        showForm && (
          <SterileOperationForm
            process={editingProcess}
            onClose={() => setShowForm(false)}
            onSave={() => {
              setShowForm(false);
              fetchData();
            }}
            processTypes={processTypes}
          />
        )
      }
    </div >
  );
}
