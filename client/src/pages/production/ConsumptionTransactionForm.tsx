import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarClock, ChevronLeft, ClipboardList, Hash, Package, Plus, RefreshCw, Save, Trash2, UserCircle, Warehouse } from 'lucide-react';
import { api } from '../../lib/api';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Loading } from '../../components/common/Loading';
import { notify } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';

type FormState = {
  typeId: string;
  transactionDate: string;
  status: string;
  productId: string;
  warehouseId: string;
  lotNumber: string;
  serialNo: string;
  personnelName: string;
  quantity: string;
  unit: string;
  notes: string;
  orderIds: string[];
};

const statusOptions = [
  { id: 'pending', label: 'Bekliyor' },
  { id: 'available', label: 'Kullanılabilir' },
  { id: 'used', label: 'Kullanıldı' }
];

const baseUnitOptions = ['Adet', 'PCS', 'Kg', 'Gram', 'Metre', 'Litre'];

const toInputDateTime = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const createInitialForm = (personnelName = ''): FormState => ({
  typeId: '',
  transactionDate: toInputDateTime(new Date()),
  status: 'pending',
  productId: '',
  warehouseId: '',
  lotNumber: '',
  serialNo: '',
  personnelName,
  quantity: '',
  unit: '',
  notes: '',
  orderIds: []
});

