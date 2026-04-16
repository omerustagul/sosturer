import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import {
  X, Save, Map, Workflow, Plus, Trash2,
  ChevronUp, ChevronDown, Clock, Building2, AlertCircle,
  Hash, Info, FileText
} from 'lucide-react';
import { Loading } from '../common/Loading';
import { CustomSelect } from '../common/CustomSelect';

interface RecipeModalProps {
  recipe: any; // null for new
  onClose: () => void;
  onRefresh: () => void;
}

export function RecipeModal({ recipe, onClose, onRefresh }: RecipeModalProps) {
  const [formData, setFormData] = useState<any>({
    name: '',
    code: '',
    description: '',
    steps: []
  });
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const opsRes = await api.get('/operations');
        setOperations(opsRes || []);

        if (recipe) {
          // If editing, use the provided recipe data
          setFormData({
            ...recipe,
            steps: recipe.steps ? [...recipe.steps].sort((a: any, b: any) => a.sequence - b.sequence) : []
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [recipe]);

  const addStep = () => {
    const nextSeq = formData.steps.length > 0 ? Math.max(...formData.steps.map((s: any) => s.sequence)) + 1 : 1;
    setFormData({
      ...formData,
      steps: [...formData.steps, { operationId: '', sequence: nextSeq, estimatedTime: 0 }]
    });
  };

  const removeStep = (index: number) => {
    const newSteps = [...formData.steps];
    newSteps.splice(index, 1);
    setFormData({ ...formData, steps: newSteps });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formData.steps.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newSteps = [...formData.steps];

    // Swap
    const temp = newSteps[index];
    newSteps[index] = newSteps[newIndex];
    newSteps[newIndex] = temp;

    // Recalculate sequences in increments of 10 to keep it tidy
    const reordered = newSteps.map((s, i) => ({ ...s, sequence: (i + 1) * 10 }));
    setFormData({ ...formData, steps: reordered });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Lütfen reçete adını girin.');
      return;
    }
    if (formData.steps.length === 0) {
      alert('Lütfen en az bir operasyon adımı ekleyin.');
      return;
    }
    if (formData.steps.some((s: any) => !s.operationId)) {
      alert('Lütfen tüm adımlarda bir operasyon seçin.');
      return;
    }

    setSaving(true);
    try {
      if (recipe?.id) {
        await api.put(`/production-routes/${recipe.id}`, formData);
      } else {
        await api.post('/production-routes', formData);
      }
      onRefresh();
      onClose();
    } catch (e) {
      alert('Kaydedilirken bir hata oluştu. Lütfen benzersiz kod kullanımını kontrol edin.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-theme-main/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-6xl bg-theme-surface border border-theme rounded-2xl shadow-xl shadow-theme-main/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="min-h-15 p-4 border-b border-theme bg-theme-base/10 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
            <Map size={120} className="text-theme-primary" />
          </div>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20 shadow-lg shadow-theme-primary/5">
              <Map className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-theme-main uppercase">
                {recipe ? 'REÇETE DÜZENLE' : 'YENİ REÇETE OLUŞTUR'}
              </h3>
              <p className="text-theme-muted text-xs font-bold mt-0.5 flex items-center gap-1">
                <Workflow className="w-3 h-3 text-theme-primary" /> Üretim standartlarını ve operasyon akışını belirleyin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-2xl transition-all border border-transparent hover:border-theme-danger/20 group"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <Loading size="lg" />
              <p className="text-xs font-black text-theme-dim uppercase tracking-[0.4em] animate-pulse">Veriler Hazırlanıyor...</p>
            </div>
          ) : (
            <form id="recipe-modal-form" onSubmit={handleSave} className="p-4 space-y-4">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> REÇETE KODU
                  </label>
                  <input
                    required
                    value={formData.code || ''}
                    className="form-input text-sm font-bold bg-theme-base/5"
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="örn. REC-CNC-01"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> REÇETE ADI / TANIMI
                  </label>
                  <input
                    required
                    value={formData.name || ''}
                    className="form-input text-sm font-black"
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="örn. CNC İŞLEME VE MONTAJ STANDARDI"
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                    <Info className="w-3 h-3" /> AÇIKLAMA (İSTEĞE BAĞLI)
                  </label>
                  <textarea
                    value={formData.description || ''}
                    className="form-input text-sm min-h-[80px] py-3 leading-relaxed"
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Reçete hakkında teknik detaylar, özel talimatlar..."
                  />
                </div>
              </div>

              {/* Steps Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-theme pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-theme-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-theme-primary/20">
                      <Workflow size={16} />
                    </div>
                    <h4 className="text-sm font-black text-theme-main uppercase tracking-widest">OPERASYON ADIMLARI</h4>
                  </div>
                  <button
                    type="button"
                    onClick={addStep}
                    className="flex items-center gap-2 px-5 py-2.5 bg-theme-primary text-white rounded-xl text-[10px] font-black hover:bg-theme-primary-hover hover:scale-105 active:scale-95 transition-all shadow-xl shadow-theme-primary/20 uppercase tracking-widest"
                  >
                    <Plus className="w-4 h-4" /> YENİ ADIM EKLE
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.steps.map((item: any, index: number) => {
                    const selectedOp = operations.find(o => o.id === item.operationId);
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-4 p-2 bg-theme-base/5 rounded-2xl border border-theme hover:border-theme-primary/30 transition-all group relative animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className="w-10 h-10 rounded-xl bg-theme-base border border-theme flex flex-col items-center justify-center group-hover:bg-theme-primary group-hover:border-theme-primary transition-all shadow-sm">
                          <span className="text-[8px] font-black text-theme-muted group-hover:text-white/70 uppercase leading-none mb-0.5">SIRA</span>
                          <span className="text-sm font-black text-theme-primary group-hover:text-white leading-none tracking-tight">{index + 1}</span>
                        </div>

                        <div className="flex-1 min-w-[250px] space-y-1.5">
                          <label className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1">OPERASYON SEÇİMİ</label>
                          <CustomSelect
                            options={operations.map(o => ({
                              id: o.id,
                              label: o.name,
                              subLabel: o.code
                            }))}
                            value={item.operationId}
                            onChange={(val) => updateStep(index, 'operationId', val)}
                            placeholder="Operasyon Seçin"
                            className="text-sm font-bold"
                          />
                        </div>

                        <div className="w-24 space-y-1.5">
                          <label className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1">SIRA NO</label>
                          <input
                            type="number"
                            value={item.sequence}
                            onChange={(e) => updateStep(index, 'sequence', parseInt(e.target.value))}
                            className="form-input text-center font-bold text-theme-primary !py-2.5 h-10"
                          />
                        </div>

                        <div className="w-36 space-y-1.5">
                          <label className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] ml-1">TAH. SÜRE (DK)</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted group-hover:text-theme-primary transition-colors" />
                            <input
                              type="number"
                              value={item.estimatedTime}
                              onChange={(e) => updateStep(index, 'estimatedTime', parseInt(e.target.value))}
                              className="form-input pl-10 font-bold h-10"
                            />
                          </div>
                        </div>

                        {selectedOp && (
                          <div className="w-full lg:w-auto px-4 py-2 bg-theme-base/10 rounded-xl flex items-center gap-3 border border-theme/50">
                            <Building2 className="w-4 h-4 text-theme-primary opacity-60" />
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest">İŞ MERKEZİ</span>
                              <span className="text-[10px] font-bold text-theme-main">{selectedOp.unit?.name || 'BELİRTİLMEMİŞ'}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto pt-4 lg:pt-0">
                          <button
                            type="button"
                            onClick={() => moveStep(index, 'up')}
                            className={`p-2.5 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-xl transition-all border border-transparent hover:border-theme-primary/20 ${index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronUp className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, 'down')}
                            className={`p-2.5 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-xl transition-all border border-transparent hover:border-theme-primary/20 ${index === formData.steps.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                          <div className="w-px h-6 bg-theme mx-1" />
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-2.5 hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-xl transition-all border border-transparent hover:border-theme-danger/20"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {formData.steps.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-theme bg-theme-base/5 opacity-40">
                      <div className="w-14 h-14 rounded-xl bg-theme-base flex items-center justify-center mb-4 border border-theme">
                        <Workflow className="w-7 h-7 text-theme-dim" />
                      </div>
                      <p className="text-sm font-black text-theme-main uppercase">Henüz operasyon eklenmedi</p>
                      <p className="text-[11px] text-theme-muted font-bold mt-1 px-10 text-center">Sağ üstteki butonu kullanarak üretim adımlarını tanımlamaya başlayın.</p>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-theme-base/30 flex justify-between items-center">
          <div className="flex items-center gap-4 text-theme-muted">
            <AlertCircle className="w-5 h-5 opacity-40" />
            <p className="text-[9px] font-bold leading-relaxed max-w-xs">
              Değişiklikleri kaydettikten sonra bu reçeteyi kullanan tüm ürünler güncel akıştan etkilenecektir.
            </p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-6 py-2 text-xs font-black text-theme-dim hover:text-theme-main transition-all uppercase hover:bg-theme-base/50 rounded-xl border border-transparent hover:border-theme"
            >
              İPTAL
            </button>
            <button
              type="submit"
              form="recipe-modal-form"
              disabled={saving || loading}
              className="h-10 px-6 py-2 bg-theme-primary text-white rounded-xl font-black text-xs shadow-2xl shadow-theme-primary/30 hover:bg-theme-primary-hover hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest"
            >
              {saving ? <Loading size="sm" /> : <><Save className="w-5 h-3.5" /> REÇETEYİ KAYDET</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
