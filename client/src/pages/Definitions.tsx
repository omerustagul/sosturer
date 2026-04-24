import { useState, useEffect, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Database, Factory, Users, Clock, Package,
  Plus, Trash2, Edit, FileUp, Download, UploadCloud,
  CheckCircle2, AlertCircle, List, ChevronLeft, ChevronRight, Search, Info, Settings, LayoutGrid,
  Warehouse, Building2, Workflow, Map, Layers
} from 'lucide-react';
import { Loading } from '../components/common/Loading';
import { CustomSelect } from '../components/common/CustomSelect';
import { BulkActionBar } from '../components/common/BulkActionBar';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SortableTableBody, SortableTableProvider } from '../components/common/SortableTable';
import { ProductRecipeModal } from '../components/planning/ProductRecipeModal';
import { ProductEditModal } from '../components/planning/ProductEditModal';
import { RecipeModal } from '../components/planning/RecipeModal';
import { RecipeDetailModal } from '../components/planning/RecipeDetailModal';
import { notify } from '../store/notificationStore';

type TabType = 'machines' | 'operators' | 'shifts' | 'products' | 'work-centers' | 'stations' | 'warehouses' | 'department-roles' | 'import' | 'operations' | 'routes' | 'event-reasons' | 'event-groups';

// Helper for Turkish characters in uppercase
const toTRUpper = (str: string) => (str || '').toLocaleUpperCase('tr-TR');

