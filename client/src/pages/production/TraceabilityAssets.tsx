import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, Building2, CalendarClock, ExternalLink, FileText, History, RefreshCw, Save, Search, Trash2, UploadCloud, Wrench, X, ChevronLeft, Edit2 } from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';

type AssetKind = 'measurement' | 'equipment';

type StatusForm = {
  workCenterId: string;
  validUntil: string;
  negativeTolerance: string;
  positiveTolerance: string;
  certificate: string;
  certificateDocumentUrl: string;
  certificateDocumentName: string;
  operationStatus: string;
  notes: string;
};

const operationStatuses = [
  { id: 'available', label: 'Kullanılabilir' },
  { id: 'out_of_use', label: 'Kullanım Dışı' },
  { id: 'calibration', label: 'Kalibrasyonda' }
];

const configByKind = {
  measurement: {
    endpoint: '/measurement-devices',
    typesEndpoint: '/measurement-tools',
    listPath: '/production/measurement-tools',
    title: 'ÖLÇÜM CİHAZLARI',
    singleTitle: 'Ölçüm Cihazı',
    description: 'Ölçüm cihazlarının güncel durum ve kalibrasyon geçmişi',
    icon: Activity,
    emptyText: 'Tanımlı ölçüm cihazı bulunamadı.'
  },
  equipment: {
    endpoint: '/equipment/devices',
    typesEndpoint: '/equipment',
    listPath: '/production/equipment',
    title: 'EKİPMANLAR',
    singleTitle: 'Ekipman',
    description: 'Ekipmanların güncel durum ve kullanım geçmişi',
    icon: Wrench,
    emptyText: 'Tanımlı ekipman bulunamadı.'
  }
};

const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('tr-TR');

const createStatusForm = (status?: any): StatusForm => ({
  workCenterId: status?.workCenterId || '',
  validUntil: status?.validUntil ? String(status.validUntil).slice(0, 10) : '',
  negativeTolerance: status?.negativeTolerance == null ? '' : String(status.negativeTolerance),
  positiveTolerance: status?.positiveTolerance == null ? '' : String(status.positiveTolerance),
  certificate: status?.certificate || '',
  certificateDocumentUrl: status?.certificateDocumentUrl || '',
  certificateDocumentName: status?.certificateDocumentName || '',
  operationStatus: status?.operationStatus || 'available',
  notes: status?.notes || ''
});

export function MeasurementTools() {
  return <AssetList kind="measurement" />;
}

export function EquipmentTracking() {
  return <AssetList kind="equipment" />;
}

export function MeasurementToolDetail() {
  return <AssetDetail kind="measurement" />;
}

export function EquipmentDetail() {
  return <AssetDetail kind="equipment" />;
}

