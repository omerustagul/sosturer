import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  Warehouse,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';

const voucherTypes = [
  { id: 'ENTRY', label: 'Giriş', direction: 1 },
  { id: 'EXIT', label: 'Çıkış', direction: -1 },
  { id: 'TRANSFER', label: 'Transfer', direction: -1 },
  { id: 'COUNT_SURPLUS', label: 'Sayım Fazlası', direction: -1 },
  { id: 'COUNT_SHORTAGE', label: 'Sayım Eksiği', direction: 1 },
  { id: 'SCRAP', label: 'Fire', direction: -1 },
  { id: 'RESERVE', label: 'Rezerve', direction: -1 },
  { id: 'IMPORT_ENTRY', label: 'İthalat Girişi', direction: 1 },
  { id: 'EXPORT_EXIT', label: 'İhracat Çıkışı', direction: -1 },
  { id: 'CONSIGNMENT_ENTRY', label: 'Konsinye Girişi', direction: 1 },
  { id: 'CONSIGNMENT_EXIT', label: 'Konsinye Çıkışı', direction: -1 },
  { id: 'CONSUMPTION_EXIT', label: 'Tüketim Çıkışı', direction: -1 }
];

const controlStatuses = [
  { id: 'pending', label: 'Bekliyor' },
  { id: 'in_control', label: 'Kontrol Aşamasında' },
  { id: 'rejected', label: 'Reddedildi' },
  { id: 'accepted', label: 'Kabul Edildi' }
];

const baseUnitOptions = ['Adet', 'PCS', 'Kg', 'Gram', 'Metre', 'Litre'];

const initialForm = {
  voucherType: 'ENTRY',
  firmId: '',
  controlStatus: 'pending',
  warehouseId: '',
  targetWarehouseId: '',
  documentNo: '',
  documentUrl: '',
  documentName: '',
  notes: ''
};

type VoucherLine = {
  clientId: string;
  productId: string;
  lotNumber: string;
  quantity: string;
  unit: string;
  notes: string;
};

