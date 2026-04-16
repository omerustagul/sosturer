import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  DiamondPlus, Save, ChevronLeft, Plus,
  Package, Layers, Workflow, Boxes,
  AlertTriangle, Cpu, ShoppingBag, Link2,
  ClipboardList, Calendar, Trash2, CheckCircle2,
  AlertCircle, History, Clock, UserCircle,
  SkipBack, SkipForward
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

type TabType = 'operations' | 'components' | 'events' | 'machines' | 'orders' | 'links' | 'notes' | 'dates';

export function ProductionOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [activeTab, setActiveTab] = useState<TabType>('operations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Master Data
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<any>({
    productId: '',
    lotNumber: '',
    quantity: 0,
    type: 'Asıl',
    targetWarehouseId: '',
    notes: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    expiryDate: '',
    sterilizationDate: '',
    productionDate: ''
  });

  // Tab Data
  const [steps, setSteps] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  // const [orderEvents, setOrderEvents] = useState<any[]>([]);
  const [assignedMachines, setAssignedMachines] = useState<any[]>([]);

  // Dynamic Lots for Components
  const [rowLots, setRowLots] = useState<Record<number, any[]>>({});

  const fetchLotsForRow = async (index: number, pid: string, wid: string) => {
    if (!pid || !wid) {
      setRowLots(prev => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const res = await api.get(`/inventory/lots`, { params: { productId: pid, warehouseId: wid } });
      setRowLots(prev => ({
        ...prev,
        [index]: Array.isArray(res) ? res.map((l: any) => ({
          id: l.lotNumber,
          label: l.lotNumber,
          subLabel: `Stok: ${l.quantity}`
        })) : []
      }));
    } catch (e) {
      console.error('Failed to fetch lots:', e);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pRes, wRes, mRes] = await Promise.all([
          api.get('/products'),
          api.get('/inventory/warehouses'),
          api.get('/machines'),
        ]);
        setProducts(pRes || []);
        setWarehouses(wRes || []);
        setMachines(mRes || []);

        if (isEditing) {
          const order = await api.get(`/production-orders/${id}`);
          setFormData({
            ...order,
            startDate: order.startDate?.slice(0, 10),
            endDate: order.endDate?.slice(0, 10),
            expiryDate: order.expiryDate?.slice(0, 10),
            sterilizationDate: order.sterilizationDate?.slice(0, 10),
            productionDate: order.productionDate?.slice(0, 10)
          });
          setSteps(order.steps || []);
          setComponents(order.components || []);
          // setOrderEvents(order.events || []);
          setAssignedMachines(order.machines || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEditing]);

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData({
        ...formData,
        productId,
        quantity: product.defaultProductionQty || 0,
        targetWarehouseId: product.targetWarehouseId || ''
      });
      // Fetch default recipe for this product
      if (product.route?.steps) {
        setSteps(product.route.steps.map((r: any) => ({
          operationId: r.operationId,
          operation: r.operation,
          sequence: r.sequence,
          status: 'pending'
        })));
      }

      // Auto-populate components from defaults
      if (product.defaultComponents?.length > 0) {
        setComponents(product.defaultComponents.map((c: any) => ({
          componentProductId: c.componentProductId,
          quantity: c.quantity,
          consumptionType: c.consumptionType || 'UNIT',
          unit: c.unit || 'PCS',
          warehouseId: c.warehouseId,
          lotNumber: c.lotNumber,
          notes: c.notes || ''
        })));
      }

      // Auto-populate machines from defaults
      if (product.defaultMachines?.length > 0) {
        setAssignedMachines(product.defaultMachines.map((m: any) => ({
          machineId: m.machineId,
          unitTimeSeconds: m.unitTimeSeconds
        })));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.productId || !formData.quantity) {
      alert('Lütfen ürün ve adet bilgilerini doldurun.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        components,
        machines: assignedMachines,
      };
      if (isEditing) {
        await api.put(`/production-orders/${id}`, payload);
      } else {
        await api.post('/production-orders', payload);
      }
      navigate('/planning/production-orders');
    } catch (e) {
      alert('Kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Re-calculate component quantities when order quantity or product changes
  useEffect(() => {
    if (!formData.quantity || isEditing || !formData.productId) return;

    const product = products.find(p => p.id === formData.productId);
    if (!product) return;

    setComponents(prev => prev.map(c => {
      // UNIT: default_qty * order_qty
      if (c.consumptionType === 'UNIT') {
        const def = product.defaultComponents?.find((dc: any) => dc.componentProductId === c.componentProductId);
        if (def) return { ...c, quantity: Number(def.quantity) * Number(formData.quantity) };
      }

      // UNIT_CONSUMPTION: (measurements) * order_qty
      if (c.consumptionType === 'UNIT_CONSUMPTION') {
        const { width = 0, height = 0, depth = 0, density = 0 } = product.measurements || {};
        // Placeholder formula: Volume (cm3) * density (g/cm3) = grams. 
        // 1cm3 = 1000mm3
        const volumeCm3 = (width * height * depth) / 1000;
        const weightGrams = volumeCm3 * density;
        const calculatedQty = weightGrams > 0 ? weightGrams : 1;
        return { ...c, quantity: calculatedQty * Number(formData.quantity) };
      }

    }));
  }, [formData.quantity, formData.productId]);

  useEffect(() => {
    if (components.length > 0 && products.length > 0 && warehouses.length > 0) {
      components.forEach((c, i) => {
        if (c.componentProductId && c.warehouseId && (!rowLots[i] || rowLots[i].length === 0)) {
          fetchLotsForRow(i, c.componentProductId, c.warehouseId);
        }
      });
    }
  }, [components.length, products.length, warehouses.length]);

  const addComponent = () => setComponents([...components, {
    componentProductId: '',
    quantity: 1,
    consumptionType: 'UNIT',
    unit: 'PCS',
    warehouseId: '',
    lotNumber: '',
    notes: ''
  }]);
  const addMachine = () => setAssignedMachines([...assignedMachines, { machineId: '', unitTimeSeconds: 60 }]);
  // const addEvent = () => setOrderEvents([...orderEvents, { type: 'RED', quantity: 0, description: '', operatorId: '' }]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loading size="lg" /></div>;

  return (
    <div className="min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header Bar */}
      <div className="h-20 bg-theme-surface/80 backdrop-blur-xl border-b border-theme px-6 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-start gap-2">
          <button onClick={() => navigate('/planning/production-orders')} className="p-1 border border-theme rounded-xl hover:bg-theme-main/5 text-theme-muted transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-black text-theme-main flex items-center gap-2">
              {isEditing ? `ÜRETİM EMRİ: ${formData.lotNumber}` : 'YENİ ÜRETİM EMRİ OLUŞTUR'}
            </h2>
            <div className="flex items-center gap-3 mt-0">
              <span className="px-2 py-0.5 bg-theme-primary/10 text-theme-primary text-[10px] font-black rounded uppercase tracking-wider">
                {formData.status}
              </span>
              <span className="text-theme-muted text-[10px] font-bold uppercase tracking-widest">
                {formData.type} ÜRETİM
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-theme-base/20 p-1 rounded-xl border border-theme">
            <button
              onClick={() => {
                const flow = ['planned', 'active', 'completed', 'cancelled'];
                const idx = flow.indexOf(formData.status);
                if (idx > 0) setFormData({ ...formData, status: flow[idx - 1] });
              }}
              className="p-2 text-theme-muted hover:text-theme-primary transition-all active:scale-95"
              title="Geri Al"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <div className="px-3 py-1 bg-theme-surface rounded-lg border border-theme shadow-sm">
              <span className="text-[10px] font-black uppercase text-theme-primary tracking-widest whitespace-nowrap">
                {formData.status === 'planned' ? 'Planlandı' : 
                 formData.status === 'active' ? 'Devam Ediyor' : 
                 formData.status === 'completed' ? 'Tamamlandı' : 
                 formData.status === 'cancelled' ? 'İptal Edildi' : formData.status}
              </span>
            </div>
            <button
              onClick={() => {
                const flow = ['planned', 'active', 'completed', 'cancelled'];
                const idx = flow.indexOf(formData.status);
                if (idx < flow.length - 1) setFormData({ ...formData, status: flow[idx + 1] });
              }}
              className="p-2 text-theme-muted hover:text-theme-primary transition-all active:scale-95"
              title="İlerlet"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 py-2 bg-theme-primary text-white rounded-xl font-black text-xs shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loading size="sm" /> : <><Save className="w-4 h-4" />KAYDET</>}
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Column: Core Info */}
        <div className="xl:col-span-1 space-y-6">
          <div className="modern-glass-card p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-theme mb-2">
                <Package className="w-5 h-5 text-theme-primary" />
                <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">ÜRÜN VE MİKTAR</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">STOK KARTI / ÜRÜN</label>
                <CustomSelect
                  options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                  value={formData.productId}
                  onChange={handleProductChange}
                  placeholder="Ürün Seçin"
                  disabled={isEditing}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">PLANLANAN ADET</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">LOT NUMARASI</label>
                  <input
                    value={formData.lotNumber}
                    disabled
                    className="form-input bg-theme-base/20"
                    placeholder="Otomatik"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-theme mb-2">
                <Layers className="w-5 h-5 text-theme-secondary" />
                <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">KLASİFİKASYON</h3>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRETİM EMRİ TİPİ</label>
                <CustomSelect
                  options={[
                    { id: 'Asıl', label: 'Asıl Üretim' },
                    { id: 'Tekrar', label: 'Tekrar İşlem' },
                    { id: 'Bölünmüş', label: 'Bölünmüş İşemri' },
                    { id: 'ArGe', label: 'Ar-Ge / Numune' },
                    { id: 'Fason', label: 'Fason Üretim' },
                    { id: 'Final', label: 'Final Kontrol' }
                  ]}
                  value={formData.type}
                  onChange={(v) => setFormData({ ...formData, type: v })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">HEDEF DEPO</label>
                <CustomSelect
                  options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                  value={formData.targetWarehouseId}
                  onChange={(v) => setFormData({ ...formData, targetWarehouseId: v })}
                />
              </div>
            </div>

            <div className="p-4 bg-theme-primary/5 border border-theme-primary/20 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-theme-primary">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">TAKİP SİSTEMİ</span>
              </div>
              <p className="text-[11px] text-theme-dim font-bold leading-relaxed">
                Ürüne ait takip tipi: <span className="text-theme-primary">{products.find(p => p.id === formData.productId)?.trackingType || 'BELİRTİLMEMİŞ'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Tabs and Details */}
        <div className="xl:col-span-3 space-y-6">
          <div className="modern-glass-card overflow-hidden p-0 flex flex-col min-h-[450px]">
            {/* Tabs Header */}
            <div className="bg-theme-base/20 border-b border-theme px-6 overflow-x-auto">
              <div className="flex justify-between items-center w-full gap-4 pt-6 py-4">
                {[
                  { id: 'operations', label: 'OPERASYONLAR', icon: Workflow },
                  { id: 'components', label: 'BİLEŞENLER', icon: Boxes },
                  { id: 'events', label: 'OLAYLAR', icon: AlertTriangle },
                  { id: 'machines', label: 'MAKİNE BİLGİSİ', icon: Cpu },
                  { id: 'orders', label: 'SİPARİŞLER', icon: ShoppingBag },
                  { id: 'links', label: 'BAĞLI EMİRLER', icon: Link2 },
                  { id: 'notes', label: 'NOTLAR', icon: ClipboardList },
                  { id: 'dates', label: 'TARİHLER', icon: Calendar },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      flex items-center gap-1 pb-2 border-b-2 transition-all whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'border-theme-primary text-theme-primary font-black'
                        : 'border-transparent text-theme-muted hover:text-theme-dim font-bold'}
                      text-[10px] uppercase tracking-[0.15em]
                    `}
                  >
                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-40'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-3">
              {activeTab === 'operations' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-theme text-[9px] font-black text-theme-muted uppercase tracking-widest bg-theme-base/10">
                        <th className="px-2 py-3 text-center">SIRA</th>
                        <th className="px-2 py-3">PROSES KODU</th>
                        <th className="px-2 py-3">OPERASYON ADI</th>
                        <th className="px-2 py-3">DURUM</th>
                        <th className="px-2 py-3">ONAYLAYAN</th>
                        <th className="px-2 py-3 text-center">#</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {steps.map((step, idx) => (
                        <tr key={idx} className="hover:bg-theme-primary/5 transition-colors group">
                          <td className="px-2 py-2 font-black text-center text-theme-primary">{step.sequence}</td>
                          <td className="px-2 py-2 text-xs font-bold text-theme-main">{step.operation?.code}</td>
                          <td className="px-2 py-2 text-xs font-bold text-theme-dim">{step.operation?.name}</td>
                          <td className="px-2 py-2">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${step.status === 'completed' ? 'bg-theme-success/10 text-theme-success' : 'bg-theme-warning/10 text-theme-warning'
                              }`}>
                              {step.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-theme-muted italic">
                              <UserCircle className="w-3.5 h-3.5" />
                              {step.confirmedBy || 'Bekleniyor...'}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button className="p-2 hover:bg-theme-primary/10 text-theme-muted rounded-xl transition-all">
                              <DiamondPlus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'components' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">HAMMADDE VE BİLEŞEN LİSTESİ</p>
                    <button onClick={addComponent} className="btn-secondary h-10 px-4 py-2 flex items-center gap-2 text-[9px] font-black bg-theme-primary/10 rounded-xl text-theme-primary border border-theme-primary/20 shadow-lg shadow-theme-primary/10 hover:scale-103">
                      <Plus className="w-3.5 h-3.5" /> BİLEŞEN EKLE
                    </button>
                  </div>
                  <div className="border border-theme rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-theme-base/10">
                        <tr className="text-[9px] font-black text-theme-muted uppercase tracking-widest">
                          <th className="px-2 py-3">BİLEŞEN ÜRÜN</th>
                          <th className="px-2 py-3">DEPO</th>
                          <th className="px-2 py-3">LOT NUMARASI</th>
                          <th className="px-2 py-3">TİP</th>
                          <th className="px-2 py-3 w-32">MİKTAR</th>
                          <th className="px-2 py-3">NOTLAR</th>
                          <th className="px-2 py-3 w-20">SİL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme">
                        {components.map((c, i) => (
                          <tr key={i}>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                                value={c.componentProductId}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].componentProductId = v;
                                  setComponents(nc);
                                  // Fetch lots if warehouse already selected
                                  if (nc[i].warehouseId) fetchLotsForRow(i, v, nc[i].warehouseId);
                                }}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                                value={c.warehouseId}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].warehouseId = v;
                                  setComponents(nc);
                                  // Fetch lots for this product in this warehouse
                                  if (nc[i].componentProductId) fetchLotsForRow(i, nc[i].componentProductId, v);
                                }}
                                placeholder="Depo..."
                              />
                            </td>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={rowLots[i] || []}
                                value={c.lotNumber}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].lotNumber = v;
                                  setComponents(nc);
                                }}
                                placeholder={!c.componentProductId || !c.warehouseId ? "Ürün/Depo seçin" : "Lot Seçin"}
                                disabled={!c.componentProductId || !c.warehouseId}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={[
                                  { id: 'UNIT', label: 'Birim' },
                                  { id: 'UNIT_CONSUMPTION', label: 'Sarfiyat' },
                                  { id: 'FIXED', label: 'Sabit' }
                                ]}
                                value={c.consumptionType}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].consumptionType = v;
                                  setComponents(nc);
                                }}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  value={c.quantity}
                                  disabled={c.consumptionType === 'UNIT_CONSUMPTION'}
                                  onChange={(e) => {
                                    const nc = [...components];
                                    nc[i].quantity = e.target.value;
                                    setComponents(nc);
                                  }}
                                  className={`form-input text-xs text-right w-15 ${c.consumptionType === 'UNIT_CONSUMPTION' ? 'bg-theme-base/5 opacity-50 cursor-not-allowed' : ''}`}
                                />
                                <div className="w-full h-10">
                                  <CustomSelect
                                    variant="inline"
                                    options={[
                                      { id: 'ADET', label: 'Adet' },
                                      { id: 'GR', label: 'Gram' },
                                      { id: 'KG', label: 'Kilogram' },
                                      { id: 'MM', label: 'Milimetre' },
                                      { id: 'CM', label: 'Santimetre' },
                                      { id: 'M', label: 'Metre' },
                                      { id: 'KASA', label: 'Kasa' },
                                      { id: 'CUVAL', label: 'Çuval' },
                                      { id: 'KOLI', label: 'Koli' },
                                      { id: 'KUTU', label: 'Kutu' },
                                    ]}
                                    value={c.unit || 'PCS'}
                                    onChange={(v) => {
                                      const nc = [...components];
                                      nc[i].unit = v;
                                      setComponents(nc);
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <input
                                value={c.notes}
                                onChange={(e) => {
                                  const nc = [...components];
                                  nc[i].notes = e.target.value;
                                  setComponents(nc);
                                }}
                                className="form-input text-xs"
                              />
                            </td>
                            <td className="px-2 py-3">
                              <button onClick={() => setComponents(components.filter((_, idx) => idx !== i))} className="p-3 text-theme-danger hover:bg-theme-danger/10 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'machines' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ATANMIŞ MAKİNE VE TEZGAH BİLGİSİ</p>
                    <button onClick={addMachine} className="btn-secondary h-10 px-4 py-2 flex items-center gap-2 text-[9px] font-black bg-theme-primary/10 rounded-xl text-theme-primary border border-theme-primary/20 shadow-lg shadow-theme-primary/10 hover:scale-103">
                      <Plus className="w-3.5 h-3.5" /> MAKİNE EKLE
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {assignedMachines.map((m, i) => {
                      const product = products.find(p => p.id === formData.productId);
                      const machineOptions = product?.defaultMachines?.map((dm: any) => ({
                        id: dm.machineId,
                        label: dm.machine?.code || 'Makine',
                        subLabel: dm.machine?.name || '',
                        defaultTime: dm.unitTimeSeconds
                      })) || [];

                      return (
                        <div key={i} className="flex items-center gap-4 p-3 border border-theme rounded-2xl bg-theme-base/5 hover:bg-theme-main/5 transition-all group">
                          <div className="w-12 h-12 rounded-xl bg-theme-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                            <Cpu className="w-6 h-6 text-theme-primary" />
                          </div>

                          <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-12 lg:col-span-7">
                              <CustomSelect
                                options={machineOptions}
                                value={m.machineId}
                                onChange={(v) => {
                                  const nm = [...assignedMachines];
                                  nm[i].machineId = v;
                                  // Auto-fill unit time from the selected default machine
                                  const dm = machineOptions.find((o: any) => o.id === v);
                                  if (dm) nm[i].unitTimeSeconds = dm.defaultTime;
                                  setAssignedMachines(nm);
                                }}
                                placeholder={!formData.productId ? "Önce Ürün Seçin" : "Makine Seçin..."}
                                disabled={!formData.productId}
                              />
                            </div>

                            <div className="col-span-12 lg:col-span-5 flex items-center gap-4 bg-theme-base/30 h-10 px-4 py-2 rounded-xl border border-theme/50">
                              <div className="flex items-center gap-2 shrink-0">
                                <Clock className="w-4 h-4 text-theme-primary/60" />
                                <span className="text-[10px] font-black text-theme-muted uppercase tracking-tighter">BİRİM SÜRE (SN)</span>
                              </div>
                              <input
                                type="number"
                                value={m.unitTimeSeconds}
                                onChange={(e) => {
                                  const nm = [...assignedMachines];
                                  nm[i].unitTimeSeconds = e.target.value;
                                  setAssignedMachines(nm);
                                }}
                                className="form-input h-8 text-xs text-right font-bold w-full bg-transparent border-none focus:ring-0 p-0"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => setAssignedMachines(assignedMachines.filter((_, idx) => idx !== i))}
                            className="p-3 text-theme-muted hover:text-theme-danger hover:bg-theme-danger/10 rounded-xl transition-all shrink-0 active:scale-90"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRETİM EMRİ ÖZEL NOTLARI</p>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input flex-1 min-h-[400px] py-6 px-6 text-sm leading-relaxed"
                    placeholder="Üretim sırasında dikkat edilmesi gereken hususlar..."
                  />
                </div>
              )}

              {activeTab === 'dates' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-theme-primary" /> ZAMAN ÇİZELGESİ VE KRİTİK TARİHLER
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-base/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-theme-primary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">PLANLAMA</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">BAŞLAMA TARİHİ</label>
                          <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="form-input" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">BİTİŞ TARİHİ</label>
                          <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="form-input" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-warning/5 border-theme-warning/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-warning/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-theme-warning" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-theme-warning">ÜRETİM / SKT</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">ÜRETİM TARİHİ</label>
                          <input type="date" value={formData.productionDate} onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })} className="form-input" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">SON KULLANMA TARİHİ</label>
                          <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className="form-input" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-secondary/5 border-theme-secondary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-secondary/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-theme-secondary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-theme-secondary">STERİLİZASYON</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">STERİL TARİHİ</label>
                          <input type="date" value={formData.sterilizationDate} onChange={(e) => setFormData({ ...formData, sterilizationDate: e.target.value })} className="form-input" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {['events', 'orders', 'links'].includes(activeTab) && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-30 gap-6 grayscale">
                  <Workflow className="w-10 h-10 stroke-[0.5]" />
                  <div className="space-y-2">
                    <h4 className="text-md font-black uppercase text-theme-dim">MODÜL YÜKLENİYOR</h4>
                    <p className="text-xs font-bold max-w-sm mx-auto leading-relaxed">
                      {activeTab === 'events' && 'Olay kayıtları, red ve numune yönetim sistemi üretim emri başlatıldıktan sonra aktifleşir.'}
                      {activeTab === 'orders' && 'Satış siparişleri ile üretim emri eşleşmeleri bu bölümde listelenir.'}
                      {activeTab === 'links' && 'Parçalı üretim veya ilişkili üretim emirleri arasındaki hiyerarşik bağlar burada yönetilir.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
