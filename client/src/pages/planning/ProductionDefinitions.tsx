import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Settings, Plus, Edit, Trash2, Search, Building2,
  Workflow, ClipboardList
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

type SubTab = 'operations' | 'plan-types';

export function ProductionDefinitions() {
  const [activeTab, setActiveTab] = useState<SubTab>('operations');
  const [data, setData] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]); // For plan types selection
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'operations' ? '/operations' : '/work-plan-types';
      const [res, unitsRes, opsRes] = await Promise.all([
        api.get(endpoint),
        api.get('/system/company/units'),
        api.get('/operations')
      ]);
      setData(Array.isArray(res) ? res : []);
      setUnits(Array.isArray(unitsRes) ? unitsRes : []);
      setOperations(Array.isArray(opsRes) ? opsRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setShowForm(false);
    setFormData({});
  }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = activeTab === 'operations' ? '/operations' : '/work-plan-types';
      if (formData.id) {
        await api.put(`${endpoint}/${formData.id}`, formData);
      } else {
        await api.post(endpoint, formData);
      }
      setShowForm(false);
      fetchData();
    } catch (e) {
      alert('Kayıt başarısız oldu.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      const endpoint = activeTab === 'operations' ? '/operations' : '/work-plan-types';
      await api.delete(`${endpoint}/${id}`);
      fetchData();
    } catch (e) {
      alert('Silme başarısız.');
    }
  };

  const filteredData = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return data.filter(item =>
      (item.name || '').toLowerCase().includes(lower) ||
      (item.code || '').toLowerCase().includes(lower)
    );
  }, [data, searchTerm]);

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-black text-theme-main flex items-center gap-2 tracking-tight">
          <Settings className="w-5 h-5 text-theme-primary" /> ÜRETİM TANIMLARI
        </h2>
        <p className="text-theme-muted text-sm mt-1">Operasyonlar, reçeteler ve planlama türleri için <strong className="text-theme-primary">profesyonel altyapı ayarları.</strong></p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="w-64 space-y-2 shrink-0">
          <button
            onClick={() => setActiveTab('operations')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-xs border-2 ${activeTab === 'operations' ? 'bg-theme-primary/10 border-theme-primary text-theme-primary shadow-xl shadow-theme-primary/10' : 'text-theme-dim border-transparent hover:border-theme-muted'}`}
          >
            <Workflow className="w-5 h-5" /> PROSES / OPERASYONLAR
          </button>
          <button
            onClick={() => setActiveTab('plan-types')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-xs border-2 ${activeTab === 'plan-types' ? 'bg-theme-primary/10 border-theme-primary text-theme-primary shadow-xl shadow-theme-primary/10' : 'text-theme-dim border-transparent hover:border-theme-muted'}`}
          >
            <ClipboardList className="w-5 h-5" /> LİSTE TÜRLERİ
          </button>
        </div>

        <div className="flex-1 space-y-6">
          <div className="modern-glass-card">
            <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-base/20">
              <div className="relative group w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ara..."
                  className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-theme-primary/50"
                />
              </div>
              <button
                onClick={() => { setShowForm(true); setFormData({}); }}
                className="bg-theme-primary hover:bg-theme-primary-hover text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-theme-primary/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> YENİ EKLE
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSave} className="p-6 border-b border-theme bg-theme-surface animate-in slide-in-from-top-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTab === 'operations' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OPERASYON KODU</label>
                        <input required value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} className="form-input" placeholder="örn. PRS-051" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OPERASYON ADI</label>
                        <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="form-input" placeholder="örn. ULTRASONİK YIKAMA" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">BAĞLI BİRİM / İŞ MERKEZİ</label>
                        <CustomSelect
                          options={units.map(u => ({ id: u.id, label: u.name }))}
                          value={formData.unitId || ''}
                          onChange={val => setFormData({ ...formData, unitId: val })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">LİSTE TÜRÜ ADI</label>
                        <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="form-input" placeholder="örn. ISIL İŞLEM FORMLARI" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">REFERANS OPERASYON (FİLTRE)</label>
                        <CustomSelect
                          options={operations.map(o => ({ id: o.id, label: `${o.code} - ${o.name}` }))}
                          value={formData.targetOperationId || ''}
                          onChange={val => setFormData({ ...formData, targetOperationId: val })}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-xs font-black text-theme-dim border border-theme rounded-xl">İPTAL</button>
                  <button type="submit" className="px-6 py-2 text-xs font-black text-white bg-theme-primary rounded-xl shadow-lg shadow-theme-primary/20">KAYDET</button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto relative min-h-[300px]">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-theme-surface/50 backdrop-blur-sm">
                  <Loading size="lg" />
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-theme bg-theme-base/10 text-[10px] font-black text-theme-muted uppercase tracking-widest">
                      <th className="px-6 py-3">AD / TANIM</th>
                      <th className="px-6 py-3">DETAY / BİRİM</th>
                      <th className="px-6 py-3 text-right text-xs">İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-theme-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-theme-main">{item.name}</span>
                            {item.code && <span className="text-[10px] font-bold text-theme-primary">{item.code}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-theme-muted">
                            <Building2 className="w-3.5 h-3.5" />
                            {item.unit?.name || (item.operation ? `${item.operation.code} - ${item.operation.name}` : '-')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setFormData(item); setShowForm(true); }} className="p-2 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-theme-danger/10 text-theme-muted hover:text-theme-danger rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-20 text-center opacity-20">
                          <Workflow className="w-12 h-12 mx-auto mb-4" />
                          <p className="font-black text-xs uppercase tracking-widest">Henüz kayıt bulunamadı.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
