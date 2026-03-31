import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Database, Factory, Users, Clock, Package,
  Plus, Trash2, Edit, FileUp, Download, UploadCloud,
  CheckCircle2, AlertCircle, List, ChevronLeft, ChevronRight, Search, XCircle, Info, Settings, LayoutGrid
} from 'lucide-react';
import { Loading } from '../components/common/Loading';
import { CustomSelect } from '../components/common/CustomSelect';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SortableTableBody, SortableTableProvider } from '../components/common/SortableTable';

type TabType = 'machines' | 'operators' | 'shifts' | 'products' | 'departments' | 'department-roles' | 'import';

// Helper for Turkish characters in uppercase
const toTRUpper = (str: string) => (str || '').toLocaleUpperCase('tr-TR');

export function Definitions() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>((location.state as any)?.activeTab || 'machines');
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: '',
    direction: null
  });

  // Search state for entity tables
  const [searchTerm, setSearchTerm] = useState('');

  // Selection & Bulk Edit state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, any>>({});

  const updateLocalChanges = (id: string, field: string, value: any) => {
    setLocalChanges(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(item => item.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Import states
  const [importType, setImportType] = useState((location.state as any)?.importType || 'production_records');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const fetchData = async () => {
    if (activeTab === 'import') return;
    setLoading(true);
    try {
      const [res, depsRes, rolesRes] = await Promise.all([
        api.get(`/${activeTab}`).catch(() => []),
        api.get('/departments').catch(() => []),
        api.get('/department-roles').catch(() => [])
      ]);
      setData(Array.isArray(res) ? res : []);
      setDepartments(Array.isArray(depsRes) ? depsRes : []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
    } catch (e) {
      console.error(`Error loading ${activeTab}:`, e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (newOrder: any[]) => {
    // Optimistic update
    setData(newOrder);

    try {
      await api.post(`/${activeTab}/reorder`, {
        ids: newOrder.map(item => item.id)
      });
    } catch (e) {
      console.error('Failed to save reorder:', e);
      fetchData();
    }
  };

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
    if ((location.state as any)?.importType) {
      setImportType((location.state as any).importType);
    }
  }, [location.state]);

  useEffect(() => {
    fetchData();
    setShowAddForm(false);
    setIsEditing(false);
    setFormData({});
    setUploadStatus(null);
    setImportLogs([]);
    setSelectedFile(null);
    setSortConfig({ key: '', direction: null });
    setSearchTerm(''); // Reset search when tab changes
    setSelectedIds(new Set()); // Reset selection when tab changes
    setIsBulkEditing(false);
    setLocalChanges({});
  }, [activeTab]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || '').toLowerCase();
      const bVal = String(b[sortConfig.key] || '').toLowerCase();

      const numA = Number(a[sortConfig.key]);
      const numB = Number(b[sortConfig.key]);

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === 'asc' ? (numA - numB) : (numB - numA);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Filtered data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return sortedData;

    const lowerSearch = searchTerm.toLowerCase();
    return sortedData.filter(item => {
      // Search in different fields based on active tab
      if (activeTab === 'machines') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.brand?.toLowerCase().includes(lowerSearch) ||
          item.model?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'operators') {
        return (
          item.employeeId?.toLowerCase().includes(lowerSearch) ||
          item.fullName?.toLowerCase().includes(lowerSearch) ||
          item.department?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'shifts') {
        return (
          item.shiftCode?.toLowerCase().includes(lowerSearch) ||
          item.shiftName?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'products') {
        return (
          item.productCode?.toLowerCase().includes(lowerSearch) ||
          item.productName?.toLowerCase().includes(lowerSearch) ||
          item.brand?.toLowerCase().includes(lowerSearch) ||
          item.productGroup?.toLowerCase().includes(lowerSearch) ||
          item.category?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'departments') {
        return (
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.code?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'department-roles') {
        return (
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.department?.name?.toLowerCase().includes(lowerSearch)
        );
      }
      return true;
    });
  }, [sortedData, searchTerm, activeTab]);

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-6 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer group hover:text-theme-primary transition-colors whitespace-nowrap"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <div className="flex flex-col opacity-20 group-hover:opacity-100 transition-opacity">
          <ChevronLeft className={`w-2.5 h-2.5 rotate-90 -mb-0.5 ${sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'text-theme-primary opacity-100' : ''}`} />
          <ChevronRight className={`w-2.5 h-2.5 rotate-90 ${sortConfig.key === sortKey && sortConfig.direction === 'desc' ? 'text-theme-primary opacity-100' : ''}`} />
        </div>
      </div>
    </th>
  );

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'KAYDI SİL',
      message: 'Bu kaydı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/${activeTab}/${id}`);
          fetchData();
        } catch (e) {
          alert('Kayıt silinirken bir hata oluştu veya bu kayıt başka bir işlemde kullanılıyor.');
        }
      }
    });
  };

  const handleEdit = (item: any) => {
    setFormData(item);
    setIsEditing(true);
    setShowAddForm(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'TOPLU SİL',
      message: `${selectedIds.size} adet kaydı kalıcı olarak silmek istediğinize emin misiniz?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/${activeTab}/bulk-delete`, { ids: Array.from(selectedIds) });
          setSelectedIds(new Set());
          fetchData();
        } catch (e) {
          alert('Toplu silme sırasında bir hata oluştu.');
        }
      }
    });
  };

  const handleBulkStatusUpdate = (status: 'active' | 'passive') => {
    if (selectedIds.size === 0) return;
    const actionText = status === 'active' ? 'AKTİF' : 'PASİF';
    setConfirmModal({
      isOpen: true,
      title: 'TOPLU DURUM GÜNCELLE',
      message: `${selectedIds.size} adet kaydı ${actionText} yapmak istediadinize emin misiniz?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          await api.post(`/${activeTab}/bulk-update-status`, { ids: Array.from(selectedIds), status });
          setSelectedIds(new Set());
          fetchData();
        } catch (e) {
          alert('Toplu durum güncelleme başarısız oldu.');
        }
      }
    });
  };

  const handleBulkSave = async () => {
    const updates = Object.entries(localChanges).map(([id, data]) => ({ id, data }));
    if (updates.length === 0) {
      setIsBulkEditing(false);
      return;
    }

    setLoading(true);
    try {
      await api.post(`/${activeTab}/bulk-update`, { updates });
      setIsBulkEditing(false);
      setLocalChanges({});
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Toplu kaydetme başarısız oldu.';
      alert(`${errorMsg}\n\nLütfen girdiğiniz tüm kodların (Tezgah Kodu, Operatör ID vb.) benzersiz olduğundan ve zorunlu alanların dolu olduğundan emin olun.`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (item: any) => {
    const newStatus = item.status === 'active' ? 'passive' : 'active';
    const actionText = newStatus === 'active' ? 'AKTİF' : 'PASİF';

    setConfirmModal({
      isOpen: true,
      title: 'DURUM DEĞİŞTİR',
      message: `Bu kaydı ${actionText} yapmak istediğinize emin misiniz?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          const { id, createdAt, updatedAt, ...rest } = item;
          await api.put(`/${activeTab}/${id}`, { ...rest, status: newStatus });
          fetchData();
        } catch (e) {
          alert('Durum güncellenirken bir hata oluştu.');
        }
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, createdAt, updatedAt, ...rest } = formData;
      const dataToSave = { ...rest, status: formData.status || 'active' };

      if (isEditing) {
        await api.put(`/${activeTab}/${id}`, dataToSave);
      } else {
        await api.post(`/${activeTab}`, dataToSave);
      }
      setShowAddForm(false);
      setIsEditing(false);
      setFormData({});
      fetchData();
    } catch (err) {
      alert('Kayıt başarısız oldu. Lütfen benzersiz kod kullanımı ve zorunlu alanları kontrol edin.');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      await api.download(`/templates/${importType}`, `${importType}_template.xlsx`);
    } catch (e) {
      alert('Şablon indirilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setUploadStatus(null);
    setImportLogs([]);

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('importType', importType);

    try {
      const response = await fetch(`${API_URL}/imports/execute`, {
        method: 'POST',
        body: fd,
        headers: {
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        }
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus({ type: 'success', message: result.message || 'İşlem tamamlandı!' });
        setImportLogs(result.logs || []);
        setSelectedFile(null);
        const fileInput = document.getElementById('bulk-import-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const errorMsg = result.details ? `${result.error} (${result.details})` : (result.error || 'Yükleme başarısız!');
        setUploadStatus({ type: 'error', message: errorMsg });
        if (result.errors) {
          setImportLogs(result.errors.map((e: any) => `❌ [Hata] Satır ${e.row}: ${e.message}`));
        }
      }
    } catch (err) {
      setUploadStatus({ type: 'error', message: 'Bağlantı hatası oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'machines', label: 'Tezgahlar', icon: Factory },
    { id: 'operators', label: 'Personeller', icon: Users },
    { id: 'departments', label: 'Departmanlar', icon: LayoutGrid },
    { id: 'department-roles', label: 'Roller / Görevler', icon: Settings },
    { id: 'shifts', label: 'Vardiyalar', icon: Clock },
    { id: 'products', label: 'Ürün Kütüphanesi', icon: Package },
    { id: 'import', label: 'Veri Aktarımı', icon: FileUp }
  ];

  return (
    <div className="p-6 lg:p-8 w-full space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-theme-main flex items-center gap-4 tracking-tight">
          <Database className="w-8 h-8 text-theme-primary" /> SİSTEM TANIMLARI
        </h2>
        <p className="text-theme-muted text-sm mt-1">Tezgah, operatör ve ürün gibi <strong className="text-theme-primary">temel sistem tanımlamalarını</strong> buradan yönetebilirsiniz.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-54 space-y-2 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all font-bold text-sm border-2 ${isActive ? 'bg-theme-primary/10 border-theme-primary text-theme-primary shadow-xl shadow-theme-primary/10'
                  : 'text-theme-dim border-transparent hover:border-theme-muted hover:text-theme-muted'
                  }`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'text-theme-primary' : 'text-theme-dim'}`} />
                {toTRUpper(tab.label)}
              </button>
            )
          })}
        </div>

        <div className="flex-1 bg-theme-surface/40 backdrop-blur-xl border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
          {activeTab === 'import' ? (
            <div className="p-10 space-y-10 overflow-y-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-theme">
                <div>
                  <h3 className="text-2xl font-black text-theme-main tracking-tight">TOPLU VERİ AKTARIMI</h3>
                  <p className="text-theme-muted font-medium">Excel üzerinden sisteme hızlıca veri enjekte edin.</p>
                </div>
                <div className="w-full md:w-80">
                  <label className="text-[10px] font-black text-theme-dim tracking-widest mb-2 block">İÇE AKTARILACAK ALAN</label>
                  <CustomSelect
                    value={importType}
                    onChange={setImportType}
                    options={[
                      { id: 'production_records', label: 'Üretim Kayıtları' },
                      { id: 'products', label: 'Ürün Kütüphanesi' },
                      { id: 'machines', label: 'Tezgahlar' },
                      { id: 'operators', label: 'Personeller' },
                      { id: 'departments', label: 'Departmanlar' },
                      { id: 'department_roles', label: 'Roller / Görevler' },
                      { id: 'shifts', label: 'Vardiyalar' }
                    ]}
                    searchable={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="p-8 bg-theme-primary/5 rounded-2xl border-2 border-dashed border-theme-primary/20 text-center space-y-4">
                    <Download className="w-10 h-10 text-theme-primary mx-auto" />
                    <div>
                      <h4 className="font-bold text-theme-main text-lg">Standart Şablon</h4>
                      <p className="text-theme-muted text-sm">Hata almamak için seçtiğiniz türe uygun güncel şablonu kullanın.</p>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-2 px-8 py-3 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl transition-all shadow-lg shadow-theme-primary/20 active:scale-95"
                    >
                      <Download className="w-4 h-4" /> ŞABLONU İNDİR
                    </button>
                  </div>

                  <div className="p-10 bg-theme-base/20 rounded-2xl border border-theme space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center">
                        <UploadCloud className="w-6 h-6 text-theme-primary" />
                      </div>
                      <h4 className="font-bold text-theme-main uppercase tracking-wider text-sm">DOSYA SEÇİN</h4>
                    </div>

                    <div className="relative group">
                      <input
                        type="file"
                        id="bulk-import-file"
                        accept=".xlsx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="p-10 border-2 border-dashed border-theme-muted rounded-2xl text-center group-hover:border-theme-primary/50 transition-colors bg-theme-base/20">
                        <UploadCloud className="w-12 h-12 text-theme-muted mx-auto mb-4 group-hover:text-theme-primary transition-colors" />
                        <span className="text-theme-main font-bold block mb-1 truncate">
                          {selectedFile ? selectedFile.name : 'Excel Dosyasını Sürükleyin'}
                        </span>
                        <span className="text-xs text-theme-muted font-medium">Sadece .xlsx dosyaları kabul edilir.</span>
                      </div>
                    </div>

                    <button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || loading}
                      className="w-full py-5 bg-theme-success hover:bg-theme-success-hover disabled:opacity-30 disabled:grayscale text-white font-black rounded-2xl transition-all shadow-xl shadow-theme-success/20 flex items-center justify-center gap-3 active:scale-95"
                    >
                      {loading ? <Loading size="sm" /> : <><FileUp className="w-5 h-5" /> SİSTEME YÜKLE</>}
                    </button>
                  </div>
                </div>

                <div className="bg-theme-base/90 rounded-2xl border border-theme flex flex-col overflow-hidden shadow-inner ring-1 ring-theme-main/3 h-[500px]">
                  <div className="p-6 border-b border-theme flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-theme-success/10 rounded-lg flex items-center justify-center">
                        <List className="w-4 h-4 text-theme-success" />
                      </div>
                      <h4 className="font-bold text-theme-main uppercase tracking-widest text-xs">İŞLEM GÜNLÜĞÜ</h4>
                    </div>
                    {importLogs.length > 0 && <span className="text-[10px] bg-theme-base/40 text-theme-muted px-3 py-1 rounded-full font-bold">{importLogs.length} KAYIT</span>}
                  </div>

                  <div className="flex-1 overflow-auto p-6 space-y-3 font-mono text-[11px]">
                    {uploadStatus && (
                      <div className={`p-4 mb-2 rounded-2xl border flex items-center gap-3 ${uploadStatus.type === 'success'
                        ? 'bg-theme-success/10 border-theme-success/20 text-theme-success'
                        : 'bg-theme-danger/10 border-theme-danger/20 text-theme-danger'
                        }`}>
                        {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-bold text-xs uppercase tracking-wider">{uploadStatus.message}</span>
                      </div>
                    )}

                    {importLogs.length > 0 ? (
                      importLogs.map((log, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border ${log.includes('✅') ? 'bg-theme-success/5 border-theme-success/10 text-theme-success/80' : 'bg-theme-danger/5 border-theme-danger/10 text-theme-danger'}`}>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                        <Info className="w-12 h-12 mb-4 text-theme-dim" />
                        <p className="font-bold text-theme-main uppercase tracking-widest leading-loose">Yükleme yapıldığında<br />detaylar burada listelenecektir.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-theme flex justify-between items-center bg-theme-base/20 gap-4">
                <h3 className="text-lg font-bold text-theme-main tracking-tight">
                  {toTRUpper(tabs.find(t => t.id === activeTab)?.label ?? '')}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted group-focus-within:text-theme-primary transition-colors" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ara..."
                      className="w-64 bg-theme-surface border-2 border-theme rounded-xl pl-10 pr-4 py-2.5 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    />
                  </div>
                  <button
                    onClick={() => { setShowAddForm(!showAddForm); setIsEditing(false); setFormData({}); }}
                    className="bg-theme-primary hover:bg-theme-primary-hover text-white px-6 py-3 rounded-xl text-sm font-black transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-2 active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> YENİ EKLE
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form onSubmit={handleSave} className="flex flex-col bg-theme-surface border-b border-theme animate-in slide-in-from-top-4 duration-300 overflow-hidden" style={{ maxHeight: '80%' }}>
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeTab === 'machines' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">TEZGAH KODU</label><input required value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">MARKA</label><input value={formData.brand || ''} className="form-input" onChange={(e) => setFormData({ ...formData, brand: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">MODEL</label><input value={formData.model || ''} className="form-input" onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">KURULUM TARİHİ</label><input value={formData.installedDate ? String(formData.installedDate).slice(0, 10) : ''} type="date" className="form-input" onChange={(e) => setFormData({ ...formData, installedDate: e.target.value || null })} /></div>
                          <div className="space-y-1"><label className="label-sm">VARDİYA KAPASİTESİ (Adet)</label><input value={formData.capacityPerShift ?? ''} type="number" className="form-input" onChange={(e) => setFormData({ ...formData, capacityPerShift: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3"><label className="label-sm">NOTLAR</label><input value={formData.notes || ''} className="form-input" onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                        </>
                      )}
                      {activeTab === 'operators' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">SİCİL NO</label><input required value={formData.employeeId || ''} className="form-input" onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">AD SOYAD</label><input required value={formData.fullName || ''} className="form-input" onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">DEPARTMAN</label>
                            <CustomSelect
                              options={departments.map(d => ({ id: d.id, label: d.name }))}
                              value={formData.departmentId || ''}
                              onChange={(val) => {
                                setFormData({ ...formData, departmentId: val, roleId: '' });
                              }}
                              placeholder="Departman Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">GÖREV / ROL</label>
                            <CustomSelect
                              options={roles
                                .filter(r => !formData.departmentId || r.departmentId === formData.departmentId)
                                .map(r => ({ id: r.id, label: r.name, subLabel: r.department?.name }))}
                              value={formData.roleId || ''}
                              onChange={(val) => setFormData({ ...formData, roleId: val })}
                              placeholder="Görev Seçin"
                              disabled={!formData.departmentId}
                            />
                          </div>
                          <div className="space-y-1"><label className="label-sm">İŞE GİRİŞ TARİHİ</label><input value={formData.hireDate ? String(formData.hireDate).slice(0, 10) : ''} type="date" className="form-input" onChange={(e) => setFormData({ ...formData, hireDate: e.target.value || null })} /></div>
                          <div className="space-y-1"><label className="label-sm">TECRÜBE (Yıl)</label><input value={formData.experienceYears ?? ''} type="number" className="form-input" onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3"><label className="label-sm">SERTİFİKALAR</label><input value={formData.certifications || ''} className="form-input" onChange={(e) => setFormData({ ...formData, certifications: e.target.value })} /></div>
                        </>
                      )}
                      {activeTab === 'departments' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">DEPARTMAN ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">DEPARTMAN KODU</label><input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">DURUM</label>
                            <CustomSelect
                              options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                              value={formData.status || 'active'}
                              onChange={(val) => setFormData({ ...formData, status: val })}
                            />
                          </div>
                        </>
                      )}
                      {activeTab === 'department-roles' && (
                        <>
                          <div className="space-y-1">
                            <label className="label-sm">DEPARTMAN</label>
                            <CustomSelect
                              options={departments.map(d => ({ id: d.id, label: d.name }))}
                              value={formData.departmentId || ''}
                              onChange={(val) => setFormData({ ...formData, departmentId: val })}
                              placeholder="Departman Seçin"
                            />
                          </div>
                          <div className="space-y-1"><label className="label-sm">GÖREV / ROL ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">DURUM</label>
                            <CustomSelect
                              options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                              value={formData.status || 'active'}
                              onChange={(val) => setFormData({ ...formData, status: val })}
                            />
                          </div>
                        </>
                      )}
                      {activeTab === 'shifts' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">VARDİYA KODU</label><input required value={formData.shiftCode || ''} className="form-input" onChange={(e) => setFormData({ ...formData, shiftCode: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">VARDİYA ADI</label><input required value={formData.shiftName || ''} className="form-input" onChange={(e) => setFormData({ ...formData, shiftName: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">BAŞLANGIÇ (HH:MM)</label><input required value={formData.startTime || ''} className="form-input" placeholder="06:00" onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">BİTİŞ (HH:MM)</label><input required value={formData.endTime || ''} className="form-input" placeholder="14:00" onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">SÜRE (DK)</label><input required value={formData.durationMinutes || ''} type="number" className="form-input" onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })} /></div>
                          <div className="space-y-1"><label className="label-sm">RENK KODU</label><input value={formData.colorCode || ''} className="form-input" placeholder="#45B7D1" onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })} /></div>
                        </>
                      )}
                      {activeTab === 'products' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">ÜRÜN KODU</label><input required value={formData.productCode || ''} className="form-input" onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">ÜRÜN ADI</label><input required value={formData.productName || ''} className="form-input" onChange={(e) => setFormData({ ...formData, productName: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">MARKA</label><input value={formData.brand || ''} className="form-input" onChange={(e) => setFormData({ ...formData, brand: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">ÜRÜN GRUBU</label><input value={formData.productGroup || ''} className="form-input" onChange={(e) => setFormData({ ...formData, productGroup: e.target.value })} /></div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3"><label className="label-sm">AÇIKLAMA</label><input value={formData.description || ''} className="form-input" onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-6 bg-theme-base/20 border-t border-theme flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2.5 text-xs font-black text-theme-dim border border-theme rounded-xl hover:bg-theme-main/10 transition-all uppercase tracking-widest">İPTAL</button>
                    <button type="submit" className="px-8 py-2.5 text-xs font-black text-white bg-theme-primary rounded-xl hover:bg-theme-primary-hover transition-all shadow-lg shadow-theme-primary/20 uppercase tracking-widest">
                      {isEditing ? 'DEĞİŞİKLİKLERİ KAYDET' : 'KAYDET'}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex-1 overflow-auto custom-scrollbar relative">
                {loading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-theme-surface/60 backdrop-blur-sm">
                    <Loading size="lg" />
                  </div>
                ) : (
                  <SortableTableProvider
                    items={filteredData}
                    onReorder={handleReorder}
                  >
                    <table className="w-full text-left border-collapse resizable-table">
                      <thead className="sticky top-0 z-20 bg-theme-base/95 backdrop-blur-md">
                        <tr>
                          <th className="w-10"></th>
                          <th className="w-12 pl-6 py-5 border-b border-theme">
                            <label className="relative flex items-center cursor-pointer group justify-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                                onChange={toggleSelectAll}
                              />
                              <div className="w-5 h-5 bg-theme-surface border-2 border-theme rounded-lg transition-all peer-checked:bg-theme-primary peer-checked:border-theme-primary group-hover:border-theme-muted flex items-center justify-center">
                                <div className="w-1.5 h-3 border-r-2 border-b-2 border-theme-base rotate-45 mb-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                              </div>
                            </label>
                          </th>
                          <SortHeader label="KOD / ID" sortKey={activeTab === 'machines' ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : activeTab === 'departments' ? 'code' : activeTab === 'department-roles' ? 'id' : 'productCode'} />
                          <SortHeader label="TANIM / İSİM" sortKey={activeTab === 'machines' ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'departments' ? 'name' : activeTab === 'department-roles' ? 'name' : 'productName'} />
                          {activeTab === 'machines' && <SortHeader label="MARKA" sortKey="brand" />}
                          {activeTab === 'machines' && <SortHeader label="MODEL" sortKey="model" />}
                          {activeTab === 'machines' && <SortHeader label="KURULUM" sortKey="installedDate" />}
                          {activeTab === 'machines' && <SortHeader label="KAPASİTE/VARDİYA" sortKey="capacityPerShift" />}
                          {activeTab === 'machines' && <SortHeader label="NOT" sortKey="notes" />}

                          {activeTab === 'departments' && <SortHeader label="DURUM" sortKey="status" />}
                          {activeTab === 'department-roles' && <SortHeader label="DEPARTMAN" sortKey="department.name" />}

                          {activeTab === 'operators' && <SortHeader label="DEPARTMAN" sortKey="department" />}
                          {activeTab === 'operators' && <SortHeader label="GÖREV / ROL" sortKey="role" />}
                          {activeTab === 'operators' && <SortHeader label="İŞE GİRİŞ" sortKey="hireDate" />}
                          {activeTab === 'operators' && <SortHeader label="TECRÜBE" sortKey="experienceYears" />}
                          {activeTab === 'operators' && <SortHeader label="SERTİFİKA" sortKey="certifications" />}

                          {activeTab === 'shifts' && <SortHeader label="BAŞLANGIÇ" sortKey="startTime" />}
                          {activeTab === 'shifts' && <SortHeader label="BİTİŞ" sortKey="endTime" />}
                          {activeTab === 'shifts' && <SortHeader label="SÜRE (DK)" sortKey="durationMinutes" />}
                          {activeTab === 'shifts' && <SortHeader label="RENK" sortKey="colorCode" />}

                          {activeTab === 'products' && <SortHeader label="MARKA" sortKey="brand" />}
                          {activeTab === 'products' && <SortHeader label="ÜRÜN GRUBU" sortKey="productGroup" />}
                          {activeTab === 'products' && <SortHeader label="AÇIKLAMA" sortKey="description" />}
                          {activeTab === 'products' && <SortHeader label="BİRİM" sortKey="unitOfMeasure" />}
                          {activeTab === 'products' && <SortHeader label="KATEGORİ" sortKey="category" />}
                          <SortHeader label="DURUM" sortKey="status" />
                          <th className="px-6 py-5 text-[10px] font-black text-theme-muted tracking-widest text-right">İŞLEMLER</th>
                        </tr>
                      </thead>
                      <SortableTableBody
                        items={filteredData}
                        renderRow={(item: any) => {
                          const isSelected = selectedIds.has(item.id);
                          const isEditingRow = isBulkEditing && isSelected;

                          return (
                            <>
                              <td className="w-12 pl-6 py-4 border-b border-theme/30">
                                <label className="relative flex items-center cursor-pointer group justify-center">
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={isSelected}
                                    onChange={() => toggleSelectItem(item.id)}
                                  />
                                  <div className="w-5 h-5 bg-theme-surface border-2 border-theme rounded-lg transition-all peer-checked:bg-theme-primary peer-checked:border-theme-primary group-hover:border-theme-muted flex items-center justify-center scale-90 group-hover:scale-100">
                                    <div className="w-1.5 h-3 border-r-2 border-b-2 border-theme-base rotate-45 mb-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                  </div>
                                </label>
                              </td>
                              <td className="px-6 py-4 border-b border-theme/30 font-bold text-theme-primary font-mono text-sm leading-none">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[activeTab === 'machines' ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : activeTab === 'departments' ? 'code' : activeTab === 'department-roles' ? 'id' : 'productCode'] ?? (item.code || item.employeeId || item.shiftCode || item.productCode || item.id || '')}
                                    onChange={(e) => updateLocalChanges(item.id, activeTab === 'machines' ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : activeTab === 'departments' ? 'code' : activeTab === 'department-roles' ? 'id' : 'productCode', e.target.value)}
                                    className="settings-inline-input text-theme-primary font-mono"
                                  />
                                ) : (item.code || item.employeeId || item.shiftCode || item.productCode || (activeTab === 'department-roles' ? item.id.slice(0, 8) : item.id))}
                              </td>
                              <td className="px-6 py-4 border-b border-theme/30 text-theme-main font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[activeTab === 'machines' ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'departments' ? 'name' : activeTab === 'department-roles' ? 'name' : 'productName'] ?? (item.name || item.fullName || item.shiftName || item.productName || '')}
                                    onChange={(e) => updateLocalChanges(item.id, activeTab === 'machines' ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'departments' ? 'name' : activeTab === 'department-roles' ? 'name' : 'productName', e.target.value)}
                                    className="settings-inline-input"
                                  />
                                ) : (item.name || item.fullName || item.shiftName || item.productName)}
                              </td>

                              {activeTab === 'machines' && (
                                <>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.brand ?? (item.brand || '')} onChange={e => updateLocalChanges(item.id, 'brand', e.target.value)} className="settings-inline-input" /> : (item.brand || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.model ?? (item.model || '')} onChange={e => updateLocalChanges(item.id, 'model', e.target.value)} className="settings-inline-input" /> : (item.model || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input type="date" value={localChanges[item.id]?.installedDate?.slice(0, 10) ?? (item.installedDate ? String(item.installedDate).slice(0, 10) : '')} onChange={e => updateLocalChanges(item.id, 'installedDate', e.target.value)} className="settings-inline-input" /> : (item.installedDate ? new Date(item.installedDate).toLocaleDateString('tr-TR') : '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted font-mono text-sm whitespace-nowrap text-right">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.capacityPerShift ?? (item.capacityPerShift || '')} onChange={e => updateLocalChanges(item.id, 'capacityPerShift', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.capacityPerShift || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.notes ?? (item.notes || '')} onChange={e => updateLocalChanges(item.id, 'notes', e.target.value)} className="settings-inline-input" /> : (item.notes || '-')}
                                  </td>
                                </>
                              )}

                              {activeTab === 'operators' && (
                                <>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        options={departments.map(d => ({ id: d.id, label: d.name }))}
                                        value={localChanges[item.id]?.departmentId ?? (item.departmentId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'departmentId', val)}
                                      />
                                    ) : (item.department?.name || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        options={roles.filter(r => r.departmentId === (localChanges[item.id]?.departmentId ?? item.departmentId)).map(r => ({ id: r.id, label: r.name }))}
                                        value={localChanges[item.id]?.roleId ?? (item.roleId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'roleId', val)}
                                      />
                                    ) : (item.role?.name || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input type="date" value={localChanges[item.id]?.hireDate?.slice(0, 10) ?? (item.hireDate ? String(item.hireDate).slice(0, 10) : '')} onChange={e => updateLocalChanges(item.id, 'hireDate', e.target.value)} className="settings-inline-input" /> : (item.hireDate ? new Date(item.hireDate).toLocaleDateString('tr-TR') : '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted font-mono text-sm whitespace-nowrap text-right">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.experienceYears ?? (item.experienceYears || '')} onChange={e => updateLocalChanges(item.id, 'experienceYears', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.experienceYears || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.certifications ?? (item.certifications || '')} onChange={e => updateLocalChanges(item.id, 'certifications', e.target.value)} className="settings-inline-input" /> : (item.certifications || '-')}
                                  </td>
                                </>
                              )}

                              {activeTab === 'department-roles' && (
                                <>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        options={departments.map(d => ({ id: d.id, label: d.name }))}
                                        value={localChanges[item.id]?.departmentId ?? (item.departmentId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'departmentId', val)}
                                      />
                                    ) : (item.department?.name || '-')}
                                  </td>
                                </>
                              )}

                              {activeTab === 'shifts' && (
                                <>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.startTime ?? (item.startTime || '')} onChange={e => updateLocalChanges(item.id, 'startTime', e.target.value)} className="settings-inline-input" /> : (item.startTime || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.endTime ?? (item.endTime || '')} onChange={e => updateLocalChanges(item.id, 'endTime', e.target.value)} className="settings-inline-input" /> : (item.endTime || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted font-mono text-sm whitespace-nowrap text-right">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.durationMinutes ?? (item.durationMinutes || '')} onChange={e => updateLocalChanges(item.id, 'durationMinutes', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.durationMinutes || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? (
                                      <div className="flex items-center gap-2">
                                        <input type="color" value={localChanges[item.id]?.colorCode ?? (item.colorCode || '#3b82f6')} onChange={e => updateLocalChanges(item.id, 'colorCode', e.target.value)} className="w-8 h-8 bg-transparent border-0 cursor-pointer" />
                                        <input value={localChanges[item.id]?.colorCode ?? (item.colorCode || '#3b82f6')} onChange={e => updateLocalChanges(item.id, 'colorCode', e.target.value)} className="settings-inline-input flex-1" />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.colorCode || '#3b82f6' }} />
                                        <span className="font-mono text-xs uppercase">{item.colorCode || '#3b82f6'}</span>
                                      </div>
                                    )}
                                  </td>
                                </>
                              )}

                              {activeTab === 'products' && (
                                <>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.brand ?? (item.brand || '')} onChange={e => updateLocalChanges(item.id, 'brand', e.target.value)} className="settings-inline-input" /> : (item.brand || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.productGroup ?? (item.productGroup || '')} onChange={e => updateLocalChanges(item.id, 'productGroup', e.target.value)} className="settings-inline-input" /> : (item.productGroup || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.description ?? (item.description || '')} onChange={e => updateLocalChanges(item.id, 'description', e.target.value)} className="settings-inline-input" /> : (item.description || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.unitOfMeasure ?? (item.unitOfMeasure || '')} onChange={e => updateLocalChanges(item.id, 'unitOfMeasure', e.target.value)} className="settings-inline-input w-20" /> : (item.unitOfMeasure || '-')}
                                  </td>
                                  <td className="px-6 py-4 border-b border-theme/30 text-theme-muted text-sm whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.category ?? (item.category || '')} onChange={e => updateLocalChanges(item.id, 'category', e.target.value)} className="settings-inline-input" /> : (item.category || '-')}
                                  </td>
                                </>
                              )}

                              <td className="px-6 py-4 border-b border-theme/30">
                                <span
                                  onClick={() => !isEditingRow && handleToggleStatus(item)}
                                  className={`text-[9px] font-black px-3 py-1 rounded-full border flex items-center gap-1.5 w-fit ${item.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : 'bg-theme-base/20 text-theme-dim border-theme'} ${!isEditingRow ? 'cursor-pointer hover:scale-105 transition-transform active:scale-95' : 'opacity-50'}`}
                                >
                                  <div className={`w-1 h-1 rounded-full ${item.status === 'active' ? 'bg-theme-success animate-pulse' : 'bg-theme-base/20'}`} />
                                  {item.status === 'active' ? 'AKTİF' : 'PASİF'}
                                </span>
                              </td>
                              <td className="px-6 py-4 border-b border-theme/30 text-right opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {!isEditingRow && (
                                  <div className="flex justify-end gap-2 text-right">
                                    <button onClick={() => handleEdit(item)} className="p-2.5 bg-theme-primary/10 text-theme-primary rounded-xl hover:bg-theme-primary-hover hover:text-white transition-all"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2.5 bg-theme-danger/10 text-theme-danger rounded-xl hover:bg-theme-danger hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                )}
                              </td>
                            </>
                          );
                        }}
                      />
                    </table>
                  </SortableTableProvider>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
      />

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 w-fit max-w-[95vw]">
          <div className="bg-theme-surface backdrop-blur-2xl border border-theme-primary/20 rounded-2xl p-3 flex items-center gap-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
            <div className="flex items-center gap-3 border-r border-theme pr-6">
              <div className="w-9 h-9 bg-theme-primary rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-theme-primary/20">
                {selectedIds.size}
              </div>
              <div className="whitespace-nowrap">
                <p className="text-[10px] font-medium text-theme-primary uppercase tracking-widest leading-none">SECHILI</p>
                <p className="text-theme-main font-medium text-xs mt-0.5">İşlem Bekliyor</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isBulkEditing ? (
                <button
                  onClick={handleBulkSave}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-success hover:bg-theme-success-hover text-white border border-theme-success/20 rounded-lg font-medium text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-theme-success/10"
                >
                  <Settings className="w-3 h-3" />
                  Değişiklikleri Kaydet
                </button>
              ) : (
                <button
                  onClick={() => setIsBulkEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-theme-primary font-medium text-[10px] uppercase tracking-wider transition-all active:scale-95"
                >
                  <Edit className="w-3 h-3 text-theme-primary" />
                  Tabloyu Düzenle
                </button>
              )}

              <button
                onClick={() => handleBulkStatusUpdate('active')}
                className="flex items-center gap-2 px-4 py-2 bg-theme-success/5 hover:bg-theme-success/10 border border-theme-success/20 rounded-lg text-theme-success font-medium text-[10px] uppercase tracking-wider transition-all active:scale-95"
              >
                <CheckCircle2 className="w-3 h-3" />
                Aktif Yap
              </button>

              <button
                onClick={() => handleBulkStatusUpdate('passive')}
                className="flex items-center gap-2 px-4 py-2 bg-theme-warning/5 hover:bg-theme-warning/10 border border-theme-warning/20 rounded-lg text-theme-warning font-medium text-[10px] uppercase tracking-wider transition-all active:scale-95"
              >
                <AlertCircle className="w-3 h-3" />
                Pasif Yap
              </button>

              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-theme-danger/5 hover:bg-theme-danger/10 border border-theme-danger/20 rounded-lg text-theme-danger font-medium text-[10px] uppercase tracking-wider transition-all active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                Sil
              </button>

              <div className="w-px h-6 bg-theme-base/20 mx-2" />

              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setIsBulkEditing(false);
                  setLocalChanges({});
                }}
                className="flex items-center gap-2 px-3 py-2 text-theme-muted hover:text-theme-main transition-colors text-[10px] font-medium uppercase tracking-widest"
              >
                <XCircle className="w-4 h-4" />
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Definitions;
