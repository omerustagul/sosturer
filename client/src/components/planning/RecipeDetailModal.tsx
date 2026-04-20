import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import { 
  X, Map, Workflow, Clock, Building2, 
  Hash, FileText 
} from 'lucide-react';
import { Loading } from '../common/Loading';

interface RecipeDetailModalProps {
  recipeId: string;
  onClose: () => void;
}

export function RecipeDetailModal({ recipeId, onClose }: RecipeDetailModalProps) {
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/production-routes/${recipeId}`);
        setRecipe(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [recipeId]);

  if (!recipeId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-theme-main/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-theme-surface border border-theme rounded-2xl shadow-xl shadow-theme-main/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-theme bg-theme-base/10 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12">
            <Map size={80} className="text-theme-primary" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center border border-theme-primary/20 shadow-lg shadow-theme-primary/5">
              <Workflow className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-theme-main uppercase tracking-tight">
                REÇETE DETAYI
              </h3>
              <p className="text-theme-muted text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-theme-primary" /> {recipe?.code || 'YÜKLENİYOR...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-xl transition-all border border-transparent hover:border-theme-danger/20 group"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loading size="md" />
              <p className="text-[10px] font-black text-theme-dim uppercase tracking-[0.3em] animate-pulse">Veriler Çekiliyor...</p>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {/* Recipe Info */}
              <div className="bg-theme-base/5 rounded-2xl p-6 border border-theme/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                  <FileText size={80} />
                </div>
                <div className="relative z-10">
                  <h4 className="text-xl font-black text-theme-main mb-2 uppercase tracking-tight">{recipe.name}</h4>
                  {recipe.description && (
                    <p className="text-sm text-theme-muted leading-relaxed font-medium">
                      {recipe.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Steps Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6 px-1">
                  <div className="w-1.5 h-6 bg-theme-primary rounded-full shadow-[0_0_12px_rgba(var(--color-primary),0.4)]" />
                  <h4 className="text-xs font-black text-theme-main uppercase tracking-[0.2em]">OPERASYON AKIŞI</h4>
                </div>

                <div className="relative pl-8 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-theme-primary before:via-theme-primary/30 before:to-transparent">
                  {recipe.steps?.sort((a: any, b: any) => a.sequence - b.sequence).map((step: any, idx: number) => (
                    <div key={step.id} className="relative group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                      {/* Timeline Node */}
                      <div className="absolute -left-[25px] top-1.5 w-[19px] h-[19px] rounded-full bg-theme-surface border-4 border-theme-primary shadow-[0_0_0_4px_rgba(var(--color-primary),0.1)] z-10 group-hover:scale-125 transition-transform duration-300" />
                      
                      <div className="bg-theme-surface border border-theme rounded-2xl p-4 hover:border-theme-primary/40 hover:shadow-xl hover:shadow-theme-primary/5 transition-all duration-300">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-[200px]">
                            <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20 shrink-0">
                              <span className="text-sm font-black text-theme-primary">{idx + 1}</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                                <Hash className="w-3 h-3" /> {step.operation?.code || 'OP-CODE'}
                              </p>
                              <h5 className="text-sm font-black text-theme-main uppercase tracking-tight">{step.operation?.name}</h5>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 bg-theme-base/20 rounded-lg flex items-center gap-2 border border-theme/50">
                              <Clock className="w-3.5 h-3.5 text-theme-primary opacity-60" />
                              <span className="text-[11px] font-black text-theme-main">{step.estimatedTime} DK</span>
                            </div>
                            <div className="px-3 py-1.5 bg-theme-base/20 rounded-lg flex items-center gap-2 border border-theme/50">
                              <Building2 className="w-3.5 h-3.5 text-theme-primary opacity-60" />
                              <span className="text-[11px] font-black text-theme-main uppercase">{step.operation?.unit?.name || 'BELİRTİLMEMİŞ'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-theme-base/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-theme-base/50 text-theme-dim hover:text-theme-main font-black text-[11px] rounded-xl border border-theme hover:border-theme-muted transition-all uppercase tracking-widest"
          >
            KAPAT
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
