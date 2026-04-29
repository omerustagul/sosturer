import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Factory, Users, Clock, Package,
  Plus, Trash2, Edit, FileUp, Download, UploadCloud,
  CheckCircle2, AlertCircle, List, ChevronLeft, ChevronRight, Search, Info, Settings, LayoutGrid,
  Warehouse, Building2, Workflow, Map, Layers, Handshake, Filter, RotateCcw, ClipboardList, X, Activity, Wrench, ShieldCheck
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

type TabType = 'machines' | 'operators' | 'shifts' | 'products' | 'firms' | 'work-centers' | 'stations' | 'warehouses' | 'department-roles' | 'import' | 'operations' | 'routes' | 'event-reasons' | 'event-groups' | 'plan-types' | 'consumption-types' | 'measurement-tools' | 'equipment' | 'measurement-methods';

const simpleDefinitionTabs = ['consumption-types', 'measurement-tools', 'equipment', 'measurement-methods', 'plan-types'];


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
    { id: 'firms', label: 'Firmalar', icon: Handshake, indent: true },
    { id: '_group_departments', label: 'DEPARTMANLAR', isGroupHeader: true, icon: LayoutGrid },
    { id: 'work-centers', label: 'İş Merkezleri', icon: Building2, indent: true },
    { id: 'stations', label: 'İstasyonlar', icon: List, indent: true },
    { id: 'warehouses', label: 'Depolar', icon: Warehouse, indent: true },
    { id: 'department-roles', label: 'Roller / Görevler', icon: Settings, indent: true },
    { id: '_group_production', label: 'ÜRETİM TANIMLARI', isGroupHeader: true, icon: LayoutGrid },
    { id: 'operations', label: 'Operasyonlar', icon: Workflow, indent: true },
    { id: 'routes', label: 'Reçeteler', icon: Map, indent: true },
    { id: 'consumption-types', label: 'Tüketim Tipleri', icon: ClipboardList, indent: true },
    { id: 'measurement-tools', label: 'Ölçüm Araçları', icon: Activity, indent: true },
    { id: 'equipment', label: 'Ekipmanlar', icon: Wrench, indent: true },
    { id: 'event-groups', label: 'Olay Grupları', icon: Layers, indent: true },
    { id: 'event-reasons', label: 'Olay Sebepleri', icon: AlertCircle, indent: true },
    { id: 'plan-types', label: 'Planlama Türleri', icon: ClipboardList, indent: true },
    { id: '_group_quality', label: 'KALİTE TANIMLARI', isGroupHeader: true, icon: ShieldCheck },
    { id: 'measurement-methods', label: 'Ölçüm Yöntemleri', icon: Activity, indent: true },
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
  const [measurementMethods, setMeasurementMethods] = useState<any[]>([]);
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

  // Search state for entity tables
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');

  // const routeSteps = setViewRecipeId;

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: '',
    direction: null
  });


  // Selection & Bulk Edit state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, any>>({});

  const [pageSize, setPageSize] = useState(20);
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
    if (activeTab === 'plan-types') return '/work-plan-types';
    if (activeTab === 'consumption-types') return '/consumption-types';
    if (activeTab === 'measurement-tools') return '/measurement-tools';
    if (activeTab === 'equipment') return '/equipment';
    if (activeTab === 'measurement-methods') return '/measurement-methods';
    return `/${activeTab}`;
  };

  const fetchData = async () => {
    if (activeTab === 'import') return;
    setLoading(true);
    try {
      const endpoint = getEndpoint();

      const [res, depsRes, rolesRes, unitsRes, locsRes] = await Promise.all([
        api.get(endpoint).catch(() => []),
        api.get('/departments').catch(() => []),
        api.get('/department-roles').catch(() => []),
        api.get('/departments').catch(() => []),
        api.get('/system/company/locations').catch(() => []),
      ]);
      setData(Array.isArray(res) ? res : []);
      setDepartments(Array.isArray(depsRes) ? depsRes : []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
      setCompanyUnits(Array.isArray(unitsRes) ? unitsRes : []);
      setCompanyLocations(Array.isArray(locsRes) ? locsRes : []);

      if (activeTab === 'measurement-tools') {
        const methodsRes = await api.get('/measurement-methods').catch(() => []);
        setMeasurementMethods(Array.isArray(methodsRes) ? methodsRes : []);
      }

      if (activeTab === 'operations' || activeTab === 'routes' || activeTab === 'products' || activeTab === 'stations' || activeTab === 'event-reasons' || activeTab === 'plan-types') {
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
      const getSortValue = (item: any) => sortConfig.key === 'methods'
        ? (item.methods || [])
          .map((link: any) => link.measurementMethod?.name || link.measurementMethod?.code)
          .filter(Boolean)
          .join(' ')
        : item[sortConfig.key];

      const aRaw = getSortValue(a);
      const bRaw = getSortValue(b);
      const aVal = String(aRaw || '').toLowerCase();
      const bVal = String(bRaw || '').toLowerCase();

      const numA = Number(aRaw);
      const numB = Number(bRaw);

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
    let result = statusFilter === 'all'
      ? sortedData
      : sortedData.filter((item: any) => item.status === statusFilter);

    if (deptFilter) {
      result = result.filter((item: any) =>
        item.departmentId === deptFilter ||
        item.unitId === deptFilter ||
        item.department?.id === deptFilter
      );
    }
    if (locFilter) {
      result = result.filter((item: any) =>
        item.locationId === locFilter ||
        item.unit?.locationId === locFilter ||
        item.department?.locationId === locFilter
      );
    }
    if (groupFilter) {
      const lowGroup = groupFilter.toLowerCase();
      result = result.filter((item: any) =>
        (item.productGroup?.toLowerCase().includes(lowGroup)) ||
        (item.category?.toLowerCase().includes(lowGroup))
      );
    }
    if (roleFilter) {
      result = result.filter((item: any) => item.roleId === roleFilter);
    }
    if (typeFilter) {
      result = result.filter((item: any) => item.type === typeFilter);
    }
    if (parentFilter) {
      result = result.filter((item: any) =>
        item.departmentId === parentFilter ||
        item.groupId === parentFilter ||
        item.stationId === parentFilter ||
        item.workCenterId === parentFilter
      );
    }

    if (!searchTerm) return result;

    const lowerSearch = searchTerm.toLowerCase();
    return result.filter((item: any) => {
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
      } else if (activeTab === 'firms') {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.taxNumber?.toLowerCase().includes(lowerSearch) ||
          item.phone?.toLowerCase().includes(lowerSearch) ||
          item.email?.toLowerCase().includes(lowerSearch)
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
      } else if (simpleDefinitionTabs.includes(activeTab)) {
        const methodText = (item.methods || [])
          .map((link: any) => link.measurementMethod?.name || link.measurementMethod?.code)
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.name?.toLowerCase().includes(lowerSearch) ||
          item.notes?.toLowerCase().includes(lowerSearch) ||
          methodText.includes(lowerSearch)
        );
      }
      return true;
    });
  }, [sortedData, searchTerm, activeTab, statusFilter, deptFilter, locFilter, groupFilter]);

  const paginatedData = useMemo(() => {
    return filteredData.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredData, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.size === (filteredData?.length || 0) && (filteredData?.length || 0) > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData?.map((item: any) => item.id) || []));
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

  const pageCount = Math.ceil(filteredData.length / pageSize);

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-2 py-3 text-[10px] border-b border-theme font-black text-theme-muted cursor-pointer hover:text-theme-primary transition-colors whitespace-nowrap text-center"
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
    setFormData(activeTab === 'measurement-tools' ? { measurementMethodIds: [] } : {});
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
      setFormData(activeTab === 'measurement-tools'
        ? {
          ...item,
          measurementMethodIds: (item.methods || [])
            .map((link: any) => link.measurementMethodId || link.measurementMethod?.id)
            .filter(Boolean)
        }
        : item);
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
          const { id, createdAt, updatedAt, unit, station, steps, department, role, company, statuses, methods, ...rest } = item;
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
      const { id, createdAt, updatedAt, unit, station, department, role, company, statuses, methods, ...rest } = formData;

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

  const measurementMethodOptions = useMemo(() => {
    return measurementMethods.map((method: any) => ({
      id: method.id,
      label: method.name,
      subLabel: method.code || undefined
    }));
  }, [measurementMethods]);


  const tabLabel = () => {
    if (activeTab === 'work-centers') return 'İŞ MERKEZLERİ';
    if (activeTab === 'stations') return 'İSTASYONLAR';
    if (activeTab === 'warehouses') return 'DEPOLAR';
    const found = tabs.find(t => t.id === activeTab);
    return (found?.label ?? '').toLocaleUpperCase('tr-TR');
  };

  return (
    <div className="h-[calc(98vh-64px)] p-4 lg:p-6 w-full flex flex-col gap-4 animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0 flex flex-col sm:flex-row items-center gap-4 modern-glass-card p-4 border-theme-primary/10">
        <div className="relative group flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim group-focus-within:text-theme-primary transition-colors" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hızlı Arama..."
            className="w-full h-10 bg-theme-base/20 border border-theme rounded-xl pl-10 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/40 focus:bg-theme-surface transition-all font-bold placeholder:text-theme-dim/50"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-xs font-black transition-all uppercase tracking-wider ${showFilters ? 'bg-theme-primary text-white border-theme-primary shadow-theme-primary/20' : 'bg-theme-base/20 text-theme-dim border-theme hover:bg-theme-main/5 hover:text-theme-main'}`}
        >
          <Filter className="w-4 h-4" /> Filtreler
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-theme-base/20 p-1 rounded-xl border border-theme h-10 px-3">
            <span className="text-[10px] font-black text-theme-dim uppercase tracking-widest px-2">DURUM:</span>
            <div className="flex gap-1">
              {['all', 'active', 'passive'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as any)}
                  className={`h-8 px-4 py-1 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider ${statusFilter === s ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:bg-theme-main/5 hover:text-theme-main'}`}
                >
                  {s === 'all' ? 'TÜMÜ' : s === 'active' ? 'AKTİF' : 'PASİF'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-theme mx-1 hidden sm:block" />

          {activeTab !== 'import' && (
            <button
              onClick={handleAddNew}
              className="bg-theme-primary hover:bg-theme-primary-hover h-10 text-white px-6 py-2 rounded-xl text-[10px] font-black transition-all shadow-xl shadow-theme-primary/30 flex items-center gap-2.5 group active:scale-95 whitespace-nowrap uppercase tracking-widest"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> YENİ EKLE
            </button>
          )}

          {activeTab === 'import' && (
            <div className="flex gap-2">
              <button onClick={handleDownloadTemplate} className="h-10 px-5 rounded-xl border-2 border-theme bg-theme-base/20 text-theme-dim hover:text-theme-main hover:bg-theme-main/5 text-[10px] font-black flex items-center gap-2 transition-all uppercase tracking-widest">
                <Download className="w-4 h-4" /> ŞABLON
              </button>
              <label className="h-10 px-5 rounded-xl bg-theme-primary text-white text-[10px] font-black flex items-center gap-2 transition-all shadow-xl shadow-theme-primary/20 cursor-pointer hover:bg-theme-primary-hover active:scale-95 uppercase tracking-widest">
                <FileUp className="w-4 h-4" /> VERİ YÜKLE
                <input type="file" className="hidden" id="bulk-import-file-main" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          <div className="h-8 w-px bg-theme/30 mx-1" />

          {['warehouses', 'work-centers', 'stations'].includes(activeTab) && (
            <div className="flex bg-theme-base/30 p-1 rounded-xl border border-theme shrink-0 h-10 items-center">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-4 h-full rounded-lg transition-all font-black text-[10px] uppercase ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Izgara</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-4 h-full rounded-xl transition-all font-black text-[10px] uppercase ${viewMode === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
              >
                <List size={14} />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="shrink-0 modern-glass-card p-4 rounded-xl border border-theme-primary/10 flex flex-wrap gap-4 animate-in slide-in-from-top-2 duration-300">
          {['machines', 'operators', 'work-centers', 'stations', 'department-roles', 'operations', 'plan-types'].includes(activeTab) && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Departman Filtresi</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm Departmanlar' }, ...departments.map(d => ({ id: d.id, label: d.name }))]}
                value={deptFilter}
                onChange={setDeptFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {['machines', 'work-centers', 'warehouses'].includes(activeTab) && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Lokasyon Filtresi</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm Lokasyonlar' }, ...companyLocations.map(l => ({ id: l.id, label: l.name }))]}
                value={locFilter}
                onChange={setLocFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'operators' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Rol Filtresi</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm Roller' }, ...roles.map(r => ({ id: r.id, label: r.name }))]}
                value={roleFilter}
                onChange={setRoleFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'stations' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">İş Merkezi Filtresi</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm İş Merkezleri' }, ...departments.map(d => ({ id: d.id, label: d.name }))]}
                value={parentFilter}
                onChange={setParentFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'warehouses' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Depo Tipi</label>
              <CustomSelect
                options={[
                  { id: '', label: 'Tüm Tipler' },
                  { id: 'general', label: 'Genel Depo' },
                  { id: 'raw', label: 'Hammadde' },
                  { id: 'finished', label: 'Mamül' },
                  { id: 'semifinished', label: 'Yarı Mamül' },
                  { id: 'consumable', label: 'Sarf Malzeme' },
                  { id: 'scrap', label: 'Fire / Hurda' },
                  { id: 'workcenter', label: 'İş Merkezi' },
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'event-reasons' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Olay Grubu</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm Gruplar' }, ...eventGroups.map(g => ({ id: g.id, label: g.name }))]}
                value={parentFilter}
                onChange={setParentFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'firms' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Firma Tipi</label>
              <CustomSelect
                options={[
                  { id: '', label: 'Tüm Tipler' },
                  { id: 'general', label: 'Genel' },
                  { id: 'supplier', label: 'Tedarikçi' },
                  { id: 'customer', label: 'Müşteri' },
                  { id: 'logistics', label: 'Lojistik' },
                  { id: 'customs', label: 'Gümrük' },
                  { id: 'consignment', label: 'Konsinye' }
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'operations' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">İstasyon Filtresi</label>
              <CustomSelect
                options={[{ id: '', label: 'Tüm İstasyonlar' }, ...stations.map(s => ({ id: s.id, label: s.name }))]}
                value={parentFilter}
                onChange={setParentFilter}
                placeholder="Seçiniz..."
              />
            </div>
          )}
          {activeTab === 'products' && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-theme-dim mb-1.5 block uppercase ml-1">Grup Filtresi</label>
              <input
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="w-full h-10 bg-theme-base/20 border border-theme rounded-xl px-4 text-xs text-theme-main focus:outline-none focus:border-theme-primary/40 focus:bg-theme-surface transition-all font-bold placeholder:text-theme-dim/50"
                placeholder="Grup adı yazın..."
              />
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={() => { setDeptFilter(''); setLocFilter(''); setGroupFilter(''); setRoleFilter(''); setTypeFilter(''); setParentFilter(''); }}
              className="h-10 px-4 rounded-xl border-2 border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center gap-2 text-xs font-black uppercase tracking-wider"
            >
              <RotateCcw className="w-4 h-4" /> Temizle
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col gap-4">

        <div className="flex-1 min-h-0 flex flex-col modern-glass-card p-0 overflow-hidden relative shadow-xl shadow-theme-primary/10">
          {activeTab === 'import' ? (
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar p-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 p-4 border-b border-theme">
                <div>
                  <h3 className="text-lg font-bold text-theme-main mb-0">TOPLU VERİ AKTARIMI</h3>
                  <p className="text-theme-muted text-[10px] font-bold">Excel üzerinden sisteme hızlıca veri, tablo, liste ve daha fazlasını aktarın.</p>
                </div>
                <div className="w-full md:w-80">
                  <label className="text-[10px] font-black text-theme-dim mb-2 block">İÇE AKTARILACAK ALAN</label>
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
                      <h4 className="font-bold text-theme-main uppercase text-sm">DOSYA SEÇİN</h4>
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
                      <h4 className="font-bold text-theme-main uppercase text-xs">İŞLEM GÜNLÜĞÜ</h4>
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
                        <span className="font-bold text-xs uppercase">{uploadStatus.message}</span>
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
                        <p className="font-bold text-theme-main uppercase leading-loose">Yükleme yapıldığında<br />detaylar burada listelenecektir.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : ((activeTab === 'warehouses' || activeTab === 'work-centers' || activeTab === 'stations') && viewMode === 'grid') ? (
            // ─── GROUPED GRID VIEW ──────────────────────
            <>
              <div className="p-4 border-b border-theme flex flex-col sm:flex-row justify-between items-start sm:items-center bg-theme-base/20 gap-4 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-theme-main leading-tight">{activeTab === 'warehouses' ? 'DEPOLAR' : 'İŞ MERKEZLERİ'}</h3>
                  <p className="text-[10px] font-bold text-theme-muted mt-0.5">
                    {activeTab === 'warehouses'
                      ? 'Şirket lokasyonlarındaki depo birimlerini buradan tanımlayın ve yönetin.'
                      : activeTab === 'work-centers'
                        ? 'Üretim süreçlerinin gerçekleştiği ana operasyonel birimler.'
                        : 'İş merkezlerine bağlı alt operasyon istasyonları.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme shrink-0">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition-all ${(viewMode as string) === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                    >
                      <List size={14} />
                    </button>
                  </div>
                  <div className="hidden sm:block h-6 w-px bg-theme mx-1" />
                  <div className="relative group flex-1 sm:flex-none sm:w-48 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted group-focus-within:text-theme-primary transition-colors" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ara..."
                      className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-8 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
                {loading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-theme-surface/60 backdrop-blur-sm">
                    <Loading size="lg" />
                  </div>
                ) : (
                  <div className="p-4 space-y-6">
                    {filteredData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                        {activeTab === 'warehouses' ? <Warehouse className="w-12 h-12 mb-4 text-theme-dim" /> : <Building2 className="w-12 h-12 mb-4 text-theme-dim" />}
                        <p className="font-black text-theme-main uppercase text-sm">Henüz {activeTab === 'warehouses' ? 'depo' : 'iş merkezi'} tanımlanmamış</p>
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
                              <h4 className="text-xs font-black text-theme-main uppercase">{group.locName}</h4>
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
                                      <p className="text-sm font-black text-theme-main uppercase leading-none mb-1">{item.name}</p>
                                      <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase ${activeTab === 'warehouses'
                                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                          : activeTab === 'stations'
                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                            : 'bg-theme-primary/10 text-theme-primary border-theme-primary/20'
                                          }`}>
                                          {typeLabel}
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-theme-base/40 border border-theme/20">
                                          <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                                          <span className={`text-[10px] font-black uppercase ${item.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>
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
              <div className="p-4 border-b border-theme flex flex-col sm:flex-row justify-between items-start sm:items-center bg-theme-base/20 gap-4 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-theme-main leading-tight truncate">
                    {tabLabel()}
                  </h3>
                  <p className="text-[10px] font-bold text-theme-muted mt-0.5 truncate">
                    Sistem tanımlamalarınızı buradan yönetin.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {['warehouses', 'work-centers', 'stations'].includes(activeTab) && (
                    <div className="flex bg-theme-base/50 p-1 rounded-xl border border-theme shrink-0">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-theme-dim hover:text-theme-main'}`}
                      >
                        <List size={14} />
                      </button>
                    </div>
                  )}
                  <div className="relative group flex-1 sm:flex-none sm:w-48 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted group-focus-within:text-theme-primary transition-colors" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ara..."
                      className="w-full h-10 bg-theme-surface border-2 border-theme rounded-xl pl-8 pr-4 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
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
                          <SortHeader label="Kod / ID" sortKey={
                            (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'firms' || activeTab === 'measurement-methods') ? 'code' :
                              activeTab === 'operators' ? 'employeeId' :
                                activeTab === 'shifts' ? 'shiftCode' :
                                  (activeTab === 'warehouses' || activeTab === 'department-roles' || activeTab === 'event-reasons') ? 'id' :
                                    'productCode'
                          } />
                          <SortHeader label="Tanım / İsim" sortKey={(activeTab === 'machines' || activeTab === 'operators' || activeTab === 'shifts' || activeTab === 'department-roles' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons' || activeTab === 'firms' || activeTab === 'measurement-methods') ? 'name' : 'productName'} />
                          {activeTab === 'machines' && <SortHeader label="Marka" sortKey="brand" />}
                          {activeTab === 'machines' && <SortHeader label="Model" sortKey="model" />}
                          {activeTab === 'machines' && <SortHeader label="Kurulum" sortKey="installedDate" />}
                          {activeTab === 'machines' && <SortHeader label="Kapasite/Vardiya" sortKey="capacityPerShift" />}
                          {activeTab === 'machines' && <SortHeader label="Not" sortKey="notes" />}

                          {activeTab === 'department-roles' && <SortHeader label="Departman Adı" sortKey="department.name" />}

                          {activeTab === 'operators' && <SortHeader label="Departman" sortKey="department" />}
                          {activeTab === 'operators' && <SortHeader label="Görev / Rol" sortKey="role" />}
                          {activeTab === 'operators' && <SortHeader label="İşe Giriş" sortKey="hireDate" />}
                          {activeTab === 'operators' && <SortHeader label="Tecrübe" sortKey="experienceYears" />}
                          {activeTab === 'operators' && <SortHeader label="Sertifika" sortKey="certifications" />}

                          {activeTab === 'shifts' && <SortHeader label="Başlangıç" sortKey="startTime" />}
                          {activeTab === 'shifts' && <SortHeader label="Bitiş" sortKey="endTime" />}
                          {activeTab === 'shifts' && <SortHeader label="Süre (dk)" sortKey="durationMinutes" />}
                          {activeTab === 'shifts' && <SortHeader label="Renk" sortKey="colorCode" />}

                          {activeTab === 'products' && (
                            <>
                              <SortHeader label="Marka" sortKey="brand" />
                              <SortHeader label="Ü. Grubu" sortKey="productGroup" />
                              <SortHeader label="Sınıf" sortKey="productClass" />
                              <SortHeader label="Açıklama" sortKey="description" />
                              <SortHeader label="Birim" sortKey="unitOfMeasure" />
                              <SortHeader label="Kategori" sortKey="category" />
                            </>
                          )}

                          {activeTab === 'firms' && (
                            <>
                              <SortHeader label="Tip" sortKey="type" />
                              <SortHeader label="Vergi No" sortKey="taxNumber" />
                              <SortHeader label="Telefon" sortKey="phone" />
                              <SortHeader label="E-Posta" sortKey="email" />
                              <SortHeader label="Yetkili" sortKey="contactName" />
                            </>
                          )}

                          {(activeTab === 'operations' || activeTab === 'stations') && <SortHeader label="İş Merkezi / Birim" sortKey="unitId" />}
                          {activeTab === 'operations' && <SortHeader label="İstasyon" sortKey="stationId" />}
                          {activeTab === 'routes' && <th className="px-2 py-3 text-[10px] border-b border-theme font-black text-theme-muted text-center uppercase">Adım Sayısı</th>}

                          {activeTab === 'warehouses' && (
                            <>
                              <SortHeader label="Tip" sortKey="type" />
                              <SortHeader label="Lokasyon" sortKey="unitId" />
                            </>
                          )}
                          {activeTab === 'work-centers' && (
                            <>
                              <SortHeader label="Lokasyon" sortKey="locationId" />
                            </>
                          )}
                          {activeTab === 'event-reasons' && (
                            <>
                              <SortHeader label="Grup" sortKey="groupId" />
                              <SortHeader label="Tip" sortKey="type" />
                            </>
                          )}
                          {activeTab === 'measurement-tools' && <SortHeader label="Ölçüm Yöntemleri" sortKey="methods" />}
                          {simpleDefinitionTabs.includes(activeTab) && <SortHeader label="Not / Açıklama" sortKey="notes" />}

                          <SortHeader label="Durum" sortKey="status" />
                          <th className="px-2 py-3 text-[10px] border-b border-theme font-black text-theme-muted text-center">İşlemler</th>
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
                          const methodNames = (item.methods || [])
                            .map((link: any) => link.measurementMethod?.name || link.measurementMethod?.code)
                            .filter(Boolean)
                            .join(', ');

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
                              <td className="px-2 py-3 border-b border-theme/30 text-sm font-black text-theme-primary leading-none">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[(activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons' || activeTab === 'event-groups' || activeTab === 'firms' || activeTab === 'plan-types' || simpleDefinitionTabs.includes(activeTab)) ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : (activeTab === 'department-roles') ? 'id' : 'productCode'] ?? (item.code || item.employeeId || item.shiftCode || item.productCode || (activeTab === 'department-roles' ? item.id : ''))}
                                    onChange={(e) => updateLocalChanges(item.id, (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-reasons' || activeTab === 'event-groups' || activeTab === 'firms' || activeTab === 'plan-types' || simpleDefinitionTabs.includes(activeTab)) ? 'code' : activeTab === 'operators' ? 'employeeId' : activeTab === 'shifts' ? 'shiftCode' : (activeTab === 'department-roles') ? 'id' : 'productCode', e.target.value)}
                                    className="settings-inline-input text-theme-primary"
                                  />
                                ) : (item.code || item.employeeId || item.shiftCode || item.productCode || (activeTab === 'department-roles' ? item.id.slice(0, 8) : item.id.slice(0, 8)))}
                              </td>
                              <td className="px-2 py-3 border-b border-theme/30 text-xs text-theme-main font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                {isEditingRow ? (
                                  <input
                                    value={localChanges[item.id]?.[(activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-groups' || activeTab === 'firms' || simpleDefinitionTabs.includes(activeTab)) ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'department-roles' ? 'name' : activeTab === 'plan-types' ? 'typeName' : 'productName'] ?? (item.name || item.fullName || item.shiftName || item.productName || item.typeName || '')}
                                    onChange={(e) => updateLocalChanges(item.id, (activeTab === 'machines' || activeTab === 'operations' || activeTab === 'routes' || activeTab === 'stations' || activeTab === 'work-centers' || activeTab === 'warehouses' || activeTab === 'event-groups' || activeTab === 'firms' || simpleDefinitionTabs.includes(activeTab)) ? 'name' : activeTab === 'operators' ? 'fullName' : activeTab === 'shifts' ? 'shiftName' : activeTab === 'department-roles' ? 'name' : activeTab === 'plan-types' ? 'typeName' : 'productName', e.target.value)}
                                    className="settings-inline-input"
                                  />
                                ) : (item.name || item.fullName || item.shiftName || item.productName || item.typeName)}
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

                              {activeTab === 'firms' && (
                                <>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? (
                                      <CustomSelect
                                        variant="inline"
                                        options={[
                                          { id: 'general', label: 'Genel' },
                                          { id: 'supplier', label: 'Tedarikçi' },
                                          { id: 'customer', label: 'Müşteri' },
                                          { id: 'logistics', label: 'Lojistik' },
                                          { id: 'customs', label: 'Gümrük' },
                                          { id: 'consignment', label: 'Konsinye' }
                                        ]}
                                        value={localChanges[item.id]?.type ?? (item.type || 'general')}
                                        onChange={(val) => updateLocalChanges(item.id, 'type', val)}
                                        searchable={false}
                                      />
                                    ) : (({
                                      general: 'Genel',
                                      supplier: 'Tedarikçi',
                                      customer: 'Müşteri',
                                      logistics: 'Lojistik',
                                      customs: 'Gümrük',
                                      consignment: 'Konsinye'
                                    }[item.type as string] || item.type) || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.taxNumber ?? (item.taxNumber || '')} onChange={e => updateLocalChanges(item.id, 'taxNumber', e.target.value)} className="settings-inline-input" /> : (item.taxNumber || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.phone ?? (item.phone || '')} onChange={e => updateLocalChanges(item.id, 'phone', e.target.value)} className="settings-inline-input" /> : (item.phone || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                                    {isEditingRow ? <input value={localChanges[item.id]?.email ?? (item.email || '')} onChange={e => updateLocalChanges(item.id, 'email', e.target.value)} className="settings-inline-input" /> : (item.email || '-')}
                                  </td>
                                  <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap">
                                    {isEditingRow ? <input value={localChanges[item.id]?.contactName ?? (item.contactName || '')} onChange={e => updateLocalChanges(item.id, 'contactName', e.target.value)} className="settings-inline-input" /> : (item.contactName || '-')}
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

                              {activeTab === 'measurement-tools' && (
                                <td
                                  className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px]"
                                  title={methodNames || undefined}
                                >
                                  {methodNames || '-'}
                                </td>
                              )}

                              {simpleDefinitionTabs.includes(activeTab) && (
                                <td className="px-2 py-3 border-b border-theme/30 text-theme-muted text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                  {isEditingRow ? <input value={localChanges[item.id]?.notes ?? (item.notes || '')} onChange={e => updateLocalChanges(item.id, 'notes', e.target.value)} className="settings-inline-input" /> : (item.notes || '-')}
                                </td>
                              )}

                              <td className="px-2 py-3 border-b border-theme/30">
                                <span
                                  onClick={() => !isEditingRow && handleToggleStatus(item)}
                                  className={`text-[9px] font-black px-3 py-1 rounded-lg border flex items-center gap-1.5 w-fit ${item.status === 'active' ? 'bg-theme-success/10 text-theme-success border-theme-success/20' : 'bg-theme-base/20 text-theme-dim border-theme'} ${!isEditingRow ? 'cursor-pointer hover:scale-105 transition-transform active:scale-95' : 'opacity-50'}`}
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
                    <span className="text-[11px] font-black text-theme-dim whitespace-nowrap uppercase">SAYFADA:</span>
                    <div className="min-w-fit">
                      <CustomSelect
                        options={[
                          { id: 20, label: '20' },
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
                    className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
                  >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border border-theme rounded-xl">
                    <span className="text-theme-primary font-black text-sm min-w-[20px] text-center">
                      {currentPage + 1}
                    </span>
                    <span className="text-theme-dim font-bold text-xs uppercase">/</span>
                    <span className="text-theme-muted font-black text-sm min-w-[20px] text-center">
                      {pageCount || 1}
                    </span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
                    disabled={currentPage >= pageCount - 1}
                    className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
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

      {showAddForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-theme-base/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowAddForm(false)}
          />
          <div className="relative w-full max-w-4xl bg-theme-card border border-theme rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-theme-primary/10 rounded-xl flex items-center justify-center text-theme-primary shadow-inner">
                  {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-md font-black text-theme-main leading-tight tracking-tight">
                    {isEditing ? 'KAYDI DÜZENLE' : 'YENİ KAYIT EKLE'}
                  </h3>
                  <p className="text-xs font-medium text-theme-dim mt-0">
                    {(() => {
                      const titles: Record<string, string> = {
                        machines: 'Makine Tanımı',
                        operators: 'Operatör Tanımı',
                        'department-roles': 'Departman Rol Tanımı',
                        'work-centers': 'İş Merkezi Tanımı',
                        warehouses: 'Depo Tanımı',
                        shifts: 'Vardiya Tanımı',
                        products: 'Ürün Tanımı',
                        firms: 'Firma Tanımı',
                        operations: 'Operasyon Tanımı',
                        stations: 'İstasyon Tanımı',
                        'event-groups': 'Olay Grubu Tanımı',
                        'event-reasons': 'Olay Sebebi Tanımı',
                        'measurement-methods': 'Ölçüm Yöntemi Tanımı',
                        'measurement-tools': 'Ölçüm Aracı Tanımı',
                        'equipment': 'Ekipman Tanımı',
                        'consumption-types': 'Tüketim Tipi Tanımı'
                      };
                      return titles[activeTab] || 'Sistem Tanımı';
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-theme-base/10 text-theme-dim hover:bg-theme-primary hover:text-white transition-all active:scale-95 group"
              >
                <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeTab === 'machines' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Makine Kodu</label><input required value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Marka</label><input value={formData.brand || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, brand: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Model</label><input value={formData.model || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Kurulum Tarihi</label><input value={formData.installedDate ? String(formData.installedDate).slice(0, 10) : ''} type="date" className="form-input h-10" onChange={(e) => setFormData({ ...formData, installedDate: e.target.value || null })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Vardiya Kapasitesi (Adet)</label><input value={formData.capacityPerShift ?? ''} type="number" className="form-input h-10" onChange={(e) => setFormData({ ...formData, capacityPerShift: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                      <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">NOTLAR</label><input value={formData.notes || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'operators' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Sicil No</label><input required value={formData.employeeId || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ad Soyad</label><input required value={formData.fullName || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Departman</label>
                        <CustomSelect
                          options={departments.map(d => ({ id: d.id, label: d.name }))}
                          value={formData.departmentId || ''}
                          onChange={(val) => {
                            setFormData({ ...formData, departmentId: val, roleId: '' });
                          }}
                          placeholder="Departman Seçin"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Görev / Rol</label>
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
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İşe Giriş Tarihi</label><input value={formData.hireDate ? String(formData.hireDate).slice(0, 10) : ''} type="date" className="form-input h-10" onChange={(e) => setFormData({ ...formData, hireDate: e.target.value || null })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Tecrübe (Yıl)</label><input value={formData.experienceYears ?? ''} type="number" className="form-input h-10" onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                      <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Sertifikalar</label><input value={formData.certifications || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, certifications: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'department-roles' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">DEPARTMAN</label>
                        <CustomSelect
                          options={departments.map(d => ({ id: d.id, label: d.name }))}
                          value={formData.departmentId || ''}
                          onChange={(val) => setFormData({ ...formData, departmentId: val })}
                          placeholder="Departman Seçin"
                        />
                      </div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Görev / Rol Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Durum</label>
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
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İş Merkezi Kodu</label><input required value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İş Merkezi Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Lokasyon</label>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Depo Kodu</label>
                        <input value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. DP-01" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Depo Adı</label>
                        <input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. MAMÜL DEPO" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Depo Tipi</label>
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
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Lokasyon Bağlantısı</label>
                        <CustomSelect
                          options={companyLocations.map(l => ({ id: l.id, label: l.name }))}
                          value={formData.locationId || ''}
                          onChange={(val) => setFormData({ ...formData, locationId: val || null })}
                          placeholder="Lokasyon Seçin"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Birim Bağlantısı</label>
                        <CustomSelect
                          options={flatUnitOptions}
                          value={formData.unitId || ''}
                          onChange={(val) => setFormData({ ...formData, unitId: val || null })}
                          placeholder="Bağlanacak birimi seçin"
                        />
                      </div>
                    </>
                  )}
                  {activeTab === 'shifts' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Vardiya Kodu</label><input required value={formData.shiftCode || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, shiftCode: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Vardiya Adı</label><input required value={formData.shiftName || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, shiftName: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Başlangıç (HH:MM)</label><input required value={formData.startTime || ''} className="form-input h-10" placeholder="06:00" onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Bitiş (HH:MM)</label><input required value={formData.endTime || ''} className="form-input h-10" placeholder="14:00" onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Süre (DK)</label><input required value={formData.durationMinutes || ''} type="number" className="form-input h-10" onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Renk Kodu</label><input value={formData.colorCode || ''} className="form-input h-10" placeholder="#45B7D1" onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'products' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ürün Kodu</label><input required value={formData.productCode || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ürün Adı</label><input required value={formData.productName || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, productName: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Marka</label><input value={formData.brand || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, brand: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ürün Grubu</label><input value={formData.productGroup || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, productGroup: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Takip Sistemi</label>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Stok Tipi</label>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Std. Üretim Adedi</label>
                        <input type="number" value={formData.defaultProductionQty || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, defaultProductionQty: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Hedef Depo</label>
                        <CustomSelect
                          options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                          value={formData.targetWarehouseId || ''}
                          onChange={(val) => setFormData({ ...formData, targetWarehouseId: val })}
                        />
                      </div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ürün Sınıfı</label><input value={formData.productClass || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, productClass: e.target.value })} /></div>
                      <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Açıklama</label><input value={formData.description || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'firms' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Firma Kodu</label><input value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. FRM-001" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Firma Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Firma Tipi</label>
                        <CustomSelect
                          options={[
                            { id: 'general', label: 'Genel' },
                            { id: 'supplier', label: 'Tedarikçi' },
                            { id: 'customer', label: 'Müşteri' },
                            { id: 'logistics', label: 'Lojistik' },
                            { id: 'customs', label: 'Gümrük' },
                            { id: 'consignment', label: 'Konsinye' }
                          ]}
                          value={formData.type || 'general'}
                          onChange={(val) => setFormData({ ...formData, type: val })}
                          searchable={false}
                        />
                      </div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Vergi Dairesi</label><input value={formData.taxOffice || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, taxOffice: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Vergi No</label><input value={formData.taxNumber || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Telefon</label><input value={formData.phone || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">E-Posta</label><input type="email" value={formData.email || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Yetkili</label><input value={formData.contactName || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} /></div>
                      <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Adres</label><input value={formData.address || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Durum</label>
                        <CustomSelect
                          options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                          value={formData.status || 'active'}
                          onChange={(val) => setFormData({ ...formData, status: val })}
                          searchable={false}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">NOTLAR</label><input value={formData.notes || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'operations' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Operasyon Kodu</label><input required value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Operasyon Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İş Merkezi / Birim</label>
                        <CustomSelect
                          options={companyUnits.map(u => ({ id: u.id, label: u.name, subLabel: companyLocations.find(l => l.id === u.locationId)?.name }))}
                          value={formData.unitId || ''}
                          onChange={(val) => setFormData({ ...formData, unitId: val, stationId: '' })}
                          placeholder="Birim Seçin"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İstasyon</label>
                        <CustomSelect
                          options={stations.filter(s => s.unitId === (formData.unitId || '')).map(s => ({ id: s.id, label: s.name, subLabel: s.code }))}
                          value={formData.stationId || ''}
                          onChange={(val) => setFormData({ ...formData, stationId: val })}
                          placeholder={formData.unitId ? "İstasyon Seçin" : "Önce İş Merkezi Seçin"}
                          disabled={!formData.unitId}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">AÇIKLAMA</label><input value={formData.description || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                    </>
                  )}
                  {activeTab === 'stations' && (
                    <>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İstasyon Kodu</label><input required value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İstasyon Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">İş Merkezi / Birim</label>
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
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Grup Kodu</label><input value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. CNC-G" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Grup Adı</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="örn. CNC Kaynaklı" /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Durum</label>
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
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Olay Kodu</label><input value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. RED-01" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Olay Sebebi</label><input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Olay Grubu</label>
                        <CustomSelect
                          options={eventGroups.map(g => ({ id: g.id, label: g.name, subLabel: g.code }))}
                          value={formData.groupId || ''}
                          onChange={(val) => setFormData({ ...formData, groupId: val })}
                          placeholder="Grup Seçin"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Olay Tipi</label>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Durum</label>
                        <CustomSelect
                          options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                          value={formData.status || 'active'}
                          onChange={(val) => setFormData({ ...formData, status: val })}
                        />
                      </div>
                    </>
                  )}
                  {(simpleDefinitionTabs.includes(activeTab) || activeTab === 'measurement-methods') && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Kod</label>
                        <input required value={formData.code || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="örn. KOD-001" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ad / Tanım</label>
                        <input required value={formData.name || ''} className="form-input h-10" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Durum</label>
                        <CustomSelect
                          options={[{ id: 'active', label: 'Aktif' }, { id: 'passive', label: 'Pasif' }]}
                          value={formData.status || 'active'}
                          onChange={(val) => setFormData({ ...formData, status: val })}
                        />
                      </div>
                      {activeTab === 'measurement-tools' && (
                        <div className="space-y-2 md:col-span-2 lg:col-span-3">
                          <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Ölçüm Yöntemleri</label>
                          <CustomSelect
                            options={measurementMethodOptions}
                            value={formData.measurementMethodIds || []}
                            onChange={(val) => setFormData({ ...formData, measurementMethodIds: Array.isArray(val) ? val : [] })}
                            isMulti
                            fullWidth
                            placeholder="Ölçüm yöntemi seçin"
                          />
                        </div>
                      )}
                      <div className="space-y-2 md:col-span-2 lg:col-span-3">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider ml-1">Notlar / Açıklama</label>
                        <textarea
                          value={formData.notes || ''}
                          className="form-input min-h-[100px] py-3"
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-theme backdrop-blur-sm flex justify-end gap-3 sticky bottom-0 z-10 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2.5 text-xs font-black text-theme-dim border border-theme rounded-xl hover:bg-theme-main/10 transition-all uppercase tracking-widest active:scale-95"
                >
                  İPTAL
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 text-xs font-black text-white bg-theme-primary rounded-xl hover:bg-theme-primary-hover transition-all shadow-xl shadow-theme-primary/20 uppercase tracking-widest active:scale-95"
                >
                  {isEditing ? 'GÜNCELLE' : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Definitions;
