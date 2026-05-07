import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';
import {
  DiamondPlus, Plus, Search, Calendar, Package,
  Hash, Pencil, Star, Trash2, Filter, Check, Download, RotateCcw, Minus,
  Edit2
} from 'lucide-react';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Tooltip } from '../../components/common/Tooltip';
import { ConfirmModal } from '../../components/common/ConfirmModal';

import { useNavigate } from 'react-router-dom';

export function ProductionOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productGroups, setProductGroups] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    status: 'all',
    productId: 'all',
    categoryId: 'all',
    productGroupId: 'all',
    machineId: 'all',
    type: 'all',
    targetWarehouseId: 'all',
    dateStart: '',
    dateEnd: ''
  });

  const resetFilters = () => {
    setFilters({
      status: 'all',
      productId: 'all',
      categoryId: 'all',
      productGroupId: 'all',
      machineId: 'all',
      type: 'all',
      targetWarehouseId: 'all',
      dateStart: '',
      dateEnd: ''
    });
    setSearchTerm('');
  };

  const isFiltered = filters.status !== 'all' ||
    filters.productId !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.productGroupId !== 'all' ||
    filters.machineId !== 'all' ||
    filters.type !== 'all' ||
    filters.targetWarehouseId !== 'all' ||
    filters.dateStart !== '' ||
    filters.dateEnd !== '' ||
    searchTerm !== '';

  const toggleStar = async (id: string, currentStatus: boolean) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, isStarred: !currentStatus } : o));
    try {
      await api.patch(`/production-orders/${id}/star`, {});
    } catch (e) {
      fetchData();
    }
  };

  const [duplicateCount, setDuplicateCount] = useState(1);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/production-orders/${deleteTargetId}`);
      fetchData();
      setDeleteTargetId(null);
      setSelectedRows((prev: string[]) => prev.filter((r: string) => r !== deleteTargetId));
    } catch (e) {
      alert('Silinirken hata oluştu.');
    }
  };

  const handleBulkDuplicate = () => {
    if (selectedRows.length === 0) return;
    setDuplicateCount(1);
    setShowDuplicateModal(true);
  };

  const executeBulkDuplicate = async () => {
    try {
      await api.post('/production-orders/duplicate', {
        ids: selectedRows,
        count: duplicateCount
      });
      setSelectedRows([]);
      fetchData();
      setShowDuplicateModal(false);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Çoğaltma işleminde hata oluştu.');
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev: string[]) =>
      prev.includes(id) ? prev.filter((r: string) => r !== id) : [...prev, id]
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        ordersRes,
        productsRes,
        warehousesRes,
        machinesRes
      ] = await Promise.all([
        api.get('/production-orders'),
        api.get('/products'),
        api.get('/inventory/warehouses'),
        api.get('/machines')
      ]);
      setOrders(ordersRes || []);
      setProducts(productsRes || []);

      // Extract unique categories and groups from products
      const cats = Array.from(new Set((productsRes || []).map((p: any) => p.category).filter(Boolean)))
        .map(c => ({ id: c, label: c as string }));
      const pGroups = Array.from(new Set((productsRes || []).map((p: any) => p.productGroup).filter(Boolean)))
        .map(g => ({ id: g, label: g as string }));

      setCategories(cats);
      setProductGroups(pGroups);
      setMachines(machinesRes || []);
      setWarehouses(warehousesRes || []);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = orders.filter(o => {
    if (showStarredOnly && !o.isStarred) return false;

    const matchesSearch = o.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.product.productCode.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filters.status !== 'all' && o.status !== filters.status) return false;
    if (filters.productId !== 'all' && o.productId !== filters.productId) return false;
    if (filters.categoryId !== 'all' && o.product?.category !== filters.categoryId) return false;
    if (filters.productGroupId !== 'all' && o.product?.productGroup !== filters.productGroupId) return false;
    if (filters.type !== 'all' && o.type !== filters.type) return false;
    if (filters.targetWarehouseId !== 'all' && o.targetWarehouseId !== filters.targetWarehouseId) return false;
    if (filters.machineId !== 'all') {
      const hasMachine = o.machines?.some((m: any) => m.machineId === filters.machineId);
      if (!hasMachine) return false;
    }

    if (filters.dateStart) {
      const orderDate = new Date(o.createdAt).getTime();
      const startDate = new Date(filters.dateStart).getTime();
      if (orderDate < startDate) return false;
    }

    if (filters.dateEnd) {
      const orderDate = new Date(o.createdAt).getTime();
      const endDate = new Date(filters.dateEnd).getTime() + 86400000;
      if (orderDate >= endDate) return false;
    }

    return true;
  });



  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-theme-main tracking-tight uppercase">ÜRETİM EMİRLERİ</h1>
          <p className="text-xs font-bold text-theme-muted mt-0.5">Aktif ve planlanan üretim süreçleri</p>
        </div>
        <button
          onClick={() => navigate('/production-orders/new')}
          className="px-6 py-3 bg-theme-primary text-white rounded-xl font-black text-xs tracking-[0.2em] transition-all flex items-center gap-2 shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover active:scale-95"
        >
          <Plus className="w-4 h-4 mb-0.5" /> YENİ ÜRETİM EMRİ
        </button>
      </div>



      <div className="modern-glass-card p-0 overflow-hidden">
        <div className="p-4 border-b border-theme bg-theme-base/20 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Lot no veya ürün ara..."
                className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-theme-primary/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedRows.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 mr-2">
                  <span className="text-[10px] font-black tracking-widest uppercase text-theme-main px-3 bg-theme-surface border border-theme rounded-xl h-10 flex items-center shadow-inner">
                    {selectedRows.length} SEÇİLİ
                  </span>
                  <Tooltip content="Seçili Emirleri Çoğalt">
                    <button
                      onClick={handleBulkDuplicate}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-theme-primary/30 bg-theme-primary/10 text-theme-primary hover:bg-theme-primary hover:text-white active:scale-95 transition-all shadow-sm shadow-theme-primary/20"
                    >
                      <DiamondPlus className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Seçili Emirleri Dışa Aktar">
                    <button
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white active:scale-95 transition-all shadow-sm shadow-green-500/20"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </Tooltip>
                </div>
              )}
              <button
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all shadow-sm ${showStarredOnly ? 'bg-amber-400 text-white border-amber-400 shadow-amber-400/20' : 'bg-theme-surface text-theme-muted border-theme hover:bg-theme-main/5'}`}
              >
                <Star className="w-4 h-4" fill={showStarredOnly ? "currentColor" : "none"} /> Yıldızlılar
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all shadow-sm ${showFilters ? 'bg-theme-primary text-white border-theme-primary shadow-theme-primary/20' : 'bg-theme-surface text-theme-muted border-theme hover:bg-theme-main/5'}`}
              >
                <Filter className="w-4 h-4" /> Filtreler
              </button>
              {isFiltered && (
                <button
                  onClick={resetFilters}
                  className="h-10 px-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center gap-2 text-xs font-bold animate-in fade-in zoom-in duration-200"
                >
                  <RotateCcw className="w-4 h-4" /> Temizle
                </button>
              )}
            </div>
          </div>
          {showFilters && (
            <div className="bg-theme-surface border border-theme rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200 shadow-sm relative z-30">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Durum</label>
                <CustomSelect
                  value={filters.status}
                  onChange={(val) => setFilters(f => ({ ...f, status: val }))}
                  options={[
                    { id: 'all', label: 'Tümü' },
                    { id: 'planned', label: 'Hazır' },
                    { id: 'active', label: 'Başladı' },
                    { id: 'completed', label: 'Bitti' },
                    { id: 'cancelled', label: 'İptal' }
                  ]}
                  placeholder="Tümü"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Üretim Emri Tipi</label>
                <CustomSelect
                  value={filters.type}
                  onChange={(val) => setFilters(f => ({ ...f, type: val }))}
                  options={[
                    { id: 'all', label: 'Tümü' },
                    { id: 'Asıl Üretim', label: 'Asıl Üretim' },
                    { id: 'Tekrar İşlem', label: 'Tekrar İşlem' },
                    { id: 'Fason Üretim', label: 'Fason Üretim' },
                    { id: 'Ar-Ge', label: 'Ar-Ge' }
                  ]}
                  placeholder="Tümü"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Ürün</label>
                <CustomSelect
                  value={filters.productId}
                  onChange={(val) => setFilters(f => ({ ...f, productId: val }))}
                  options={[
                    { id: 'all', label: 'Tüm Ürünler' },
                    ...products.map(p => ({ id: p.id, label: p.productName, subtitle: p.productCode }))
                  ]}
                  placeholder="Tüm Ürünler"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Ürün Grubu</label>
                <CustomSelect
                  value={filters.productGroupId}
                  onChange={(val) => setFilters(f => ({ ...f, productGroupId: val }))}
                  options={[
                    { id: 'all', label: 'Tüm Gruplar' },
                    ...productGroups.map(pg => ({ id: pg.id, label: pg.name }))
                  ]}
                  placeholder="Tüm Gruplar"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Kategori</label>
                <CustomSelect
                  value={filters.categoryId}
                  onChange={(val) => setFilters(f => ({ ...f, categoryId: val }))}
                  options={[
                    { id: 'all', label: 'Tüm Kategoriler' },
                    ...categories.map(c => ({ id: c.id, label: c.name }))
                  ]}
                  placeholder="Tüm Kategoriler"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Makine Bilgisi</label>
                <CustomSelect
                  value={filters.machineId}
                  onChange={(val) => setFilters(f => ({ ...f, machineId: val }))}
                  options={[
                    { id: 'all', label: 'Tüm Makineler' },
                    ...machines.map(m => ({ id: m.id, label: m.name, subtitle: m.code }))
                  ]}
                  placeholder="Tüm Makineler"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Hedef Depo</label>
                <CustomSelect
                  value={filters.targetWarehouseId}
                  onChange={(val) => setFilters(f => ({ ...f, targetWarehouseId: val }))}
                  options={[
                    { id: 'all', label: 'Tüm Depolar' },
                    ...warehouses.map(w => ({ id: w.id, label: w.name }))
                  ]}
                  placeholder="Tüm Depolar"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest leading-none">Başlangıç / Bitiş Tarihi</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => setFilters(f => ({ ...f, dateStart: e.target.value }))}
                    className="form-input text-xs h-10 py-0 px-2 w-full"
                  />
                  <span>-</span>
                  <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => setFilters(f => ({ ...f, dateEnd: e.target.value }))}
                    className="form-input text-xs h-10 py-0 px-2 w-full"
                  />
                </div>
              </div>

              {Object.values(filters).some(v => v !== 'all' && v !== '') && (
                <button
                  onClick={() => setFilters({ status: 'all', productId: 'all', categoryId: 'all', productGroupId: 'all', machineId: 'all', type: 'all', targetWarehouseId: 'all', dateStart: '', dateEnd: '' })}
                  className="absolute -top-3 -right-3 bg-theme-danger text-white rounded-xl px-3 py-1.5 shadow-lg shadow-theme-danger/30 text-[10px] font-black tracking-widest uppercase hover:bg-theme-danger-hover transition-colors flex items-center gap-1 active:scale-95 border border-white/20 z-40"
                >
                  Temizle
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto min-h-[100px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loading size="lg" />
              <p className="text-xs font-black text-theme-dim uppercase tracking-[0.2em]">Yükleniyor...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-theme-base/10 border-b border-theme text-[10px] font-black text-theme-muted">
                  <th className="pl-6 px-3 py-4 w-10">
                    <div
                      onClick={() => setSelectedRows(selectedRows.length === orders.length ? [] : orders.map(o => o.id))}
                      className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${selectedRows.length === orders.length && orders.length > 0 ? "bg-theme-success border-theme-success" : "border-theme-border hover:border-theme-success"}`}
                    >
                      {selectedRows.length === orders.length && orders.length > 0 && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </th>
                  <th className="px-3 py-4 text-center">No</th>
                  <th className="px-3 py-4">Oluşturma Tarih</th>
                  <th className="px-3 py-4">Lot Numarası</th>
                  <th className="px-3 py-4">Tip</th>
                  <th className="px-3 py-4">Durum</th>
                  <th className="px-3 py-4">Ürün</th>
                  <th className="px-3 py-4">Güncel Proses</th>
                  <th className="px-3 py-4 text-center">Planlanan</th>
                  <th className="px-3 py-4 text-center">Kabul Adeti</th>
                  <th className="px-3 py-4 text-center">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredOrders.map((order) => {
                  const completedSteps = order.steps.filter((s: any) => s.status === 'completed');
                  const currentStep = order.steps.find((s: any) => s.status !== 'completed') || order.steps[order.steps.length - 1];
                  const lastCompletedStep = completedSteps[completedSteps.length - 1];
                  const progress = (completedSteps.length / order.steps.length) * 100;
                  const acceptedQuantity = lastCompletedStep ? (lastCompletedStep.approvedQty || 0) : 0;
                  const isSelected = selectedRows.includes(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors group cursor-pointer ${isSelected ? 'bg-theme-primary/10' : 'hover:bg-theme-primary/5'}`}
                      onClick={() => handleRowSelect(order.id)}
                    >
                      <td className="pl-6 px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <div
                          onClick={() => handleRowSelect(order.id)}
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? "bg-theme-success border-theme-success" : "border-theme-border hover:border-theme-success"}`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center w-16">
                        <div className="w-8 h-8 rounded-xl bg-theme-primary/10 flex items-center justify-center shrink-0 border border-theme-primary/20">
                          <span className="text-xs font-black text-theme-primary">{order.recordNumber}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-theme-muted">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className="text-sm font-black text-theme-main">{order.lotNumber}</span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-theme-muted uppercase bg-theme-base/50 px-2 py-1 rounded-md border border-theme">
                          {order.type || 'Asıl Üretim'}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm
                          ${order.status === 'planned' ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/30 shadow-theme-warning/20' :
                            order.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/30 shadow-theme-success/20' :
                              order.status === 'completed' ? 'bg-theme-primary/10 text-theme-primary border-theme-primary/30 shadow-theme-primary/20' :
                                'bg-theme-danger/10 text-theme-danger border-theme-danger/30 shadow-theme-danger/20'}`}
                        >
                          {order.status === 'planned' ? 'HAZIR' :
                            order.status === 'active' ? 'BAŞLADI' :
                              order.status === 'completed' ? 'BİTTİ' : 'İPTAL'}
                        </div>
                      </td>
                      <td className="px-3 py-4 max-w-[200px]">
                        <div className="space-y-0 overflow-hidden w-full">
                          <Tooltip content={order.productCodeSnap || order.product.productCode} position="top" className="w-full text-left inline-block">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-theme-primary truncate block">{order.productCodeSnap || order.product.productCode}</span>
                              {order.product.isSterileProduct && (
                                <span className="bg-theme-success/10 text-theme-success text-[8px] font-black px-1.5 py-0.5 rounded border border-theme-success/20 animate-pulse">STERİL ÜRETİM</span>
                              )}
                            </div>
                          </Tooltip>
                          <Tooltip content={order.productNameSnap || order.product.productName} position="top" className="w-full text-left inline-block mt-0">
                            <span className="text-xs font-bold text-theme-muted truncate block">{order.productNameSnap || order.product.productName}</span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-3 py-4 max-w-[200px]">
                        <div className="space-y-2 w-full">
                          <div className="flex justify-between text-[10px] font-black uppercase mb-1 items-center gap-2 overflow-hidden w-full text-left">
                            <Tooltip content={currentStep?.operation.name} position="top" className="flex-1 text-left inline-block overflow-hidden">
                              <span className="text-theme-main truncate block">{currentStep?.operation.name}</span>
                            </Tooltip>
                            <span className="text-theme-muted shrink-0 text-right">%{Math.round(progress)}</span>
                          </div>
                          <div className="h-2 w-full bg-theme-base rounded-full overflow-hidden border border-theme/30 shadow-inner">
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
                      <td className="px-3 py-4 text-center">
                        <span className="text-sm font-black text-theme-main">{order.quantity}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-sm font-black ${order.status === 'completed' ? 'text-theme-primary' : 'text-theme-success'}`}>
                          {order.status === 'planned' ? '-' : acceptedQuantity}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleStar(order.id, order.isStarred)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all bg-theme-main/5 hover:bg-theme-yellow/20 active:bg-theme-yellow/20 border border-theme-main/10 hover:border-theme-yellow/30 text-theme-main hover:text-theme-yellow group/star shadow-md shadow-theme-main/20 hover:shadow-theme-yellow/30 hover:scale-95"
                            title={order.isStarred ? "Yıldızı Kaldır" : "Yıldızla"}
                          >
                            <Star className={`w-4 h-4 transition-all ${order.isStarred ? 'text-amber-400 fill-amber-400' : 'group-hover/star:fill-amber-400/20'}`} />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all bg-theme-danger/10 hover:bg-theme-danger border border-theme-danger/30 text-theme-danger hover:text-theme-surface shadow-md shadow-theme-danger/20 hover:scale-95"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/production-orders/${order.lotNumber}`)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all bg-theme-primary/10 hover:bg-theme-primary border border-theme-primary/30 text-theme-primary hover:text-theme-surface shadow-md shadow-theme-primary/20 hover:scale-95"
                            title="Düzenle / Detay"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-40 text-center opacity-20">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="w-12 h-12 mb-4 text-theme-muted" />
                        <p className="font-black text-lg tracking-tight">Henüz bir üretim emri verilmemiş.</p>
                        <p className="text-xs font-bold mt-2">Arama kriterlerinize uygun sonuç bulunamadı veya liste boş.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={executeDelete}
        title="Üretim Emri'ni Kalıcı Olarak Sil?"
        message="Bu işlem geri alınamaz! Üretim emri ve emre bağlı olan tüm operasyon süreç verileri kalıcı olarak silinecektir."
        confirmLabel="KALICI OLARAK SİL"
        cancelLabel="VAZGEÇ"
        type="danger"
        requireMatch="Sil"
        matchPlaceholder="Sil"
      />

      {showDuplicateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-theme-surface/70 backdrop-blur-xs" onClick={() => setShowDuplicateModal(false)} />
          <div className="relative w-full max-w-sm bg-theme-card border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-theme-main text-center mb-6">Emirleri Çoğalt</h3>
            <div className="space-y-4">
              <p className="text-theme-muted text-xs font-bold text-center">
                Seçili {selectedRows.length} emri kaçar adet çoğaltmak istersiniz?
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setDuplicateCount(Math.max(1, duplicateCount - 1))}
                  className="w-10 h-10 rounded-xl bg-theme-base border border-theme flex items-center justify-center text-theme-main hover:bg-theme-main/5 transition-all text-theme-dim hover:text-theme-main"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={duplicateCount}
                  onChange={(e) => setDuplicateCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-12 bg-theme-base border border-theme rounded-xl text-center font-black text-xl text-theme-primary outline-none focus:border-theme-primary transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setDuplicateCount(Math.min(50, duplicateCount + 1))}
                  className="w-10 h-10 rounded-xl bg-theme-base border border-theme flex items-center justify-center text-theme-main hover:bg-theme-main/5 transition-all text-theme-dim hover:text-theme-main"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-theme-dim text-center opacity-70 uppercase font-black tracking-widest bg-theme-main/5 py-2 rounded-lg border border-theme/50">
                Toplam {selectedRows.length * duplicateCount} yeni emir oluşturulacak
              </p>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="flex-1 h-12 bg-theme-main/5 text-theme-dim font-black rounded-xl border border-white/10 hover:bg-theme-main/10 transition-all text-xs uppercase"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={executeBulkDuplicate}
                  className="flex-1 h-12 bg-theme-primary text-white font-black rounded-xl shadow-xl shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Çoğalt
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
