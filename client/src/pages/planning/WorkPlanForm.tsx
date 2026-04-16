import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Plus, Trash2, Save, Calendar, Building2,
  Package, Hash, ChevronLeft, Calculator, AlertCircle,
  ClipboardList, Workflow, CheckCircle2
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

interface WorkPlanItem {
  id?: string;
  productId: string;
  lotNumber: string;
  plannedQuantity: number;
  orderStepId?: string; // For professional planning link
  notes: string;
}

export function WorkPlanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [planTypes, setPlanTypes] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]); // Items waiting for the selected process

  const [formData, setFormData] = useState({
    unitId: '',
    typeId: '', // List type
    planName: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    notes: '',
    status: 'active'
  });

  const [items, setItems] = useState<WorkPlanItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [unitsRes, productsRes, typesRes] = await Promise.all([
          api.get('/system/company/units'),
          api.get('/products'),
          api.get('/work-plan-types')
        ]);
        setUnits(unitsRes || []);
        setProducts(productsRes || []);
        setPlanTypes(typesRes || []);

        if (isEditing) {
          const plan = await api.get(`/work-plans/${id}`);
          setFormData({
            unitId: plan.unitId,
            typeId: plan.typeId || '',
            planName: plan.planName || '',
            startDate: plan.startDate.slice(0, 10),
            endDate: plan.endDate.slice(0, 10),
            notes: plan.notes || '',
            status: plan.status
          });
          setItems(plan.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            lotNumber: item.lotNumber || '',
            plannedQuantity: item.plannedQuantity,
            orderStepId: item.orderStepId,
            notes: item.notes || ''
          })));
        }
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEditing]);

  // When plan type changes, fetch available production steps for that type's target operation
  useEffect(() => {
    const fetchAvailable = async () => {
      if (!formData.typeId) {
        setAvailableItems([]);
        return;
      }
      try {
        const res = await api.get(`/work-plans/available-items/${formData.typeId}`);
        setAvailableItems(res || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchAvailable();
  }, [formData.typeId]);

  const addItem = () => {
    setItems([...items, { productId: '', lotNumber: '', plannedQuantity: 0, notes: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof WorkPlanItem, value: any) => {
    const newItems = [...items];

    // If selecting an available production step from the professional list
    if (field === 'orderStepId' && value) {
      const step = availableItems.find(s => s.id === value);
      if (step) {
        newItems[index] = {
          ...newItems[index],
          orderStepId: step.id,
          productId: step.productionOrder.productId,
          lotNumber: step.productionOrder.lotNumber,
          plannedQuantity: step.productionOrder.quantity // Default to full quantity
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitId) return alert('Lütfen bir birim seçin.');
    if (items.length === 0) return alert('Lütfen en az bir ürün ekleyin.');
    if (items.some(item => !item.productId)) return alert('Tüm satırlarda ürün seçilmelidir.');

    try {
      if (isEditing) {
        await api.put(`/work-plans/${id}`, { ...formData, items });
      } else {
        await api.post('/work-plans', { ...formData, items });
      }
      navigate('/planning/work-plans');
    } catch (error) {
      alert('Kaydedilirken bir hata oluştu.');
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-theme-base"><Loading size="lg" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-2">
          <button
            onClick={() => navigate('/planning/work-plans')}
            className="p-1 border border-theme rounded-xl hover:bg-theme-main/5 text-theme-muted hover:text-theme-primary transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-theme-main">
              {isEditing ? 'İŞ LİSTESİNİ DÜZENLE' : 'YENİ İŞ LİSTESİ OLUŞTUR'}
            </h2>
            <p className="text-theme-muted text-xs font-bold mt-0">
              Birim bazlı <span className="text-theme-primary">profesyonel operasyonel planlama</span> formunu doldurun.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Header Card */}
          <div className="modern-glass-card p-0 space-y-6">
            <div className="flex items-center gap-3 p-4 border-b border-theme bg-theme-base/20">
              <ClipboardList className="w-5 h-5 text-theme-primary" />
              <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">GENEL BİLGİLER</h3>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> PLANLAMA YAPILAN BİRİM
                  </label>
                  <CustomSelect
                    options={units.map(u => ({ id: u.id, label: u.name }))}
                    value={formData.unitId}
                    onChange={(val) => setFormData({ ...formData, unitId: val })}
                    placeholder="Birim Seçin"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                    <Workflow className="w-3 h-3 text-theme-primary" /> LİSTE TÜRÜ (PROFESYONEL)
                  </label>
                  <CustomSelect
                    options={planTypes.map(t => ({ id: t.id, label: t.name, subLabel: t.operation?.code }))}
                    value={formData.typeId}
                    onChange={(val) => setFormData({ ...formData, typeId: val })}
                    placeholder="Liste Türü Seçin (İsteğe bağlı)"
                  />
                  {formData.typeId && planTypes.find(t => t.id === formData.typeId)?.operation && (
                    <div className="p-3 bg-theme-primary/5 border border-theme-primary/20 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-theme-primary" />
                      <span className="text-[10px] font-black text-theme-primary uppercase">
                        REFERANS: {planTypes.find(t => t.id === formData.typeId)?.operation.name} bekleyenleri listelenecek.
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">LİSTE ADI (OPSİYONEL)</label>
                  <input
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    className="form-input"
                    placeholder="örn. 2024 - 15. HAFTA PLANI"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">BAŞLANGIÇ</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="form-input pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">BİTİŞ</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="form-input pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">PLANLAMA NOTLARI</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input min-h-[100px] py-3 text-xs"
                    placeholder="Önemli uyarılar, öncelikler..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="xl:col-span-2 space-y-6">
            <div className="modern-glass-card overflow-hidden p-0">
              <div className="p-4 border-b border-theme bg-theme-base/20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-theme-primary/10 rounded-xl">
                    <Package className="w-5 h-5 text-theme-primary" />
                  </div>
                  <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">PLANLANAN ÜRÜN VE LOTLAR</h3>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-theme-main/5 hover:bg-theme-main/10 text-theme-main px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all border border-theme flex items-center gap-2 uppercase tracking-widest"
                >
                  <Plus className="w-4 h-4" /> SATIR EKLE
                </button>
              </div>

              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-base/10 border-b border-theme">
                      <th className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase tracking-[0.15em]">
                        {formData.typeId ? 'REFERANS ÜRETİM EMRİ / LOT' : 'ÜRÜN / STOK KARTI'}
                      </th>
                      {!formData.typeId && (
                        <th className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase tracking-[0.15em]">LOT NO (MANUEL)</th>
                      )}
                      <th className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase tracking-[0.15em] text-center">MİKTAR</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase tracking-[0.15em]">NOT</th>
                      <th className="px-4 py-3 text-[10px] font-black text-theme-muted uppercase tracking-[0.15em] text-right">#</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-theme-primary/5 transition-colors group">
                        <td className="px-4 py-4 min-w-[300px]">
                          {formData.typeId ? (
                            <CustomSelect
                              options={availableItems.map(s => ({
                                id: s.id,
                                label: `LOT: ${s.productionOrder.lotNumber}`,
                                subLabel: `${s.productionOrder.product.productCode} - ${s.productionOrder.product.productName}`
                              }))}
                              value={item.orderStepId}
                              onChange={(val) => updateItem(index, 'orderStepId', val)}
                              placeholder="Bekleyen Lot Seçin"
                            />
                          ) : (
                            <CustomSelect
                              options={products.map(p => ({
                                id: p.id,
                                label: p.productCode,
                                subLabel: p.productName
                              }))}
                              value={item.productId}
                              onChange={(val) => updateItem(index, 'productId', val)}
                              placeholder="Ürün Seçin"
                            />
                          )}
                        </td>
                        {!formData.typeId && (
                          <td className="px-4 py-4">
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                              <input
                                value={item.lotNumber}
                                onChange={(e) => updateItem(index, 'lotNumber', e.target.value)}
                                placeholder="Lot / Seri No"
                                className="form-input pl-9 text-xs"
                              />
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <div className="relative w-24 mx-auto">
                            <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                            <input
                              type="number"
                              value={item.plannedQuantity}
                              onChange={(e) => updateItem(index, 'plannedQuantity', e.target.value)}
                              className="form-input pl-9 text-xs text-center"
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            value={item.notes}
                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            placeholder="Not..."
                            className="form-input text-xs"
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-16 h-16 rounded-full bg-theme-base/50 flex items-center justify-center border-2 border-theme border-dashed">
                      <Package className="w-8 h-8 text-theme-dim" />
                    </div>
                    <div>
                      <p className="font-black text-theme-dim uppercase tracking-widest text-xs">Henüz kalem eklenmedi.</p>
                      <button type="button" onClick={addItem} className="text-theme-primary font-bold text-xs mt-2 hover:underline">Bir satır ekleyerek başlayın</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 modern-glass-card">
              <div className="flex items-center gap-3 text-theme-muted">
                <AlertCircle className="w-5 h-5 text-theme-primary/50" />
                <p className="text-[11px] font-medium max-w-sm">
                  Profesyonel planlama modülü sayesinde sadece ilgili operasyona gelmiş, üretim emri olan lotları planlayabilirsiniz.
                </p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => navigate('/planning/work-plans')}
                  className="flex-1 md:flex-none h-10 px-3 py-2 text-xs font-semibold text-theme-dim border-2 border-theme rounded-xl hover:bg-theme-main/5 transition-all uppercase tracking-[0.2em]"
                >
                  İPTAL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 md:flex-none h-10 px-6 py-2 text-xs font-black text-white bg-theme-primary rounded-xl hover:bg-theme-primary-hover transition-all shadow-xl shadow-theme-primary/20 uppercase flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? <Loading size="sm" /> : <><Save className="w-5 h-5" /> {isEditing ? 'KAYDET' : 'LİSTEYİ OLUŞTUR'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
