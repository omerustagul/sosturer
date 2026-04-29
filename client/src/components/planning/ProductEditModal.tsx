import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import {
  X, Save, Package, Layers,
  Workflow, Map, Info,
  Plus, Trash2, Gauge,
  ShoppingBag, Cpu
} from 'lucide-react';
import { Loading } from '../common/Loading';
import { CustomSelect } from '../common/CustomSelect';

interface ProductEditModalProps {
  product: any;
  onClose: () => void;
  onSave: () => void;
  warehouses: any[];
  routes: any[];
  allProducts?: any[]; // For component selection
  machines?: any[];     // For machine assignment
}

export function ProductEditModal({
  product, onClose, onSave, warehouses, routes,
  allProducts = [], machines = []
}: ProductEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    ...product,
    measurements: product.measurements || { width: 0, height: 0, depth: 0, density: 0, weight: 0 },
    defaultComponents: product.defaultComponents || [],
    defaultMachines: product.defaultMachines || [],
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'route' | 'measurements' | 'components' | 'machines' | 'advanced'>('basic');
  const [componentLots, setComponentLots] = useState<Record<string, any[]>>({});

  // Fetch initial lots for existing components
  useEffect(() => {
    if (formData.defaultComponents?.length > 0) {
      formData.defaultComponents.forEach((comp: any, idx: number) => {
        if (comp.componentProductId && comp.warehouseId) {
          fetchLots(idx, comp.componentProductId, comp.warehouseId);
        }
      });
    }
  }, []);

  // Tab Navigation items
  const tabs = [
    { id: 'basic', label: 'Genel Bilgiler', icon: Info },
    { id: 'measurements', label: 'Ölçümler', icon: Gauge },
    { id: 'route', label: 'Üretim Reçetesi', icon: Map },
    { id: 'components', label: 'Bileşenler', icon: ShoppingBag },
    { id: 'machines', label: 'Makine Bilgisi', icon: Cpu },
    { id: 'advanced', label: 'Gelişmiş Ayarlar', icon: Layers },
  ];

  const handleAddComponent = () => {
    const newComponent = {
      id: `temp-${Date.now()}`,
      componentProductId: '',
      warehouseId: '',
      lotNumber: '',
      quantity: 0,
      consumptionType: 'UNIT',
      unit: 'PCS',
      notes: ''
    };
    setFormData({
      ...formData,
      defaultComponents: [...formData.defaultComponents, newComponent]
    });
  };

  const handleRemoveComponent = (id: string) => {
    setFormData({
      ...formData,
      defaultComponents: formData.defaultComponents.filter((c: any) => c.id !== id)
    });
  };

  const handleAddMachine = () => {
    const newMachine = {
      id: `temp-${Date.now()}`,
      machineId: '',
      unitTimeSeconds: 0
    };
    setFormData({
      ...formData,
      defaultMachines: [...formData.defaultMachines, newMachine]
    });
  };

  const handleRemoveMachine = (id: string) => {
    setFormData({
      ...formData,
      defaultMachines: formData.defaultMachines.filter((m: any) => m.id !== id)
    });
  };

  const fetchLots = async (componentIndex: number, productId: string, warehouseId: string) => {
    if (!productId || !warehouseId) return;
    try {
      const res = await api.get(`/inventory/lots?productId=${productId}&warehouseId=${warehouseId}`);
      setComponentLots(prev => ({ ...prev, [componentIndex]: res || [] }));
    } catch (error) {
      console.error('Lot error:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Clean up temp IDs before saving
      const cleanData = {
        ...formData,
        defaultComponents: formData.defaultComponents.map(({ id, ...rest }: any) =>
          id.startsWith('temp-') ? rest : { id, ...rest }
        ),
        defaultMachines: formData.defaultMachines.map(({ id, ...rest }: any) =>
          id.startsWith('temp-') ? rest : { id, ...rest }
        )
      };
      await api.put(`/products/${product.id}`, cleanData);
      onSave();
      onClose();
    } catch (error) {
      alert('Güncelleme başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-theme-main/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="w-full max-w-6xl bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-3 border-b border-theme bg-theme-base/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-md font-black text-theme-main tracking-tight uppercase">STOK KARTI DÜZENLE</h3>
              <p className="text-theme-muted text-xs font-bold mt-0.5">{product.productCode} — {product.productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-theme-main/5 text-theme-muted rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-theme bg-theme-base/5 px-6 gap-6 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1 py-4 border-b-2 transition-all text-[10px] font-bold uppercase whitespace-nowrap ${activeTab === tab.id
                ? 'border-theme-primary text-theme-primary'
                : 'border-transparent text-theme-dim hover:text-theme-muted'
                }`}
            >
              <tab.icon className="w-3.5 h-3.5 mb-0.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <form id="product-edit-form" onSubmit={handleSave} className="space-y-8">
            {activeTab === 'measurements' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="p-4 bg-theme-base/5 border border-theme rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest">Temel Boyutlar</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Genişlik (mm)</label>
                      <input type="number" value={formData.measurements?.width || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, width: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Boy / Uzunluk (mm)</label>
                      <input type="number" value={formData.measurements?.height || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, height: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Çap (mm)</label>
                      <input type="number" value={formData.measurements?.diameter || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, diameter: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Derinlik/Kalınlık (mm)</label>
                      <input type="number" value={formData.measurements?.depth || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, depth: Number(e.target.value) } })} />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-theme-base/5 border border-theme rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black text-theme-primary uppercase tracking-widest">Fiziksel Özellikler</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Yoğunluk (g/cm³)</label>
                      <input type="number" value={formData.measurements?.density || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, density: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-theme-muted uppercase">Birim Ağırlık (g)</label>
                      <input type="number" value={formData.measurements?.weight || 0} className="form-input" onChange={e => setFormData({ ...formData, measurements: { ...formData.measurements, weight: Number(e.target.value) } })} />
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-theme-primary/20 bg-theme-primary/5 rounded-2xl flex flex-col justify-center items-center text-center space-y-2">
                  <Gauge className="w-8 h-8 text-theme-primary opacity-20" />
                  <p className="text-[11px] font-bold text-theme-muted max-w-[200px]">Bu ölçümler "Birim Sarfiyat" hesaplamalarında temel alınacaktır.</p>
                </div>
              </div>
            )}

            {activeTab === 'components' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Varsayılan Bileşenler</h4>
                  <button type="button" onClick={handleAddComponent} className="btn-secondary py-1 px-3 text-[9px] font-black flex items-center gap-2">
                    <Plus className="w-3 h-3" /> BİLEŞEN EKLE
                  </button>
                </div>

                <div className="border border-theme rounded-xl overflow-x-auto">
                  <table className="w-full text-left min-w-[750px] max-w-[1200px]">
                    <thead className="bg-theme-base/10 border-b border-theme">
                      <tr className="text-[9px] font-black text-theme-muted">
                        <th className="px-4 py-3 w-[15%]">Bileşen Ürün</th>
                        <th className="px-4 py-3 w-[15%]">Depo</th>
                        <th className="px-4 py-3 w-[15%]">Lot No</th>
                        <th className="px-4 py-3 w-[10%]">Tip</th>
                        <th className="px-4 py-3 w-[20%]">Miktar / Birim</th>
                        <th className="px-4 py-3 text-center w-[15%]">Sil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {formData.defaultComponents.map((comp: any, idx: number) => (
                        <tr key={comp.id} className="text-xs group hover:bg-theme-base/5">
                          <td className="px-4 py-3 w-[15%]">
                            <CustomSelect
                              options={allProducts.map(p => ({ id: p.id, label: p.productName, subLabel: p.productCode }))}
                              value={comp.componentProductId}
                              onChange={(val) => {
                                const newComponents = [...formData.defaultComponents];
                                newComponents[idx].componentProductId = val;
                                setFormData({ ...formData, defaultComponents: newComponents });
                                if (comp.warehouseId) fetchLots(idx, val, comp.warehouseId);
                              }}
                              placeholder="Ürün Seçin..."
                            />
                          </td>
                          <td className="px-4 py-3 w-[15%]">
                            <CustomSelect
                              options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                              value={comp.warehouseId}
                              onChange={(val) => {
                                const newComponents = [...formData.defaultComponents];
                                newComponents[idx].warehouseId = val;
                                newComponents[idx].lotNumber = ''; // Depo değişince lot sıfırlanmalı
                                setFormData({ ...formData, defaultComponents: newComponents });
                                if (comp.componentProductId) fetchLots(idx, comp.componentProductId, val);
                              }}
                              placeholder="Depo..."
                            />
                          </td>
                          <td className="px-4 py-3 w-[15%]">
                            <CustomSelect
                              disabled={!comp.warehouseId}
                              options={(componentLots[idx] || []).map(l => ({ id: l.lotNumber, label: l.lotNumber, subLabel: `Stok: ${l.quantity}` }))}
                              value={comp.lotNumber}
                              onChange={(val) => {
                                const newComponents = [...formData.defaultComponents];
                                newComponents[idx].lotNumber = val;
                                setFormData({ ...formData, defaultComponents: newComponents });
                              }}
                              placeholder={comp.warehouseId ? "Lot Seçin..." : "Depo Seçilmeli"}
                            />
                          </td>
                          <td className="px-4 py-3 w-[10%]">
                            <CustomSelect
                              options={[
                                { id: 'UNIT', label: 'Birim Miktar' },
                                { id: 'UNIT_CONSUMPTION', label: 'Birim Sarfiyat' },
                                { id: 'FIXED', label: 'Sabit Miktar' }
                              ]}
                              value={comp.consumptionType}
                              onChange={(val) => {
                                const newComponents = [...formData.defaultComponents];
                                newComponents[idx].consumptionType = val;
                                setFormData({ ...formData, defaultComponents: newComponents });
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 w-[20%] space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="number"
                                disabled={comp.consumptionType === 'UNIT_CONSUMPTION'}
                                value={comp.quantity}
                                className="form-input text-center h-10 w-20 disabled:bg-theme-base/10"
                                onChange={e => {
                                  const newComponents = [...formData.defaultComponents];
                                  newComponents[idx].quantity = Number(e.target.value);
                                  setFormData({ ...formData, defaultComponents: newComponents });
                                }}
                              />
                              <CustomSelect
                                options={['PCS', 'GR', 'KG', 'M', 'M2', 'M3'].map(u => ({ id: u, label: u }))}
                                value={comp.unit}
                                onChange={(val) => {
                                  const newComponents = [...formData.defaultComponents];
                                  newComponents[idx].unit = val as string;
                                  setFormData({ ...formData, defaultComponents: newComponents });
                                }}
                              />
                            </div>
                            {comp.consumptionType === 'UNIT_CONSUMPTION' && (
                              <p className="text-[9px] text-theme-primary font-bold uppercase italic">* Ölçümlere göre otomatik hesaplanır</p>
                            )}
                          </td>
                          <td className="px-4 py-3 w-[5%] text-center">
                            <button type="button" onClick={() => handleRemoveComponent(comp.id)} className="p-2 text-theme-danger hover:bg-theme-danger/10 rounded-lg transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.defaultComponents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-36 text-center text-theme-muted text-xs font-bold opacity-30">Bileşen tanımlanmamış</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'machines' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-theme-muted">Atanmış Makineler</h4>
                  <button type="button" onClick={handleAddMachine} className="btn-secondary py-1 px-3 text-[9px] font-black flex items-center gap-2">
                    <Plus className="w-3 h-3" /> MAKİNE EKLE
                  </button>
                </div>

                <div className="border border-theme rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-theme-base/10 border-b border-theme">
                      <tr className="text-[9px] font-black text-theme-muted">
                        <th className="px-4 py-3">Makine / Tezgah</th>
                        <th className="px-4 py-3 w-48 text-center">Birim Süre (Saniye)</th>
                        <th className="px-4 py-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {formData.defaultMachines.map((m: any, idx: number) => (
                        <tr key={m.id} className="text-xs group hover:bg-theme-base/5">
                          <td className="px-4 py-3">
                            <CustomSelect
                              options={machines.map(mac => ({ id: mac.id, label: mac.name, subLabel: mac.code }))}
                              value={m.machineId}
                              onChange={(val) => {
                                const newMachines = [...formData.defaultMachines];
                                newMachines[idx].machineId = val;
                                setFormData({ ...formData, defaultMachines: newMachines });
                              }}
                              placeholder="Makine Seçin..."
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={m.unitTimeSeconds}
                              className="form-input text-center h-9 font-mono"
                              onChange={e => {
                                const newMachines = [...formData.defaultMachines];
                                newMachines[idx].unitTimeSeconds = Number(e.target.value);
                                setFormData({ ...formData, defaultMachines: newMachines });
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => handleRemoveMachine(m.id)} className="p-2 text-theme-danger hover:bg-theme-danger/10 rounded-lg transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.defaultMachines.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-36 text-center text-theme-muted text-xs font-bold opacity-30">Makine atanmamış</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'basic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRÜN KODU</label>
                  <input required value={formData.productCode || ''} className="form-input" onChange={e => setFormData({ ...formData, productCode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRÜN ADI</label>
                  <input required value={formData.productName || ''} className="form-input" onChange={e => setFormData({ ...formData, productName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">MARKA</label>
                  <input value={formData.brand || ''} className="form-input" onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRÜN GRUBU / KATEGORİ</label>
                  <input value={formData.productGroup || ''} className="form-input" onChange={e => setFormData({ ...formData, productGroup: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">AÇIKLAMA</label>
                  <textarea value={formData.description || ''} className="form-input min-h-[100px]" onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
              </div>
            )}

            {activeTab === 'route' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="p-3 bg-theme-primary/5 border border-theme-primary/20 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Map className="w-6 h-6 text-theme-primary" />
                    <div>
                      <h4 className="font-black text-theme-main text-sm">ÜRETİM REÇETESİ SEÇİMİ</h4>
                      <p className="text-[10px] text-theme-muted font-bold">Bu ürün için kullanılacak standart üretim akışını belirleyin.</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="text-[10px] font-black text-theme-muted mb-2 block">STANDART REÇETE</label>
                    <CustomSelect
                      options={[...routes].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(r => ({
                        id: r.id,
                        label: `${r.code} — ${r.name}`,
                        subLabel: `${r.steps?.length || 0} Operasyon`
                      }))}
                      value={formData.routeId || ''}
                      onChange={(val: any) => setFormData({ ...formData, routeId: val })}
                      placeholder="Reçete Seçin..."
                    />
                  </div>
                </div>

                {formData.routeId && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-theme-muted flex items-center gap-2">
                      <Workflow className="w-4 h-4" /> REÇETE ÖNİZLEME
                    </p>
                    <div className="border border-theme rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-theme-base/10 border-b border-theme">
                          <tr className="text-[9px] font-black text-theme-muted">
                            <th className="px-4 py-3">Sıra</th>
                            <th className="px-4 py-3">Operasyon</th>
                            <th className="px-4 py-3">Birim</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme">
                          {routes.find(r => r.id === formData.routeId)?.steps?.map((step: any, idx: number) => (
                            <tr key={idx} className="text-xs">
                              <td className="px-4 py-3 font-bold text-theme-primary">{step.sequence}</td>
                              <td className="px-4 py-3 font-bold text-theme-main">{step.operation?.name}</td>
                              <td className="px-4 py-3 text-theme-muted">{step.operation?.unit?.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">TAKİP SİSTEMİ</label>
                  <CustomSelect
                    options={[
                      { id: 'LOT', label: 'Lot Takibi' },
                      { id: 'SERIAL', label: 'Seri No Takibi' },
                      { id: 'BOTH', label: 'Lot ve Seri Takibi' },
                      { id: 'NONE', label: 'Takip Yok' }
                    ]}
                    value={formData.trackingType || 'NONE'}
                    onChange={(val: any) => setFormData({ ...formData, trackingType: val })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">STOK TİPİ</label>
                  <CustomSelect
                    options={[
                      'Hammadde', 'Sarf Malzeme', 'Yarımamül', 'Mamül', 'Ölçüm Aracı',
                      'Ekipman', 'Kalıp', 'Yardımcı Malzeme', 'Tüketim Malzemesi',
                      'Ambalaj', 'Yedek Parça'
                    ].map(s => ({ id: s, label: s }))}
                    value={formData.stockType || ''}
                    onChange={(val: any) => setFormData({ ...formData, stockType: val })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">STD. ÜRETİM ADETİ (LOT)</label>
                  <input type="number" value={formData.defaultProductionQty || ''} className="form-input" onChange={e => setFormData({ ...formData, defaultProductionQty: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">HEDEF DEPO</label>
                  <CustomSelect
                    options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                    value={formData.targetWarehouseId || ''}
                    onChange={(val: any) => setFormData({ ...formData, targetWarehouseId: val })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRÜN SINIFI</label>
                  <input value={formData.productClass || ''} className="form-input" onChange={e => setFormData({ ...formData, productClass: e.target.value })} />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-theme bg-theme-base/20 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-8 py-3 text-xs font-black text-theme-dim hover:text-theme-danger transition-all uppercase tracking-widest">İPTAL</button>
          <button
            type="submit"
            form="product-edit-form"
            disabled={loading}
            className="px-3 py-3 bg-theme-primary text-white rounded-xl font-bold tracking-widest text-xs shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loading size="sm" /> : <><Save className="w-4 h-4 mb-0.75" /> KAYDET</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