const createClientId = () => {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createLine = (): VoucherLine => ({
  clientId: createClientId(),
  productId: '',
  lotNumber: '',
  quantity: '',
  unit: '',
  notes: ''
});

export function StockVoucherForm() {
  const navigate = useNavigate();
  const { voucherNo } = useParams();
  const isEditing = Boolean(voucherNo);

  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [firms, setFirms] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [nextVoucherNo, setNextVoucherNo] = useState('SF000000');
  const [form, setForm] = useState(initialForm);
  const [lines, setLines] = useState<VoucherLine[]>(() => [createLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(new Date());

  const selectedType = voucherTypes.find((type) => type.id === form.voucherType) || voucherTypes[0];
  const isTransfer = form.voucherType === 'TRANSFER';
  const isOutbound = selectedType.direction === -1 || isTransfer;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productRes, warehouseRes, firmRes, levelRes, nextRes] = await Promise.all([
          api.get('/products'),
          api.get('/inventory/warehouses'),
          api.get('/firms'),
          api.get('/inventory/levels'),
          api.get('/inventory/stock-vouchers/next-number')
        ]);

        setProducts(Array.isArray(productRes) ? productRes : []);
        setWarehouses(Array.isArray(warehouseRes) ? warehouseRes : []);
        setFirms(Array.isArray(firmRes) ? firmRes : []);
        setStockLevels(Array.isArray(levelRes) ? levelRes : []);

        if (!isEditing) {
          setNextVoucherNo(nextRes?.voucherNo || 'SF000000');
          setForm((prev) => ({
            ...prev,
            warehouseId: prev.warehouseId || warehouseRes?.[0]?.id || ''
          }));
        } else {
          const voucher = await api.get(`/inventory/stock-vouchers/${voucherNo}`);
          setForm({
            voucherType: voucher.voucherType,
            firmId: voucher.firmId || '',
            controlStatus: voucher.controlStatus,
            warehouseId: voucher.warehouseId,
            targetWarehouseId: voucher.targetWarehouseId || '',
            documentNo: voucher.documentNo || '',
            documentUrl: voucher.documentUrl || '',
            documentName: voucher.documentName || '',
            notes: voucher.notes || ''
          });
          setNextVoucherNo(voucher.voucherNo);
          setNow(new Date(voucher.transactionDate));
          setLines(voucher.items.map((item: any) => ({
            clientId: createClientId(),
            productId: item.productId,
            lotNumber: item.lotNumber,
            quantity: String(item.quantity),
            unit: item.unit || '',
            notes: item.notes || ''
          })));
        }
      } catch (error: any) {
        const message = error.response?.data?.error || 'Stok fişi ekranı için gerekli bilgiler yüklenemedi.';
        notify.error('Hata', message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [voucherNo, isEditing]);

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      label: product.productName,
      subLabel: product.productCode
    }));
  }, [products]);

  const firmOptions = useMemo(() => {
    return [
      { id: '', label: 'Firma Seçilmedi' },
      ...firms
        .filter((firm) => firm.status !== 'passive')
        .map((firm) => ({ id: firm.id, label: firm.name, subLabel: firm.code || firm.type }))
    ];
  }, [firms]);

  const warehouseOptions = useMemo(() => {
    return warehouses
      .filter((warehouse) => warehouse.status !== 'passive')
      .map((warehouse) => {
        let typeLabel = warehouse.type;
        if (warehouse.type === 'finished') typeLabel = 'Mamul';
        if (warehouse.type === 'semifinished') typeLabel = 'Yarımamul';
        if (warehouse.type === 'raw') typeLabel = 'Hammadde';
        if (warehouse.type === 'scrap') typeLabel = 'Hurda';
        if (warehouse.type === 'consumable') typeLabel = 'Sarf Malzeme';

        return {
          id: warehouse.id,
          label: warehouse.name,
          subLabel: warehouse.code || typeLabel
        };
      })
      .sort((a, b) => (a.subLabel || '').localeCompare(b.subLabel || ''));
  }, [warehouses]);

  const updateLine = (clientId: string, patch: Partial<VoucherLine>) => {
    setLines((prev) => prev.map((line) => {
      if (line.clientId !== clientId) return line;
      const nextLine = { ...line, ...patch };
      if (patch.productId) {
        const product = products.find((item) => item.id === patch.productId);
        nextLine.unit = product?.unitOfMeasure || '';
      }
      return nextLine;
    }));
  };

  const removeLine = (clientId: string) => {
    setLines((prev) => prev.length === 1 ? [createLine()] : prev.filter((line) => line.clientId !== clientId));
  };

  const getAvailableQty = (line: VoucherLine) => {
    if (!form.warehouseId || !line.productId) return 0;

    return stockLevels
      .filter((level) =>
        level.warehouseId === form.warehouseId &&
        level.productId === line.productId &&
        (!line.lotNumber || level.lotNumber === line.lotNumber)
      )
      .reduce((sum, level) => sum + Number(level.quantity || 0), 0);
  };

  const getLotOptions = (line: VoucherLine) => {
    if (!form.warehouseId || !line.productId) return [];

    return stockLevels
      .filter((level) =>
        level.warehouseId === form.warehouseId &&
        level.productId === line.productId &&
        Number(level.quantity || 0) > 0
      )
      .map((level) => ({ lotNumber: level.lotNumber || '', quantity: Number(level.quantity || 0) }));
  };

  const handleDocumentUpload = async (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify.warning('PDF Gerekli', 'Belge alanı sadece PDF kabul eder.');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);

    try {
      const uploaded = await api.upload('/inventory/stock-vouchers/upload', fd);
      setForm((prev) => ({
        ...prev,
        documentUrl: uploaded.url,
        documentName: uploaded.name
      }));
      notify.success('Belge Yüklendi', uploaded.name);
    } catch (error: any) {
      notify.error('Belge Yüklenemedi', error.message || 'PDF yükleme başarısız oldu.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.warehouseId) {
      notify.warning('Depo Seçin', 'Stok fişi için depo alanı zorunludur.');
      return;
    }

    if (isTransfer && !form.targetWarehouseId) {
      notify.warning('Hedef Depo Seçin', 'Transfer fişinde hedef depo zorunludur.');
      return;
    }

    const validLines = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({
        productId: line.productId,
        lotNumber: line.lotNumber.trim(),
        quantity: Number(line.quantity),
        unit: line.unit || null,
        notes: line.notes.trim() || null
      }));

    if (validLines.length === 0) {
      notify.warning('Satır Ekleyin', 'En az bir ürün satırı girilmelidir.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/inventory/stock-vouchers/${voucherNo}`, {
          ...form,
          firmId: form.firmId || null,
          targetWarehouseId: isTransfer ? form.targetWarehouseId : null,
          items: validLines
        });
        notify.success('Stok Fişi Güncellendi', `${nextVoucherNo} numaralı fiş güncellendi.`);
      } else {
        await api.post('/inventory/stock-vouchers', {
          ...form,
          firmId: form.firmId || null,
          targetWarehouseId: isTransfer ? form.targetWarehouseId : null,
          items: validLines
        });
        notify.success('Stok Fişi Kaydedildi', `${nextVoucherNo} numaralı fiş işlendi.`);
      }
      navigate('/inventory/stock-vouchers');
    } catch (error: any) {
      notify.error('İşlem Başarısız', error.message || 'Stok fişi kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const clearDocument = () => {
    setForm((prev) => ({ ...prev, documentUrl: '', documentName: '' }));
  };

  const totalLineQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventory/stock-vouchers')}
            className="p-2 rounded-xl bg-theme-base border border-theme text-theme-muted hover:text-theme-main hover:border-theme-primary/30 transition-all flex items-center justify-center shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-theme-main uppercase flex items-center gap-2">
              <FileText className="w-5 h-5 text-theme-primary" />
              {isEditing ? `STOK FİŞİ: ${nextVoucherNo}` : 'YENİ STOK FİŞİ'}
            </h2>
            <p className="text-theme-main/80 text-[11px] mt-0.5 font-bold opacity-60">
              {isEditing ? 'Stok Fişi Detayları Ve Düzenleme' : 'Lot Bazlı Giriş, Çıkış, Transfer Ve Sayım İşlemleri'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="h-11 px-6 rounded-xl bg-theme-primary text-white hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {isEditing ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Fiş No" value={nextVoucherNo} color="text-theme-primary" />
        <StatCard icon={CalendarClock} label="İşlem Tarihi" value={format(now, 'dd/MM/yyyy HH:mm')} color="text-theme-warning" />
        <StatCard icon={Package} label="Satır Toplamı" value={totalLineQuantity.toLocaleString('tr-TR')} color="text-theme-success" />
        <StatCard icon={Warehouse} label="Kaynak Depo" value={warehouses.find(w => w.id === form.warehouseId)?.name || '-'} color="text-theme-danger" />
      </div>

      <div className="modern-glass-card p-0 overflow-visible">
        <div className="p-5 border-b border-theme bg-theme-surface/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-theme-primary/10 rounded-2xl">
              <FileText className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main leading-none uppercase">{isEditing ? 'FİŞ BİLGİLERİ' : 'YENİ FİŞ OLUŞTUR'}</h3>
              <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-60">
                {selectedType.label} {selectedType.direction === 1 ? '(+)' : '(-)'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ReadOnlyField label="Fiş No" value={nextVoucherNo} />
            <ReadOnlyField label="Tarih" value={format(now, 'dd/MM/yyyy HH:mm')} />
            <Field label="Fiş Tipi">
              <CustomSelect
                options={voucherTypes.map((type) => ({ id: type.id, label: `${type.label} ${type.direction === 1 ? '(+)' : '(-)'}` }))}
                value={form.voucherType}
                onChange={(value) => !isEditing && setForm((prev) => ({ ...prev, voucherType: String(value), targetWarehouseId: '' }))}
                searchable={false}
                disabled={isEditing}
              />
            </Field>
            <Field label="Kontrol Durumu">
              <CustomSelect
                options={controlStatuses}
                value={form.controlStatus}
                onChange={(value) => setForm((prev) => ({ ...prev, controlStatus: String(value || 'pending') }))}
                searchable={false}
              />
            </Field>
            <Field label="Firma">
              <CustomSelect
                options={firmOptions}
                value={form.firmId}
                onChange={(value) => setForm((prev) => ({ ...prev, firmId: String(value || '') }))}
                placeholder="Firma Seçin"
              />
            </Field>
            <Field label="Depo">
              <CustomSelect
                options={warehouseOptions}
                value={form.warehouseId}
                onChange={(value) => !isEditing && setForm((prev) => ({ ...prev, warehouseId: String(value || '') }))}
                placeholder="Depo Seçin"
                disabled={isEditing}
              />
            </Field>
            {isTransfer && (
              <Field label="Hedef Depo">
                <CustomSelect
                  options={warehouseOptions.filter((warehouse) => warehouse.id !== form.warehouseId)}
                  value={form.targetWarehouseId}
                  onChange={(value) => !isEditing && setForm((prev) => ({ ...prev, targetWarehouseId: String(value || '') }))}
                  placeholder="Hedef Depo Seçin"
                  disabled={isEditing}
                />
              </Field>
            )}
            <Field label="Belge No">
              <input
                value={form.documentNo}
                onChange={(event) => setForm((prev) => ({ ...prev, documentNo: event.target.value }))}
                className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-sm font-bold text-theme-main outline-none focus:border-theme-primary transition-all"
                placeholder="Fatura / irsaliye no"
              />
            </Field>
            <Field label="Belge Yükle">
              <div className="flex gap-2">
                <label className="h-10 flex-1 rounded-xl bg-theme-base border border-theme text-theme-main hover:border-theme-primary/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase cursor-pointer overflow-hidden px-3">
                  <UploadCloud size={16} className={uploading ? 'animate-pulse text-theme-primary' : 'text-theme-muted'} />
                  <span className="truncate">{form.documentName || (uploading ? 'Yükleniyor' : 'PDF')}</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      handleDocumentUpload(event.target.files?.[0] || null);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {form.documentUrl && (
                  <button
                    type="button"
                    onClick={clearDocument}
                    className="h-10 w-10 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-danger hover:border-theme-danger/30 transition-all flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </Field>
            <div className="md:col-span-2 xl:col-span-4 space-y-1">
              <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">Notlar</span>
              <input
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-sm font-bold text-theme-main outline-none focus:border-theme-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-theme rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-theme-surface/60">
                  <th className="px-4 py-3 text-[10px] font-black text-theme-dim min-w-[260px]">Ürün</th>
                  <th className="px-4 py-3 text-[10px] font-black text-theme-dim min-w-[160px]">Lot Numarası</th>
                  <th className="px-4 py-3 text-[10px] font-black text-theme-dim text-right min-w-[110px]">Mevcut</th>
                  <th className="px-4 py-3 text-[10px] font-black text-theme-dim min-w-[220px]">Miktar</th>
                  <th className="px-4 py-3 text-[10px] font-black text-theme-dim min-w-[180px]">Açıklama</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-theme-dim w-16">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme/20">
                {lines.map((line, index) => {
                  const lotOptions = getLotOptions(line);
                  const availableQty = getAvailableQty(line);
                  const datalistId = `voucher-lots-${line.clientId}`;

                  return (
                    <tr key={line.clientId} className="bg-theme-base/20">
                      <td className="px-4 py-3 align-top">
                        <CustomSelect
                          options={productOptions}
                          value={line.productId}
                          onChange={(value) => updateLine(line.clientId, { productId: String(value || ''), lotNumber: '' })}
                          placeholder="Ürün Seçin"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          list={datalistId}
                          value={line.lotNumber}
                          onChange={(event) => updateLine(line.clientId, { lotNumber: event.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-xs font-black text-theme-main outline-none focus:border-theme-primary transition-all uppercase"
                          placeholder={isOutbound ? 'Lot seçin' : 'Lot girin'}
                        />
                        <datalist id={datalistId}>
                          {lotOptions.map((lot) => (
                            <option key={`${line.clientId}-${lot.lotNumber}`} value={lot.lotNumber}>
                              {lot.quantity.toLocaleString('tr-TR')}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <span className={`inline-flex h-10 items-center font-mono text-xs font-black ${isOutbound ? 'text-theme-warning' : 'text-theme-dim'}`}>
                          {isOutbound ? availableQty.toLocaleString('tr-TR') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.clientId, { quantity: event.target.value })}
                            className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-xs font-black text-theme-main outline-none focus:border-theme-primary transition-all text-right"
                          />
                          <div className="w-36 shrink-0">
                            <CustomSelect
                              options={Array.from(new Set([...baseUnitOptions, line.unit])).filter(Boolean).map(u => ({ id: u, label: u }))}
                              value={line.unit}
                              onChange={(value) => updateLine(line.clientId, { unit: String(value || '') })}
                              searchable={false}
                              placeholder="Birim"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          value={line.notes}
                          onChange={(event) => updateLine(line.clientId, { notes: event.target.value })}
                          className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-xs font-bold text-theme-main outline-none focus:border-theme-primary transition-all"
                        />
                      </td>
                      <td className="px-4 py-3 align-top text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.clientId)}
                          className="h-10 w-10 rounded-xl bg-theme-main/5 text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 transition-all inline-flex items-center justify-center"
                          aria-label={`${index + 1}. satırı sil`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, createLine()])}
              className="h-10 px-4 rounded-xl bg-theme-base border border-theme text-theme-main hover:border-theme-primary/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <Plus size={16} /> Satır Ekle
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              className="h-11 px-6 rounded-xl bg-theme-primary text-white hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {isEditing ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, disabled }: { label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={`space-y-1 min-w-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="h-10 bg-theme-base/50 border border-theme rounded-xl px-3 flex items-center text-sm font-black text-theme-muted cursor-not-allowed">
        {value}
      </div>
    </Field>
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

export default StockVoucherForm;