export function Definitions() {
  const location = useLocation();
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();

  const tabs = [
    { id: '_group_base', label: 'TEMEL TANIMLAR', isGroupHeader: true, icon: LayoutGrid },
    { id: 'machines', label: 'Makineler', icon: Factory, indent: true },
    { id: 'operators', label: 'Personeller', icon: Users, indent: true },
    { id: 'shifts', label: 'Vardiyalar', icon: Clock, indent: true },
    { id: 'products', label: 'Stok Kartları', icon: Package, indent: true },
    { id: '_group_departments', label: 'DEPARTMANLAR', isGroupHeader: true, icon: LayoutGrid },
    { id: 'work-centers', label: 'İş Merkezleri', icon: Building2, indent: true },
    { id: 'stations', label: 'İstasyonlar', icon: List, indent: true },
    { id: 'warehouses', label: 'Depolar', icon: Warehouse, indent: true },
    { id: 'department-roles', label: 'Roller / Görevler', icon: Settings, indent: true },
    { id: '_group_production', label: 'ÜRETİM TANIMLARI', isGroupHeader: true, icon: LayoutGrid },
    { id: 'operations', label: 'Operasyonlar', icon: Workflow, indent: true },
    { id: 'routes', label: 'Reçeteler', icon: Map, indent: true },
    { id: 'event-groups', label: 'Olay Grupları', icon: Layers, indent: true },
    { id: 'event-reasons', label: 'Olay Sebepleri', icon: AlertCircle, indent: true },
    { id: '_group_tools', label: 'SİSTEM ARAÇLARI', isGroupHeader: true, icon: LayoutGrid },
    { id: 'import', label: 'Veri Aktarımı', icon: FileUp, indent: true }
  ];

  const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || (location.state as any)?.activeTab || 'machines');
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [companyUnits, setCompanyUnits] = useState<any[]>([]);   // departments from /company/units (with locationId)
  const [companyLocations, setCompanyLocations] = useState<any[]>([]); // locations from /company/locations
  const [routes, setRoutes] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [eventGroups, setEventGroups] = useState<any[]>([]);
  const [modularEditProduct, setModularEditProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
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

  const [recipeProduct, setRecipeProduct] = useState<any>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set(['_group_base']);
    const currentTab = tab || (location.state as any)?.activeTab || 'machines';

    const tabIndex = tabs.findIndex(t => t.id === currentTab);
    if (tabIndex !== -1) {
      for (let i = tabIndex; i >= 0; i--) {
        if ((tabs[i] as any).isGroupHeader) {
          initial.add(tabs[i].id);
          break;
        }
      }
    }
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    const next = new Set(openGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setOpenGroups(next);
  };

  // const routeSteps = setViewRecipeId;

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

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

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
      setSelectedIds(new Set(filteredData.map((item: any) => item.id)));
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

  // const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3005/api`;

  const getEndpoint = () => {
    if (activeTab === 'work-centers') return '/departments';
    if (activeTab === 'warehouses') return '/inventory/warehouses';
    if (activeTab === 'routes') return '/production-routes';
    if (activeTab === 'operations') return '/operations';
    if (activeTab === 'stations') return '/stations';
    if (activeTab === 'event-groups') return '/production-event-groups';
    if (activeTab === 'event-reasons') return '/production-event-reasons';
    return `/${activeTab}`;
  };

  const fetchData = async () => {
    if (activeTab === 'import') return;
    setLoading(true);
    try {
      // Use the helper to get the correct endpoint for the current tab
      const endpoint = getEndpoint();

      // For warehouses/stations tab: fetch company units (departments) and locations
      const [res, depsRes, rolesRes, unitsRes, locsRes] = await Promise.all([
        api.get(endpoint).catch(() => []),
        api.get('/departments').catch(() => []),
        api.get('/department-roles').catch(() => []),
        api.get('/departments').catch(() => []), // Replaced system unit call
        api.get('/system/company/locations').catch(() => []),
      ]);
      setData(Array.isArray(res) ? res : []);
      setDepartments(Array.isArray(depsRes) ? depsRes : []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
      setCompanyUnits(Array.isArray(unitsRes) ? unitsRes : []);
      setCompanyLocations(Array.isArray(locsRes) ? locsRes : []);

      // Fetch specifically for production definitions
      if (activeTab === 'operations' || activeTab === 'routes' || activeTab === 'products' || activeTab === 'stations' || activeTab === 'event-reasons') {
        const [routesRes, wareRes, stationsRes, machinesRes, productsRes, groupsRes] = await Promise.all([
          api.get('/production-routes').catch(() => []),
          api.get('/inventory/warehouses').catch(() => []),
          api.get('/stations').catch(() => []),
          api.get('/machines').catch(() => []),
          api.get('/products').catch(() => []),
          api.get('/production-event-groups').catch(() => [])
        ]);
        setRoutes(Array.isArray(routesRes) ? routesRes : []);
        setWarehouses(Array.isArray(wareRes) ? wareRes : []);
        setStations(Array.isArray(stationsRes) ? stationsRes : []);
        setMachines(Array.isArray(machinesRes) ? machinesRes : []);
        setAllProducts(Array.isArray(productsRes) ? productsRes : []);
        setEventGroups(Array.isArray(groupsRes) ? groupsRes : []);
      }
    } catch (e) {
      console.error(`Error loading ${activeTab}:`, e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab && tab !== activeTab) {
      setActiveTab(tab as TabType);

      // Find and open the parent group of the new tab
      const tabIndex = tabs.findIndex(t => t.id === tab);
      if (tabIndex !== -1) {
        for (let i = tabIndex; i >= 0; i--) {
          if ((tabs[i] as any).isGroupHeader) {
            setOpenGroups(prev => new Set([...Array.from(prev), tabs[i].id]));
            break;
          }
        }
      }
    }
  }, [tab]);

  const handleReorder = async (newOrder: any[]) => {
    // Optimistic update
    setData(newOrder);

    const endpoint = getEndpoint();
    try {
      await api.post(`${endpoint}/reorder`, {
        ids: newOrder.map(item => item.id)
      });
    } catch (e) {
      console.error('Failed to save reorder:', e);
      fetchData();
    }
  };

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      navigate(`/definitions/${(location.state as any).activeTab}`, { replace: true });
    }
    if ((location.state as any)?.importType) {
      setImportType((location.state as any).importType);
    }
  }, [location.state, navigate]);

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
    setCurrentPage(0); // Reset page when tab changes
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
    return sortedData.filter((item: any) => {
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
      } else if (activeTab === 'work-centers') {
        return (
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.code?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'warehouses') {
        return (
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.type?.toLowerCase().includes(lowerSearch) ||
          item.code?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'department-roles') {
        return (
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.department?.name?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'operations') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.unit?.name?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'routes') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'event-groups') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch)
        );
      } else if (activeTab === 'event-reasons') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.type?.toLowerCase().includes(lowerSearch)
        );
      }
      return true;
    });
  }, [sortedData, searchTerm, activeTab]);

  const paginatedData = useMemo(() => {
    return filteredData.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredData, currentPage, pageSize]);

  const pageCount = Math.ceil(filteredData.length / pageSize);

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-2 py-3 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-theme-primary transition-colors whitespace-nowrap text-center"
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



  const handleAddNew = () => {
    if (activeTab === 'routes') {
      setSelectedRecipe(null);
      setShowRecipeModal(true);
      return;
    }
    setFormData({});
    setIsEditing(false);
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'KAYDI SİL',
      message: 'Bu kaydı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`${getEndpoint()}/${id}`);
          fetchData();
          notify.success('Silindi', 'Kayıt başarıyla temizlendi.');
        } catch (e) {
          notify.error('Hata', 'Kayıt silinirken bir hata oluştu veya bu kayıt başka bir işlemde kullanılıyor.');
        }
      }
    });
  };

  const handleEdit = (item: any) => {
    if (activeTab === 'products') {
      setModularEditProduct(item);
    } else if (activeTab === 'routes') {
      setSelectedRecipe(item);
      setShowRecipeModal(true);
    } else {
      setFormData(item);
      setIsEditing(true);
      setShowAddForm(true);
    }
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
          await api.post(`${getEndpoint()}/bulk-delete`, { ids: Array.from(selectedIds) });
          setSelectedIds(new Set());
          fetchData();
          notify.success('Toplu Silme', `${selectedIds.size} kayıt başarıyla silindi.`);
        } catch (e) {
          notify.error('Hata', 'Toplu silme sırasında bir hata oluştu.');
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
          await api.post(`${getEndpoint()}/bulk-update-status`, { ids: Array.from(selectedIds), status });
          setSelectedIds(new Set());
          fetchData();
          notify.success('Durum Güncellendi', 'Seçili kayıtların durumu başarıyla değiştirildi.');
        } catch (e) {
          notify.error('Başarısız', 'Toplu durum güncelleme başarısız oldu.');
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
      await api.post(`${getEndpoint()}/bulk-update`, { updates });
      setIsBulkEditing(false);
      setLocalChanges({});
      setSelectedIds(new Set());
      fetchData();
      notify.success('Kaydedildi', 'Tüm değişiklikler başarıyla uygulandı.');
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Toplu kaydetme başarısız oldu.';
      notify.error('Hata', errorMsg);
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
          const { id, createdAt, updatedAt, unit, station, steps, department, role, company, ...rest } = item;
          await api.put(`${getEndpoint()}/${id}`, { ...rest, status: newStatus });
          fetchData();
          notify.success('Durum Güncellendi', 'Kayıt durumu başarıyla değiştirildi.');
        } catch (e) {
          notify.error('Hata', 'Durum güncellenirken bir hata oluştu.');
        }
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Destructure to remove relations and sensitive fields
      const { id, createdAt, updatedAt, unit, station, department, role, company, ...rest } = formData;

      // We keep 'steps' if we are on the routes tab because the backend handles nested steps there.
      const dataToSave = {
        ...rest,
        steps: activeTab === 'routes' ? formData.steps : undefined,
        status: formData.status || 'active'
      };

      if (isEditing) {
        await api.put(`${getEndpoint()}/${id}`, dataToSave);
      } else {
        await api.post(getEndpoint(), dataToSave);
      }
      setShowAddForm(false);
      setIsEditing(false);
      setFormData({});
      fetchData();
      notify.success(isEditing ? 'Güncellendi' : 'Eklendi', 'İşlem başarıyla tamamlandı.');
    } catch (err) {
      notify.error('Başarısız', 'Kayıt işlemi sırasında bir hata oluştu. Lütfen zorunlu alanları ve benzersiz kodları kontrol edin.');
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
      const result = await api.upload('/imports/execute', fd);

      setUploadStatus({ type: 'success', message: result.message || 'İşlem tamamlandı!' });
      setImportLogs(result.logs || []);
      setSelectedFile(null);
      const fileInput = document.getElementById('bulk-import-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Yükleme başarısız!' });
    } finally {
      setLoading(false);
    }
  };

  // Build unit options grouped by location for the warehouses tab
  const unitOptionsByLocation = useMemo(() => {
    const grouped: { locationName: string; units: { id: string; label: string; subLabel: string }[] }[] = [];
    const noLocationUnits: { id: string; label: string; subLabel: string }[] = [];

    companyUnits.forEach((u: any) => {
      const loc = companyLocations.find(l => l.id === u.locationId);
      const unitEntry = { id: u.id, label: u.name, subLabel: loc?.name || 'Lokasyon yok' };
      if (loc) {
        const existing = grouped.find(g => g.locationName === loc.name);
        if (existing) {
          existing.units.push(unitEntry);
        } else {
          grouped.push({ locationName: loc.name, units: [unitEntry] });
        }
      } else {
        noLocationUnits.push(unitEntry);
      }
    });
    if (noLocationUnits.length > 0) {
      grouped.push({ locationName: 'Lokasyon Atanmamış', units: noLocationUnits });
    }
    return grouped;
  }, [companyUnits, companyLocations]);

  // Flat unit options for CustomSelect in warehouse form
  const flatUnitOptions = useMemo(() => {
    return [
      { id: '', label: 'Birim Bağlantısı Yok' },
      ...unitOptionsByLocation.flatMap(g =>
        g.units.map(u => ({ id: u.id, label: u.label, subLabel: `📍 ${g.locationName}` }))
      )
    ];
  }, [unitOptionsByLocation]);


  const tabLabel = () => {
    if (activeTab === 'work-centers') return 'İŞ MERKEZLERİ';
    if (activeTab === 'stations') return 'İSTASYONLAR';
    if (activeTab === 'warehouses') return 'DEPOLAR';
    const found = tabs.find(t => t.id === activeTab);
    return toTRUpper(found?.label ?? '');
  };

  return (
    <div className="h-[calc(100vh-64px)] p-4 lg:p-6 w-full flex flex-col gap-4 animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-theme-main flex items-center gap-2 tracking-tight">
            <Database className="w-5 h-5 text-theme-primary" /> SİSTEM TANIMLARI
          </h2>
          <p className="text-theme-muted text-[11px] font-bold mt-0.5">Makine, operatör ve ürün gibi <strong className="text-theme-primary lowercase">temel sistem tanımlamalarını</strong> buradan yönetebilirsiniz.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
            >
              <List size={13} />
            </button>
          </div>
          {(activeTab !== 'import' && activeTab !== 'department-roles' && activeTab !== 'event-reasons' && activeTab !== 'event-groups') && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-6 h-10 bg-theme-primary hover:bg-theme-primary-hover text-white font-black rounded-xl transition-all shadow-xl shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 text-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Yeni Ekle
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <div className="w-50 flex flex-col gap-0.5 overflow-y-auto pr-3 no-scrollbar shrink-0">
          {tabs.map((tab, idx) => {
            if ((tab as any).isGroupHeader) {
              const isOpen = openGroups.has(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => toggleGroup(tab.id)}
                  className="flex items-center justify-between w-full pt-4 pb-2 px-1 group transition-all"
                >
                  <span className="text-[9px] font-black text-theme-dim uppercase group-hover:text-theme-primary tracking-widest">{tab.label}</span>
                  <ChevronLeft className={`w-2.5 h-2.5 text-theme-dim/60 group-hover:text-theme-primary transition-transform duration-300 ${isOpen ? '-rotate-90' : ''}`} />
                </button>
              );
            }

            // Find parent group to check if visible
            let parentGroupId = '';
            for (let i = idx; i >= 0; i--) {
              if ((tabs[i] as any).isGroupHeader) {
                parentGroupId = tabs[i].id;
                break;
              }
            }
            if (parentGroupId && !openGroups.has(parentGroupId)) return null;

            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(`/definitions/${tab.id}`)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition-all font-bold text-[10.5px] border-2 group ${isActive ? 'bg-theme-primary/10 border-theme-primary text-theme-primary shadow-xl shadow-theme-primary/10'
                  : 'text-theme-dim border-transparent hover:bg-theme-main/5 hover:text-theme-main'
                  }`}
              >
                <tab.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-theme-primary' : 'text-theme-dim'}`} />
                <span className="uppercase">{toTRUpper(tab.label)}</span>
                {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-theme-primary shadow-[0_0_8px_var(--primary-glow)]" />}
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex flex-col min-h-0 modern-glass-card p-0 overflow-hidden relative border border-theme/50 bg-theme-surface/30 backdrop-blur-xl shadow-xl">
          {activeTab === 'import' ? (
            <div className="space-y-4 overflow-y-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 p-4 border-b border-theme">
                <div>
                  <h3 className="text-lg font-bold text-theme-main mb-0">TOPLU VERİ AKTARIMI</h3>
                  <p className="text-theme-muted text-[10px] font-bold">Excel üzerinden sisteme hızlıca veri, tablo, liste ve daha fazlasını aktarın.</p>
                </div>
                <div className="w-full md:w-80">
                  <label className="text-[10px] font-black text-theme-dim tracking-widest mb-2 block">İÇE AKTARILACAK ALAN</label>
                  <CustomSelect
                    value={importType}
                    onChange={setImportType}
                    options={[
                      { id: 'production_records', label: 'Üretim Kayıtları' },
                      { id: 'products', label: 'Stok Kartları' },
                      { id: 'machines', label: 'Makineler' },
                      { id: 'operators', label: 'Personeller' },
                      { id: 'departments', label: 'İş Merkezleri' },
                      { id: 'department_roles', label: 'Roller / Görevler' },
                      { id: 'shifts', label: 'Vardiyalar' },
                      { id: 'warehouses', label: 'Depolar' },
                      { id: 'operations', label: 'Operasyonlar' },
                      { id: 'stations', label: 'İstasyonlar' },
                      { id: 'routes', label: 'Reçeteler' }
                    ]}
                    searchable={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
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
                      className="w-full h-12 py-5 bg-theme-success hover:bg-theme-success-hover disabled:opacity-30 disabled:grayscale text-white font-black rounded-xl transition-all shadow-xl shadow-theme-success/20 flex items-center justify-center gap-3 active:scale-95"
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
                        <div key={idx} className={`p-3 rounded-xl border ${log.includes('✅') || log.toLowerCase().includes('başarıyla') || log.toLowerCase().includes('success') ? 'bg-theme-success/5 border-theme-success/10 text-theme-success/80' : 'bg-theme-danger/5 border-theme-danger/10 text-theme-danger'}`}>
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
          ) : ((activeTab === 'warehouses' || activeTab === 'work-centers' || activeTab === 'stations') && viewMode === 'grid') ? (
            // ─── GROUPED GRID VIEW ──────────────────────
            <>
              <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-base/20 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-theme-main">{activeTab === 'warehouses' ? 'DEPOLAR' : 'İŞ MERKEZLERİ'}</h3>
                  <p className="text-[10px] font-bold text-theme-muted mt-0">
                    {activeTab === 'warehouses'
                      ? 'Şirket lokasyonlarındaki depo birimlerini buradan tanımlayın ve yönetin.'
                      : activeTab === 'work-centers'
                        ? 'Üretim süreçlerinin gerçekleştiği ana operasyonel birimler.'
                        : 'İş merkezlerine bağlı alt operasyon istasyonları.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition-all ${(viewMode as string) === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                    >
                      <List size={16} />
                    </button>
                  </div>
                  <div className="h-6 w-px bg-theme mx-1" />
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted group-focus-within:text-theme-primary transition-colors" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ara..."
                      className="w-64 h-10 bg-theme-surface border-2 border-theme rounded-xl pl-8 pr-4 py-2 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    />
                  </div>
                  <button
                    onClick={handleAddNew}
                    className="bg-theme-primary hover:bg-theme-primary-hover h-10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-2 group hover:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Yeni Ekle
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form onSubmit={handleSave} className="flex flex-col bg-theme-surface border-b border-theme animate-in slide-in-from-top-4 duration-300 overflow-hidden" style={{ maxHeight: '80%' }}>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                      {activeTab === 'warehouses' ? (
                        <>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO KODU</label>
                            <input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. DP-01" />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO ADI</label>
                            <input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. MAMÜL DEPO" />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO TİPİ</label>
                            <CustomSelect
                              options={[
                                { id: 'general', label: 'Genel Depo' },
                                { id: 'raw', label: 'Hammadde Deposu' },
                                { id: 'finished', label: 'Mamül Deposu' },
                                { id: 'semifinished', label: 'Yarı Mamül Deposu' },
                                { id: 'consumable', label: 'Sarf Malzeme Deposu' },
                                { id: 'scrap', label: 'Fire / Hurda' },
                                { id: 'workcenter', label: 'İş Merkezi' },
                              ]}
                              value={formData.type || 'general'}
                              onChange={(val) => setFormData({ ...formData, type: val })}
                              searchable={false}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DURUM</label>
                            <CustomSelect
                              options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                              value={formData.status || 'active'}
                              onChange={(val) => setFormData({ ...formData, status: val })}
                              searchable={false}
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="label-sm">LOKASYON BAĞLANTISI</label>
                            <CustomSelect
                              options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                              value={formData.locationId || ''}
                              onChange={(val) => setFormData({ ...formData, locationId: val || null })}
                              placeholder="Lokasyon Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">BİRİM BAĞLANTISI (Şirket Yapısından Seçin)</label>
                            <CustomSelect
                              options={flatUnitOptions}
                              value={formData.unitId || ''}
                              onChange={(val) => setFormData({ ...formData, unitId: val || null })}
                              placeholder="Bağlanacak birimi seçin (isteğe bağlı)"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="label-sm">İŞ MERKEZİ ADI</label>
                            <input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. CNC-1 KESİM" />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">LOKASYON</label>
                            <CustomSelect
                              options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                              value={formData.locationId || ''}
                              onChange={(val) => setFormData({ ...formData, locationId: val })}
                              placeholder="Lokasyon Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DURUM</label>
                            <CustomSelect
                              options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                              value={formData.status || 'active'}
                              onChange={(val) => setFormData({ ...formData, status: val })}
                              searchable={false}
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3">
                            <label className="label-sm">KOD</label>
                            <input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Birim Kodu" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="py-4 p-2 bg-theme-base/20 flex justify-end gap-3">
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
                  <div className="p-4 space-y-6">
                    {filteredData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                        {activeTab === 'warehouses' ? <Warehouse className="w-12 h-12 mb-4 text-theme-dim" /> : <Building2 className="w-12 h-12 mb-4 text-theme-dim" />}
                        <p className="font-black text-theme-main uppercase tracking-widest text-sm">Henüz {activeTab === 'warehouses' ? 'depo' : 'iş merkezi'} tanımlanmamış</p>
                        <p className="text-xs text-theme-muted mt-1">Yeni Ekle butonuna tıklayarak başlayın.</p>
                      </div>
                    ) : (
                      (() => {
                        const groupsMap: Record<string, { locName: string; items: any[] }> = {};

                        paginatedData.forEach((item: any) => {
                          let locName = 'Bilinmiyor';
                          if (activeTab === 'warehouses') {
                            const directLoc = companyLocations.find(l => l.id === item.locationId);
                            if (directLoc) {
                              locName = directLoc.name;
                            } else {
                              const unit = companyUnits.find(u => u.id === item.unitId);
                              const loc = companyLocations.find(l => l.id === unit?.locationId);
                              locName = loc?.name || (unit ? unit.name : 'Lokasyon Atanmamış');
                            }
                          } else if (activeTab === 'stations') {
                            const unit = companyUnits.find(u => u.id === item.unitId);
                            locName = unit?.name || 'İş Merkezi Atanmamış';
                          } else {
                            const loc = companyLocations.find(l => l.id === item.locationId);
                            locName = loc?.name || 'Lokasyon Atanmamış';
                          }

                          if (!groupsMap[locName]) groupsMap[locName] = { locName, items: [] };
                          groupsMap[locName].items.push(item);
                        });

                        return Object.values(groupsMap).map(group => (
                          <div key={group.locName} className="space-y-4">
                            <div className="flex items-center gap-3 pb-2 border-b-2 border-theme/20">
                              <div className="w-2 h-6 bg-theme-primary rounded-full" />
                              <h4 className="text-xs font-black text-theme-main uppercase tracking-widest">{group.locName}</h4>
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
                                {group.items.length} {activeTab === 'warehouses' ? 'DEPO' : activeTab === 'work-centers' ? 'İŞ MERKEZİ' : 'İSTASYON'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {group.items.map((item: any) => {
                                const typeLabel = activeTab === 'warehouses' ? ({
                                  general: 'Genel Depo',
                                  raw: 'Hammadde',
                                  finished: 'Mamül',
                                  semifinished: 'Yarı Mamül',
                                  consumable: 'Sarf Malzeme',
                                  scrap: 'Fire / Hurda',
                                  workcenter: 'İş Merkezi',
                                }[item.type as string] || item.type) : (item.code || 'BİRİM');

                                return (
                                  <div key={item.id} className="p-4 rounded-2xl border border-theme bg-theme-surface/50 hover:border-theme-primary/40 hover:bg-theme-surface hover:shadow-2xl hover:shadow-theme-primary/5 transition-all duration-300 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-theme-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500" />

                                    <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                                      <div className={`w-10 h-10 rounded-xl ${activeTab === 'warehouses' ? 'bg-amber-500/10' : activeTab === 'stations' ? 'bg-emerald-500/10' : 'bg-theme-primary/10'} flex items-center justify-center shrink-0 shadow-inner`}>
                                        {activeTab === 'warehouses' ? <Warehouse className="w-5 h-5 text-amber-500" /> : activeTab === 'stations' ? <Factory className="w-5 h-5 text-emerald-500" /> : <Building2 className="w-5 h-5 text-theme-primary" />}
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleEdit(item)} className="p-2 bg-theme-base/50 text-theme-dim rounded-xl hover:bg-theme-primary hover:text-white transition-all shadow-sm"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-theme-base/50 text-theme-dim rounded-xl hover:bg-theme-danger hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                    </div>

                                    <div className="relative z-10">
                                      <p className="text-sm font-black text-theme-main uppercase leading-none tracking-tight mb-1">{item.name}</p>
                                      <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider ${activeTab === 'warehouses'
                                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                          : activeTab === 'stations'
                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                            : 'bg-theme-primary/10 text-theme-primary border-theme-primary/20'
                                          }`}>
                                          {typeLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-theme-base/40 border border-theme/20">
                                          <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {item.status === 'active' ? 'AKTİF' : 'PASİF'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {activeTab === 'warehouses' && item._count?.stockLevels != null && (
                                      <div className="mt-4 pt-3 border-t border-theme/20 flex items-center justify-between">
                                        <span className="text-[10px] text-theme-muted font-bold">Takip Edilen Ürün</span>
                                        <span className="text-[11px] font-black text-theme-main">{item._count.stockLevels}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      })()
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-theme flex justify-between items-center bg-theme-base/20 gap-4">
                <h3 className="text-lg font-bold text-theme-main">
                  {tabLabel()}
                  <p className="text-[10px] font-bold text-theme-muted mt-0">
                    Sistem tanımlamalarınızı, referans verilerinizi ve daha fazlasını buradan yönetin.
                  </p>
                </h3>
                <div className="flex items-center gap-3">
                  {['warehouses', 'work-centers', 'stations'].includes(activeTab) && (
                    <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                      >
                        <List size={16} />
                      </button>
                    </div>
                  )}
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted group-focus-within:text-theme-primary transition-colors" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ara..."
                      className="w-64 h-10 bg-theme-surface border-2 border-theme rounded-xl pl-8 pr-4 py-2 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    />
                  </div>
                  <button
                    onClick={handleAddNew}
                    className="bg-theme-primary hover:bg-theme-primary-hover h-10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xl shadow-theme-primary/20 flex items-center gap-2 group hover:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Yeni Ekle
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form onSubmit={handleSave} className="flex flex-col bg-theme-surface border-b border-theme animate-in slide-in-from-top-4 duration-300 overflow-hidden" style={{ maxHeight: '80%' }}>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                      {activeTab === 'machines' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">MAKİNE KODU</label><input required value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
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
                      {activeTab === 'work-centers' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">İŞ MERKEZİ KODU</label><input required value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">İŞ MERKEZİ ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">LOKASYON</label>
                            <CustomSelect
                              options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                              value={formData.locationId || ''}
                              onChange={(val) => setFormData({ ...formData, locationId: val })}
                              placeholder="Lokasyon Seçin"
                            />
                          </div>
                        </>
                      )}
                      {activeTab === 'warehouses' && (
                        <>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO KODU</label>
                            <input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. DP-01" />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO ADI</label>
                            <input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. MAMÜL DEPO" />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">DEPO TİPİ</label>
                            <CustomSelect
                              options={[
                                { id: 'general', label: 'Genel Depo' },
                                { id: 'raw', label: 'Hammadde' },
                                { id: 'finished', label: 'Mamül' },
                                { id: 'semifinished', label: 'Yarı Mamül' },
                                { id: 'consumable', label: 'Sarf Malzeme' },
                                { id: 'scrap', label: 'Fire / Hurda' },
                                { id: 'workcenter', label: 'İş Merkezi' },
                              ]}
                              value={formData.type || 'general'}
                              onChange={(val) => setFormData({ ...formData, type: val })}
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="label-sm">LOKASYON BAĞLANTISI</label>
                            <CustomSelect
                              options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                              value={formData.locationId || ''}
                              onChange={(val) => setFormData({ ...formData, locationId: val || null })}
                              placeholder="Lokasyon Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">BİRİM BAĞLANTISI (Şirket Yapısından Seçin)</label>
                            <CustomSelect
                              options={flatUnitOptions}
                              value={formData.unitId || ''}
                              onChange={(val) => setFormData({ ...formData, unitId: val || null })}
                              placeholder="Bağlanacak birimi seçin (isteğe bağlı)"
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
                          <div className="space-y-1">
                            <label className="label-sm">TAKİP SİSTEMİ</label>
                            <CustomSelect
                              options={[
                                { id: 'LOT', label: 'Lot Takibi' },
                                { id: 'SERIAL', label: 'Seri No Takibi' },
                                { id: 'BOTH', label: 'Lot ve Seri Takibi' },
                                { id: 'NONE', label: 'Takip Yok' }
                              ]}
                              value={formData.trackingType || 'NONE'}
                              onChange={(val) => setFormData({ ...formData, trackingType: val })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">STOK TİPİ</label>
                            <CustomSelect
                              options={[
                                'Hammadde', 'Sarf Malzeme', 'Yarımamül', 'Mamül', 'Ölçüm Aracı',
                                'Ekipman', 'Kalıp', 'Yardımcı Malzeme', 'Tüketim Malzemesi',
                                'Ambalaj', 'Yedek Parça'
                              ].map(s => ({ id: s, label: s }))}
                              value={formData.stockType || ''}
                              onChange={(val) => setFormData({ ...formData, stockType: val })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">STD. ÜRETİM ADETİ (BİR LOT)</label>
                            <input type="number" value={formData.defaultProductionQty || ''} className="form-input" onChange={(e) => setFormData({ ...formData, defaultProductionQty: Number(e.target.value) })} />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">HEDEF DEPO (BİTİNCE)</label>
                            <CustomSelect
                              options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                              value={formData.targetWarehouseId || ''}
                              onChange={(val) => setFormData({ ...formData, targetWarehouseId: val })}
                            />
                          </div>
                          <div className="space-y-1"><label className="label-sm">ÜRÜN SINIFI</label><input value={formData.productClass || ''} className="form-input" onChange={(e) => setFormData({ ...formData, productClass: e.target.value })} /></div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3"><label className="label-sm">AÇIKLAMA</label><input value={formData.description || ''} className="form-input" onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                        </>
                      )}

                      {activeTab === 'operations' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">OPERASYON KODU</label><input required value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">OPERASYON ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">İŞ MERKEZİ / BİRİM</label>
                            <CustomSelect
                              options={companyUnits.map(u => ({ id: u.id, label: u.name, subLabel: companyLocations.find(l => l.id === u.locationId)?.name }))}
                              value={formData.unitId || ''}
                              onChange={(val) => setFormData({ ...formData, unitId: val, stationId: '' })}
                              placeholder="Birim Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">İSTASYON</label>
                            <CustomSelect
                              options={stations.filter(s => s.unitId === (formData.unitId || '')).map(s => ({ id: s.id, label: s.name, subLabel: s.code }))}
                              value={formData.stationId || ''}
                              onChange={(val) => setFormData({ ...formData, stationId: val })}
                              placeholder={formData.unitId ? "İstasyon Seçin" : "Önce İş Merkezi Seçin"}
                              disabled={!formData.unitId}
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2 lg:col-span-3"><label className="label-sm">AÇIKLAMA</label><input value={formData.description || ''} className="form-input" onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                        </>
                      )}

                      {activeTab === 'stations' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">İSTASYON KODU</label><input required value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                          <div className="space-y-1"><label className="label-sm">İSTASYON ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">İŞ MERKEZİ / BİRİM</label>
                            <CustomSelect
                              options={companyUnits.map(u => ({ id: u.id, label: u.name, subLabel: companyLocations.find(l => l.id === u.locationId)?.name }))}
                              value={formData.unitId || ''}
                              onChange={(val) => setFormData({ ...formData, unitId: val })}
                              placeholder="Birim Seçin"
                            />
                          </div>
                        </>
                      )}
                      {activeTab === 'event-groups' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">GRUP KODU</label><input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. CNC-G" /></div>
                          <div className="space-y-1"><label className="label-sm">GRUP ADI</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. CNC Kaynaklı" /></div>
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
                      {activeTab === 'event-reasons' && (
                        <>
                          <div className="space-y-1"><label className="label-sm">OLAY KODU</label><input value={formData.code || ''} className="form-input" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. RED-01" /></div>
                          <div className="space-y-1"><label className="label-sm">OLAY SEBEBİ</label><input required value={formData.name || ''} className="form-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                          <div className="space-y-1">
                            <label className="label-sm">OLAY GRUBU</label>
                            <CustomSelect
                              options={eventGroups.map(g => ({ id: g.id, label: g.name, subLabel: g.code }))}
                              value={formData.groupId || ''}
                              onChange={(val) => setFormData({ ...formData, groupId: val })}
                              placeholder="Grup Seçin"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="label-sm">OLAY TİPİ</label>
                            <CustomSelect
                              options={[
                                { id: 'RED', label: 'RED' },
                                { id: 'NUMUNE', label: 'NUMUNE' },
                                { id: 'TEKRAR_ISLEM', label: 'TEKRAR İŞLEM' },
                                { id: 'SARTLI_KABUL', label: 'ŞARTLI KABUL' }
                              ]}
                              value={formData.type || ''}
                              onChange={(val) => setFormData({ ...formData, type: val })}
                              placeholder="Tip Seçin"
                            />
                          </div>
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


                    </div>
                    <div className="py-4 p-2 bg-theme-base/20 border-t border-theme flex justify-end gap-3">
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2.5 text-xs font-black text-theme-dim border border-theme rounded-xl hover:bg-theme-main/10 transition-all uppercase tracking-widest">İPTAL</button>
                      <button type="submit" className="px-8 py-2.5 text-xs font-black text-white bg-theme-primary rounded-xl hover:bg-theme-primary-hover transition-all shadow-lg shadow-theme-primary/20 uppercase tracking-widest">
                        {isEditing ? 'DEĞİŞİKLİKLERİ KAYDET' : 'KAYDET'}
                      </button>
                    </div>
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
                    items={paginatedData}
                    onReorder={handleReorder}
                  >
                    <table className="w-full text-left border-collapse resizable-table density-aware-table">
                      <thead className="sticky top-0 z-20 bg-theme-base/95 backdrop-blur-md">
                        <tr>
                          <th className="w-2 px-1 py-3 border-b border-theme" />
                          <th className="w-12 px-2 py-3 border-b border-theme text-center">
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
                          <SortHeader label="KOD / ID" sortKey={
                            (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers') ? 'code' :
                              activeTab === 'operators' ? 'employeeId' :
                                activeTab === 'shifts' ? 'shiftCode' :
                                  (activeTab === 'warehouses' || activeTab === 'department-roles' || activeTab === 'event-reasons') ? 'id' :
                                    'productCode'
                          } />
                          <SortHeader label="TANIM / İSİM" sortKey={(activeTab === 'machines' || activeTab === 'operators' || activeTab === 'shifts' || activeTab === 'department-roles' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons') ? 'name' : 'productName'} />
                          {activeTab === 'machines' && <SortHeader label="MARKA" sortKey="brand" />}
                          {activeTab === 'machines' && <SortHeader label="MODEL" sortKey="model" />}
                          {activeTab === 'machines' && <SortHeader label="KURULUM" sortKey="installedDate" />}
                          {activeTab === 'machines' && <SortHeader label="KAPASİTE/VARDİYA" sortKey="capacityPerShift" />}
                          {activeTab === 'machines' && <SortHeader label="NOT" sortKey="notes" />}

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

                          {activeTab === 'products' && (
                            <>
                              <SortHeader label="MARKA" sortKey="brand" />
                              <SortHeader label="Ü. GRUBU" sortKey="productGroup" />
                              <SortHeader label="SINIF" sortKey="productClass" />
                              <SortHeader label="AÇIKLAMA" sortKey="description" />
                              <SortHeader label="BİRİM" sortKey="unitOfMeasure" />
                              <SortHeader label="KATEGORİ" sortKey="category" />
                            </>
                          )}

                          {(activeTab === 'operations' || activeTab === 'stations') && <SortHeader label="İŞ MERKEZİ / BİRİM" sortKey="unitId" />}
                          {activeTab === 'operations' && <SortHeader label="İSTASYON" sortKey="stationId" />}
                          {activeTab === 'routes' && <th className="px-2 py-3 text-[10px] font-black text-theme-muted tracking-widest text-center uppercase">ADIM SAYISI</th>}

                          {activeTab === 'warehouses' && (
                            <>
                              <SortHeader label="TİP" sortKey="type" />
                              <SortHeader label="LOKASYON" sortKey="unitId" />
                            </>
                          )}
                          {activeTab === 'work-centers' && (
                            <>
                              <SortHeader label="LOKASYON" sortKey="locationId" />
                            </>
                          )}
                          {activeTab === 'event-reasons' && (
                            <>
                              <SortHeader label="GRUP" sortKey="groupId" />
                              <SortHeader label="TİP" sortKey="type" />
                            </>
                          )}

                          <SortHeader label="DURUM" sortKey="status" />
                          <th className="px-2 py-3 text-[10px] font-black text-theme-muted tracking-widest text-center">İŞLEMLER</th>
                        </tr>
                      </thead>
                      <SortableTableBody
                        items={paginatedData}
                        onRowClick={(item, e) => {
                          if ((e.target as HTMLElement).closest('button, input, select, a, .cursor-pointer, [role="button"]')) return;
                          if (activeTab === 'routes') {
                            setViewRecipeId(item.id);
                          } else {
                            toggleSelectItem(item.id);
                          }
                        }}
                        rowClassName={(item) => selectedIds.has(item.id) ? 'bg-theme-primary/10' : ''}
                        renderRow={(item: any) => {
                          const isSelected = selectedIds.has(item.id);
                          const isEditingRow = isBulkEditing && isSelected;

                          return (
                            <>
                              <td className="w-12 px-2 py-3 border-b border-theme/30">
                                <label className="relative flex items-center justify-center group">
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={isSelected}
                                    onChange={() => toggleSelectItem(item.id)}
                                  />
                                  <div className="w-5 h-5 bg-theme-surface border-2 border-theme rounded-lg transition-all peer-checked:bg-theme-primary peer-checked:border-theme-primary flex items-center justify-center scale-90 group-hover:scale-100">
                                    <div className="w-1.5 h-3 border-r-2 border-b-2 border-theme-base rotate-45 mb-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                                  </div>
                                </label>
                              </td>
                              <td className="px-2 py-3 border-b border-theme/30 font-bold text-theme-primary font-mono text-sm leading-none">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[(activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons' || activeTab === 'event-groups') ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : (activeTab === 'department-roles') ? 'id' : 'productCode'] ?? (item.code || item.employeeId || item.shiftCode || item.productCode || (activeTab === 'department-roles' ? item.id : ''))}
                                    onChange={(e) => updateLocalChanges(item.id, (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons' || activeTab === 'event-groups') ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : (activeTab === 'department-roles') ? 'id' : 'productCode', e.target.value)}
                                    className="settings-inline-input text-theme-primary font-mono"
                                  />
                                ) : (item.code || item.employeeId || item.shiftCode || item.productCode || (activeTab === 'department-roles' ? item.id.slice(0, 8) : item.id.slice(0, 8)))}
                              </td>
                              <td className="px-2 py-3 border-b border-theme/30 text-xs text-theme-main font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[(activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-groups') ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'department-roles' ? 'name' : 'productName'] ?? (item.name || item.fullName || item.shiftName || item.productName || '')}
                                    onChange={(e) => updateLocalChanges(item.id, (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-groups') ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'department-roles' ? 'name' : 'productName', e.target.value)}
                                    className="settings-inline-input"
                                  />
                                ) : (item.name || item.fullName || item.shiftName || item.productName)}
                              </td>

                              {activeTab === 'machines' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap text-start">
                                    {isEditingRow ? <input value={localChanges[item.id]?.brand ?? (item.brand || '')} onChange={e => updateLocalChanges(item.id, 'brand', e.target.value)} className="settings-inline-input" /> : (item.brand || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.model ?? (item.model || '')} onChange={e => updateLocalChanges(item.id, 'model', e.target.value)} className="settings-inline-input" /> : (item.model || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input type="date" value={localChanges[item.id]?.installedDate?.slice(0, 10) ?? (item.installedDate ? String(item.installedDate).slice(0, 10) : '')} onChange={e => updateLocalChanges(item.id, 'installedDate', e.target.value)} className="settings-inline-input" /> : (item.installedDate ? new Date(item.installedDate).toLocaleDateString('tr-TR') : '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted font-mono text-xs whitespace-nowrap text-start">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.capacityPerShift ?? (item.capacityPerShift || '')} onChange={e => updateLocalChanges(item.id, 'capacityPerShift', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.capacityPerShift || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-start max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.notes ?? (item.notes || '')} onChange={e => updateLocalChanges(item.id, 'notes', e.target.value)} className="settings-inline-input" /> : (item.notes || '-')}
                                  </td>
                                </>
                              )}

                              {activeTab === 'operators' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={departments.map(d => ({ id: d.id, label: d.name }))}
                                        value={localChanges[item.id]?.departmentId ?? (item.departmentId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'departmentId', val)}
                                      />
                                    ) : (item.department?.name || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={roles.filter(r => r.departmentId === (localChanges[item.id]?.departmentId ?? item.departmentId)).map(r => ({ id: r.id, label: r.name }))}
                                        value={localChanges[item.id]?.roleId ?? (item.roleId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'roleId', val)}
                                      />
                                    ) : (item.role?.name || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input type="date" value={localChanges[item.id]?.hireDate?.slice(0, 10) ?? (item.hireDate ? String(item.hireDate).slice(0, 10) : '')} onChange={e => updateLocalChanges(item.id, 'hireDate', e.target.value)} className="settings-inline-input" /> : (item.hireDate ? new Date(item.hireDate).toLocaleDateString('tr-TR') : '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted font-mono text-xs whitespace-nowrap text-start">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.experienceYears ?? (item.experienceYears || '')} onChange={e => updateLocalChanges(item.id, 'experienceYears', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.experienceYears || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.certifications ?? (item.certifications || '')} onChange={e => updateLocalChanges(item.id, 'certifications', e.target.value)} className="settings-inline-input" /> : (item.certifications || '-')}
                                  </td>
                                </>
                              )}

                              {activeTab === 'department-roles' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
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
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.startTime ?? (item.startTime || '')} onChange={e => updateLocalChanges(item.id, 'startTime', e.target.value)} className="settings-inline-input" /> : (item.startTime || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.endTime ?? (item.endTime || '')} onChange={e => updateLocalChanges(item.id, 'endTime', e.target.value)} className="settings-inline-input" /> : (item.endTime || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted font-mono text-xs whitespace-nowrap text-right">
                                    {isEditingRow ? <input type="number" value={localChanges[item.id]?.durationMinutes ?? (item.durationMinutes || '')} onChange={e => updateLocalChanges(item.id, 'durationMinutes', parseInt(e.target.value))} className="settings-inline-input w-20 text-right" /> : (item.durationMinutes || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
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
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.brand ?? (item.brand || '')} onChange={e => updateLocalChanges(item.id, 'brand', e.target.value)} className="settings-inline-input" /> : (item.brand || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.productGroup ?? (item.productGroup || '')} onChange={e => updateLocalChanges(item.id, 'productGroup', e.target.value)} className="settings-inline-input" /> : (item.productGroup || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.productClass ?? (item.productClass || '')} onChange={e => updateLocalChanges(item.id, 'productClass', e.target.value)} className="settings-inline-input w-20" /> : (item.productClass || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                    {isEditingRow ? <input value={localChanges[item.id]?.description ?? (item.description || '')} onChange={e => updateLocalChanges(item.id, 'description', e.target.value)} className="settings-inline-input" /> : (item.description || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.unitOfMeasure ?? (item.unitOfMeasure || '')} onChange={e => updateLocalChanges(item.id, 'unitOfMeasure', e.target.value)} className="settings-inline-input w-20" /> : (item.unitOfMeasure || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.category ?? (item.category || '')} onChange={e => updateLocalChanges(item.id, 'category', e.target.value)} className="settings-inline-input" /> : (item.category || '-')}
                                  </td>
                                </>
                              )}

                              {(activeTab === 'operations' || activeTab === 'stations') && (
                                <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                  {isEditingRow ? (
                                    <CustomSelect
                                      variant="inline"
                                      options={companyUnits.map(u => ({ id: u.id, label: u.name }))}
                                      value={localChanges[item.id]?.unitId ?? (item.unitId || '')}
                                      onChange={(val) => {
                                        updateLocalChanges(item.id, 'unitId', val);
                                        updateLocalChanges(item.id, 'stationId', '');
                                      }}
                                    />
                                  ) : (item.unit?.name || '-')}
                                </td>
                              )}

                              {activeTab === 'operations' && (
                                <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                  {isEditingRow ? (
                                    <CustomSelect
                                      variant="inline"
                                      options={stations.filter(s => s.unitId === (localChanges[item.id]?.unitId ?? item.unitId)).map(s => ({ id: s.id, label: s.name }))}
                                      value={localChanges[item.id]?.stationId ?? (item.stationId || '')}
                                      onChange={(val) => updateLocalChanges(item.id, 'stationId', val)}
                                      disabled={!(localChanges[item.id]?.unitId ?? item.unitId)}
                                      placeholder={(localChanges[item.id]?.unitId ?? item.unitId) ? "Seç" : "Önce Birim"}
                                    />
                                  ) : (item.station?.name || '-')}
                                </td>
                              )}

                              {activeTab === 'routes' && (
                                <td className="px-2 py-3 border-b border-theme/30 text-theme-main text-xs font-black text-center">
                                  {item._count?.steps ?? (item.steps?.length || 0)} ADIM
                                </td>
                              )}

                              {activeTab === 'warehouses' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={[
                                          { id: 'general', label: 'Genel Depo' },
                                          { id: 'raw', label: 'Hammadde' },
                                          { id: 'finished', label: 'Mamül' },
                                          { id: 'semifinished', label: 'Yarı Mamül' },
                                          { id: 'consumable', label: 'Sarf Malzeme' },
                                          { id: 'scrap', label: 'Fire / Hurda' },
                                          { id: 'workcenter', label: 'İş Merkezi' },
                                        ]}
                                        value={localChanges[item.id]?.type ?? (item.type || 'general')}
                                        onChange={(val) => updateLocalChanges(item.id, 'type', val)}
                                      />
                                    ) : (({
                                      general: 'Genel Depo',
                                      raw: 'Hammadde',
                                      finished: 'Mamül',
                                      semifinished: 'Yarı Mamül',
                                      consumable: 'Sarf Malzeme',
                                      scrap: 'Fire / Hurda',
                                      workcenter: 'İş Merkezi',
                                    }[item.type as string] || item.type) || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap text-start">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                                        value={localChanges[item.id]?.locationId ?? (item.locationId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'locationId', val)}
                                        placeholder="Lokasyon Seçin"
                                      />
                                    ) : (() => {
                                      const directLoc = companyLocations.find(l => l.id === item.locationId);
                                      if (directLoc) return directLoc.name;
                                      const unit = companyUnits.find(u => u.id === item.unitId);
                                      const loc = companyLocations.find(l => l.id === unit?.locationId);
                                      return loc?.name || (unit ? unit.name : '-');
                                    })()}
                                  </td>
                                </>
                              )}

                              {activeTab === 'work-centers' && (
                                <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                  {isEditingRow ? (
                                    <CustomSelect
                                      variant="inline"
                                      options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                                      value={localChanges[item.id]?.locationId ?? (item.locationId || '')}
                                      onChange={(val) => updateLocalChanges(item.id, 'locationId', val)}
                                      placeholder="Seç"
                                    />
                                  ) : (
                                    (() => {
                                      const loc = companyLocations.find(l => l.id === item.locationId);
                                      return loc?.name || '-';
                                    })()
                                  )}
                                </td>
                              )}



                              {activeTab === 'event-reasons' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={eventGroups.map(g => ({ id: g.id, label: g.name }))}
                                        value={localChanges[item.id]?.groupId ?? (item.groupId || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'groupId', val)}
                                        placeholder="Grup Seçin"
                                      />
                                    ) : (item.group?.name || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={[
                                          { id: 'RED', label: 'RED' },
                                          { id: 'NUMUNE', label: 'NUMUNE' },
                                          { id: 'TEKRAR_ISLEM', label: 'TEKRAR İŞLEM' },
                                          { id: 'SARTLI_KABUL', label: 'ŞARTLI KABUL' }
                                        ]}
                                        value={localChanges[item.id]?.type ?? (item.type || '')}
                                        onChange={(val) => updateLocalChanges(item.id, 'type', val)}
                                      />
                                    ) : (item.type || '-')}
                                  </td>
                                </>
                              )}

                              <td className="px-2 py-3 border-b border-theme/30">
                                <span
                                  onClick={() => !isEditingRow && handleToggleStatus(item)}
                                  className={`text-[9px] font-black px-3 py-1 rounded-full border flex items-center gap-1.5 w-fit ${item.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : 'bg-theme-base/20 text-theme-dim border-theme'} ${!isEditingRow ? 'cursor-pointer hover:scale-105 transition-transform active:scale-95' : 'opacity-50'}`}
                                >
                                  <div className={`w-1 h-1 rounded-full ${item.status === 'active' ? 'bg-theme-success animate-pulse' : 'bg-theme-base/20'}`} />
                                  {item.status === 'active' ? 'AKTİF' : 'PASİF'}
                                </span>
                              </td>
                              <td className="px-2 py-3 border-b border-theme/30 text-center transition-opacity whitespace-nowrap">
                                {!isEditingRow && (
                                  <div className="flex justify-center gap-2 text-center">
                                    {activeTab === 'products' && (
                                      <button
                                        onClick={() => setRecipeProduct(item)}
                                        className="p-2 bg-theme-main/5 text-theme-dim rounded-lg hover:bg-theme-success/10 hover:text-theme-success transition-all shadow-sm"
                                        title="Operasyon Kartı / Reçete"
                                      >
                                        <Workflow className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button onClick={() => handleEdit(item)} className="p-2 bg-theme-main/5 text-theme-dim rounded-lg hover:bg-theme-primary/10 hover:text-theme-primary transition-all shadow-sm"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 bg-theme-main/5 text-theme-dim rounded-lg hover:bg-theme-danger/10 hover:text-theme-danger transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
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

              {recipeProduct && (
                <ProductRecipeModal
                  product={recipeProduct}
                  onClose={() => setRecipeProduct(null)}
                />
              )}

              {/* Pagination Footer */}
              <div className="p-4 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 order-2 md:order-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase tracking-widest">SAYFADA:</span>
                    <div className="w-24">
                      <CustomSelect
                        options={[
                          { id: 10, label: '10' },
                          { id: 50, label: '50' },
                          { id: 250, label: '250' },
                          { id: 500, label: '500' },
                          { id: 1000, label: '1000' },
                          { id: 999999, label: 'Tümü' }
                        ]}
                        value={pageSize}
                        onChange={value => {
                          setPageSize(Number(value));
                          setCurrentPage(0);
                        }}
                        searchable={false}
                      />
                    </div>
                  </div>
                  <div className="h-4 w-px bg-theme hidden md:block" />
                  <span className="text-[11px] font-black text-theme-dim">
                    Toplam <span className="text-theme-primary">{filteredData.length}</span> Kayıt
                  </span>
                </div>

                <div className="flex items-center gap-3 order-1 md:order-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
                  >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-2xl">
                    <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                      {currentPage + 1}
                    </span>
                    <span className="text-theme-dim font-bold text-xs uppercase tracking-widest">/</span>
                    <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                      {pageCount || 1}
                    </span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
                    disabled={currentPage >= pageCount - 1}
                    className="p-3 rounded-xl bg-theme-base border border-theme text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
                  >
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
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

      <BulkActionBar
        selectedCount={selectedIds.size}
        isEditing={isBulkEditing}
        onSave={handleBulkSave}
        onEditToggle={setIsBulkEditing}
        onStatusUpdate={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setIsBulkEditing(false);
          setLocalChanges({});
        }}
      />

      {modularEditProduct && (
        <ProductEditModal
          product={modularEditProduct}
          warehouses={warehouses}
          routes={routes}
          allProducts={allProducts}
          machines={machines}
          onClose={() => setModularEditProduct(null)}
          onSave={() => { fetchData(); setModularEditProduct(null); }}
        />
      )}

      {showRecipeModal && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => {
            setShowRecipeModal(false);
            setSelectedRecipe(null);
          }}
          onRefresh={fetchData}
        />
      )}

      {viewRecipeId && (
        <RecipeDetailModal
          recipeId={viewRecipeId!}
          onClose={() => setViewRecipeId(null)}
        />
      )}
    </div>
  );
}

export default Definitions;
