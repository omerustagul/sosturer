import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, Building2, CalendarClock, ChevronLeft, FileText, History, RefreshCw, Save, Search, Wrench, X } from 'lucide-react';
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
    endpoint: '/measurement-tools',
    listPath: '/production/measurement-tools',
    title: 'ÖLÇÜM ARAÇLARI',
    singleTitle: 'Ölçüm Aracı',
    description: 'Ölçüm araçlarının güncel durum ve kalibrasyon geçmişi',
    icon: Activity,
    emptyText: 'Tanımlı ölçüm aracı bulunamadı.'
  },
  equipment: {
    endpoint: '/equipment',
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
        normalize(asset.name).includes(search) ||
        normalize(asset.serialNo).includes(search) ||
        normalize(asset.brand).includes(search) ||
        normalize(asset.model).includes(search) ||
        normalize(latest?.workCenter?.name).includes(search) ||
        normalize(latest?.certificate).includes(search);
      const matchesStatus = statusFilter === 'all' || latest?.operationStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assets, searchTerm, statusFilter]);

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Icon} label="Tanımlı Kayıt" value={assets.length.toLocaleString('tr-TR')} color="text-theme-primary" />
        <StatCard icon={Activity} label="Kullanılabilir" value={assets.filter((asset) => asset.statuses?.[0]?.operationStatus === 'available').length.toLocaleString('tr-TR')} color="text-theme-success" />
        <StatCard icon={RefreshCw} label="Kalibrasyonda" value={assets.filter((asset) => asset.statuses?.[0]?.operationStatus === 'calibration').length.toLocaleString('tr-TR')} color="text-theme-warning" />
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
                <th className="px-6 py-4 text-[10px] font-black text-theme-dim">Son Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {filteredAssets.map((asset) => {
                const latest = asset.statuses?.[0];
                return (
                  <tr key={asset.id} onClick={() => navigate(`${cfg.listPath}/${asset.id}`)} className="hover:bg-theme-main/5 transition-all cursor-pointer">
                    <td className="px-6 py-5 font-mono text-sm font-black text-theme-primary whitespace-nowrap">{asset.code || asset.id.slice(0, 8)}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-theme-main">{asset.name}</span>
                        <span className="text-[10px] text-theme-muted font-bold">{asset.serialNo || asset.brand || asset.model || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{latest?.workCenter?.name || '-'}</td>
                    <td className="px-6 py-5 text-xs font-black text-theme-main whitespace-nowrap">{latest?.validUntil ? format(new Date(latest.validUntil), 'dd/MM/yyyy') : '-'}</td>
                    <td className="px-6 py-5 text-xs font-black text-theme-muted whitespace-nowrap">
                      {latest ? `${latest.negativeTolerance ?? '-'} / +${latest.positiveTolerance ?? '-'}` : '-'}
                    </td>
                    <td className="px-6 py-5"><OperationStatusBadge status={latest?.operationStatus || 'none'} /></td>
                    <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{latest?.createdAt ? format(new Date(latest.createdAt), 'dd/MM/yyyy HH:mm') : '-'}</td>
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-25">
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

  const latestStatus = asset?.statuses?.[0];

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

  const updateForm = (patch: Partial<StatusForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
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
              {asset.name}
            </h2>
            <p className="text-theme-main/80 text-[11px] mt-0.5 font-bold opacity-60">
              {asset.code || '-'} {asset.serialNo ? ` / ${asset.serialNo}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveStatus}
          disabled={saving}
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
          <Field label="Sertifika">
            <input value={form.certificate} onChange={(event) => updateForm({ certificate: event.target.value })} className="form-input h-10 text-xs" placeholder="Sertifika no / belge referansı" />
          </Field>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/20">
              {(asset.statuses || []).map((status: any) => (
                <tr key={status.id} className="hover:bg-theme-main/5 transition-all">
                  <td className="px-6 py-5 text-xs font-black text-theme-main whitespace-nowrap">{format(new Date(status.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{status.workCenter?.name || '-'}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{status.validUntil ? format(new Date(status.validUntil), 'dd/MM/yyyy') : '-'}</td>
                  <td className="px-6 py-5 text-xs font-black text-theme-muted whitespace-nowrap">{status.negativeTolerance ?? '-'} / +{status.positiveTolerance ?? '-'}</td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted whitespace-nowrap">{status.certificate || '-'}</td>
                  <td className="px-6 py-5"><OperationStatusBadge status={status.operationStatus} /></td>
                  <td className="px-6 py-5 text-xs font-bold text-theme-muted max-w-[260px] truncate">{status.notes || '-'}</td>
                </tr>
              ))}
              {(asset.statuses || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center opacity-30 italic text-sm">
                    Henüz durum kaydı eklenmedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getOperationLabel(status: string) {
  return operationStatuses.find((item) => item.id === status)?.label || '-';
}

function OperationStatusBadge({ status }: { status: string }) {
  const config = status === 'available'
    ? { label: 'Kullanılabilir', className: 'bg-theme-success/10 text-theme-success border-theme-success/20' }
    : status === 'calibration'
      ? { label: 'Kalibrasyonda', className: 'bg-theme-warning/10 text-theme-warning border-theme-warning/20' }
      : status === 'out_of_use'
        ? { label: 'Kullanım Dışı', className: 'bg-theme-danger/10 text-theme-danger border-theme-danger/20' }
        : { label: 'Kayıt Yok', className: 'bg-theme-base/40 text-theme-dim border-theme' };

  return (
    <span className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border inline-flex items-center ${config.className}`}>
      {config.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="modern-glass-card p-3 border-theme-primary/10 hover:border-theme-primary/30 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color.replace('text', 'bg')}/10 group-hover:scale-110 transition-transform`}>
          <Icon className={`${color} w-5 h-5`} />
        </div>
      </div>
      <p className="text-[10px] font-black text-theme-dim uppercase tracking-[0.2em] mb-2 opacity-60">{label}</p>
      <p className="text-xl font-black text-theme-main tracking-tight leading-none truncate">{value}</p>
    </div>
  );
}
