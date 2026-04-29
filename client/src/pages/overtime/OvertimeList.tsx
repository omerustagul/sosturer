import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Eye, Trash2, Clock, X, Calendar,
  Users, ShieldCheck,
  Search, Plus,
  LayoutList, Download, Activity, Image,
  Monitor, Package, Layers, Edit2, Check,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { notify } from '../../store/notificationStore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CustomSelect } from '../../components/common/CustomSelect';
import { BulkActionBar } from '../../components/common/BulkActionBar';
import { useAuthStore } from '../../store/authStore';

interface PlanItem {
  id: string;
  date: string;
  machine: { name: string; code: string } | null;
  backupMachine?: { name: string; code: string } | null;
  operator: {
    fullName: string;
    employeeId: string;
    department?: { name: string }
  };
  product?: { productName: string; productCode: string } | null;
  targetQuantity?: number | null;
  notes?: string | null;
}

interface Plan {
  id: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  shift: { id: string; shiftName: string; shiftCode: string } | null;
  items: PlanItem[];
  _count: { items: number };
}

const statusConfig: Record<string, { label: string; color: string; border: string }> = {
  planned: { label: 'Planlanmış', color: 'bg-blue-500/10 text-blue-400', border: 'border-blue-500/20' },
  active: { label: 'Aktif', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20' },
  completed: { label: 'Tamamlandı', color: 'bg-theme-dim/10 text-theme-dim', border: 'border-theme/20' },
  cancelled: { label: 'İptal', color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/20' }
};

export function OvertimeList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [activeDayDate, setActiveDayDate] = useState<string | null>(null);

  // States for Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const { company } = useAuthStore();

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await api.get('/overtime');
      setPlans(data);
    } catch (err) {
      notify.error('Hata', 'Mesai planları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Bu mesai planını silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/overtime/${id}`);
      setPlans(prev => prev.filter(p => p.id !== id));
      notify.success('Başarılı', 'Mesai planı silindi.');
    } catch (err) {
      notify.error('Hata', 'Mesai planı silinemedi.');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.size} adet planı silmek istediğinize emin misiniz?`)) return;
    try {
      setLoading(true);
      await Promise.all(Array.from(selectedIds).map(id => api.delete(`/overtime/${id}`)));
      setPlans(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      notify.success('Başarılı', 'Seçili planlar silindi.');
    } catch (err) {
      notify.error('Hata', 'Bazı planlar silinemedi.');
    } finally {
      setLoading(false);
    }
  };

  // PDF Export Functionality
  const exportToPDF = async () => {
    if (!selectedPlan) return;
    setLoading(true);

    try {
      const { default: html2pdf } = await import('html2pdf.js');

      // Prepare date range
      const dates: string[] = [];
      let curr = new Date(selectedPlan.startDate);
      const end = new Date(selectedPlan.endDate);
      while (curr <= end) {
        dates.push(new Date(curr).toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      // Group items by machine and date
      const rows: Record<string, Record<string, any>> = {};
      const supportItems: any[] = [];

      selectedPlan.items.forEach(item => {
        const dateStr = new Date(item.date).toISOString().split('T')[0];
        if (item.machine) {
          const rowKey = `${item.machine.code} - ${item.machine.name}`;
          if (!rows[rowKey]) rows[rowKey] = {};
          rows[rowKey][dateStr] = item;
        } else {
          supportItems.push({ ...item, dateStr });
        }
      });

      const element = document.createElement('div');
      element.innerHTML = `
        <div style="padding: 20px; font-family: 'Inter', sans-serif; color: #1e293b; background: white;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0f172a;">
            <div>
              <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 900; text-transform: uppercase;">MESAİ ÇALIŞMA PLANI</h1>
              <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: 700;">${company?.name || 'Sosturer'} - ${selectedPlan.planName}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 900; color: #0f172a; font-size: 12px;">${selectedPlan.shift?.shiftName || 'Vardiya Belirtilmedi'}</p>
              <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px; font-weight: 600;">
                ${new Date(selectedPlan.startDate).toLocaleDateString('tr-TR')} - ${new Date(selectedPlan.endDate).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </div>

          <!-- Summary Stats -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase;">TOPLAM PERSONEL</p>
              <p style="margin: 2px 0 0 0; color: #0f172a; font-size: 14px; font-weight: 900;">${[...new Set(selectedPlan.items.map(i => i.operator?.fullName))].length}</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase;">AKTİF BİRİM</p>
              <p style="margin: 2px 0 0 0; color: #0f172a; font-size: 14px; font-weight: 900;">${[...new Set(selectedPlan.items.map(i => i.operator?.department?.name || 'Diğer'))].length}</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase;">MAKİNE SAYISI</p>
              <p style="margin: 2px 0 0 0; color: #0f172a; font-size: 14px; font-weight: 900;">${[...new Set(selectedPlan.items.filter(i => i.machine).map(i => i.machine?.name))].length}</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase;">TOPLAM ATAMA</p>
              <p style="margin: 2px 0 0 0; color: #0f172a; font-size: 14px; font-weight: 900;">${selectedPlan.items.length}</p>
            </div>
          </div>

          <!-- Main Matrix Table -->
          <h2 style="font-size: 10px; font-weight: 900; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 5px;">
            <span style="width: 3px; height: 12px; background: #3b82f6; display: inline-block; border-radius: 1px;"></span>
            MAKİNE VE ÜRETİM DAĞILIMI
          </h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 9px; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 130px; color: #475569;">MAKİNE / BİRİM</th>
                ${dates.map(date => `
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: #475569;">
                    ${new Date(date).toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(rows).map(([machineName, dateData]) => `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 8px; font-weight: 800; color: #0f172a; background: #f8fafc;">
                    ${machineName}
                  </td>
                  ${dates.map(date => {
        const item = dateData[date];
        return `
                      <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; height: 45px; position: relative;">
                        ${item ? `
                          <div style="font-weight: 900; color: #3b82f6; line-height: 1.1;">${item.operator?.fullName || '-'}</div>
                          <div style="font-size: 7px; color: #64748b; margin-top: 2px; font-weight: 700;">${item.product?.productCode || 'N/A'}</div>
                          <div style="font-size: 8px; color: #10b981; font-weight: 900; margin-top: 2px;">${item.targetQuantity ? item.targetQuantity + ' Adet' : ''}</div>
                          ${item.backupMachine ? `<div style="font-size: 6px; color: #94a3b8; font-style: italic;">Yedek: ${item.backupMachine.code}</div>` : ''}
                        ` : '<span style="opacity: 0.1;">-</span>'}
                      </td>
                    `;
      }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Support Personnel Section -->
          ${supportItems.length > 0 ? `
            <div style="page-break-before: auto;">
              <h2 style="font-size: 10px; font-weight: 900; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 5px;">
                <span style="width: 3px; height: 12px; background: #ec4899; display: inline-block; border-radius: 1px;"></span>
                İDARİ VE DESTEK BİRİM MESAİLERİ
              </h2>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 9px;">
                <thead>
                  <tr style="background: #fdf2f8;">
                    <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #9d174d;">PERSONEL</th>
                    <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #9d174d;">BİRİM</th>
                    <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #9d174d;">TARİH</th>
                    <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #9d174d;">AÇIKLAMALAR</th>
                  </tr>
                </thead>
                <tbody>
                  ${supportItems.map(item => `
                    <tr>
                      <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: 800; color: #0f172a;">${item.operator?.fullName}</td>
                      <td style="border: 1px solid #e2e8f0; padding: 6px; color: #64748b;">${item.operator?.department?.name || 'Destek'}</td>
                      <td style="border: 1px solid #e2e8f0; padding: 6px; color: #0f172a; font-weight: 600;">
                        ${new Date(item.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', weekday: 'short' })}
                      </td>
                      <td style="border: 1px solid #e2e8f0; padding: 6px; color: #64748b; font-style: italic;">${item.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Footer Info -->
          <div style="margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 15px;">
            <div>
              <p style="margin: 0; font-size: 8px; color: #94a3b8; font-weight: 600;">Oluşturan: ${selectedPlan.createdBy || 'Sistem'}</p>
              <p style="margin: 2px 0 0 0; font-size: 8px; color: #94a3b8; font-weight: 600;">Yazdırma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 8px; color: #94a3b8; font-weight: 800; text-transform: uppercase;">&copy; 2024 SOSTURER PRO</p>
            </div>
          </div>
        </div>
      `;

      const opt = {
        margin: 0,
        filename: `MESAI_PLANI_${selectedPlan.planName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
      };

      await html2pdf().from(element).set(opt).save();
      notify.success('Başarılı', 'Mesai planı PDF olarak indirildi.');
    } catch (error) {
      console.error('PDF Export Error:', error);
      notify.error('Hata', 'PDF oluşturulurken bir hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  // Image Export Functionality (PNG)
  const exportToImage = async () => {
    if (!selectedPlan) return;
    setLoading(true);

    try {
      const { default: html2canvas } = await import('html2canvas');

      // Prepare dates
      const dates: string[] = [];
      let curr = new Date(selectedPlan.startDate);
      const end = new Date(selectedPlan.endDate);
      while (curr <= end) {
        dates.push(new Date(curr).toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.width = '1200px';
      document.body.appendChild(element);

      element.innerHTML = `
        <div style="padding: 30px; background: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; width: 1200px;">
          <!-- Top Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #000; text-transform: uppercase;">MESAİ / VARDİYA PLANLAMA ÇİZELGESİ</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #1e293b; opacity: 0.8;">
                ${new Date(selectedPlan.startDate).toLocaleDateString('tr-TR')} - ${new Date(selectedPlan.endDate).toLocaleDateString('tr-TR')} ${selectedPlan.planName} | ${selectedPlan.shift?.shiftName || ''}
              </p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 13px; font-weight: 900; color: #000;">${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b;">Çalışma Saatleri: 19:30 — 07:30</p>
            </div>
          </div>

          <!-- Content Grid (Horizontal list of Day Cards) -->
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            ${dates.map(date => {
        const dayItems = selectedPlan.items.filter(i => new Date(i.date).toISOString().split('T')[0] === date);
        const machines = dayItems.filter(i => i.machine);
        const personnel = dayItems.filter(i => !i.machine);
        const uniqueOpsCount = [...new Set(dayItems.map(i => i.operator?.fullName))].length;

        return `
                <div style="flex: 1; min-width: 0; background: #fff; border: 1px solid #eef2f6; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; padding: 2px;">
                  <!-- Day Header -->
                  <div style="padding: 15px 10px; text-align: center;">
                    <p style="margin: 0; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${new Date(date).toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                    <p style="margin: 2px 0 0 0; font-size: 15px; font-weight: 800; color: #000;">${new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</p>
                  </div>

                  <!-- Black Action Bar -->
                  <div style="background: #1a1a1a; margin: 0 8px 12px 8px; padding: 8px; border-radius: 6px; text-align: center;">
                    <p style="margin: 0; font-size: 9px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 1px;">TOPLAM: ${uniqueOpsCount} PERSONEL</p>
                  </div>

                  <!-- Machines Section -->
                  <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <div style="height: 1px; flex: 1; background: #f1f5f9; margin: 0 5px;"></div>
                    <p style="margin: 0; font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">MAKİNELER</p>
                    <div style="height: 1px; flex: 1; background: #f1f5f9; margin: 0 5px;"></div>
                  </div>

                  <div style="padding: 0 8px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                    ${machines.map(m => `
                      <div style="background: #fff; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px; position: relative; ${m.backupMachine ? 'border: 1px dashed #f59e0b; background: #fffbeb;' : ''}">
                        ${m.backupMachine ? `<div style="position: absolute; right: 4px; top: 4px; background: #f59e0b; color: white; padding: 2px 4px; border-radius: 3px; font-size: 6px; font-weight: 900; letter-spacing: 0.5px;">YEDEK</div>` : ''}
                        <p style="margin: 0; font-size: 11px; font-weight: 800; color: #000;">${m.machine?.code || 'MAKİNE'}</p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 800; color: #3b82f6;">${m.operator?.fullName || 'Belirtilmedi'}</p>
                        <p style="margin: 4px 0 0 0; font-size: 9px; font-weight: 600; color: #64748b;">Hedeflenen Üretim Adeti: <span style="font-weight: 800; color: #000;">${m.targetQuantity || '—'}</span></p>
                        ${m.product ? `<p style="margin: 2px 0 0 0; font-size: 8px; font-weight: 700; color: #94a3b8;">Ürün: ${m.product.productCode}</p>` : ''}
                      </div>
                    `).join('')}
                    ${machines.length === 0 ? '<p style="text-align:center; font-size:9px; color:#cbd5e1; font-style:italic; padding: 10px;">Görev Yok</p>' : ''}
                  </div>

                  <!-- Personnel Section -->
                  <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <div style="height: 1px; flex: 1; background: #f1f5f9; margin: 0 5px;"></div>
                    <p style="margin: 0; font-size: 7px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">PERSONEL</p>
                    <div style="height: 1px; flex: 1; background: #f1f5f9; margin: 0 5px;"></div>
                  </div>

                  <div style="padding: 0 8px; display: flex; flex-direction: column; gap: 4px; padding-bottom: 12px;">
                    ${personnel.map(p => `
                      <div style="padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">
                         <p style="margin: 0; font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${p.operator?.department?.name || 'GENEL'}</p>
                         <p style="margin: 2px 0 0 0; font-size: 10px; font-weight: 800; color: #000;">${p.operator?.fullName}</p>
                      </div>
                    `).join('')}
                    ${personnel.length === 0 ? '<p style="text-align:center; font-size:9px; color:#cbd5e1; font-style:italic; padding: 10px;">Görev Yok</p>' : ''}
                  </div>
                </div>
              `;
      }).join('')}
          </div>

          <!-- Bottom Footer -->
          <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #f1f5f9; padding-top: 25px;">
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Hazırlayan:</p>
              <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #000; letter-spacing: -0.5px;">${selectedPlan.createdBy || 'Ömer Baran Ustagül'}</p>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 15px;">
              <div style="text-align: right;">
                <p style="margin: 0; font-size: 15px; font-weight: 800; color: #1e293b;">${company?.name || 'Medisolaris Sağlık Hizmetleri Ltd. Şti.'}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.2px;">SOSTURER | Smart Manufacturing System</p>
              </div>
              <img src="/logo/logo.png" alt="Logo" style="width: 44px; height: 44px;" />
            </div>
          </div>
        </div>
      `;

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `MESAI_PLANI_${selectedPlan.planName.replace(/\s+/g, '_')}.png`;
      link.click();

      document.body.removeChild(element);
      notify.success('Başarılı', 'Mesai planı görseli indirildi.');
    } catch (error) {
      console.error('Image Export Error:', error);
      notify.error('Hata', 'Görsel oluşturulurken bir hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      await api.post('/overtime/bulk-status', { ids: Array.from(selectedIds), status });
      setPlans(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status } : p));
      setSelectedIds(new Set());
      notify.success('Güncellendi', 'Durumlar güncellendi.');
    } catch (err) {
      notify.error('Hata', 'Güncelleme başarısız.');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/overtime/${id}`, { status });
      setPlans(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      notify.success('Güncellendi', 'Plan durumu değiştirildi.');
    } catch (err) {
      notify.error('Hata', 'Durum güncellenemedi.');
    }
  };

  const filteredPlans = useMemo(() => {
    const lowerSearch = searchTerm.toLocaleLowerCase('tr-TR');
    return plans.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = p.planName.toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        (p.shift?.shiftName || '').toLocaleLowerCase('tr-TR').includes(lowerSearch) ||
        p.items.some(i => (i.operator?.fullName || '').toLocaleLowerCase('tr-TR').includes(lowerSearch));

      const planStart = new Date(p.startDate);
      const planEnd = new Date(p.endDate);
      const filterStart = dateFilter.start ? new Date(dateFilter.start) : null;
      const filterEnd = dateFilter.end ? new Date(dateFilter.end) : null;

      const matchesDate = (!filterStart || planEnd >= filterStart) && (!filterEnd || planStart <= filterEnd);

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [plans, statusFilter, searchTerm, dateFilter]);

  const paginatedPlans = useMemo(() => {
    return filteredPlans.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize
    );
  }, [filteredPlans, currentPage, pageSize]);

  const pageCount = Math.ceil(filteredPlans.length / pageSize);

  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setCurrentPage(0);
  };

  // Modal logic to handle day selection
  useEffect(() => {
    if (selectedPlan && selectedPlan.items.length > 0 && !activeDayDate) {
      const uniqueDates = [...new Set(selectedPlan.items.map(i => i.date.split('T')[0]))].sort();
      setActiveDayDate(uniqueDates[0]);
    }
  }, [selectedPlan]);

  const activeDayItems = useMemo(() => {
    if (!selectedPlan || !activeDayDate) return [];
    return selectedPlan.items.filter(i => i.date.startsWith(activeDayDate));
  }, [selectedPlan, activeDayDate]);

  const uniqueDays = useMemo(() => {
    if (!selectedPlan) return [];
    return [...new Set(selectedPlan.items.map(i => i.date.split('T')[0]))].sort();
  }, [selectedPlan]);

  return (
    <div className="p-4 lg:p-6 mx-auto">
      {/* Header & Main Filters */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-theme-main tracking-tight uppercase leading-none mb-2">MESAİ LİSTESİ</h1>
            <div className="flex items-center gap-2 text-theme-dim opacity-60">
              <LayoutList size={14} className="text-theme-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest">TÜM PLANLANAN VE GERÇEKLEŞEN MESAİLER</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/overtime/create')}
              className="h-10 px-6 bg-theme-primary hover:bg-theme-primary/90 text-white rounded-xl flex items-center gap-3 text-[10px] font-black tracking-widest transition-all shadow-xl active:scale-95 group uppercase"
            >
              <Plus size={16} className="group-hover:rotate-180 transition-transform duration-500" />
              YENİ MESAİ PLANI
            </button>
            <div className="flex gap-1 bg-theme-base border border-theme-border p-1 rounded-xl backdrop-blur-sm">
              {['all', 'planned', 'active', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    statusFilter === status
                      ? "bg-theme-primary/10 border border-theme-primary/30 text-theme-primary shadow-md"
                      : "text-theme-dim hover:text-theme-main hover:bg-theme-main/5"
                  )}
                >
                  {status === 'all' ? 'HEPSİ' : statusConfig[status]?.label || status.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="premium-card rounded-2xl p-2 flex flex-wrap items-center gap-4 bg-theme-surface/30">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-dim opacity-40 w-4 h-4" />
            <input
              type="text"
              placeholder="Mesai Planı Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 bg-theme-base border border-theme rounded-xl pl-8 pr-4 py-3 text-xs font-bold text-theme-main focus:ring-2 focus:ring-theme-primary outline-none transition-all placeholder:text-theme-dim/40"
            />
          </div>

          <div className="flex items-center gap-2 bg-theme-base/50 p-1 rounded-xl border border-theme/10">
            <div className="flex items-center px-4 gap-2 text-theme-dim opacity-50 border-r border-theme/20">
              <Calendar size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">TARİH</span>
            </div>
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent text-xs font-bold text-theme-main p-2 outline-none cursor-pointer"
            />
            <span className="text-theme-dim opacity-20">—</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent text-xs font-bold text-theme-main p-2 outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter({ start: '', end: '' }) }}
            className="h-10 px-4 py-3 bg-theme-base border border-theme rounded-xl text-[10px] font-black uppercase text-theme-dim hover:text-theme-main hover:bg-theme-main/5 transition-all"
          >
            TEMİZLE
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 w-full animate-pulse bg-theme-surface/50 rounded-2xl border border-theme/10" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="premium-card p-20 text-center bg-theme-surface/10">
          <Clock className="w-16 h-16 text-theme-dim/10 mx-auto mb-6" />
          <h2 className="text-lg font-black text-theme-dim/60 uppercase tracking-[0.2em]">Sonuç Bulunamadı</h2>
          <p className="text-[10px] font-bold text-theme-dim/40 uppercase mt-2">Filtrelerinizi güncelleyerek tekrar deneyin.</p>
        </div>
      ) : (
        <div className="premium-card rounded-2xl overflow-hidden border-theme/60">
          <table className="w-full border-collapse density-aware-table">
            <thead>
              <tr className="bg-theme-surface/50 border-b border-theme/20">
                <th className="w-6 px-3 py-4">
                  <div
                    onClick={() => {
                      if (selectedIds.size === filteredPlans.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filteredPlans.map(p => p.id)));
                    }}
                    className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                      selectedIds.size === filteredPlans.length ? "bg-theme-success border-theme-success" : "border-theme-border/40 hover:border-theme-success"
                    )}
                  >
                    {selectedIds.size === filteredPlans.length && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </th>
                <th className="text-left py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">MESAI PLANI / VARDİYA</th>
                <th className="text-left py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">TARİH ARALIĞI</th>
                <th className="text-center py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">OPERATÖR</th>
                <th className="text-center py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">ALAN/T.GAH</th>
                <th className="text-center py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">DURUM</th>
                <th className="text-right py-2 px-3 text-[10px] font-black text-theme-dim uppercase tracking-[0.2em]">AKSİYON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {paginatedPlans.map(plan => {
                const status = statusConfig[plan.status] || { label: plan.status.toUpperCase(), color: 'bg-theme/10 text-theme-dim', border: 'border-theme/10' };
                const opCount = [...new Set((plan.items || []).map(i => i.operator?.fullName || ''))].length;
                const machineCount = [...new Set((plan.items || []).filter(i => i.machine).map(i => i.machine?.name || ''))].length;
                const isSelected = selectedIds.has(plan.id);

                return (
                  <tr
                    key={plan.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, input, select, a, .cursor-pointer, [role="button"]')) return;
                      const newSelected = new Set(selectedIds);
                      if (newSelected.has(plan.id)) newSelected.delete(plan.id);
                      else newSelected.add(plan.id);
                      setSelectedIds(newSelected);
                    }}
                    className={cn(
                      "hover:bg-theme-primary/5 transition-all group cursor-pointer",
                      isSelected && "bg-theme-primary/5"
                    )}
                  >
                    <td className="py-2 px-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-theme-success border-theme-success" : "border-theme-border/40 hover:border-theme-success"
                        )}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-theme-primary/10 flex items-center justify-center text-theme-primary border border-theme-primary/20 shadow-inner group-hover:rotate-6 transition-transform">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-theme-main group-hover:text-theme-primary transition-colors leading-tight">{plan.planName}</p>
                          <p className="text-[10px] font-bold text-theme-dim opacity-60">{plan.shift?.shiftName || 'Vardiya Belirtilmedi'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <p className="text-xs font-black text-theme-main">
                          {format(new Date(plan.startDate), 'd MMMM', { locale: tr })} — {format(new Date(plan.endDate), 'd MMMM', { locale: tr })}
                        </p>
                        <p className="text-[10px] font-bold text-theme-dim opacity-50 uppercase tracking-tighter">
                          {format(new Date(plan.startDate), 'yyyy')}
                        </p>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-sm font-black text-theme-main">{opCount}</span>
                      <span className="text-[10px] text-theme-dim font-bold ml-1">Kişi</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-sm font-black text-theme-main">{machineCount}</span>
                      <span className="text-[10px] text-theme-dim font-bold ml-1">Birim</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black border uppercase tracking-widest inline-block shadow-sm", status.color, status.border)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedPlan(plan); setActiveDayDate(null); }}
                          className="w-9 h-9 flex items-center justify-center bg-theme-primary/10 text-theme-primary border border-theme-primary/20 rounded-xl hover:bg-theme-primary hover:text-white transition-all active:scale-95 shadow-lg shadow-theme-primary/5"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/overtime/edit/${plan.id}`)}
                          className="w-9 h-9 flex items-center justify-center bg-theme-base/50 text-theme-main border border-theme-border rounded-xl hover:bg-theme-main hover:text-theme-base transition-all active:scale-95 shadow-lg shadow-theme-main/5"
                        >
                          <Edit2 size={16} />
                        </button>
                        <div className="w-40 h-9 flex items-center justify-center rounded-xl">
                          <CustomSelect
                            options={Object.entries(statusConfig).map(([val, cfg]) => ({
                              id: val,
                              label: cfg.label
                            }))}
                            value={plan.status}
                            onChange={(val) => updateStatus(plan.id, val)}
                            searchable={false}
                          />
                        </div>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          className="w-9 h-9 flex items-center justify-center bg-theme-danger/10 text-theme-danger border border-theme-danger/20 rounded-xl hover:bg-theme-danger hover:text-white transition-all active:scale-95"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="px-4 py-2 border-t border-theme bg-theme-base/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 order-2 md:order-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-theme-dim whitespace-nowrap">Sayfada Görüntülenen:</span>
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
                    onChange={value => handlePageSizeChange(Number(value))}
                    searchable={false}
                  />
                </div>
              </div>
              <div className="h-4 w-px bg-theme hidden md:block" />
              <span className="text-[11px] font-black text-theme-dim">
                Toplam <span className="text-theme-primary">{filteredPlans.length}</span> Kayıt
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

              <div className="flex items-center gap-2 px-4 py-2 bg-theme-base border rounded-xl">
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
                className="p-3 rounded-xl bg-theme-base border text-theme-dim hover:text-theme-main hover:bg-theme-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg group"
              >
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPlan && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-10 overflow-hidden bg-theme-base/10 backdrop-blur-xs animate-in fade-in duration-500">
          <div className="relative w-full h-[85vh] max-w-6xl bg-theme-base border border-theme rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-500 ring-1 ring-white/5">

            {/* Modal Header */}
            <div className="p-3 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primary border border-theme-primary/30 shadow-2xl relative group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-theme-primary/20 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <LayoutList size={24} className="relative z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black text-theme-main tracking-tight uppercase leading-none">{selectedPlan.planName}</h3>
                    <span className={cn("px-3 py-1 rounded-lg text-[8px] font-black border uppercase tracking-[0.2em]", statusConfig[selectedPlan.status]?.color || '', statusConfig[selectedPlan.status]?.border || '')}>
                      {statusConfig[selectedPlan.status]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-theme-dim opacity-50 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><Calendar size={12} /> {format(new Date(selectedPlan.startDate), 'd MMMM', { locale: tr })} - {format(new Date(selectedPlan.endDate), 'd MMMM', { locale: tr })}</div>
                    <div className="w-1 h-1 rounded-full bg-theme-primary/40" />
                    <div className="flex items-center gap-1.5"><Clock size={12} /> {selectedPlan.shift?.shiftName}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/overtime/edit/${selectedPlan.id}`)}
                  className="h-10 px-4 flex items-center justify-center bg-theme-primary/10 text-theme-primary border border-theme-primary/20 rounded-xl hover:bg-theme-primary hover:text-white transition-all duration-300 group shadow-xl gap-2 text-[10px] font-black uppercase tracking-widest"
                >
                  <Edit2 size={16} /> DÜZENLE
                </button>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-10 h-10 flex items-center justify-center bg-theme-surface border border-theme rounded-xl text-theme-dim hover:text-white hover:bg-theme-danger hover:border-theme-danger transition-all duration-300 group shadow-xl"
                >
                  <X className="group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            {/* Day Selector Track - Modern Compact Navigation */}
            <div className="px-3 mb-3">
              <div className="bg-theme-surface/30 p-2.5 rounded-2xl border border-theme-border/50 flex items-center gap-2 relative overflow-x-auto no-scrollbar backdrop-blur-md">
                {uniqueDays.map(day => {
                  const isActive = activeDayDate === day;
                  const dateObj = new Date(day);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  return (
                    <button
                      key={day}
                      onClick={() => setActiveDayDate(day)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[100px] h-12 rounded-xl transition-all duration-500 relative shrink-0",
                        isActive
                          ? "bg-theme-primary/10 text-theme-primary border border-theme-primary/20 shadow-lg shadow-theme-primary/10 scale-[1.05] z-10 translate-y-[-2px]"
                          : "text-theme-dim hover:bg-theme-main/10 hover:text-theme-main"
                      )}
                    >
                      <span className={cn("text-[9px] font-black uppercase tracking-widest mb-0.5 opacity-60", isActive && "text-theme-primary")}>
                        {format(dateObj, 'EEEE', { locale: tr })}
                      </span>
                      <span className="text-sm font-black tracking-tighter">
                        {format(dateObj, 'd MMMM', { locale: tr })}
                      </span>
                      {isWeekend && !isActive && <div className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-rose-500/40" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body - Dual Column Layout */}
            <div className="flex-1 flex overflow-hidden">

              {/* Left Side: Assignment List */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 custom-scrollbar">
                {activeDayItems.length === 0 ? (
                  <div className="py-12 text-center bg-theme-surface/20 rounded-3xl border border-dashed border-theme/20 mt-4">
                    <p className="text-[10px] font-black text-theme-dim opacity-40 uppercase tracking-widest italic">BU GÜN İÇİN ATAMA BULUNMUYOR</p>
                  </div>
                ) : (
                  <>
                    {/* Production Section */}
                    {activeDayItems.filter(i => i.machine).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-theme-primary/20 flex-1" />
                          <span className="text-[9px] font-black text-theme-primary uppercase tracking-[0.3em]">MAKİNE VE ÜRETİM MESAİSİ</span>
                          <div className="h-px bg-theme-primary/20 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {activeDayItems.filter(i => i.machine).map((item) => (
                            <div key={item.id} className="premium-card p-3 group flex flex-col gap-4 border border-theme/10 rounded-xl hover:border-theme-primary/30 transition-all duration-300">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-theme-base border border-theme flex items-center justify-center text-theme-dim group-hover:text-theme-primary transition-colors shadow-sm">
                                    <Monitor size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-theme-main group-hover:text-theme-primary transition-colors leading-none mt-0.5">{item.machine?.name}</p>
                                    <p className="text-[10px] font-bold text-theme-dim opacity-60 uppercase">{item.machine?.code}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-theme-main uppercase">{item.operator?.fullName || 'Belirtilmedi'}</span>
                                  <span className="text-[9px] font-bold text-theme-dim opacity-50 uppercase tracking-widest">OPERATÖR</span>
                                </div>
                              </div>

                              <div className="bg-theme-main/5 p-3 rounded-xl flex items-center justify-between border border-theme/5">
                                <div className="flex flex-col">
                                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-wider opacity-40 leading-none mb-1.5">ÜRÜN / PARÇA</p>
                                  <div className="flex items-center gap-2">
                                    <Package size={12} className="text-theme-primary/60" />
                                    <p className="text-xs font-bold text-theme-main truncate max-w-[140px] leading-tight">
                                      {item.product ? item.product.productName : "Belirtilmedi"}
                                    </p>
                                    {item.product?.productCode && <span className="text-[9px] font-black text-theme-dim py-0.5 px-1.5 bg-theme-base border border-theme/10 rounded-md uppercase">{item.product.productCode}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-theme-dim uppercase tracking-wider opacity-40 leading-none mb-1.5 text-right">HEDEF</p>
                                  <p className="text-xs font-black text-theme-primary italic">{item.targetQuantity ? `${item.targetQuantity} ADET` : "—"}</p>
                                </div>
                              </div>

                              {item.notes && (
                                <div className="bg-theme-warning/5 px-3 py-2 rounded-xl border-l-2 border-theme-warning/30 flex items-center gap-2">
                                  <ShieldCheck size={12} className="text-theme-warning/40 shrink-0" />
                                  <p className="text-[10px] font-bold text-theme-dim/70 leading-relaxed italic truncate opacity-80">
                                    "{item.notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Support/Other Units Section */}
                    {activeDayItems.filter(i => !i.machine).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-theme-dim/10 flex-1" />
                          <span className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-60">DESTEK VE İDARİ BİRİM MESAİLERİ</span>
                          <div className="h-px bg-theme-dim/10 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {activeDayItems.filter(i => !i.machine).map((item) => (
                            <div key={item.id} className="premium-card p-3 group flex items-center gap-4 hover:border-theme-primary/20 rounded-xl transition-all bg-theme-surface/10 border-theme/5">
                              <div className="w-8 h-8 rounded-xl bg-theme-base border border-theme flex items-center justify-center text-theme-dim group-hover:bg-theme-primary/10 group-hover:text-theme-primary group-hover:border-theme-primary/20 transition-all shadow-sm">
                                <Users size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-theme-main tracking-tight group-hover:text-theme-primary transition-colors truncate">{item.operator?.fullName || 'Belirtilmedi'}</p>
                                <p className="text-[9px] font-bold text-theme-dim opacity-60 uppercase flex items-center gap-1.5 mt-0.5">
                                  <Activity size={10} /> {item.operator?.department?.name || "Birim Desteği"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Side: Plan Dashboard / Modular Stats */}
              <div className="w-80 border-l border-theme/10 bg-theme-surface/10 p-6 space-y-8 overflow-y-auto no-scrollbar">

                {/* Stats Section 1: Overview */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">PLANA GENEL BAKIŞ</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'TOPLAM PERSONEL', value: [...new Set(selectedPlan.items.map(i => i.operator?.fullName || 'Belirtilmedi'))].length, icon: Users, color: 'text-theme-primary', bg: 'bg-theme-primary/10' },
                      { label: 'AKTİF BİRİMLER', value: [...new Set(selectedPlan.items.map(i => i.operator?.department?.name || 'Diğer'))].length, icon: Layers, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                      { label: 'TOPLAM MAKİNE', value: [...new Set(selectedPlan.items.filter(i => i.machine).map(i => i.machine?.code || '—'))].length, icon: Monitor, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                      { label: 'ÜRETİM HEDEFİ', value: selectedPlan.items.reduce((acc, curr) => acc + (curr.targetQuantity || 0), 0) + ' ADET', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-theme-base border border-theme-border/50 p-2 rounded-xl flex items-center gap-4 group hover:border-theme/40 transition-all">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                          <stat.icon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-theme-main">{stat.value}</p>
                          <p className="text-[8px] font-bold text-theme-dim uppercase tracking-widest">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats Section 2: Active Day Summary */}
                <div className="space-y-4">
                  {/* Calculate unique personnel for the day */}
                  {(() => {
                    // Get unique operator list with their department info
                    const uniqueDayOps = Array.from(
                      new Map(activeDayItems.map(item => [item.operator?.fullName || Math.random().toString(), item.operator])).values()
                    ).filter(Boolean);

                    // Calculate department distribution
                    const deptDistribution: Record<string, number> = {};
                    uniqueDayOps.forEach(op => {
                      const dName = op.department?.name || 'Birim Belirtilmedi';
                      deptDistribution[dName] = (deptDistribution[dName] || 0) + 1;
                    });

                    const dayMachines = [...new Set(activeDayItems.filter(i => i.machine).map(i => i.machine?.code))];

                    return (
                      <>
                        <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">GÜNLÜK ÖZET</p>
                        <div className="bg-theme-primary/5 border border-theme-primary/10 rounded-xl p-3 space-y-5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Calendar size={80} />
                          </div>
                          <div className="relative">
                            <p className="text-[10px] font-black text-theme-primary uppercase mb-4 flex items-center gap-2">
                              <Activity size={14} /> BUGÜNÜN VERİLERİ
                            </p>
                            <div className="space-y-5">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-theme-dim uppercase">PERSONEL</span>
                                  <span className="text-xs font-black text-theme-main">{uniqueDayOps.length} PERSONEL</span>
                                </div>
                                {/* Department Breakdown */}
                                <div className="pl-3 space-y-1 border-l border-theme-primary/20">
                                  {Object.entries(deptDistribution).map(([dept, count]) => (
                                    <div key={dept} className="flex items-center justify-between opacity-70">
                                      <span className="text-[9px] font-bold text-theme-dim uppercase italic">{dept}</span>
                                      <span className="text-[10px] font-black text-theme-main">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-t border-theme-primary/10 pt-2">
                                <span className="text-[10px] font-bold text-theme-dim uppercase">MAKİNE</span>
                                <span className="text-xs font-black text-theme-main">{dayMachines.length} BİRİM</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Working Personnel List (Small) */}
                        <div className="space-y-4 pt-4">
                          <p className="text-[9px] font-black text-theme-dim uppercase tracking-[0.3em] opacity-40">GÜNÜN PERSONELLERİ</p>
                          <div className="space-y-2">
                            {uniqueDayOps.slice(0, 10).map((op, i) => (
                              <div key={i} className="flex items-center justify-between py-1 text-theme-main group/p">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-theme-primary/40 shrink-0 group-hover/p:bg-theme-primary transition-colors" />
                                  <span className="text-[10px] font-black truncate">{op?.fullName || 'Belirtilmedi'}</span>
                                </div>
                                <span className="text-[8px] font-bold text-theme-dim uppercase opacity-40 italic">{op?.department?.name || '—'}</span>
                              </div>
                            ))}
                            {uniqueDayOps.length > 10 && (
                              <p className="text-[9px] font-bold text-theme-dim italic ml-4 opacity-40">...ve {uniqueDayOps.length - 10} kişi daha</p>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-theme-surface/50 border-t border-theme/10 flex items-center justify-between backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-black text-theme-dim flex items-center gap-2">
                  <Users size={14} className="opacity-40" /> Toplam {selectedPlan.items.length} Atama
                </div>
                <button
                  onClick={exportToPDF}
                  disabled={loading}
                  className="text-[10px] font-black text-theme-dim flex items-center gap-2 hover:text-theme-primary transition-colors disabled:opacity-50"
                >
                  <Download size={14} className="opacity-40" /> PDF Dışa Aktar
                </button>
                <button
                  onClick={exportToImage}
                  disabled={loading}
                  className="text-[10px] font-black text-theme-dim flex items-center gap-2 hover:text-theme-primary transition-colors disabled:opacity-50"
                >
                  <Image size={14} className="opacity-40" /> Görsel İndir
                </button>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="h-10 px-6 py-2 bg-theme-main text-theme-base font-black text-xs uppercase rounded-xl shadow-xl hover:-translate-y-1 transition-all gorup hover:text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <BulkActionBar
        selectedCount={selectedIds.size}
        isEditing={isBulkEditing}
        onSave={() => setIsBulkEditing(false)}
        onEditToggle={setIsBulkEditing}
        onStatusUpdate={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        onCancel={() => {
          setSelectedIds(new Set());
          setIsBulkEditing(false);
        }}
      />
    </div>
  );
}

export default OvertimeList;
