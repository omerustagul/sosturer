import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import {
  Plus, Trash2, Save, X, Workflow,
  ChevronUp, ChevronDown, Clock, Building2, AlertCircle
} from 'lucide-react';
import { Loading } from '../common/Loading';
import { CustomSelect } from '../common/CustomSelect';

interface ProductRecipeModalProps {
  product: any;
  onClose: () => void;
}

export function ProductRecipeModal({ product, onClose }: ProductRecipeModalProps) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipeRes, opsRes] = await Promise.all([
          api.get(`/operations/recipes/${product.id}`),
          api.get('/operations')
        ]);
        setRecipes(recipeRes || []);
        setOperations(opsRes || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [product.id]);

  const addStep = () => {
    const nextSeq = recipes.length > 0 ? Math.max(...recipes.map(r => r.sequence)) + 10 : 10;
    setRecipes([...recipes, { operationId: '', sequence: nextSeq, estimatedTime: 0 }]);
  };

  const removeStep = (index: number) => {
    setRecipes(recipes.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newRecipes = [...recipes];
    newRecipes[index] = { ...newRecipes[index], [field]: value };
    setRecipes(newRecipes);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === recipes.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newRecipes = [...recipes];

    // Swap sequences
    const tempSeq = newRecipes[index].sequence;
    newRecipes[index].sequence = newRecipes[newIndex].sequence;
    newRecipes[newIndex].sequence = tempSeq;

    // Sort by sequence
    setRecipes(newRecipes.sort((a, b) => a.sequence - b.sequence));
  };

  const handleSave = async () => {
    if (recipes.some(r => !r.operationId)) {
      alert('Lütfen tüm adımlarda bir operasyon seçin.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/operations/recipes/bulk', {
        productId: product.id,
        recipes: recipes.map(r => ({
          operationId: r.operationId,
          sequence: r.sequence,
          estimatedTime: r.estimatedTime
        }))
      });
      onClose();
    } catch (e) {
      alert('Kaydedilirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-theme-main/60 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-3 border-b border-theme bg-theme-base/10 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-theme-main flex items-center gap-3">
              <Workflow className="w-6 h-6 text-theme-primary" /> OPERASYON KARTI / REÇETE
            </h3>
            <p className="text-theme-muted text-xs font-bold mt-1 uppercase tracking-widest leading-none">
              <span className="text-theme-primary">{product.productCode}</span> — {product.productName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-theme-main/5 text-theme-muted rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loading size="lg" />
              <p className="text-xs font-black text-theme-dim uppercase tracking-[0.2em]">Yükleniyor...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-theme-muted uppercase">OPERASYON SIRALAMASI</p>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-primary/10 text-theme-primary rounded-xl text-xs font-black hover:bg-theme-primary/20 transition-all border border-theme-primary/20"
                >
                  <Plus className="w-4 h-4" /> ADIM EKLE
                </button>
              </div>

              <div className="border border-theme rounded-2xl overflow-hidden bg-theme-base/5">
                <table className="w-full text-left">
                  <thead className="bg-theme-base/10">
                    <tr className="text-[9px] font-black text-theme-muted uppercase tracking-widest border-b border-theme">
                      <th className="px-4 py-3 w-20">SIRA</th>
                      <th className="px-4 py-3">OPERASYON / PROSES</th>
                      <th className="px-4 py-3 w-32">BİRİM</th>
                      <th className="px-4 py-3 w-32">TAHMİNİ SÜRE (DK)</th>
                      <th className="px-4 py-3 w-32 text-right">İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {recipes.map((item, index) => {
                      const selectedOp = operations.find(o => o.id === item.operationId);
                      return (
                        <tr key={index} className="hover:bg-theme-primary/5 transition-colors group">
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              value={item.sequence}
                              onChange={(e) => updateStep(index, 'sequence', parseInt(e.target.value))}
                              className="w-16 h-10 bg-theme-surface border-2 border-theme rounded-xl px-3 text-sm font-bold text-theme-primary focus:outline-none focus:border-theme-primary/50"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <CustomSelect
                              options={operations.map(o => ({
                                id: o.id,
                                label: o.code,
                                subLabel: o.name
                              }))}
                              value={item.operationId}
                              onChange={(val) => updateStep(index, 'operationId', val)}
                              placeholder="Operasyon Seçin"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-theme-muted">
                              {selectedOp ? (
                                <>
                                  <Building2 className="w-3.5 h-3.5 text-theme-primary/50" />
                                  {selectedOp.unit?.name}
                                </>
                              ) : '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                              <input
                                type="number"
                                value={item.estimatedTime}
                                onChange={(e) => updateStep(index, 'estimatedTime', parseInt(e.target.value))}
                                className="form-input pl-9 text-xs"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => moveStep(index, 'up')} className="p-2 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-lg transition-all"><ChevronUp className="w-4 h-4" /></button>
                              <button onClick={() => moveStep(index, 'down')} className="p-2 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-lg transition-all"><ChevronDown className="w-4 h-4" /></button>
                              <div className="w-px h-4 bg-theme mx-1" />
                              <button onClick={() => removeStep(index)} className="p-2 hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {recipes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center opacity-30">
                          <Workflow className="w-12 h-12 mx-auto mb-3" />
                          <p className="font-black text-xs uppercase tracking-widest">Henüz operasyon eklenmedi.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-theme-primary/5 border border-theme-primary/20 rounded-2xl p-4 flex gap-4">
                <AlertCircle className="w-5 h-5 text-theme-primary shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-theme-primary uppercase tracking-widest">BİLGİ</p>
                  <p className="text-xs text-theme-muted leading-relaxed">
                    Operasyon kartı, ürünün üretim sürecindeki reçetesini belirler. Üretim emirleri bu sıralamaya göre oluşturulur ve her adım tamamlandığında ürün bir sonraki iş merkezine aktarılır.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-theme bg-theme-base/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-8 py-3 text-xs font-black text-theme-dim hover:text-theme-main transition-all uppercase tracking-widest"
          >
            İPTAL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-3 bg-theme-primary text-white rounded-xl font-black text-xs shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest"
          >
            {saving ? <Loading size="sm" /> : <><Save className="w-5 h-3.5" /> REÇETEYİ KAYDET</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