export function ConsumptionTransactionForm() {
  const navigate = useNavigate();
  const { transactionNo } = useParams();
  const isEditing = Boolean(transactionNo);
  const user = useAuthStore((state) => state.user);

  const [types, setTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [stockLots, setStockLots] = useState<any[]>([]);
  const [transactionNumber, setTransactionNumber] = useState('TK000000');
  const [form, setForm] = useState<FormState>(() => createInitialForm(user?.fullName || ''));
  const [activeTab, setActiveTab] = useState<'orders' | 'notes'>('orders');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === form.warehouseId);
  const availableQty = stockLots
    .filter((lot) => (lot.lotNumber || '') === (form.lotNumber || ''))
    .reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [typeRes, productRes, warehouseRes, orderRes] = await Promise.all([
          api.get('/consumption-types'),
          api.get('/products'),
          api.get('/inventory/warehouses'),
          api.get('/production-orders')
        ]);
        setTypes(Array.isArray(typeRes) ? typeRes : []);
        setProducts(Array.isArray(productRes) ? productRes : []);
        setWarehouses(Array.isArray(warehouseRes) ? warehouseRes : []);
        setProductionOrders(Array.isArray(orderRes) ? orderRes : []);

        if (isEditing && transactionNo) {
          const transaction = await api.get(`/consumption-transactions/${transactionNo}`);
          setTransactionNumber(transaction.transactionNo);
          setForm({
            typeId: transaction.typeId || '',
            transactionDate: toInputDateTime(new Date(transaction.transactionDate)),
            status: transaction.status || 'pending',
            productId: transaction.productId || '',
            warehouseId: transaction.warehouseId || '',
            lotNumber: transaction.lotNumber || '',
            serialNo: transaction.serialNo || '',
            personnelName: transaction.personnelName || user?.fullName || '',
            quantity: String(transaction.quantity || ''),
            unit: transaction.unit || transaction.product?.unitOfMeasure || '',
            notes: transaction.notes || '',
            orderIds: (transaction.productionOrders || []).map((link: any) => link.productionOrderId)
          });
        } else {
          const nextRes = await api.get('/consumption-transactions/next-number');
          setTransactionNumber(nextRes?.transactionNo || 'TK000000');
          setForm((prev) => ({
            ...prev,
            personnelName: user?.fullName || prev.personnelName,
            warehouseId: prev.warehouseId || warehouseRes?.[0]?.id || ''
          }));
        }
      } catch (error) {
        notify.error('Hata', 'Tüketim işlemi ekranı için gerekli bilgiler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isEditing, transactionNo, user?.fullName]);

  useEffect(() => {
    if (!form.productId || !form.warehouseId) {
      setStockLots([]);
      return;
    }

    const fetchLots = async () => {
      setLoadingLots(true);
      try {
        const res = await api.get(`/inventory/lots?productId=${form.productId}&warehouseId=${form.warehouseId}`);
        setStockLots(Array.isArray(res) ? res : []);
      } catch (error) {
        setStockLots([]);
      } finally {
        setLoadingLots(false);
      }
    };

    fetchLots();
  }, [form.productId, form.warehouseId]);

  const typeOptions = useMemo(() => {
    return types
      .filter((type) => type.status !== 'passive' || type.id === form.typeId)
      .map((type) => ({ id: type.id, label: type.name, subLabel: type.code }));
  }, [types, form.typeId]);

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      label: product.productCode,
      subLabel: product.productName
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses
      .filter((warehouse) => warehouse.status !== 'passive' || warehouse.id === form.warehouseId)
      .map((warehouse) => ({ id: warehouse.id, label: warehouse.name, subLabel: warehouse.code || warehouse.type }));
  }, [warehouses, form.warehouseId]);

  const unitOptions = useMemo(() => {
    const units = new Set<string>(baseUnitOptions);
    if (selectedProduct?.unitOfMeasure) units.add(selectedProduct.unitOfMeasure);
    return Array.from(units).map((unit) => ({ id: unit, label: unit }));
  }, [selectedProduct]);

  const productionOrderOptions = useMemo(() => {
    return productionOrders.map((order) => ({
      id: order.id,
      label: order.lotNumber,
      subLabel: `${order.product?.productCode || ''} ${order.product?.productName || ''}`.trim()
    }));
  }, [productionOrders]);

  const lotOptions = useMemo(() => {
    return stockLots.map((lot) => ({
      id: lot.lotNumber || '',
      label: lot.lotNumber || 'Lotsuz',
      subLabel: `${Number(lot.quantity || 0).toLocaleString('tr-TR')} ${selectedProduct?.unitOfMeasure || form.unit || ''}`.trim()
    }));
  }, [stockLots, selectedProduct, form.unit]);

  const selectedOrders = productionOrders.filter((order) => form.orderIds.includes(order.id));

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    updateForm({
      productId,
      lotNumber: '',
      unit: product?.unitOfMeasure || form.unit
    });
  };

  const handleSave = async () => {
    if (!form.typeId) {
      notify.warning('Tip Seçin', 'Tüketim tipi zorunludur.');
      return;
    }
    if (!form.productId || !form.warehouseId) {
      notify.warning('Eksik Bilgi', 'Stok kodu ve depo seçilmelidir.');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      notify.warning('Miktar Gerekli', 'Miktar 0dan büyük olmalıdır.');
      return;
    }

    const hasNamedLotsOnly = stockLots.some((lot) => lot.lotNumber) && !stockLots.some((lot) => !lot.lotNumber);
    if (hasNamedLotsOnly && !form.lotNumber) {
      notify.warning('Giriş No Seçin', 'Seçilen stok için tüketilecek giriş numarası seçilmelidir.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        personnelName: form.personnelName || user?.fullName || user?.email || ''
      };

      if (isEditing) {
        await api.put(`/consumption-transactions/${transactionNo}`, payload);
        notify.success('Güncellendi', `${transactionNumber} numaralı tüketim işlemi güncellendi.`);
      } else {
        await api.post('/consumption-transactions', payload);
        notify.success('Kaydedildi', `${transactionNumber} numaralı tüketim işlemi oluşturuldu.`);
      }
      navigate('/production/consumption-transactions');
    } catch (error: any) {
      notify.error('İşlem Başarısız', error.message || 'Tüketim işlemi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-6 bg-theme-base animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/production/consumption-transactions')}
            className="p-2 rounded-xl bg-theme-base border border-theme text-theme-muted hover:text-theme-main hover:border-theme-primary/30 transition-all flex items-center justify-center shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-theme-main uppercase flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-theme-primary" />
              {isEditing ? `TÜKETİM: ${transactionNumber}` : 'YENİ TÜKETİM İŞLEMİ'}
            </h2>
            <p className="text-theme-main/80 text-[11px] mt-0.5 font-bold opacity-60">
              Ürün, lot ve üretim emri bazlı tüketim izlenebilirliği
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-theme-primary text-white hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {isEditing ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Hash} label="İşlem No" value={transactionNumber} color="text-theme-primary" />
        <StatCard icon={CalendarClock} label="Tarih" value={format(new Date(form.transactionDate), 'dd/MM/yyyy HH:mm')} color="text-theme-warning" />
        <StatCard icon={Package} label="Stok" value={selectedProduct?.productCode || '-'} color="text-theme-success" />
        <StatCard icon={Warehouse} label="Depo" value={selectedWarehouse?.name || '-'} color="text-theme-danger" />
      </div>

      <div className="modern-glass-card p-0 overflow-visible">
        <div className="p-5 border-b border-theme bg-theme-surface/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-theme-primary/10 rounded-2xl">
              <ClipboardList className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main leading-none uppercase">Tüketim Bilgileri</h3>
              <p className="text-[10px] text-theme-dim font-black uppercase tracking-widest mt-1 opacity-60">
                {form.status === 'used' ? 'Stoktan düşülecek kayıt' : 'İzleme kaydı'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ReadOnlyField label="İşlem No" value={transactionNumber} />
            <Field label="Tipi">
              <CustomSelect options={typeOptions} value={form.typeId} onChange={(value) => updateForm({ typeId: String(value || '') })} placeholder="Tüketim tipi seçin" />
            </Field>
            <ReadOnlyField label="Tarih" value={format(new Date(form.transactionDate), 'dd/MM/yyyy HH:mm')} />
            <Field label="Durumu">
              <CustomSelect options={statusOptions} value={form.status} onChange={(value) => updateForm({ status: String(value || 'pending') })} searchable={false} />
            </Field>
            <Field label="Stok Kodu">
              <CustomSelect options={productOptions} value={form.productId} onChange={(value) => handleProductChange(String(value || ''))} placeholder="Stok seçin" />
            </Field>
            <Field label="Depo">
              <CustomSelect options={warehouseOptions} value={form.warehouseId} onChange={(value) => updateForm({ warehouseId: String(value || ''), lotNumber: '' })} placeholder="Depo seçin" />
            </Field>
            <Field label="Giriş No">
              <CustomSelect
                options={lotOptions}
                value={form.lotNumber}
                onChange={(value) => updateForm({ lotNumber: String(value || '') })}
                placeholder={loadingLots ? 'Lotlar yükleniyor...' : 'Giriş no seçin'}
                disabled={!form.productId || !form.warehouseId}
              />
            </Field>
            <Field label="Seri No">
              <input value={form.serialNo} onChange={(event) => updateForm({ serialNo: event.target.value })} className="form-input h-10 text-xs" placeholder="Elle girilebilir" />
            </Field>
            <ReadOnlyField label="Personel" value={form.personnelName || user?.fullName || '-'} />
            <Field label="Miktar">
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={(event) => updateForm({ quantity: event.target.value })}
                  className="w-full h-10 bg-theme-base border border-theme rounded-xl px-3 text-xs font-black text-theme-main outline-none focus:border-theme-primary transition-all text-right"
                />
                <div className="w-32">
                  <CustomSelect options={unitOptions} value={form.unit} onChange={(value) => updateForm({ unit: String(value || '') })} searchable={false} />
                </div>
              </div>
            </Field>
            <ReadOnlyField label="Mevcut Lot Miktarı" value={form.lotNumber || stockLots.some((lot) => !lot.lotNumber) ? `${availableQty.toLocaleString('tr-TR')} ${selectedProduct?.unitOfMeasure || ''}` : '-'} />
          </div>
        </div>
      </div>

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="bg-theme-base/20 border-b border-theme px-6">
          <div className="flex items-center gap-4 py-4">
            <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={ClipboardList} label="Üretim Emirleri" />
            <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={UserCircle} label="Notlar" />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <Field label="Üretim Emri Ekle">
                <CustomSelect
                  options={productionOrderOptions}
                  value={form.orderIds}
                  onChange={(value) => updateForm({ orderIds: Array.isArray(value) ? value.map(String) : [] })}
                  placeholder="Üretim emri seçin"
                  isMulti
                />
              </Field>

              <div className="overflow-x-auto border border-theme rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-surface/60">
                      <th className="px-4 py-3 text-[10px] font-black text-theme-dim">Emir No</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-dim">Ürün</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-dim">Durum</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-dim text-right">Miktar</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-dim text-center w-16">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme/20">
                    {selectedOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-mono text-xs font-black text-theme-primary">{order.lotNumber}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-theme-main">{order.product?.productCode || '-'}</span>
                            <span className="text-[10px] text-theme-muted font-bold">{order.product?.productName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase">{order.status || '-'}</td>
                        <td className="px-4 py-3 text-right text-xs font-black text-theme-main">{Number(order.quantity || 0).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => updateForm({ orderIds: form.orderIds.filter((id) => id !== order.id) })}
                            className="h-9 w-9 rounded-xl bg-theme-main/5 text-theme-dim hover:text-theme-danger hover:bg-theme-danger/10 transition-all inline-flex items-center justify-center"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selectedOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center opacity-30 italic text-sm">
                          Bu tüketime bağlı üretim emri eklenmedi.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-dim">Notlar</label>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm({ notes: event.target.value })}
                className="form-input min-h-[180px] py-4"
                placeholder="Tüketim işlemiyle ilgili notlar..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-7 rounded-xl bg-theme-primary text-white hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          {isEditing ? 'Güncelle' : 'Oluştur'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <span className="text-[11px] font-black text-theme-dim">{label}</span>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="h-10 bg-theme-base/50 border border-theme rounded-xl px-3 flex items-center text-sm font-black text-theme-muted cursor-not-allowed truncate">
        {value}
      </div>
    </Field>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 pb-2 border-b-2 transition-all whitespace-nowrap text-[10px] uppercase tracking-[0.05em] ${active ? 'border-theme-primary text-theme-primary font-black' : 'border-transparent text-theme-muted hover:text-theme-dim font-bold'}`}
    >
      <Icon className={`w-4 h-4 mb-0.5 ${active ? 'opacity-100' : 'opacity-40'}`} />
      {label}
    </button>
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

export default ConsumptionTransactionForm;
