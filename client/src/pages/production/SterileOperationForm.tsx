import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Save, ShieldCheck, FileText,
  Trash2, Plus, AlertCircle, Info, Package, UploadCloud,
  Calendar, ClipboardCheck, History, RefreshCw, Layers, CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { api } from '../../lib/api';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { notify } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

interface SterileOperationFormProps {
  process: any;
  onClose: () => void;
  onSave: () => void;
  processTypes: any[];
}

export function SterileOperationForm({ process, onClose, onSave, processTypes }: SterileOperationFormProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [eligibleLots, setEligibleLots] = useState<any[]>([]);
  const [fetchingLots, setFetchingLots] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState<any>({
    personnelName: user?.fullName || '',
    documentName: '',
    documentUrl: '',
    notes: '',
    status: 'Draft',
    items: [],
    ...process,
    typeId: process?.typeId || '',
    processDate: process?.processDate ? new Date(process.processDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
  });

  const fetchEligibleLots = async () => {
    setFetchingLots(true);
    try {
      const res = await api.get('/sterile-processes/eligible-lots');
      setEligibleLots(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Eligible lots error:', error);
    } finally {
      setFetchingLots(false);
    }
  };

  useEffect(() => {
    fetchEligibleLots();
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/company/users');
        setUsers(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error('Fetch users error:', error);
      }
    };
    fetchUsers();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    setUploading(true);
    try {
      const res = await api.upload('/system/upload', uploadData);
      if (res.url) {
        setFormData((prev: any) => ({
          ...prev,
          documentUrl: res.url,
          documentName: prev.documentName || file.name
        }));
        notify.success('Başarılı', 'Belge yüklendi.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      notify.error('Hata', 'Belge yüklenirken bir hata oluştu.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent, isComplete: boolean = false) => {
    e.preventDefault();
    if (!formData.typeId) {
      notify.error('Hata', 'Lütfen işlem türü seçin.');
      return;
    }
    if (formData.items.length === 0) {
      notify.error('Hata', 'Lütfen en az bir lot ekleyin.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        status: isComplete ? 'Completed' : 'Draft'
      };

      if (process?.id) {
        await api.put(`/sterile-processes/${process.id}`, payload);
      } else {
        await api.post('/sterile-processes', payload);
      }

      notify.success('Başarılı', isComplete ? 'İşlem tamamlandı ve lotlar sterilize edildi.' : 'Kayıt taslak olarak saklandı.');
      onSave();
    } catch (error: any) {
      notify.error('Hata', error.message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (lot: any) => {
    if (formData.items.some((i: any) => i.productionOrderId === lot.id)) {
      notify.warning('Uyarı', 'Bu lot zaten listede ekli.');
      return;
    }
    setFormData({
      ...formData,
      items: [...formData.items, { productionOrderId: lot.id, productionOrder: lot }]
    });
  };

  const removeItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i: any) => i.productionOrderId !== id)
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-theme-main/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-7xl bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-theme bg-theme-base/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-theme-primary/10 flex items-center justify-center text-theme-primary shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main tracking-tight uppercase leading-none mt-1">
                {process?.id ? `DÜZENLE: ${process.processNo}` : 'YENİ STERİL LİSTESİ'}
              </h3>
              <p className="text-theme-muted text-[10px] font-bold mt-0.75 flex items-center gap-1">
                <History className="w-3 h-3" /> {process?.id ? 'Mevcut Süreç Güncelleme' : 'Yeni sterilizasyon süreci başlatılıyor'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-theme-main/5 text-theme-muted rounded-xl transition-all active:scale-90 group">
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-theme-base/5">
          {/* Top Row: Info & Docs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* General Info */}
            <div className="p-4 bg-theme-surface border border-theme rounded-2xl space-y-4 shadow-sm">
              <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2 border-b border-theme pb-2">
                <Info className="w-3.5 h-3.5" /> Genel Bilgiler
              </h4>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İşlem Türü</label>
                  <CustomSelect
                    options={processTypes.map(t => ({ id: t.id, label: t.name }))}
                    value={formData.typeId}
                    onChange={(val) => setFormData({ ...formData, typeId: val })}
                    placeholder="Tür Seçin..."
                    variant="inline"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İşlem Tarihi</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
                    <input
                      type="datetime-local"
                      value={formData.processDate}
                      onChange={(e) => setFormData({ ...formData, processDate: e.target.value })}
                      className="form-input h-9 pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Sorumlu Personel</label>
                  <CustomSelect
                    options={users.map(u => ({ id: u.fullName, label: u.fullName, subLabel: u.operator?.role?.name || u.role }))}
                    value={formData.personnelName}
                    onChange={(val) => setFormData({ ...formData, personnelName: val })}
                    placeholder="Personel Seçin..."
                    searchable={true}
                    variant="inline"
                  />
                </div>
              </div>
            </div>

            {/* Documentation */}
            <div className="p-4 bg-theme-surface border border-theme rounded-2xl space-y-4 shadow-sm">
              <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2 border-b border-theme pb-2">
                <FileText className="w-3.5 h-3.5" /> Dökümantasyon
              </h4>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Belge Tanımı</label>
                  <input
                    value={formData.documentName}
                    onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                    className="form-input h-9 text-xs"
                    placeholder="Sertifika, Test Raporu vb."
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="relative group overflow-hidden">
                    <div className={cn(
                      "h-16 flex flex-row items-center justify-center gap-3 bg-theme-base/20 border-2 border-theme border-dashed rounded-xl cursor-pointer transition-all duration-300",
                      formData.documentUrl ? "border-theme-success/30 bg-theme-success/5" : "hover:bg-theme-primary/5 hover:border-theme-primary/50"
                    )}>
                      {uploading ? <RefreshCw className="w-4 h-4 animate-spin text-theme-primary" /> : <UploadCloud className="w-4 h-4 text-theme-muted group-hover:text-theme-primary" />}
                      <div className="text-left">
                        <p className="text-[10px] font-black text-theme-main uppercase leading-none">{uploading ? 'Yükleniyor...' : formData.documentUrl ? 'Dosya Hazır' : 'Dosya Seç'}</p>
                        <p className="text-[8px] font-bold text-theme-muted uppercase mt-1">PDF veya Görsel</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.png,.jpg,.jpeg" />
                  </label>

                  {formData.documentUrl && (
                    <div className="flex items-center justify-between p-2 bg-theme-base/30 border border-theme rounded-lg">
                      <span className="text-[10px] font-bold text-theme-main truncate max-w-[150px] uppercase">{formData.documentName || 'Belge'}</span>
                      <div className="flex gap-1">
                        <a href={formData.documentUrl} target="_blank" rel="noreferrer" className="p-1.5 text-theme-primary hover:bg-theme-primary/10 rounded-md"><ExternalLink size={14} /></a>
                        <button type="button" onClick={() => setFormData({ ...formData, documentUrl: '', documentName: '' })} className="p-1.5 text-theme-danger hover:bg-theme-danger/10 rounded-md"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="p-4 bg-theme-surface border border-theme rounded-2xl space-y-4 shadow-sm">
              <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2 border-b border-theme pb-2">
                <ClipboardCheck className="w-3.5 h-3.5" /> Süreç Notları
              </h4>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="form-input min-h-[105px] py-2 text-xs resize-none"
                placeholder="Ek bilgiler..."
              />
            </div>
          </div>

          {/* Bottom Row: Lot Selection & Selected List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lot Selection (Left) */}
            <div className="p-4 bg-theme-surface border border-theme rounded-2xl space-y-4 shadow-sm flex flex-col min-h-[400px]">
              <div className="flex justify-between items-center border-b border-theme pb-2">
                <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Bekleyen Lotlar
                </h4>
                <button onClick={fetchEligibleLots} className="text-[9px] font-black text-theme-dim hover:text-theme-primary transition-all flex items-center gap-1 uppercase">
                  <RefreshCw className={cn("w-3 h-3", fetchingLots && "animate-spin")} /> Yenile
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {fetchingLots ? (
                  <div className="h-full flex items-center justify-center"><Loading size="sm" /></div>
                ) : eligibleLots.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <Package className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase">Uygun lot bulunamadı</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {eligibleLots.map((lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => addItem(lot)}
                        className="w-full flex items-center justify-between p-2.5 bg-theme-base/30 hover:bg-theme-primary/5 border border-theme/50 rounded-xl transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-theme-surface border border-theme flex items-center justify-center group-hover:border-theme-primary/30">
                            <Package className="w-4 h-4 text-theme-dim group-hover:text-theme-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-theme-main uppercase leading-none">{lot.lotNumber}</p>
                            <p className="text-[9px] font-bold text-theme-muted truncate max-w-[200px] uppercase mt-0.5">{lot.product?.productName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-theme-primary bg-theme-primary/10 px-2 py-0.5 rounded-md">
                            {lot.productionQty} {lot.product?.unitOfMeasure}
                          </span>
                          <Plus className="w-4 h-4 text-theme-primary opacity-0 group-hover:opacity-100 transition-all mr-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected List (Right) */}
            <div className="p-4 bg-theme-primary/[0.02] border-2 border-theme-primary/10 rounded-2xl space-y-4 shadow-sm flex flex-col min-h-[400px]">
              <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest flex items-center gap-2 border-b border-theme-primary/10 pb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Seçili Liste ({formData.items.length})
              </h4>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {formData.items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <AlertCircle className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase">Lot seçimi yapın</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {formData.items.map((item: any) => (
                      <div
                        key={item.productionOrderId}
                        className="flex items-center justify-between p-2.5 bg-theme-surface border border-theme-primary/20 rounded-xl shadow-sm animate-in slide-in-from-right-2 duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-theme-primary/10 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-theme-primary" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-theme-main uppercase leading-none">{item.productionOrder?.lotNumber}</p>
                            <p className="text-[9px] font-bold text-theme-muted truncate max-w-[180px] uppercase mt-0.5">{item.productionOrder?.product?.productName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-theme-muted">
                            {item.productionOrder?.productionQty} {item.productionOrder?.product?.unitOfMeasure}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productionOrderId)}
                            className="p-1.5 text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-theme bg-theme-base/20 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-theme-warning/80">
            <AlertCircle className="w-4 h-4" />
            <p className="text-[10px] font-black leading-none">
              Tamamla butonuna basıldığında tüm lotlar sterilize edilmiş olarak işaretlenecektir.
            </p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-8 py-3 text-[10px] font-black text-theme-dim hover:text-theme-danger transition-all uppercase tracking-widest border border-theme rounded-xl hover:bg-theme-danger/5"
            >
              İPTAL
            </button>
            <button
              onClick={(e) => handleSave(e, false)}
              disabled={loading}
              className="flex-1 sm:flex-none px-8 py-3 bg-theme-base border border-theme text-theme-main rounded-xl font-black tracking-widest text-[10px] hover:bg-theme-surface transition-all flex items-center justify-center gap-2 uppercase active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> TASLAK SAKLA
            </button>
            <button
              onClick={(e) => handleSave(e, true)}
              disabled={loading || formData.items.length === 0}
              className="flex-1 sm:flex-none px-10 py-3 bg-theme-primary text-white rounded-xl font-black tracking-widest text-[10px] shadow-xl shadow-theme-primary/30 hover:bg-theme-primary-hover transition-all flex items-center justify-center gap-2 uppercase active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loading size="sm" /> : <><CheckCircle2 className="w-4 h-4 mb-0.5" /> LİSTEYİ TAMAMLA</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
