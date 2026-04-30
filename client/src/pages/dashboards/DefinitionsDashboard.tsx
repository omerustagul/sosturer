import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Package, Factory, Users, Clock, Building2,
  Settings, Workflow, Map, Activity, Wrench,
  Search, Plus, ChevronRight, Database,
  FileUp, ShieldCheck, Handshake, List, Warehouse
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../../components/common/Loading';

export function DefinitionsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    products: 0,
    machines: 0,
    operators: 0,
    warehouses: 0
  });
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [products, machines, operators, warehouses] = await Promise.all([
          api.get('/products'),
          api.get('/machines'),
          api.get('/operators'),
          api.get('/inventory/warehouses')
        ]);

        setStats({
          products: products.length,
          machines: machines.length,
          operators: operators.length,
          warehouses: warehouses.length
        });

        setRecentProducts(products.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const categories = [
    {
      title: 'TEMEL TANIMLAR',
      icon: Database,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      items: [
        { label: 'Makineler', path: '/definitions/machines', icon: Factory },
        { label: 'Personeller', path: '/definitions/personnel', icon: Users },
        { label: 'Vardiyalar', path: '/definitions/shifts', icon: Clock },
        { label: 'Stok Kartları', path: '/definitions/products', icon: Package },
        { label: 'Firmalar', path: '/definitions/firms', icon: Handshake },
      ]
    },
    {
      title: 'DEPARTMAN & YERLEŞİM',
      icon: Building2,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      items: [
        { label: 'İş Merkezleri', path: '/definitions/work-centers', icon: Building2 },
        { label: 'İstasyonlar', path: '/definitions/stations', icon: List },
        { label: 'Depolar', path: '/definitions/warehouses', icon: Warehouse },
        { label: 'Roller / Görevler', path: '/definitions/department-roles', icon: Settings },
      ]
    },
    {
      title: 'ÜRETİM AKIŞI',
      icon: Workflow,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      items: [
        { label: 'Operasyonlar', path: '/definitions/operations', icon: Workflow },
        { label: 'Reçeteler / Rotalar', path: '/definitions/routes', icon: Map },
        { label: 'Ölçüm Araçları', path: '/definitions/measurement-tools', icon: Activity },
        { label: 'Ekipmanlar', path: '/definitions/equipment', icon: Wrench },
        { label: 'Steril İşlemler', path: '/definitions/sterile-process-types', icon: ShieldCheck },
      ]
    }
  ];

  if (loading) return <Loading size="lg" fullScreen />;

  return (
    <div className="p-4 lg:p-6 w-full space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-theme-main uppercase tracking-tight">Tanımlar</h2>
          <p className="text-theme-main/80 text-[12px] mt-1 font-bold opacity-60 leading-none">
            Sistem Parametreleri ve Master Veri Yönetimi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/definitions/import')}
            className="group flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-[0.2em] transition-all border border-theme bg-theme-surface/80 text-theme-main hover:border-theme-primary/40 shadow-lg"
          >
            <FileUp className="w-4 h-4 group-hover:translate-y-[-2px] transition-transform" />
            VERİ AKTARIMI
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'STOK KARTI', value: stats.products, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'MAKİNE', value: stats.machines, icon: Factory, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'PERSONEL', value: stats.operators, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'DEPO', value: stats.warehouses, icon: Warehouse, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        ].map((stat, i) => (
          <div key={i} className="modern-glass-card p-6 flex items-center gap-4 hover:border-theme-primary/30 transition-all group/s">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover/s:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-theme-dim uppercase tracking-widest opacity-60">{stat.label}</p>
              <h4 className="text-2xl font-black text-theme-main">{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Links Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, i) => (
              <div key={i} className="modern-glass-card p-3 overflow-hidden rounded-2xl">
                <div className="p-3 border-b border-theme/20 bg-theme-base rounded-2xl flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cat.bg} ${cat.color}`}>
                    <cat.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[11px] font-black tracking-widest text-theme-main uppercase">{cat.title}</h3>
                </div>
                <div className="pt-3 space-y-1">
                  {cat.items.map((item, j) => (
                    <button
                      key={j}
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-theme-main/5 transition-all group/item"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4 text-theme-muted group-hover/item:text-theme-primary transition-colors" />
                        <span className="text-xs font-bold text-theme-main">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-theme-muted opacity-0 group-hover/item:opacity-100 transition-all translate-x-[-10px] group-hover/item:translate-x-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini List Column */}
        <div className="space-y-6">
          <div className="modern-glass-card h-full flex flex-col">
            <div className="p-3 bg-theme-base rounded-2xl border-b border-theme/20 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-theme-main uppercase">STOK KARTLARI</h3>
                <p className="text-[10px] font-bold text-theme-dim opacity-60">Son Eklenen Ürünler</p>
              </div>
              <button
                onClick={() => navigate('/definitions/products')}
                className="text-xs font-black text-theme-primary hover:underline"
              >
                TÜMÜ
              </button>
            </div>

            <div className="pt-3 flex-1">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input
                  type="text"
                  placeholder="Ürün ara..."
                  className="w-full bg-theme-base border border-theme rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-theme-main focus:border-theme-primary/50 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                {recentProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase())).map((product, i) => (
                  <div key={i} className="p-3 bg-theme-surface/50 border border-theme rounded-xl hover:border-theme-primary/30 transition-all group/p">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-theme-main/5 rounded-lg flex items-center justify-center text-theme-muted group-hover/p:text-theme-primary transition-colors">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-theme-main uppercase tracking-tight">{product.code}</p>
                          <p className="text-[10px] font-bold text-theme-dim truncate w-32">{product.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-theme-primary italic">{product.unit || 'ADET'}</p>
                        <p className="text-[9px] font-bold text-theme-dim opacity-50">{product.status === 'active' ? 'AKTİF' : 'PASİF'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-theme/20">
              <button
                onClick={() => navigate('/definitions/products')}
                className="w-full bg-theme-primary text-white py-3 rounded-xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" /> YENİ STOK KARTI EKLE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
