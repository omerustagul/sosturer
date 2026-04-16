import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  DiamondPlus, Plus, Search, Calendar, Package,
  Hash, ChevronRight
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';

import { useNavigate } from 'react-router-dom';

export function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<any>({
    productId: '',
    lotNumber: '',
    quantity: '',
    startDate: new Date().toISOString().slice(0, 10)
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.get('/production-orders'),
        api.get('/products')
      ]);
      setOrders(ordersRes || []);
      setProducts(productsRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/production-orders', formData);
      setShowAddForm(false);
      setFormData({ productId: '', lotNumber: '', quantity: '', startDate: new Date().toISOString().slice(0, 10) });
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Kayıt başarısız.');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-theme-main flex items-center gap-2 tracking-tight">
            <DiamondPlus className="w-5 h-5 text-theme-primary" /> ÜRETİM EMİRLERİ
          </h2>
          <p className="text-theme-muted text-sm mt-1">Lot bazlı üretim takibi ve operasyonel süreç yönetimi.</p>
        </div>
        <button
          onClick={() => navigate('/planning/production-orders/new')}
          className="bg-theme-primary hover:bg-theme-primary-hover text-white h-10 px-4 py-2 rounded-xl font-black text-sm transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-5 h-5" /> YENİ ÜRETİM EMRİ
        </button>
      </div>

      {showAddForm && (
        <div className="modern-glass-card p-6 animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRÜN SEÇİMİ</label>
              <CustomSelect
                options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                value={formData.productId}
                onChange={val => setFormData({ ...formData, productId: val })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">LOT / SERİ NO (OTOMATİK)</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input value={formData.lotNumber} onChange={e => setFormData({ ...formData, lotNumber: e.target.value })} className="form-input pl-10" placeholder="Boş bırakırsanız otomatik üretilir" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRETİM MİKTARI</label>
              <input required type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="form-input" placeholder="0" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-3 text-xs font-black text-theme-dim border-2 border-theme rounded-xl hover:bg-theme-main/5">İPTAL</button>
              <button type="submit" className="flex-1 px-4 py-3 bg-theme-primary text-white rounded-xl font-black text-xs shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover">OLUŞTUR</button>
            </div>
          </form>
        </div>
      )}

      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-theme bg-theme-base/20">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Lot no veya ürün ara..."
              className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-theme-primary/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loading size="lg" />
              <p className="text-xs font-black text-theme-dim uppercase tracking-[0.2em]">Yükleniyor...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-theme-base/10 border-b border-theme text-[10px] font-black text-theme-muted uppercase tracking-widest">
                  <th className="px-6 py-4">NO / LOT NUMARASI</th>
                  <th className="px-6 py-4">ÜRÜN</th>
                  <th className="px-6 py-4 text-center">PLANLANAN</th>
                  <th className="px-6 py-4">GÜNCEL DURUM / PROSES</th>
                  <th className="px-6 py-4">TARİH</th>
                  <th className="px-6 py-4 text-right">DETAY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {orders.filter(o => o.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) || o.product.productCode.toLowerCase().includes(searchTerm.toLowerCase())).map((order) => {
                  const currentStep = order.steps.find((s: any) => s.status !== 'completed') || order.steps[order.steps.length - 1];
                  const progress = (order.steps.filter((s: any) => s.status === 'completed').length / order.steps.length) * 100;

                  return (
                    <tr key={order.id} className="hover:bg-theme-primary/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center border border-theme-primary/20 shrink-0">
                            <span className="text-xs font-black text-theme-primary">{order.recordNumber}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-theme-main leading-tight">{order.lotNumber}</span>
                            <span className="text-[9px] font-black text-theme-muted uppercase tracking-widest leading-none mt-1">LOT NUMARASI</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-theme-primary">{order.product.productCode}</span>
                          <span className="text-xs font-bold text-theme-muted">{order.product.productName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black text-theme-main">{order.quantity}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2 min-w-[240px]">
                          <div className="flex justify-between text-[10px] font-black uppercase mb-1 items-center gap-2">
                            <div className="flex items-center gap-2">
                              {/* Status Badge */}
                              <span className={`px-2 py-0.5 rounded border leading-none tracking-tighter shadow-sm
                                ${order.status === 'planned' ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/30' : 
                                  order.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/30' : 
                                  order.status === 'completed' ? 'bg-theme-primary/10 text-theme-primary border-theme-primary/30' : 
                                  'bg-theme-danger/10 text-theme-danger border-theme-danger/30'}`}
                              >
                                {order.status === 'planned' ? 'Hazır' : 
                                 order.status === 'active' ? 'Başladı' : 
                                 order.status === 'completed' ? 'Bitti' : 
                                 order.status === 'cancelled' ? 'İptal' : order.status}
                              </span>
                              <span className="text-theme-muted opacity-50">/</span>
                              <span className="text-theme-main">{currentStep?.operation.name}</span>
                            </div>
                            <span className="text-theme-muted">%{Math.round(progress)}</span>
                          </div>
                          <div className="h-2 w-full bg-theme-base/20 rounded-full overflow-hidden border border-theme/30 shadow-inner">
                            <div 
                              className={`h-full transition-all duration-1000 shadow-sm
                                ${order.status === 'planned' ? 'bg-theme-warning' : 
                                  order.status === 'active' ? 'bg-theme-success shadow-success-glow' : 
                                  order.status === 'completed' ? 'bg-theme-primary shadow-primary-glow' : 
                                  'bg-theme-danger'}`} 
                              style={{ width: `${progress}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-theme-muted">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/planning/production-orders/${order.id}`)}
                          className="p-2 hover:bg-theme-primary/10 text-theme-muted hover:text-theme-primary rounded-xl transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-32 text-center opacity-20">
                      <Package className="w-10 h-10 mx-auto mb-4" />
                      <p className="font-black text-md">Henüz bir üretim emri verilmemiş.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