function AssetList({ kind }: { kind: AssetKind }) {
  const cfg = configByKind[kind];
  const Icon = cfg.icon;
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${cfg.endpoint}?includeLatest=true`);
      setAssets(Array.isArray(res) ? res : []);
    } catch (error) {
      notify.error('Veri Alınamadı', `${cfg.singleTitle} listesi yüklenemedi.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cfg.endpoint]);

  const filteredAssets = useMemo(() => {
    const search = normalize(searchTerm.trim());
    return assets.filter((asset) => {
      const latest = asset.statuses?.[0];
      const matchesSearch = !search ||
        normalize(asset.code).includes(search) ||
        normalize(asset.type?.code).includes(search) ||
        normalize(asset.name).includes(search) ||
        normalize(asset.type?.name).includes(search) ||
        normalize(asset.serialNo).includes(search) ||
        normalize(asset.type?.brand).includes(search) ||
        normalize(asset.type?.model).includes(search) ||
        normalize(latest?.workCenter?.name).includes(search) ||
        normalize(latest?.certificate).includes(search) ||
        normalize(latest?.certificateDocumentName).includes(search);
      const matchesStatus = statusFilter === 'all' || latest?.operationStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assets, searchTerm, statusFilter]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [types, setTypes] = useState<any[]>([]);
  const [newDevice, setNewDevice] = useState({ typeId: '', serialNo: '', code: '', notes: '' });

  const fetchTypes = async () => {
    try {
      const res = await api.get(cfg.typesEndpoint);
      setTypes(Array.isArray(res) ? res : []);
    } catch (e) { }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.typeId) {
      notify.warning('Tip Seçin', 'Lütfen bir tür seçin.');
      return;
    }
    try {
      await api.post(cfg.endpoint, newDevice);
      notify.success('Eklendi', `Yeni ${cfg.singleTitle.toLowerCase()} başarıyla oluşturuldu.`);
      setShowAddModal(false);
      setNewDevice({ typeId: '', serialNo: '', code: '', notes: '' });
      fetchData();
    } catch (err: any) {
      notify.error('Hata', err.message || 'Kayıt eklenemedi.');
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase flex items-center gap-2">
            <Icon className="w-5 h-5 text-theme-primary" />
            {cfg.title}
          </h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60">{cfg.description}</p>
        </div>
        <button
          onClick={() => { fetchTypes(); setShowAddModal(true); }}
          className="bg-theme-primary hover:bg-theme-primary-hover h-11 text-white px-8 rounded-xl text-xs font-black transition-all shadow-xl shadow-theme-primary/30 flex items-center gap-2.5 active:scale-95 uppercase tracking-widest"
        >
          <Icon className="w-4 h-4" /> YENİ {cfg.singleTitle.toUpperCase()} EKLE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Icon} label="Tanımlı Kayıt" value={assets.length.toLocaleString('tr-TR')} color="text-theme-primary" />
        <StatCard icon={Activity} label="Kullanılabilir" value={assets.filter((asset) => asset.statuses?.[0]?.operationStatus === 'available').length.toLocaleString('tr-TR')} color="text-theme-success" />
        <StatCard icon={RefreshCw} label="Kalibrasyon/Bakım" value={assets.filter((asset) => asset.statuses?.[0]?.operationStatus === 'calibration').length.toLocaleString('tr-TR')} color="text-theme-warning" />
        <StatCard icon={X} label="Kullanım Dışı" value={assets.filter((asset) => asset.statuses?.[0]?.operationStatus === 'out_of_use').length.toLocaleString('tr-TR')} color="text-theme-danger" />
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-6 border-b border-theme bg-theme-surface/30 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div className="relative group flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Kod, ad, seri no, iş merkezi..."
                className="w-full h-10 bg-theme-base/20 border border-theme rounded-xl pl-10 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/40 focus:bg-theme-surface transition-all font-bold placeholder:text-theme-dim/50"
              />
            </div>
            <div className="flex items-center gap-3">
              <CustomSelect
                options={[{ id: 'all', label: 'Tüm Durumlar' }, ...operationStatuses]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(String(value || 'all'))}
                searchable={false}
              />
              <button
                onClick={fetchData}
                className="h-10 px-4 rounded-xl border border-theme bg-theme-base/20 text-theme-dim hover:text-theme-main hover:bg-theme-surface hover:border-theme-primary/30 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <RefreshCw size={14} /> Yenile
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Kod</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tanım</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">İş Merkezi</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Geçerlilik</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tolerans</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Durum</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {filteredAssets.map((asset) => {
                const latest = asset.statuses?.[0];
                return (
                  <tr key={asset.id} onClick={() => navigate(`${cfg.listPath}/${asset.id}`)} className="hover:bg-theme-main/5 transition-all cursor-pointer">
                    <td className="px-6 py-5 font-mono text-sm font-black text-theme-primary whitespace-nowrap">{asset.code || asset.type?.code || asset.id.slice(0, 8)}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-theme-main">{asset.type?.name || asset.name}</span>
                        <span className="text-[10px] text-theme-muted font-bold">
                          {asset.serialNo ? `S/N: ${asset.serialNo}` : ''}
                          {asset.type?.brand ? ` [${asset.type.brand} ${asset.type.model || ''}]` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{latest?.workCenter?.name || '-'}</td>
                    <td className="px-6 py-5 text-xs font-black text-theme-main whitespace-nowrap">{latest?.validUntil ? format(new Date(latest.validUntil), 'dd/MM/yyyy') : '-'}</td>
                    <td className="px-6 py-5 text-xs font-black text-theme-muted whitespace-nowrap">
                      {latest ? `${latest.negativeTolerance ?? '-'} / +${latest.positiveTolerance ?? '-'}` : '-'}
                    </td>
                    <td className="px-6 py-5"><OperationStatusBadge status={latest?.operationStatus || 'none'} /></td>
                    <td className="px-6 py-5 text-center">
                      <button className="p-2 rounded-lg bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 transition-all"><Edit2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">
                    <div className="flex flex-col items-center gap-2 opacity-25 p-20">
                      <Icon size={34} />
                      <p className="text-sm font-black">{cfg.emptyText}</p>
                      <p className="text-xs font-bold">Yeni tanımlar /definitions sayfasından eklenebilir.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AddDeviceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        types={types}
        onSubmit={handleAddDevice}
        data={newDevice}
        setData={setNewDevice}
        title={cfg.singleTitle}
        icon={Icon}
        kind={kind}
      />
    </div>
  );
}

function AddDeviceModal({ isOpen, onClose, types, onSubmit, data, setData, title, icon: Icon, kind }: any) {
  const [lots, setLots] = useState<any[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);

  useEffect(() => {
    if (isOpen && data.typeId) {
      setLoadingLots(true);
      const param = kind === 'measurement' ? 'toolTypeId' : 'equipmentTypeId';
      api.get(`/inventory/lots?${param}=${data.typeId}`)
        .then(res => setLots(Array.isArray(res) ? res : []))
        .catch(() => setLots([]))
        .finally(() => setLoadingLots(false));
    } else {
      setLots([]);
    }
  }, [isOpen, data.typeId, kind]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-theme-base/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-theme-surface w-full max-w-lg rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-theme flex items-center justify-between bg-theme-base/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-theme-primary/10 rounded-2xl">
              <Icon className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main uppercase leading-none">YENİ {title.toUpperCase()}</h3>
              <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-60">Fiziksel kayıt tanımlama</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-theme-base/10 text-theme-dim hover:bg-theme-primary hover:text-white transition-all"><X size={20} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <Field label={`${title} Türü`}>
            <CustomSelect
              options={types.map((t: any) => ({ id: t.id, label: t.name, subLabel: `${t.code || ''} ${t.brand || ''}` }))}
              value={data.typeId}
              onChange={(val) => setData({ ...data, typeId: String(val), serialNo: '' })}
              placeholder="Tür seçin..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kod (Opsiyonel)">
              <input value={data.code} onChange={e => setData({ ...data, code: e.target.value })} className="form-input h-11 text-xs" placeholder="Örn: MK-01" />
            </Field>
            <Field label="Seri Numarası (Stoktan)">
              <CustomSelect
                options={lots.map(l => ({
                  id: l.lotNumber,
                  label: l.lotNumber,
                  subLabel: `${l.quantity} Adet`
                }))}
                value={data.serialNo}
                onChange={(val) => setData({ ...data, serialNo: String(val) })}
                placeholder={loadingLots ? "Yükleniyor..." : "S/N Seçin"}
                disabled={!data.typeId || loadingLots}
              />
            </Field>
          </div>
          <Field label="Notlar">
            <textarea value={data.notes} onChange={e => setData({ ...data, notes: e.target.value })} className="form-input min-h-[80px] py-3 text-xs" placeholder="Ekstra bilgiler..." />
          </Field>
          <button type="submit" className="w-full h-12 bg-theme-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-theme-primary-hover transition-all shadow-xl shadow-theme-primary/20 flex items-center justify-center gap-2">
            <Save size={18} /> KAYDET
          </button>
        </form>
      </div>
    </div>
  );
}

function AssetDetail({ kind }: { kind: AssetKind }) {
  const cfg = configByKind[kind];
  const Icon = cfg.icon;
  const navigate = useNavigate();
  const { id } = useParams();
  const [asset, setAsset] = useState<any | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [form, setForm] = useState<StatusForm>(() => createStatusForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certificateUploading, setCertificateUploading] = useState(false);

  const latestStatus = asset?.statuses?.[0];
  const canUploadCertificate = kind === 'measurement';

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [assetRes, departmentRes] = await Promise.all([
        api.get(`${cfg.endpoint}/${id}`),
        api.get('/departments')
      ]);
      setAsset(assetRes);
      setDepartments(Array.isArray(departmentRes) ? departmentRes : []);
      setForm(createStatusForm(assetRes.statuses?.[0]));
    } catch (error) {
      notify.error('Hata', `${cfg.singleTitle} detayı yüklenemedi.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, cfg.endpoint]);

  const saveStatus = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`${cfg.endpoint}/${id}/statuses`, {
        ...form,
        negativeTolerance: form.negativeTolerance === '' ? null : Number(form.negativeTolerance),
        positiveTolerance: form.positiveTolerance === '' ? null : Number(form.positiveTolerance)
      });
      notify.success('Kaydedildi', 'Yeni durum geçmişe eklendi.');
      await fetchData();
    } catch (error: any) {
      notify.error('Kaydedilemedi', error.message || 'Durum kaydı oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const deleteStatus = async (statusId: string) => {
    if (!window.confirm('Bu durum kaydını silmek istediğinize emin misiniz?')) return;
    const basePath = kind === 'measurement' ? '/measurement-devices' : '/equipment';
    try {
      await api.delete(`${basePath}/statuses/${statusId}`);
      notify.success('Silindi', 'Durum kaydı başarıyla silindi.');
      await fetchData();
    } catch (error: any) {
      notify.error('Hata', error.message || 'Durum kaydı silinemedi.');
    }
  };

  const updateForm = (patch: Partial<StatusForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleCertificateDocumentUpload = async (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify.warning('PDF Gerekli', 'Sertifika belgesi sadece PDF kabul eder.');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    setCertificateUploading(true);

    try {
      const uploaded = await api.upload('/measurement-devices/certificates/upload', fd);
      updateForm({
        certificateDocumentUrl: uploaded.url,
        certificateDocumentName: uploaded.name
      });
      notify.success('Belge Yüklendi', uploaded.name);
    } catch (error: any) {
      notify.error('Belge Yüklenemedi', error.message || 'PDF yükleme başarısız oldu.');
    } finally {
      setCertificateUploading(false);
    }
  };

  const clearCertificateDocument = () => {
    updateForm({ certificateDocumentUrl: '', certificateDocumentName: '' });
  };

  if (loading) return <Loading size="lg" fullScreen />;
  if (!asset) return null;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(cfg.listPath)}
            className="p-2 rounded-xl bg-theme-base border border-theme text-theme-muted hover:text-theme-main hover:border-theme-primary/30 transition-all flex items-center justify-center shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-theme-main uppercase flex items-center gap-2">
              <Icon className="w-5 h-5 text-theme-primary" />
              {asset.type?.name || asset.name}
            </h2>
            <p className="text-theme-main/80 text-[11px] mt-0.5 font-bold opacity-60">
              {asset.code || asset.type?.code || '-'} {asset.serialNo ? ` / S/N: ${asset.serialNo}` : ''}
              {asset.type?.brand ? ` [${asset.type.brand} ${asset.type.model || ''}]` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveStatus}
          disabled={saving || certificateUploading}
          className="h-11 px-6 rounded-xl bg-theme-primary text-white hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Kaydet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Icon} label="Güncel Durum" value={getOperationLabel(latestStatus?.operationStatus)} color="text-theme-primary" />
        <StatCard icon={Building2} label="İş Merkezi" value={latestStatus?.workCenter?.name || '-'} color="text-theme-success" />
        <StatCard icon={CalendarClock} label="Geçerlilik" value={latestStatus?.validUntil ? format(new Date(latestStatus.validUntil), 'dd/MM/yyyy') : '-'} color="text-theme-warning" />
        <StatCard icon={History} label="Durum Kaydı" value={(asset.statuses?.length || 0).toLocaleString('tr-TR')} color="text-theme-danger" />
      </div>

      <div className="modern-glass-card p-0 overflow-visible">
        <div className="p-5 border-b border-theme bg-theme-surface/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-theme-primary/10 rounded-2xl">
              <FileText className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main leading-none uppercase">Yeni Durum Kaydı</h3>
              <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-60">
                Her kaydetme izlenebilir geçmişe yeni kayıt ekler
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Field label="İş Merkezi">
            <CustomSelect
              options={departments.map((department) => ({ id: department.id, label: department.name, subLabel: department.code }))}
              value={form.workCenterId}
              onChange={(value) => updateForm({ workCenterId: String(value || '') })}
              placeholder="İş merkezi seçin"
            />
          </Field>
          <Field label="Geçerlilik Tarihi">
            <input type="date" value={form.validUntil} onChange={(event) => updateForm({ validUntil: event.target.value })} className="form-input h-10 text-xs" />
          </Field>
          <Field label="Eksi Tolerans">
            <input type="number" step="0.0001" value={form.negativeTolerance} onChange={(event) => updateForm({ negativeTolerance: event.target.value })} className="form-input h-10 text-xs text-right" />
          </Field>
          <Field label="Artı Tolerans">
            <input type="number" step="0.0001" value={form.positiveTolerance} onChange={(event) => updateForm({ positiveTolerance: event.target.value })} className="form-input h-10 text-xs text-right" />
          </Field>
          <div className={canUploadCertificate ? 'md:col-span-2 xl:col-span-2' : ''}>
            <Field label="Sertifika">
              <div className={canUploadCertificate ? 'grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(210px,260px)] gap-2' : ''}>
                <input value={form.certificate} onChange={(event) => updateForm({ certificate: event.target.value })} className="form-input h-10 text-xs" placeholder="Sertifika no / belge referansı" />
                {canUploadCertificate && (
                  <div className="flex gap-2 min-w-0">
                    <label className="h-10 flex-1 rounded-xl bg-theme-base border border-theme text-theme-main hover:border-theme-primary/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase cursor-pointer overflow-hidden px-3">
                      <UploadCloud size={16} className={certificateUploading ? 'animate-pulse text-theme-primary' : 'text-theme-muted'} />
                      <span className="truncate">{form.certificateDocumentName || (certificateUploading ? 'Yükleniyor' : 'PDF Yükle')}</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(event) => {
                          handleCertificateDocumentUpload(event.target.files?.[0] || null);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {form.certificateDocumentUrl && (
                      <a
                        href={form.certificateDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Sertifika belgesini aç"
                        className="h-10 w-10 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-primary hover:border-theme-primary/30 transition-all flex items-center justify-center shrink-0"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {form.certificateDocumentUrl && (
                      <button
                        type="button"
                        onClick={clearCertificateDocument}
                        title="Belgeyi kaldır"
                        className="h-10 w-10 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-danger hover:border-theme-danger/30 transition-all flex items-center justify-center shrink-0"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </div>
          <Field label="İşlem Durumu">
            <CustomSelect options={operationStatuses} value={form.operationStatus} onChange={(value) => updateForm({ operationStatus: String(value || 'available') })} searchable={false} />
          </Field>
          <div className="md:col-span-2 xl:col-span-4">
            <Field label="Notlar">
              <textarea value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} className="form-input min-h-[110px] py-3" />
            </Field>
          </div>
        </div>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-theme bg-theme-surface/10 flex items-center gap-4">
          <div className="w-1.5 h-6 bg-theme-success rounded-full" />
          <h3 className="text-sm font-black text-theme-main leading-tight uppercase tracking-wider">Durum Geçmişi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface/50">
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Kayıt Tarihi</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">İş Merkezi</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Geçerlilik</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Tolerans</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Sertifika</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Durum</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Not</th>
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {(asset.statuses || []).map((status: any) => (
                <tr key={status.id} className="hover:bg-theme-main/5 transition-all">
                  <td className="px-6 py-5 text-xs font-black text-theme-main whitespace-nowrap">{format(new Date(status.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{status.workCenter?.name || '-'}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{status.validUntil ? format(new Date(status.validUntil), 'dd/MM/yyyy') : '-'}</td>
                  <td className="px-6 py-5 text-xs font-black text-theme-muted whitespace-nowrap">{status.negativeTolerance ?? '-'} / +{status.positiveTolerance ?? '-'}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <span className="truncate max-w-[180px]">{status.certificate || '-'}</span>
                      {status.certificateDocumentUrl && (
                        <a
                          href={status.certificateDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={status.certificateDocumentName || 'Sertifika belgesini aç'}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-theme text-theme-primary hover:bg-theme-primary/10 transition-all shrink-0"
                        >
                          <FileText size={13} />
                          <span className="text-[9px] font-black uppercase">PDF</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5"><OperationStatusBadge status={status.operationStatus} /></td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted max-w-[260px] truncate">{status.notes || '-'}</td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <button
                        onClick={() => deleteStatus(status.id)}
                        className="p-2 rounded-lg bg-theme-danger/10 text-theme-danger hover:bg-theme-danger/20 transition-all"
                        title="Bu kaydı sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OperationStatusBadge({ status }: { status: string }) {
  const config = operationStatuses.find((s) => s.id === status) || { label: status, color: 'theme-dim' };
  const colorClass = status === 'available' ? 'theme-success' : status === 'calibration' ? 'theme-warning' : 'theme-danger';

  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-${colorClass}/10 text-${colorClass} border-${colorClass}/20`}>
      {config.label}
    </span>
  );
}

function getOperationLabel(status?: string) {
  return operationStatuses.find((s) => s.id === status)?.label || '-';
}

function Field({ label, children, disabled }: { label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={`space-y-1.5 min-w-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest pl-1">{label}</span>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="modern-glass-card p-4 border-theme-primary/10 hover:border-theme-primary/30 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color.replace('text', 'bg')}/10 group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
      </div>
      <p className="text-[12px] font-black text-theme-dim mb-2 opacity-60">{label}</p>
      <p className="text-xl font-black text-theme-main tracking-tight leading-none truncate">{value}</p>
    </div>
  );
}
