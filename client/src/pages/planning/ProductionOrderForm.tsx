import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  DiamondPlus, Save, ChevronLeft, Plus,
  Package, Layers, Workflow, Boxes,
  AlertTriangle, Cpu, ShoppingBag, Link2,
  ClipboardList, Calendar, Trash2, Check, CheckCircle2,
  AlertCircle, History, Clock, UserCircle,
  Play, RotateCcw,
  User as UserIcon, Type, Timer
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { createPortal } from 'react-dom';
import { Loading } from '../../components/common/Loading';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useSettingsStore } from '../../store/settingsStore';

type TabType = 'operations' | 'components' | 'events' | 'machines' | 'orders' | 'links' | 'notes' | 'dates';

export function ProductionOrderForm() {
  const navigate = useNavigate();
  const { lotNumber } = useParams();
  const isEditing = Boolean(lotNumber);
  const identifier = lotNumber;

  const { settings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<TabType>('operations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Master Data
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<any>({
    productId: '',
    lotNumber: '',
    quantity: 0,
    type: 'Asıl',
    targetWarehouseId: '',
    notes: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    expiryDate: '',
    sterilizationDate: '',
    productionDate: ''
  });

  const isCompleted = formData.status === 'completed';

  // Tab Data
  const [steps, setSteps] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [orderEvents, setOrderEvents] = useState<any[]>([]);
  const [assignedMachines, setAssignedMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showValidation, setShowValidation] = useState(false);

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingStep, setSigningStep] = useState<any>(null);
  const [bulkSigningSteps, setBulkSigningSteps] = useState<any[]>([]);
  const [isBulkSignMode, setIsBulkSignMode] = useState(false);
  const [selectedStepIndices, setSelectedStepIndices] = useState<number[]>([]);
  const [signFormData, setSignFormData] = useState<any>({
    operatorId: '',
    shiftId: '',
    workType: 'İşlem',
    approvedQty: 0,
    rejectedQty: 0,
    reworkQty: 0,
    sampleQty: 0,
    conditionalQty: 0,
    recordDate: new Date().toISOString().slice(0, 16)
  });

  const [eventReasons, setEventReasons] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventFormData, setEventFormData] = useState<any>({
    stepId: '',
    type: '',
    quantity: 0,
    operatorId: '',
    reasonId: '',
    warehouseId: '',
    description: '',
    createdAt: new Date().toISOString().slice(0, 16)
  });
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning'
  });

  const showAlert = (message: string, title: string = 'UYARI', type: 'danger' | 'warning' | 'info' = 'warning') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const authUser = useAuthStore(state => state.user);

  // Dynamic Lots for Components
  const [rowLots, setRowLots] = useState<Record<number, any[]>>({});

  const fetchLotsForRow = async (index: number, pid: string, wid: string) => {
    if (!pid || !wid) {
      setRowLots(prev => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const res = await api.get(`/inventory/lots?productId=${pid}&warehouseId=${wid}`);
      setRowLots(prev => ({
        ...prev,
        [index]: Array.isArray(res) ? res.map((l: any) => ({
          id: l.lotNumber,
          label: l.lotNumber,
          subLabel: `Stok: ${l.quantity}`,
          availableQty: Number(l.quantity || 0)
        })) : []
      }));
    } catch (e) {
      console.error('Failed to fetch lots:', e);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, wRes, oRes, sRes, erRes] = await Promise.all([
        api.get('/products'),
        api.get('/inventory/warehouses'),
        api.get('/operators'),
        api.get('/shifts'),
        api.get('/production-event-reasons')
      ]);
      setProducts(pRes || []);
      setWarehouses(wRes || []);
      setOperators(oRes || []);
      setShifts(sRes || []);
      setEventReasons(erRes || []);


      if (isEditing) {
        const order = await api.get(`/production-orders/${identifier}`);
        setFormData({
          ...order,
          startDate: order.startDate?.slice(0, 10),
          endDate: order.endDate?.slice(0, 10),
          expiryDate: order.expiryDate?.slice(0, 10),
          sterilizationDate: order.sterilizationDate?.slice(0, 10),
          productionDate: order.productionDate?.slice(0, 10)
        });
        setSteps(order.steps || []);
        setComponents(order.components || []);
        setOrderEvents(order.events || []);
        setAssignedMachines(order.machines || []);
      }
    } catch (e) {
      console.error('Failed to fetch order details:', e);
    } finally {
      setLoading(false);
    }
  }, [identifier, isEditing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (newStatus: string) => {
    if (!isEditing || !formData.id) {
      setFormData((prev: any) => ({ ...prev, status: newStatus }));
      return;
    }

    if (newStatus === 'completed') {
      const allDone = steps.every(s => s.status === 'completed');
      if (!allDone) {
        showAlert('Tüm operasyon adımları tamamlanmadan üretim emri bitirilemez!', 'EKSİK İŞLEM', 'danger');
        return;
      }

      // Validate Components
      const incompleteComponents = components.some(c => !c.lotNumber || !c.quantity || Number(c.quantity) <= 0);
      if (incompleteComponents) {
        showAlert('Bazı bileşenlerin lot numarası veya miktarı eksik! Lütfen bileşen tablosunu kontrol edin.', 'EKSİK BİLEŞEN', 'danger');
        setActiveTab('components');
        return;
      }

      // Check stock availability for all components
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        const lot = (rowLots[i] || []).find((l: any) => l.id === c.lotNumber);
        if (lot && Number(c.quantity) > lot.availableQty) {
          showAlert(`"${c.componentProduct?.name}" için yeterli stok yok! Seçilen: ${c.quantity}, Mevcut: ${lot.availableQty}`, 'STOK YETERSİZ', 'danger');
          setActiveTab('components');
          return;
        }
      }

      if (!window.confirm('Bu üretim emrini tamamlamak istediğinize emin misiniz? Bu işlem geri alınamaz ve ürünler stoklarınıza eklenecektir.')) {
        return;
      }
    }

    // Update locally first, persistence will happen on handleSave or we can keep status immediate if preferred
    // The user said "kaydet butonuna bastıktan sonra veritabanına işlensin", so we update locally.
    setFormData((prev: any) => ({ ...prev, status: newStatus }));
    if (newStatus === 'completed') {
      showAlert('Üretim emri tamamlandı olarak işaretlendi. Değişikliklerin kalıcı olması için KAYDET butonuna basınız.', 'BİLGİ', 'info');
    }
  };

  const getCurrentShiftId = () => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const shift of shifts) {
      if (!shift.startTime || !shift.endTime) continue;

      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);

      const start = startH * 60 + startM;
      const end = endH * 60 + endM;

      if (start < end) {
        // Normal shift (e.g., 08:00 - 16:00)
        if (currentTime >= start && currentTime < end) return shift.id;
      } else {
        // Night shift (e.g., 22:00 - 06:00)
        if (currentTime >= start || currentTime < end) return shift.id;
      }
    }
    return shifts[0]?.id || '';
  };

  const handleStepSign = (step: any, idx: number) => {
    if (formData.status !== 'active') {
      showAlert('Operasyon kaydı için üretim emrinin "Devam Ediyor" durumunda olması gerekir.', 'DURUM HATASI', 'danger');
      return;
    }

    // CHECK FOR EVENTS
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        const prev = steps[i];
        const nonAccepted = Number(prev.rejectedQty || 0) + Number(prev.reworkQty || 0) + Number(prev.sampleQty || 0) + Number(prev.conditionalQty || 0);
        if (nonAccepted > 0) {
          const logged = orderEvents
            .filter((e: any) => e.stepId === prev.id || (e.sequence === prev.sequence))
            .reduce((s: number, e: any) => s + Number(e.quantity || 0), 0);

          if (logged < nonAccepted) {
            showAlert(`"${prev.operation?.name}" operasyonunda ${nonAccepted} adet kabul edilmeyen ürün çıktı. OLAYLAR sekmesinden olay formu oluşturulmadan devam edilemez.`, 'OLAY KAYDI ZORUNLU', 'danger');
            setActiveTab('events');
            return;
          }
        }
      }
    }

    const matchedOperator = operators.find(o => o.fullName === authUser?.fullName);
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);

    const prevStepApprovedQty = Number(idx === 0 ? formData.quantity : (steps[idx - 1]?.approvedQty || 0));

    setBulkSigningSteps([]);
    setSigningStep({ ...step, index: idx });
    setSignFormData({
      operatorId: matchedOperator?.id || '',
      shiftId: getCurrentShiftId(),
      workType: 'İşlem',
      approvedQty: prevStepApprovedQty,
      rejectedQty: 0,
      reworkQty: 0,
      sampleQty: 0,
      conditionalQty: 0,
      recordDate: localISO
    });
    setShowSignModal(true);
  };

  const handleBulkSignClick = () => {
    if (selectedStepIndices.length === 0) {
      showAlert('Lütfen imzalanacak operasyonları seçin.', 'SEÇİM YOK', 'warning');
      return;
    }

    const matchedOperator = operators.find(o => o.fullName === authUser?.fullName);
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);

    // For bulk, we'll assume the quantity is the max allowed for each step
    // in the executeStepSign we will calculate properly.
    const firstIdx = Math.min(...selectedStepIndices);
    const prevMax = Number(firstIdx === 0 ? formData.quantity : (steps[firstIdx - 1]?.approvedQty || 0));

    setBulkSigningSteps(selectedStepIndices.sort((a, b) => a - b));
    setSigningStep(null);
    setSignFormData({
      operatorId: matchedOperator?.id || '',
      shiftId: getCurrentShiftId(),
      workType: 'İşlem',
      approvedQty: prevMax,
      rejectedQty: 0,
      reworkQty: 0,
      sampleQty: 0,
      conditionalQty: 0,
      recordDate: localISO
    });
    setShowSignModal(true);
  };

  const executeStepSign = async () => {
    const newSteps = [...steps];
    const opName = operators.find(o => o.id === signFormData.operatorId)?.fullName || authUser?.fullName;

    if (bulkSigningSteps.length > 0) {
      // BULK SIGN
      let currentApprovedQty = Number(signFormData.approvedQty || 0);

      for (const idx of bulkSigningSteps) {
        newSteps[idx] = {
          ...newSteps[idx],
          ...signFormData,
          status: 'completed',
          confirmedBy: opName,
          endTime: signFormData.recordDate
        };
        // Reset non-approved quantities for intermediate steps in bulk for simplicity
        // as the modal inputs are applied to the "batch"
        if (idx !== bulkSigningSteps[bulkSigningSteps.length - 1]) {
          newSteps[idx].rejectedQty = 0;
          newSteps[idx].reworkQty = 0;
          newSteps[idx].sampleQty = 0;
          newSteps[idx].conditionalQty = 0;
        }
      }
      setSteps(newSteps);
      setIsBulkSignMode(false);
      setSelectedStepIndices([]);
    } else {
      // SINGLE SIGN
      const prevStepApprovedQty = signingStep.index === 0
        ? formData.quantity
        : (steps[signingStep.index - 1]?.approvedQty || 0);

      const totalEntered =
        Number(signFormData.approvedQty || 0) +
        Number(signFormData.rejectedQty || 0) +
        Number(signFormData.reworkQty || 0) +
        Number(signFormData.sampleQty || 0) +
        Number(signFormData.conditionalQty || 0);

      if (totalEntered > prevStepApprovedQty) {
        showAlert(`Miktar hatası! Maksimum: ${prevStepApprovedQty}`, 'HATA', 'danger');
        return;
      }

      newSteps[signingStep.index] = {
        ...newSteps[signingStep.index],
        ...signFormData,
        status: 'completed',
        confirmedBy: opName,
        endTime: signFormData.recordDate
      };
      setSteps(newSteps);
    }

    setShowSignModal(false);
    showAlert('İmza işlemi yerel olarak kaydedildi. Kalıcı olması için KAYDET butonuna basınız.', 'BİLGİ', 'info');
  };

  const handleEventSubmit = () => {
    if (!eventFormData.stepId || !eventFormData.type || !eventFormData.quantity || !eventFormData.reasonId) {
      showAlert('Lütfen tüm zorunlu alanları doldurun.', 'EKSİK BİLGİ', 'warning');
      return;
    }

    if (eventFormData.id || eventFormData.localId) {
      // UPDATE
      setOrderEvents((prev: any[]) => prev.map(e => (e.id === eventFormData.id || (e.localId && e.localId === eventFormData.localId)) ? { ...e, ...eventFormData, quantity: Number(eventFormData.quantity) } : e));
    } else {
      // CREATE
      const newEvent = {
        ...eventFormData,
        localId: Math.random().toString(36).substr(2, 9),
        quantity: Number(eventFormData.quantity),
        createdAt: eventFormData.createdAt || new Date().toISOString()
      };
      setOrderEvents((prev: any[]) => [...prev, newEvent]);
    }
    setShowEventModal(false);
    showAlert('Olay kaydı listeye eklendi. Kalıcı olması için KAYDET butonuna basınız.', 'BİLGİ', 'info');
  };

  const handleEventDelete = (eventId: string) => {
    setOrderEvents(prev => prev.filter(e => e.id !== eventId && e.localId !== eventId));
  };

  const handleStepRollback = (stepId: string, idx: number) => {
    setSteps(prev => prev.map((s, i) => i === idx ? {
      ...s,
      status: 'pending',
      approvedQty: 0,
      rejectedQty: 0,
      reworkQty: 0,
      sampleQty: 0,
      conditionalQty: 0,
      confirmedBy: null,
      operatorId: null,
      startTime: null,
      endTime: null
    } : s));
    showAlert('İmza geri çekildi. Kalıcı olması için KAYDET butonuna basınız.', 'BİLGİ', 'info');
  };

  const currentStepIdx = steps.findIndex(s => s.status !== 'completed');
  // If no uncompleted step, and we have steps, all are completed.
  const activeStepIdx = currentStepIdx === -1 && steps.length > 0 ? steps.length : currentStepIdx;

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData({
        ...formData,
        productId,
        quantity: product.defaultProductionQty || 0,
        targetWarehouseId: product.targetWarehouseId || ''
      });
      // Fetch default recipe for this product
      if (product.route?.steps) {
        setSteps(product.route.steps.map((r: any) => ({
          operationId: r.operationId,
          operation: r.operation,
          sequence: r.sequence,
          status: 'pending'
        })));
      }

      // Auto-populate components from defaults
      if (product.defaultComponents?.length > 0) {
        setComponents(product.defaultComponents.map((c: any) => ({
          componentProductId: c.componentProductId,
          quantity: c.quantity,
          consumptionType: c.consumptionType || 'UNIT',
          unit: c.unit || 'PCS',
          warehouseId: c.warehouseId,
          lotNumber: c.lotNumber,
          notes: c.notes || ''
        })));
      }

      // Initialize machine as empty (User must select manually)
      setAssignedMachines([{ machineId: '', unitTimeSeconds: 0 }]);
    }
  };

  const handleSave = async () => {
    setShowValidation(true);
    setErrors({});
    const newErrors: Record<string, boolean> = {};

    if (!formData.productId) newErrors.productId = true;
    if (!formData.quantity || Number(formData.quantity) <= 0) newErrors.quantity = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showAlert('Lütfen ürün ve adet bilgilerini doldurun.', 'EKSİK BİLGİ', 'warning');
      return;
    }

    if (assignedMachines.length === 0 || !assignedMachines[0].machineId) {
      setErrors({ machineId: true });
      showAlert('Lütfen üretim yapılacak bir makine seçin!', 'EKSİK MAKİNE', 'danger');
      setActiveTab('machines');
      return;
    }

    // Component Stock Validation
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (!c.componentProductId) continue;

      const cProduct = products.find(p => p.id === c.componentProductId);
      const cName = cProduct?.productName || c.componentProduct?.name || 'Bileşen';

      if (!c.lotNumber) {
        setErrors({ [`component_lot_${i}`]: true });
        showAlert(`"${cName}" için lot seçilmemiş!`, 'EKSİK LOT', 'warning');
        setActiveTab('components');
        return;
      }

      const lot = (rowLots[i] || []).find((l: any) => l.id === c.lotNumber);
      const available = lot?.availableQty || 0;
      const required = Number(c.quantity || 0);

      if (required > available) {
        setErrors({ [`component_qty_${i}`]: true });
        showAlert(
          `"${cName}" için stok yetersiz! \n\nSeçilen Lot: ${c.lotNumber}\nİhtiyaç: ${required.toFixed(3)}\nMevcut: ${available.toFixed(3)}`,
          'STOK YETERSİZ',
          'danger'
        );
        setActiveTab('components');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        status: formData.status, // Ensure status is explicitly included
        components,
        machines: assignedMachines,
        steps,
        events: orderEvents
      };
      if (isEditing) {
        await api.put(`/production-orders/${formData.id}`, payload);
        await fetchData();
        showAlert('Üretim emri başarıyla güncellendi.', 'BAŞARILI', 'info');
      } else {
        const res = await api.post('/production-orders', payload);
        showAlert('Üretim emri başarıyla oluşturuldu.', 'BAŞARILI', 'info');
        if (res && res.id) {
          navigate(`/production-orders/${res.id}`);
        } else {
          navigate('/production-orders');
        }
      }
    } catch (e: any) {
      console.error('Save error:', e);
      showAlert(`Kaydedilirken hata oluştu: ${e.message || 'Bilinmeyen hata'}`, 'HATA', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Re-calculate component quantities when order quantity or product changes
  useEffect(() => {
    if (!formData.quantity || isEditing || !formData.productId) return;

    const mainProduct = products.find(p => p.id === formData.productId);
    if (!mainProduct) return;

    setComponents(prev => prev.map(c => {
      // UNIT: default_qty * order_qty
      if (c.consumptionType === 'UNIT') {
        const def = mainProduct.defaultComponents?.find((dc: any) => dc.componentProductId === c.componentProductId);
        if (def) return { ...c, quantity: Number(def.quantity) * Number(formData.quantity) };
      }

      // UNIT_CONSUMPTION: Professional formula (PI * r^2 * (L+f) * rho)
      if (c.consumptionType === 'UNIT_CONSUMPTION') {
        const compProduct = products.find(p => p.id === c.componentProductId);
        if (compProduct) {
          const L = Number(mainProduct.measurements?.height || 0); // mm
          const D = Number(compProduct.measurements?.diameter || 0); // mm
          const rho = Number(compProduct.measurements?.density || 0); // g/cm3
          const f = 0.07; // Default cut/waste margin in mm (from user's formula)

          if (L > 0 && D > 0 && rho > 0) {
            // Formula: PI * (D/20)^2 * ((L+f)/10) * rho
            const weightPerUnit = Math.PI * Math.pow(D / 20, 2) * ((L + f) / 10) * rho;
            return {
              ...c,
              quantity: Number((weightPerUnit * Number(formData.quantity)).toFixed(4)),
              unit: 'GR' // Force Grams for this calculation
            };
          }
        }
      }
      return c;
    }));
  }, [formData.quantity, formData.productId, products]);

  useEffect(() => {
    if (components.length > 0 && products.length > 0 && warehouses.length > 0) {
      components.forEach((c, i) => {
        if (c.componentProductId && c.warehouseId && (!rowLots[i] || rowLots[i].length === 0)) {
          fetchLotsForRow(i, c.componentProductId, c.warehouseId);
        }
      });
    }
  }, [components.length, products.length, warehouses.length]);

  const addComponent = () => setComponents([...components, {
    componentProductId: '',
    quantity: 1,
    consumptionType: 'UNIT',
    unit: 'PCS',
    warehouseId: '',
    lotNumber: '',
    notes: ''
  }]);
  const addMachine = () => setAssignedMachines([...assignedMachines, { machineId: '', unitTimeSeconds: 60 }]);
  // const addEvent = () => setOrderEvents([...orderEvents, { type: 'RED', quantity: 0, description: '', operatorId: '' }]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loading size="lg" /></div>;

  return (
    <div className="min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header Bar */}
      <div className="h-20 bg-theme-surface/80 backdrop-blur-[5px] border-b border-theme px-6 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-start justify-center gap-2">
          <button onClick={() => navigate('/production-orders')} className="p-1 border border-theme rounded-xl hover:bg-theme-main/5 text-theme-muted transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="flex items-center justify-center text-xl font-bold text-theme-main flex items-center gap-2">
              {isEditing ? `Üretim Emri No: ${formData.lotNumber}` : 'Yeni Üretim Emri Oluştur'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <div className="flex items-center gap-2">
              {formData.status === 'planned' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="h-10 px-6 py-2 bg-theme-primary text-white rounded-xl font-black text-[10px] uppercase shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover transition-all flex items-center gap-2 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" /> ÜRETİM EMRİNİ BAŞLAT
                </button>
              )}
              {formData.status === 'active' && (
                <>
                  <button
                    onClick={() => handleStatusChange('planned')}
                    className="h-10 px-4 py-2 bg-theme-surface text-theme-muted rounded-xl font-black text-[10px] uppercase border border-theme hover:bg-theme-main/5 transition-all flex items-center gap-2 active:scale-95"
                    title="Hazır Durumuna Geri Çek"
                  >
                    <RotateCcw className="w-4 h-4" /> GERİ ÇEK
                  </button>
                  <button
                    onClick={() => handleStatusChange('completed')}
                    className="h-10 px-6 py-2 bg-theme-success text-white rounded-xl font-black text-[10px] uppercase shadow-xl shadow-theme-success/20 hover:bg-theme-success-hover transition-all flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" /> ÜRETİM EMRİNİ BİTİR
                  </button>
                </>
              )}
              {formData.status === 'completed' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="h-10 px-4 py-2 bg-theme-surface text-theme-muted rounded-xl font-black text-[10px] uppercase border border-theme hover:bg-theme-main/5 transition-all flex items-center gap-2 active:scale-95"
                  title="Başladı Durumuna Geri Çek"
                >
                  <RotateCcw className="w-4 h-4" /> BAŞLADIYA ÇEK
                </button>
              )}
            </div>
          )}

          {!isCompleted && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-4 py-2 bg-theme-primary text-white rounded-xl font-black text-xs shadow-xl shadow-theme-primary/20 hover:bg-theme-primary-hover transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loading size="sm" /> : <>{isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{isEditing ? 'GÜNCELLE' : 'OLUŞTUR'}</>}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto px-6 space-y-6">
        {/* Top Row: Core Info & Classification */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Summary Card */}
          <div className="lg:col-span-3 space-y-6">
            <div className="modern-glass-card p-4 bg-theme-base/20 border-theme-primary/10 shadow-inner h-full flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em]">Özet Bilgi</span>
                <div className={`w-2 h-2 rounded-full animate-pulse shadow-lg ${formData.status === 'active' ? 'bg-theme-success shadow-theme-success/50' : formData.status === 'completed' ? 'bg-theme-primary shadow-theme-primary/50' : 'bg-theme-warning shadow-theme-warning/50'}`} />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 rounded-xl bg-theme-surface border border-theme-border/50 flex flex-col gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest">GÜNCEL DURUM</span>
                  <span className={`text-xs font-black uppercase tracking-wider ${formData.status === 'active' ? 'text-theme-success' : formData.status === 'completed' ? 'text-theme-primary' : 'text-theme-warning'}`}>
                    {formData.status === 'planned' ? 'Planlandı' :
                      formData.status === 'active' ? 'Devam Ediyor' :
                        formData.status === 'completed' ? 'Tamamlandı' :
                          formData.status === 'cancelled' ? 'İptal Edildi' : formData.status}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-theme-surface border border-theme-border/50 flex flex-col gap-1 shadow-sm">
                  <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest">İŞ EMRİ TİPİ</span>
                  <span className="text-xs font-black text-theme-dim uppercase tracking-wider">{formData.type} Üretim</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Card */}
          <div className="lg:col-span-9">
            <div className="modern-glass-card p-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Product & Qty */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-theme/50 mb-2">
                    <Package className="w-4 h-4 text-theme-primary" />
                    <h3 className="text-xs font-black text-theme-main uppercase tracking-widest">Ürün ve Miktar</h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">STOK KARTI / ÜRÜN</label>
                    <CustomSelect
                      options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                      value={formData.productId}
                      onChange={handleProductChange}
                      placeholder="Ürün Seçin"
                      disabled={isEditing}
                      className={showValidation && errors.productId ? 'border-theme-danger' : ''}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">ADET</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        disabled={isCompleted}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className={`form-input h-10 text-xs ${isCompleted ? 'bg-theme-base/20' : ''} ${showValidation && errors.quantity ? 'border-theme-danger shadow-sm shadow-theme-danger/20' : ''}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">LOT NO</label>
                      <input
                        value={formData.lotNumber}
                        disabled
                        className="form-input h-10 text-xs bg-theme-base/20 font-black tracking-tighter"
                        placeholder="Otomatik"
                      />
                    </div>
                  </div>
                </div>

                {/* Classification */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-theme/50 mb-2">
                    <Layers className="w-4 h-4 text-theme-primary" />
                    <h3 className="text-xs font-black text-theme-main uppercase tracking-widest">Klasifikasyon</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">EMİR TİPİ</label>
                    <CustomSelect
                      options={[
                        { id: 'Asıl', label: 'Asıl Üretim' },
                        { id: 'Tekrar', label: 'Tekrar İşlem' },
                        { id: 'Bölünmüş', label: 'Bölünmüş İşemri' },
                        { id: 'ArGe', label: 'Ar-Ge / Numune' },
                        { id: 'Fason', label: 'Fason Üretim' },
                        { id: 'Final', label: 'Final Kontrol' }
                      ]}
                      value={formData.type}
                      disabled={isCompleted}
                      onChange={(v) => setFormData({ ...formData, type: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">HEDEF DEPO</label>
                    <CustomSelect
                      options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                      value={formData.targetWarehouseId}
                      disabled={isCompleted}
                      onChange={(v) => setFormData({ ...formData, targetWarehouseId: v })}
                    />
                  </div>
                </div>

                {/* Tracking Info */}
                <div className="flex flex-col justify-center">
                  <div className="p-5 bg-theme-primary/5 border border-theme-primary/10 rounded-2xl space-y-4 shadow-inner">
                    <div className="flex items-center gap-3 text-theme-primary">
                      <div className="p-2 bg-theme-primary/10 rounded-lg">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">ÜRETİM TAKİBİ</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-theme-muted font-black uppercase tracking-widest">TAKİP TİPİ</p>
                      <p className="text-sm text-theme-main font-black tracking-widest bg-theme-surface/50 p-2 rounded-xl border border-theme/30 inline-block">
                        {products.find(p => p.id === formData.productId)?.trackingType || 'BELİRTİLMEMİŞ'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Full Width Tabs and Details */}
        <div className="w-full space-y-6">
          <div className="modern-glass-card overflow-hidden p-0 flex flex-col min-h-[450px]">
            {/* Tabs Header */}
            <div className="bg-theme-base/20 border-b border-theme px-6 overflow-x-auto">
              <div className="flex justify-between items-center w-full gap-4 pt-6 py-4 px-12">
                {[
                  { id: 'operations', label: 'OPERASYONLAR', icon: Workflow },
                  { id: 'components', label: 'BİLEŞENLER', icon: Boxes },
                  { id: 'events', label: 'OLAYLAR', icon: AlertTriangle },
                  { id: 'machines', label: 'MAKİNE BİLGİSİ', icon: Cpu },
                  { id: 'orders', label: 'SİPARİŞLER', icon: ShoppingBag },
                  { id: 'links', label: 'BAĞLI EMİRLER', icon: Link2 },
                  { id: 'notes', label: 'NOTLAR', icon: ClipboardList },
                  { id: 'dates', label: 'TARİHLER', icon: Calendar },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      flex items-center gap-1 pb-2 border-b-2 transition-all whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'border-theme-primary text-theme-primary font-black'
                        : 'border-transparent text-theme-muted hover:text-theme-dim font-bold'}
                      text-[10px] uppercase tracking-[0.05em]
                    `}
                  >
                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-40'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-3">
              {activeTab === 'operations' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OPERASYON VE PROSES AKIŞI</p>
                    <div className="flex items-center gap-3">
                      {isBulkSignMode ? (
                        <>
                          <button
                            onClick={() => {
                              setIsBulkSignMode(false);
                              setSelectedStepIndices([]);
                            }}
                            className="text-[10px] font-black text-theme-danger uppercase hover:underline"
                          >
                            VAZGEÇ
                          </button>
                          <button
                            onClick={handleBulkSignClick}
                            className="h-9 px-4 bg-theme-success text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-theme-success/20 flex items-center gap-2 active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" /> SEÇİLENLERİ İMZALA ({selectedStepIndices.length})
                          </button>
                        </>
                      ) : (
                        !isCompleted && formData.status === 'active' && (
                          <button
                            onClick={() => setIsBulkSignMode(true)}
                            className="h-9 px-4 bg-theme-base border border-theme text-theme-muted hover:text-theme-primary hover:border-theme-primary/30 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2"
                          >
                            <Layers className="w-4 h-4" /> TOPLU İMZALAMA
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-theme text-[9px] font-black text-theme-muted bg-theme-base/10">
                        <th className="px-2 py-3 text-center">Sıra</th>
                        {isBulkSignMode && <th className="px-2 py-3 text-center w-10">SEÇ</th>}
                        <th className="px-2 py-3">Proses Kodu</th>
                        <th className="px-2 py-3">Operasyon Adı</th>
                        <th className="px-2 py-3">Kabul Adeti</th>
                        <th className="px-2 py-3">Durum</th>
                        <th className="px-2 py-3">Onaylayan</th>
                        <th className="px-2 py-3 text-center">#</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {steps.map((step, idx) => {
                        const isStepCompleted = step.status === 'completed';
                        const isCurrent = idx === activeStepIdx;
                        const isFuture = idx > activeStepIdx;
                        const isPast = idx < activeStepIdx;

                        // User requirement: "completed steps are bright but buttons dimmed"
                        // "Current step is bright and buttons colorful"
                        // "Future steps are passive/transparent"
                        const rowOpacity = isFuture ? 'opacity-30' : 'opacity-100';

                        return (
                          <tr
                            key={idx}
                            className={`transition-all duration-300 border-b border-theme/50 ${isCurrent ? 'bg-theme-primary/[0.03] shadow-inner' : ''}`}
                          >
                            <td className={`px-2 py-4 font-black text-center ${rowOpacity}`}>
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center mx-auto text-[10px] ${isStepCompleted ? 'bg-theme-success text-white' : isCurrent ? 'bg-theme-primary text-white animate-pulse' : 'bg-theme-base border border-theme text-theme-muted'}`}>
                                {isStepCompleted ? <Check className="w-2.5 h-2.5" /> : step.sequence}
                              </div>
                            </td>
                            {isBulkSignMode && (
                              <td className="px-2 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedStepIndices.includes(idx)}
                                  disabled={isStepCompleted || idx < activeStepIdx}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Range selection logic
                                      const newIndices = [];
                                      for (let i = activeStepIdx; i <= idx; i++) {
                                        if (steps[i].status !== 'completed') newIndices.push(i);
                                      }
                                      setSelectedStepIndices(Array.from(new Set([...selectedStepIndices, ...newIndices])));
                                    } else {
                                      setSelectedStepIndices(selectedStepIndices.filter(i => i < idx));
                                    }
                                  }}
                                  className="w-4.5 h-4.5 rounded-2xl border border-theme text-theme-primary focus:ring-theme-primary bg-theme-base transition-all"
                                />
                              </td>
                            )}
                            <td className={`px-2 py-4 text-xs font-bold text-theme-main ${rowOpacity}`}>{step.operation?.code}</td>
                            <td className={`px-2 py-4 text-xs font-bold text-theme-dim ${rowOpacity}`}>
                              <div className="flex flex-col">
                                <span>{step.operation?.name}</span>
                                {isCurrent && <span className="text-[9px] text-theme-primary animate-pulse font-black mt-1">AKTİF OPERASYON</span>}
                              </div>
                            </td>
                            <td className={`px-2 py-4 ${rowOpacity}`}>
                              <div className="flex flex-col gap-1">
                                <span className={`text-[11px] font-black ${isStepCompleted ? 'text-theme-success' : isCurrent ? 'text-theme-primary' : 'text-theme-muted'}`}>
                                  {isStepCompleted ? `${Number(step.approvedQty || 0)} ADET` : 'BEKLİYOR'}
                                </span>
                                {isStepCompleted && Number(step.rejectedQty || 0) > 0 && (
                                  <span className="text-[9px] font-bold text-theme-danger">-{step.rejectedQty} RED</span>
                                )}
                              </div>
                            </td>
                            <td className={`px-2 py-4 ${rowOpacity}`}>
                              <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm border
                                ${isStepCompleted ? 'bg-theme-success/10 text-theme-success border-theme-success/20' :
                                  isCurrent ? 'bg-theme-primary/10 text-theme-primary border-theme-primary/20 animate-pulse' :
                                    'bg-theme-base/50 text-theme-muted border-theme/50'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isStepCompleted ? 'bg-theme-success' : isCurrent ? 'bg-theme-primary animate-ping' : 'bg-theme-muted'}`} />
                                {isStepCompleted ? 'TAMAMLANDI' : isCurrent ? 'SIRADAKİ' : 'BEKLİYOR'}
                              </div>
                            </td>
                            <td className={`px-2 py-4 ${rowOpacity}`}>
                              <div className="flex items-center gap-2 text-[10px] font-bold">
                                <div className="w-8 h-8 rounded-full bg-theme-base border border-theme flex items-center justify-center shrink-0 shadow-sm">
                                  <UserCircle className={`w-5 h-5 ${isStepCompleted ? 'text-theme-primary' : 'opacity-20'}`} />
                                </div>
                                <div className="flex flex-col">
                                  <span className={step.confirmedBy || step.operator?.fullName ? 'text-theme-main font-black' : 'italic text-theme-muted opacity-50'}>
                                    {step.confirmedBy || step.operator?.fullName || (isStepCompleted ? 'Atanmamış' : 'Personel Bekleniyor')}
                                  </span>
                                  {isStepCompleted && (step.shift?.shiftName || step.workType) && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {step.shift?.shiftName && (
                                        <span className="text-[8px] text-theme-primary font-black uppercase tracking-tighter ring-1 ring-theme-primary/20 px-1 rounded bg-theme-primary/5">
                                          {step.shift.shiftName}
                                        </span>
                                      )}
                                      {step.workType && (
                                        <span className="text-[8px] text-theme-muted font-bold uppercase tracking-tighter ring-1 ring-theme/20 px-1 rounded bg-theme-base/50">
                                          {step.workType}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`px-2 py-4 text-right ${rowOpacity}`}>
                              <div className="flex items-center justify-end gap-2">
                                {isCurrent && !isCompleted && !isBulkSignMode && (
                                  <button
                                    onClick={() => handleStepSign(step, idx)}
                                    className="h-10 px-4 bg-theme-primary text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-theme-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                  >
                                    <CheckCircle2 className="w-4 h-4" /> İMZALA
                                  </button>
                                )}
                                {isPast && idx === activeStepIdx - 1 && !isCompleted && !isBulkSignMode && (
                                  <button
                                    onClick={() => handleStepRollback(step.id, idx)}
                                    className="p-1.5 bg-theme-danger/10 border border-theme-danger/30 text-theme-danger hover:text-theme-base hover:bg-theme-danger hover:border-theme-danger transition-all rounded-xl shadow-sm"
                                    title="İmzayı Geri Çek"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {isPast && (idx !== activeStepIdx - 1 || isCompleted || isBulkSignMode) && (
                                  <div className="p-2.5 opacity-10 cursor-not-allowed">
                                    <CheckCircle2 className="w-4 h-4 text-theme-success" />
                                  </div>
                                )}
                                {isFuture && (
                                  <div className="p-2.5 opacity-5">
                                    <DiamondPlus className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'components' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-theme-muted uppercase">HAMMADDE VE BİLEŞEN LİSTESİ</p>
                    {!isCompleted && (
                      <button onClick={addComponent} className="btn-secondary h-10 px-4 py-2 flex items-center gap-2 text-[9px] font-black bg-theme-primary/10 rounded-xl text-theme-primary border border-theme-primary/20 shadow-lg shadow-theme-primary/10 hover:scale-103">
                        <Plus className="w-3.5 h-3.5" /> BİLEŞEN EKLE
                      </button>
                    )}
                  </div>
                  <div className="border border-theme rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead className="bg-theme-base/10">
                        <tr className="text-[9px] font-black text-theme-muted">
                          <th className="px-2 py-3 w-12">Bileşen Ürün</th>
                          <th className="px-2 py-3">Depo</th>
                          <th className="px-2 py-3">Giriş Numarası</th>
                          <th className="px-2 py-3">Tipi</th>
                          <th className="px-2 py-3 w-32">Miktar</th>
                          <th className="px-2 py-3 w-64">Notlar</th>
                          <th className="px-2 py-3 w-20">Sil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme">
                        {components.map((c, i) => (
                          <tr key={i}>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={products.map(p => ({ id: p.id, label: p.productCode, subLabel: p.productName }))}
                                value={c.componentProductId}
                                disabled={isCompleted}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].componentProductId = v;
                                  setComponents(nc);
                                  // Fetch lots if warehouse already selected
                                  if (nc[i].warehouseId) fetchLotsForRow(i, v, nc[i].warehouseId);
                                }}
                              />
                            </td>
                            <td className="px-2 py-3 w-12">
                              <CustomSelect
                                options={warehouses.map(w => ({ id: w.id, label: w.name }))}
                                value={c.warehouseId}
                                disabled={isCompleted}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].warehouseId = v;
                                  setComponents(nc);
                                  // Fetch lots for this product in this warehouse
                                  if (nc[i].componentProductId) fetchLotsForRow(i, nc[i].componentProductId, v);
                                }}
                                placeholder="Depo..."
                              />
                            </td>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={rowLots[i] || []}
                                value={c.lotNumber}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].lotNumber = v;
                                  setComponents(nc);
                                }}
                                placeholder={!c.componentProductId || !c.warehouseId ? "Ürün/Depo seçin" : "Lot Seçin"}
                                disabled={isCompleted || !c.componentProductId || !c.warehouseId}
                                className={showValidation && errors[`component_lot_${i}`] ? 'border-theme-danger shadow-sm shadow-theme-danger/20' : ''}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <CustomSelect
                                options={[
                                  { id: 'UNIT', label: 'Birim Miktar' },
                                  { id: 'UNIT_CONSUMPTION', label: 'Birim Sarfiyat' },
                                  { id: 'FIXED', label: 'Sabit Miktar' }
                                ]}
                                value={c.consumptionType}
                                disabled={isCompleted}
                                onChange={(v) => {
                                  const nc = [...components];
                                  nc[i].consumptionType = v;
                                  setComponents(nc);
                                }}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex gap-2 items-center">
                                {c.consumptionType === 'UNIT' && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={c.unitQuantity || ''}
                                      placeholder="Birim"
                                      disabled={isCompleted || !c.lotNumber}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const nc = [...components];
                                        nc[i].unitQuantity = val;
                                        nc[i].quantity = val * (formData.quantity || 0);
                                        setComponents(nc);
                                        const lot = (rowLots[i] || []).find((l: any) => l.id === c.lotNumber);
                                        if (lot && nc[i].quantity > lot.availableQty) {
                                          showAlert(`"${c.componentProduct?.name}" için yeterli stok yok! Mevcut: ${lot.availableQty}`, 'STOK YETERSİZ', 'warning');
                                        }
                                      }}
                                      className={`form-input text-xs text-right w-14 border-theme-primary/30 bg-theme-primary/5 ${(!c.lotNumber || isCompleted) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    <span className="text-[10px] text-theme-muted">x</span>
                                  </div>
                                )}
                                <div className="flex flex-col items-center min-w-[64px]">
                                  <input
                                    type="number"
                                    value={c.quantity}
                                    min="1"
                                    disabled={isCompleted || c.consumptionType === 'UNIT_CONSUMPTION' || !c.lotNumber}
                                    onChange={(e) => {
                                      let val = Number(e.target.value);
                                      const lot = (rowLots[i] || []).find((l: any) => l.id === c.lotNumber);
                                      if (lot && val > lot.availableQty) {
                                        val = lot.availableQty;
                                        showAlert(`"${c.componentProduct?.name}" için maksimum stok ${lot.availableQty} adet seçilebilir.`, 'STOK SINIRI', 'warning');
                                      }
                                      if (val < 1) val = 1;
                                      const nc = [...components];
                                      nc[i].quantity = val;
                                      setComponents(nc);
                                    }}
                                    className={`form-input text-xs text-right w-20 ${(isCompleted || c.consumptionType === 'UNIT_CONSUMPTION' || !c.lotNumber) ? 'bg-theme-base/5 opacity-50 cursor-not-allowed' : ''} ${c.consumptionType === 'UNIT' ? 'font-bold text-theme-primary bg-theme-primary/5' : ''} ${showValidation && errors[`component_qty_${i}`] ? 'border-theme-danger shadow-sm shadow-theme-danger/20' : ''}`}
                                  />
                                  {c.consumptionType === 'UNIT_CONSUMPTION' && (
                                    <div className="mt-1 whitespace-nowrap">
                                      <span className="text-[8px] font-black text-theme-primary bg-theme-primary/10 px-1.5 py-0.5 rounded-md border border-theme-primary/20 shadow-sm">
                                        {(c.quantity / (formData.quantity || 1)).toFixed(3)} g/adet
                                      </span>
                                    </div>
                                  )}
                                  {showValidation && !c.lotNumber && !isCompleted && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-theme-danger/5 backdrop-blur-[1px] pointer-events-none rounded-lg border border-theme-danger/20">
                                      <span className="text-[10px] font-black text-theme-danger animate-pulse tracking-tighter">LOT SEÇİN</span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-full h-10">
                                  <CustomSelect
                                    variant="inline"
                                    options={[
                                      { id: 'ADET', label: 'Adet' },
                                      { id: 'GR', label: 'Gram' },
                                      { id: 'KG', label: 'Kilogram' },
                                      { id: 'MM', label: 'Milimetre' },
                                      { id: 'CM', label: 'Santimetre' },
                                      { id: 'M', label: 'Metre' },
                                      { id: 'KASA', label: 'Kasa' },
                                      { id: 'CUVAL', label: 'Çuval' },
                                      { id: 'KOLI', label: 'Koli' },
                                      { id: 'KUTU', label: 'Kutu' },
                                    ]}
                                    value={c.unit || 'PCS'}
                                    disabled={isCompleted}
                                    onChange={(v) => {
                                      const nc = [...components];
                                      nc[i].unit = v;
                                      setComponents(nc);
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 w-64">
                              <input
                                value={c.notes}
                                disabled={isCompleted}
                                onChange={(e) => {
                                  const nc = [...components];
                                  nc[i].notes = e.target.value;
                                  setComponents(nc);
                                }}
                                className={`form-input w-64 text-xs ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`}
                              />
                            </td>
                            <td className="px-2 py-3 text-center">
                              {!isCompleted && (
                                <button onClick={() => setComponents(components.filter((_, idx) => idx !== i))} className="p-3 text-theme-danger hover:bg-theme-danger/10 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'machines' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-black text-theme-muted uppercase">ATANMIŞ MAKİNE VE TEZGAH BİLGİSİ</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {(assignedMachines.length > 0 ? assignedMachines : [{ machineId: '', unitTimeSeconds: 60 }]).slice(0, 1).map((m, i) => {
                      const product = products.find(p => p.id === formData.productId);
                      const machineOptions = product?.defaultMachines?.map((dm: any) => ({
                        id: dm.machineId,
                        label: dm.machine?.code || 'Makine',
                        subLabel: dm.machine?.name || '',
                        defaultTime: dm.unitTimeSeconds
                      })) || [];

                      return (
                        <div key={i} className="flex items-center gap-4 p-4 border border-theme rounded-2xl bg-theme-base/5 hover:bg-theme-main/5 transition-all group shadow-sm">
                          <div className="w-12 h-12 rounded-xl bg-theme-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                            <Cpu className="w-6 h-6 text-theme-primary" />
                          </div>

                          <div className="flex-1 grid grid-cols-12 gap-6 items-center">
                            <div className="col-span-12 lg:col-span-2">
                              <label className="text-[11px] font-black text-theme-muted mb-1.5 block">Makine Seçimi</label>
                              <CustomSelect
                                options={machineOptions}
                                value={m.machineId}
                                disabled={isCompleted || !formData.productId}
                                onChange={(v) => {
                                  const nm = [...assignedMachines];
                                  if (nm.length === 0) nm.push({ machineId: '', unitTimeSeconds: 60 });
                                  nm[0].machineId = v;
                                  // Auto-fill unit time from the selected default machine
                                  const dm = machineOptions.find((o: any) => o.id === v);
                                  if (dm) nm[0].unitTimeSeconds = dm.defaultTime;
                                  setAssignedMachines(nm);
                                }}
                                placeholder={!formData.productId ? "Önce Ürün Seçin" : "Makine Seçin..."}
                                className={showValidation && errors.machineId ? 'border-theme-danger shadow-sm shadow-theme-danger/20' : ''}
                              />
                            </div>

                            <div className="col-span-12 lg:col-span-2">
                              <label className="text-[11px] font-black text-theme-muted mb-1.5 block">Birim Süre (sn)</label>
                              <div className="flex items-center justify-between gap-4 bg-theme-base/30 h-10 px-4 py-2 rounded-xl border border-theme/50">
                                <div className="flex items-center gap-2 shrink-0">
                                  <Clock className="w-4 h-4 text-theme-primary/60" />
                                </div>
                                <input
                                  type="number"
                                  value={m.unitTimeSeconds}
                                  disabled={isCompleted}
                                  onChange={(e) => {
                                    const nm = [...assignedMachines];
                                    if (nm.length === 0) nm.push({ machineId: '', unitTimeSeconds: 60 });
                                    nm[0].unitTimeSeconds = e.target.value;
                                    setAssignedMachines(nm);
                                  }}
                                  className={`form-input h-8 text-xs text-right font-black w-24 bg-transparent border-none focus:ring-0 p-0 ${isCompleted ? 'opacity-50' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">ÜRETİM EMRİ ÖZEL NOTLARI</p>
                  <textarea
                    value={formData.notes}
                    disabled={isCompleted}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className={`form-input flex-1 min-h-[400px] py-6 px-6 text-sm leading-relaxed ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`}
                    placeholder="Üretim sırasında dikkat edilmesi gereken hususlar..."
                  />
                </div>
              )}

              {activeTab === 'dates' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-theme-primary" /> ZAMAN ÇİZELGESİ VE KRİTİK TARİHLER
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-base/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-primary/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-theme-primary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">PLANLAMA</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">BAŞLAMA TARİHİ</label>
                          <input type="date" value={formData.startDate} disabled={isCompleted} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className={`form-input ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">BİTİŞ TARİHİ</label>
                          <input type="date" value={formData.endDate} disabled={isCompleted} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className={`form-input ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-warning/5 border-theme-warning/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-warning/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-theme-warning" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-theme-warning">ÜRETİM / SKT</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">ÜRETİM TARİHİ</label>
                          <input type="date" value={formData.productionDate} disabled={isCompleted} onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })} className={`form-input ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">SON KULLANMA TARİHİ</label>
                          <input type="date" value={formData.expiryDate} disabled={isCompleted} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className={`form-input ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-3 border border-theme rounded-2xl bg-theme-secondary/5 border-theme-secondary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-theme-secondary/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-theme-secondary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-theme-secondary">STERİLİZASYON</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-theme-muted uppercase">STERİL TARİHİ</label>
                          <input type="date" value={formData.sterilizationDate} disabled={isCompleted} onChange={(e) => setFormData({ ...formData, sterilizationDate: e.target.value })} className={`form-input ${isCompleted ? 'bg-theme-base/20 opacity-50' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-theme-muted uppercase">OLAY VE UYGUNSUZLUK KAYITLARI</p>
                      <p className="text-[10px] font-bold text-theme-dim">Red, numune ve şartlı kabul gibi durumlar için zorunlu olay kayıtları.</p>
                    </div>
                    {!isCompleted && (
                      <button
                        onClick={() => {
                          setEventFormData({
                            stepId: '',
                            type: '',
                            quantity: 0,
                            operatorId: operators.find(o => o.fullName === authUser?.fullName)?.id || '',
                            reasonId: '',
                            warehouseId: '',
                            description: '',
                            createdAt: new Date().toISOString().slice(0, 16)
                          });
                          setShowEventModal(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-theme-primary text-white rounded-xl hover:bg-theme-primary-hover transition-all text-[11px] font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20 group"
                      >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                        YENİ OLAY EKLE
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {orderEvents.length === 0 ? (
                      <div className="p-16 border-2 border-dashed border-theme rounded-3xl flex flex-col items-center justify-center gap-4 text-theme-muted bg-theme-base/5">
                        <div className="w-16 h-16 rounded-full bg-theme-base/10 flex items-center justify-center">
                          <AlertTriangle className="w-8 h-8 opacity-20" />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="font-black text-xs uppercase tracking-widest">Henüz Olay Kaydı Yok</p>
                          <p className="text-[10px] font-bold opacity-60">Üretim sırasında oluşan aksaklıkları buradan raporlayabilirsiniz.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {orderEvents.map((evt: any) => (
                          <div key={evt.id} className="group relative p-4 border border-theme rounded-2xl bg-theme-base/10 hover:bg-theme-main/5 transition-all flex items-center justify-between overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${evt.type === 'RED' ? 'bg-rose-500' :
                              evt.type === 'NUMUNE' ? 'bg-amber-500' :
                                evt.type === 'TEKRAR_ISLEM' ? 'bg-indigo-500' : 'bg-emerald-500'
                              }`} />
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${evt.type === 'RED' ? 'bg-rose-500/10 text-rose-500' :
                                evt.type === 'NUMUNE' ? 'bg-amber-500/10 text-amber-500' :
                                  evt.type === 'TEKRAR_ISLEM' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                {evt.type === 'RED' ? <Trash2 className="w-5 h-5" /> :
                                  evt.type === 'NUMUNE' ? <ShoppingBag className="w-5 h-5" /> :
                                    evt.type === 'TEKRAR_ISLEM' ? <RotateCcw className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${evt.type === 'RED' ? 'text-rose-500' :
                                    evt.type === 'NUMUNE' ? 'text-amber-500' :
                                      evt.type === 'TEKRAR_ISLEM' ? 'text-indigo-500' : 'text-emerald-500'
                                    }`}>{evt.type?.replace('_', ' ')}</span>
                                  <span className="w-1 h-1 rounded-full bg-theme-muted/30" />
                                  <span className="text-[10px] font-black text-theme-main uppercase tracking-tighter opacity-80">{evt.step?.operation?.name || 'GENEL'}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[11px] font-bold text-theme-muted">
                                    {evt.reason?.code ? `[${evt.reason.code}] ` : ''}
                                    {evt.reason?.name || evt.description || 'Neden belirtilmemiş'}
                                  </p>
                                  {evt.operator && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-theme-muted/30" />
                                      <span className="text-[10px] font-bold text-theme-dim">PERSONEL: {evt.operator.fullName}</span>
                                    </>
                                  )}
                                  {evt.warehouse && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-theme-primary/10 text-theme-primary rounded-md uppercase">{evt.warehouse.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-sm font-black text-theme-main leading-none">{evt.quantity} {evt.step?.product?.unitOfMeasure || 'ADET'}</span>
                                <span className="text-[9px] font-bold text-theme-muted opacity-40 uppercase">{new Date(evt.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedEvent(evt)}
                                  className="px-3 py-1.5 bg-theme-base/20 border border-theme hover:bg-theme-main/5 text-theme-muted text-[9px] font-black uppercase rounded-lg transition-all"
                                >
                                  DETAY
                                </button>
                                {!isCompleted && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEventFormData({
                                          id: evt.id,
                                          stepId: evt.stepId,
                                          type: evt.type,
                                          quantity: evt.quantity,
                                          operatorId: evt.operatorId,
                                          reasonId: evt.reasonId,
                                          warehouseId: evt.warehouseId || '',
                                          description: evt.description || '',
                                          createdAt: new Date(evt.createdAt).toISOString().slice(0, 16)
                                        });
                                        setShowEventModal(true);
                                      }}
                                      className="px-3 py-1.5 bg-theme-primary/10 border border-theme-primary/30 hover:bg-theme-primary/20 text-theme-primary text-[9px] font-black uppercase rounded-lg transition-all"
                                    >
                                      DÜZENLE
                                    </button>
                                    <button
                                      onClick={() => handleEventDelete(evt.id)}
                                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {['orders', 'links'].includes(activeTab) && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-30 gap-6 grayscale">
                  <Workflow className="w-10 h-10 stroke-[0.5]" />
                  <div className="space-y-2">
                    <h4 className="text-md font-black uppercase text-theme-dim">MODÜL YÜKLENİYOR</h4>
                    <p className="text-xs font-bold max-w-sm mx-auto leading-relaxed">
                      {activeTab === 'orders' && 'Satış siparişleri ile üretim emri eşleşmeleri bu bölümde listelenir.'}
                      {activeTab === 'links' && 'Parçalı üretim veya ilişkili üretim emirleri arasındaki hiyerarşik bağlar burada yönetilir.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showSignModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-theme-surface/60 backdrop-blur-xs" onClick={() => setShowSignModal(false)} />
          <div className="relative w-full max-w-4xl bg-theme-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="px-6 py-3 bg-theme-base/20 border-b border-theme flex justify-between items-center bg-gradient-to-r from-theme-primary/5 to-transparent">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-theme-primary/10 rounded-xl">
                  <Workflow className="w-5 h-5 text-theme-primary" />
                </div>
                <div>
                  <h3 className="text-md font-black text-theme-main uppercase">Operasyon İmzalama</h3>
                  <p className="text-[10px] font-bold text-theme-muted">{signingStep?.operation?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="p-2 hover:bg-theme-main/5 text-theme-muted hover:text-theme-main rounded-xl transition-all"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Metadata */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5" /> PERSONEL ADI
                    </label>
                    <CustomSelect
                      options={operators.map(o => ({ id: o.id, label: o.fullName, subLabel: o.employeeId }))}
                      value={signFormData.operatorId}
                      onChange={val => setSignFormData({ ...signFormData, operatorId: val })}
                      placeholder="Personel seçin..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5" /> VARDİYA
                    </label>
                    <CustomSelect
                      options={shifts.map(s => ({ id: s.id, label: s.shiftName, subLabel: `${s.startTime}-${s.endTime}` }))}
                      value={signFormData.shiftId}
                      onChange={val => setSignFormData({ ...signFormData, shiftId: val })}
                      placeholder="Vardiya seçin..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                      <Type className="w-3.5 h-3.5" /> İŞ TİPİ
                    </label>
                    <CustomSelect
                      options={[
                        { id: 'İşlem', label: 'İşlem' },
                        { id: 'Hazırlık', label: 'Hazırlık' },
                        { id: 'Ürün Geçişi', label: 'Ürün Geçişi' },
                        { id: 'Temizlik', label: 'Temizlik' },
                        { id: 'Sökme', label: 'Sökme' },
                      ]}
                      value={signFormData.workType}
                      onChange={val => setSignFormData({ ...signFormData, workType: val })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> TARİH & SAAT
                    </label>
                    <input
                      type="datetime-local"
                      value={signFormData.recordDate}
                      onChange={e => setSignFormData({ ...signFormData, recordDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Column 2: Quantities */}
                <div className="p-4 bg-theme-base/10 rounded-2xl border border-theme space-y-4">
                  {(() => {
                    const firstBulkIdx = bulkSigningSteps.length > 0 ? Math.min(...bulkSigningSteps) : null;
                    const referenceIdx = signingStep ? signingStep.index : firstBulkIdx;
                    const prevMax = Number(referenceIdx === 0 ? formData.quantity : (steps[(referenceIdx || 0) - 1]?.approvedQty || 0));
                    return (
                      <>
                        <div className="space-y-1 pb-4 border-b border-theme/50">
                          <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">
                            {signingStep?.index === 0 ? 'TOPLAM PERSONEL PLANLANAN' : 'ÖNCEKİ OPERASYONDAN GELEN'}
                          </label>
                          <div className="text-2xl font-black text-theme-primary">
                            {prevMax} ADET
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-success uppercase tracking-widest">KABUL ADETİ</label>
                            <input
                              type="number"
                              value={signFormData.approvedQty}
                              onChange={e => setSignFormData({ ...signFormData, approvedQty: Number(e.target.value) })}
                              className="form-input h-12 p-2 text-lg font-black border-theme-success/30 focus:border-theme-success bg-theme-success/5"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-danger uppercase tracking-widest">RED ADETİ</label>
                            <input
                              type="number"
                              min="0"
                              value={signFormData.rejectedQty}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const others = Number(signFormData.reworkQty || 0) + Number(signFormData.sampleQty || 0) + Number(signFormData.conditionalQty || 0);
                                const newApproved = Math.max(0, prevMax - (val + others));
                                setSignFormData({ ...signFormData, rejectedQty: val, approvedQty: newApproved });
                              }}
                              className="form-input h-12 p-2 text-lg font-black border-theme-danger/30 focus:border-theme-danger bg-theme-danger/5"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-warning uppercase tracking-widest">TEKRAR İŞLEM</label>
                            <input
                              type="number"
                              min="0"
                              value={signFormData.reworkQty}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const others = Number(signFormData.rejectedQty || 0) + Number(signFormData.sampleQty || 0) + Number(signFormData.conditionalQty || 0);
                                const newApproved = Math.max(0, prevMax - (val + others));
                                setSignFormData({ ...signFormData, reworkQty: val, approvedQty: newApproved });
                              }}
                              className="form-input h-12 p-2 text-lg font-black border-theme-warning/30 focus:border-theme-warning bg-theme-warning/5"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-info uppercase tracking-widest">NUMUNE ADETİ</label>
                            <input
                              type="number"
                              min="0"
                              value={signFormData.sampleQty}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const others = Number(signFormData.rejectedQty || 0) + Number(signFormData.reworkQty || 0) + Number(signFormData.conditionalQty || 0);
                                const newApproved = Math.max(0, prevMax - (val + others));
                                setSignFormData({ ...signFormData, sampleQty: val, approvedQty: newApproved });
                              }}
                              className="form-input h-12 p-2 text-lg font-black border-theme-info/30 focus:border-theme-info bg-theme-info/5"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[9px] font-black text-theme-dim uppercase tracking-widest">ŞARTLI KABUL</label>
                            <input
                              type="number"
                              min="0"
                              value={signFormData.conditionalQty}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const others = Number(signFormData.rejectedQty || 0) + Number(signFormData.reworkQty || 0) + Number(signFormData.sampleQty || 0);
                                const newApproved = Math.max(0, prevMax - (val + others));
                                setSignFormData({ ...signFormData, conditionalQty: val, approvedQty: newApproved });
                              }}
                              className="form-input h-12 p-2 text-lg font-black border-theme-dim/30 bg-theme-base/20"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-theme-base/20 border-t border-theme flex gap-4">
              <button
                onClick={() => setShowSignModal(false)}
                className="flex-1 h-12 bg-theme-base text-theme-muted font-black border border-theme rounded-xl hover:bg-theme-main/5 transition-all text-xs uppercase"
              >
                VAZGEÇ
              </button>
              <button
                onClick={executeStepSign}
                className="flex-1 h-12 bg-theme-primary text-white font-black rounded-xl shadow-xl shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> KAYDET VE İMZALA
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showEventModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-theme-surface/60 backdrop-blur-xs" onClick={() => setShowEventModal(false)} />
          <div className="relative w-full max-w-2xl bg-theme-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 bg-theme-base/20 border-b border-theme flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-theme-warning/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-theme-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">{eventFormData.id ? 'OLAY DÜZENLE' : 'YENİ OLAY FORMU'}</h3>
                  <p className="text-[10px] font-bold text-theme-muted uppercase tracking-tighter">Üretim içi aksaklık ve numune kaydı</p>
                </div>
              </div>
              <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-theme-main/5 text-theme-muted rounded-xl transition-all">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OLAY OPERASYONU</label>
                  <CustomSelect
                    options={steps
                      .filter(s => (s.rejectedQty || 0) + (s.sampleQty || 0) + (s.reworkQty || 0) + (s.conditionalQty || 0) > 0)
                      .map(s => ({
                        id: s.id,
                        label: s.operation?.name || 'Bilinmeyen Operasyon',
                        subLabel: `Kalan LOG: ${((s.rejectedQty || 0) + (s.sampleQty || 0) + (s.reworkQty || 0) + (s.conditionalQty || 0)) - (orderEvents.filter(e => e.stepId === s.id).reduce((sum, e) => sum + (e.quantity || 0), 0))} ADET`
                      }))}
                    value={eventFormData.stepId}
                    onChange={(v) => {
                      setEventFormData({ ...eventFormData, stepId: v, type: '', quantity: 0 });
                    }}
                    placeholder="Operasyon Seçin"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OLAY TİPİ</label>
                  <CustomSelect
                    options={[
                      { id: 'RED', label: 'RED', disabled: !steps.find(s => s.id === eventFormData.stepId)?.rejectedQty },
                      { id: 'NUMUNE', label: 'NUMUNE', disabled: !steps.find(s => s.id === eventFormData.stepId)?.sampleQty },
                      { id: 'TEKRAR_ISLEM', label: 'TEKRAR İŞLEM', disabled: !steps.find(s => s.id === eventFormData.stepId)?.reworkQty },
                      { id: 'SARTLI_KABUL', label: 'ŞARTLI KABUL', disabled: !steps.find(s => s.id === eventFormData.stepId)?.conditionalQty }
                    ].map(opt => ({
                      ...opt,
                      subLabel: eventFormData.stepId ? `Mevcut: ${(() => {
                        const s = steps.find(st => st.id === eventFormData.stepId);
                        if (opt.id === 'RED') return s?.rejectedQty || 0;
                        if (opt.id === 'NUMUNE') return s?.sampleQty || 0;
                        if (opt.id === 'TEKRAR_ISLEM') return s?.reworkQty || 0;
                        if (opt.id === 'SARTLI_KABUL') return s?.conditionalQty || 0;
                        return 0;
                      })()} Adet` : ''
                    }))}
                    value={eventFormData.type}
                    onChange={(v) => {
                      let max = 0;
                      const s_found = steps.find(st => st.id === eventFormData.stepId);
                      if (v === 'RED') max = s_found?.rejectedQty || 0;
                      else if (v === 'NUMUNE') max = s_found?.sampleQty || 0;
                      else if (v === 'TEKRAR_ISLEM') max = s_found?.reworkQty || 0;
                      else if (v === 'SARTLI_KABUL') max = s_found?.conditionalQty || 0;

                      const logged = orderEvents
                        .filter(e => e.stepId === eventFormData.stepId && e.type === v)
                        .reduce((sum, e) => sum + (e.quantity || 0), 0);

                      setEventFormData({ ...eventFormData, type: v, quantity: Math.max(0, max - logged), reasonId: '' });
                    }}
                    placeholder={!eventFormData.stepId ? "Önce Op. Seçin" : "Tip Seçin"}
                    disabled={!eventFormData.stepId}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">MİKTAR</label>
                  <input
                    type="number"
                    value={eventFormData.quantity}
                    onChange={(e) => setEventFormData({ ...eventFormData, quantity: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OLAY SEBEBİ</label>
                  <CustomSelect
                    options={eventReasons
                      .filter(r => r.type === eventFormData.type)
                      .map(r => ({
                        id: r.id,
                        label: r.name,
                        subLabel: r.group?.name ? `Grup: ${r.group.name}` : undefined
                      }))}
                    value={eventFormData.reasonId}
                    onChange={(v) => setEventFormData({ ...eventFormData, reasonId: v })}
                    placeholder={!eventFormData.type ? "Önce Tip Seçin" : "Sebep Seçin"}
                    disabled={!eventFormData.type}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest flex items-center justify-between">
                    <span>DEPO SEÇİMİ</span>
                    {settings?.productionEventWarehouseRequired && <span className="text-rose-500 text-[8px] font-black">ZORUNLU</span>}
                  </label>
                  <CustomSelect
                    options={warehouses.map(w => ({ id: w.id, label: w.name, subLabel: w.type?.toUpperCase() }))}
                    value={eventFormData.warehouseId}
                    onChange={(v) => setEventFormData({ ...eventFormData, warehouseId: v })}
                    placeholder="Depo Seçin (İsteğe bağlı)"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">DETAYLI AÇIKLAMA</label>
                  <textarea
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                    className="form-input min-h-[80px] py-3"
                    placeholder="Ek bilgiler..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-theme-base/20 border-t border-theme flex gap-3">
              <button onClick={() => setShowEventModal(false)} className="flex-1 px-6 py-3 bg-theme-base text-theme-muted text-xs font-black rounded-xl border border-theme hover:bg-theme-main/10 transition-all uppercase tracking-widest">VAZGEÇ</button>
              <button onClick={handleEventSubmit} className="flex-1 px-6 py-3 bg-theme-primary text-white text-xs font-black rounded-xl shadow-lg shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">OLAYI KAYDET</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedEvent && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-theme-surface/60 backdrop-blur-xs" onClick={() => setSelectedEvent(null)} />
          <div className="relative w-full max-w-lg bg-theme-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 bg-theme-base/20 border-b border-theme flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${selectedEvent.type === 'RED' ? 'bg-rose-500/10 text-rose-500' :
                  selectedEvent.type === 'NUMUNE' ? 'bg-amber-500/10 text-amber-500' :
                    selectedEvent.type === 'TEKRAR_ISLEM' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">OLAY DETAYLARI</h3>
                  <p className="text-[10px] font-bold text-theme-muted uppercase tracking-tighter">İşlem Bazlı Uygunsuzluk / Durum Bilgisi</p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-theme-main/5 text-theme-muted rounded-xl transition-all">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OLAY TİPİ</p>
                  <p className="text-xs font-bold text-theme-main uppercase">{selectedEvent.type?.replace('_', ' ')}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">MİKTAR</p>
                  <p className="text-xs font-bold text-theme-main">{selectedEvent.quantity} {selectedEvent.step?.product?.unitOfMeasure || 'ADET'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">OPERASYON</p>
                  <p className="text-xs font-bold text-theme-main uppercase">{selectedEvent.step?.operation?.name || 'GENEL'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">TARİH</p>
                  <p className="text-xs font-bold text-theme-main">{new Date(selectedEvent.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <div className="space-y-1 col-span-2 p-3 bg-theme-base/10 rounded-xl border border-theme">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-1">OLAY SEBEBİ</p>
                  <p className="text-xs font-bold text-theme-main">
                    {selectedEvent.reason?.code ? `[${selectedEvent.reason.code}] ` : ''}
                    {selectedEvent.reason?.name || 'Tanımlanmamış'}
                  </p>
                  {selectedEvent.reason?.group && (
                    <p className="text-[10px] font-bold text-theme-dim mt-1 uppercase">GRUP: {selectedEvent.reason.group.name}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">KAYDEDEN PERSONEL</p>
                  <p className="text-xs font-bold text-theme-main uppercase">{selectedEvent.operator?.fullName || '-'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">DEPO</p>
                  <p className="text-xs font-bold text-theme-main uppercase">{selectedEvent.warehouse?.name || '-'}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">AÇIKLAMA</p>
                  <p className="text-xs font-medium text-theme-muted italic">{selectedEvent.description || 'Açıklama girilmemiş.'}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-theme-base/20 border-t border-theme flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-6 h-10 bg-theme-base text-theme-muted font-black border border-theme rounded-xl hover:bg-theme-main/5 transition-all text-[10px] uppercase"
              >
                KAPAT
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        alertOnly={true}
      />
    </div>
  );
}
