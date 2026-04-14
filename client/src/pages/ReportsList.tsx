import { useState } from 'react';
import { api } from '../lib/api';
import { FileDown, FileText, Download, ClipboardList, BarChart3, Factory, Activity, Calendar, TrendingUp } from 'lucide-react';
import { CustomSelect } from '../components/common/CustomSelect';
import { Loading } from '../components/common/Loading';
import { useAuthStore } from '../store/authStore';

export function ReportsList() {
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState('production_records_excel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPdfType, setSelectedPdfType] = useState('performance');

  const downloadSelected = async () => {
    try {
      setLoading(true);
      const map: Record<string, { url: string; filename: string }> = {
        production_records_excel: { url: '/reports/excel/export', filename: 'Uretim_Kayitlari.xlsx' },
        production_template_excel: { url: '/reports/excel/template', filename: 'Uretim_Sablonu.xlsx' },
        machine_efficiency_excel: { url: '/reports/excel/machine-efficiency', filename: 'Makine_Verimlilik_Ozeti.xlsx' },
        oee_trend_excel: { url: '/reports/excel/oee-trend', filename: 'OEE_Trend.xlsx' },
      };
      const chosen = map[selectedReport] || map.production_records_excel;

      // Add date filters if provided
      let url = chosen.url;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      await api.download(url, chosen.filename);
    } catch (e) {
      alert('Veriler indirilemedi. Yetkiniz olmayabilir.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const recordsQuery = params.toString();
      const recordsEndpoint = `/production-records${recordsQuery ? `?${recordsQuery}` : ''}`;
      let records = await api.get(recordsEndpoint);
      const machines = await api.get('/machines');

      let element = document.createElement('div');
      const dateRangeText = startDate || endDate
        ? `(${startDate || 'BaÅŸlangÄ±Ã§'} - ${endDate || 'BitiÅŸ'})`
        : '';

      const summaryStats = {
        totalRecords: records.length,
        avgOee: records.length > 0 ? (records.reduce((sum: number, r: any) => sum + (r.oee || 0), 0) / records.length).toFixed(1) : '0',
        totalProduced: records.reduce((sum: number, r: any) => sum + (r.producedQuantity || 0), 0),
        totalDefects: records.reduce((sum: number, r: any) => sum + (r.defectQuantity || 0), 0),
        avgQuality: records.length > 0 ? (records.reduce((sum: number, r: any) => sum + (r.quality || 0), 0) / records.length).toFixed(1) : '0',
      };

      const getHeader = (title: string) => `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
          <div>
            <h1 style="margin: 0; color: #1e293b; font-size: 28px; font-weight: 900; letter-spacing: -1px;">${title}</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${company?.name || 'Sosturer'} Verimlilik YÃ¶netim Sistemi</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: 700; color: #1e293b;">TARÄ°H: ${new Date().toLocaleDateString('tr-TR')}</p>
            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">${dateRangeText}</p>
          </div>
        </div>
      `;

      const getSummaryCards = (cards: { label: string; value: string; color: string }[]) => `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
          ${cards.map(c => `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${c.label}</p>
              <p style="margin: 5px 0 0 0; color: ${c.color}; font-size: 20px; font-weight: 900;">${c.value}</p>
            </div>
          `).join('')}
        </div>
      `;

      let reportHTML = '';

      if (selectedPdfType === 'performance') {
        reportHTML = `
          <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #1e293b;">
            ${getHeader('ÃœRETÄ°M PERFORMANS ANALÄ°ZÄ°')}
            ${getSummaryCards([
          { label: 'TOPLAM KAYIT', value: String(summaryStats.totalRecords), color: '#3b82f6' },
          { label: 'ORTALAMA OEE', value: `%${summaryStats.avgOee}`, color: '#8b5cf6' },
          { label: 'TOPLAM ÃœRETÄ°M', value: summaryStats.totalProduced.toLocaleString(), color: '#10b981' },
          { label: 'KALÄ°TE ORANI', value: `%${summaryStats.avgQuality}`, color: '#f59e0b' }
        ])}
            
            <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 15px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
              <span style="width: 4px; height: 18px; background: #3b82f6; border-radius: 2px; display: inline-block;"></span>
              SON ÃœRETÄ°M AKIÅI (DETAYLI)
            </h3>
            
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">TARİH</th>
                  <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">MAKİNE</th>
                  <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">ÜRÜN</th>
                  <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">ÜRETİLEN</th>
                  <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">OEE</th>
                </tr>
              </thead>
              <tbody>
                ${records.slice(0, 25).map((r: any, idx: number) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 10px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9;">${new Date(r.productionDate).toLocaleDateString('tr-TR')}</td>
                    <td style="padding: 10px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${r.machine.code || '-'}</td>
                    <td style="padding: 10px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; color: #64748b;">${r.product.productCode || '-'}</td>
                    <td style="padding: 10px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: right;">${r.producedQuantity}</td>
                    <td style="padding: 10px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: ${r.oee >= 80 ? '#10b981' : r.oee >= 60 ? '#f59e0b' : '#ef4444'};">%${r.oee || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #f1f5f9; pt-20">
               <p style="font-size: 10px; color: #94a3b8; margin: 15px 0 0 0;">Bu rapor sistem tarafÄ±ndan otomatik olarak oluÅŸturulmuÅŸtur. &copy; 2024 SOSTURER</p>
            </div>
          </div>
        `;
      } else if (selectedPdfType === 'machine') {
        const machineStats = machines.map((m: any) => {
          const mRecords = records.filter((r: any) => r.machineId === m.id);
          const avgOee = mRecords.length > 0 ? (mRecords.reduce((sum: number, r: any) => sum + (r.oee || 0), 0) / mRecords.length).toFixed(1) : '0';
          const totalP = mRecords.reduce((sum: number, r: any) => sum + (r.producedQuantity || 0), 0);
          return { machine: m, recordCount: mRecords.length, avgOee, totalP };
        });

        reportHTML = `
          <div style="padding: 40px; font-family: 'Inter', sans-serif;">
            ${getHeader('MAKİNE VERİMLİLİK MATRİSİ')}
            ${getSummaryCards([
          { label: 'TOPLAM MAKİNE', value: String(machines.length), color: '#3b82f6' },
          { label: 'AKTİF ÇALIŞMA', value: String(machineStats.filter((s: any) => s.recordCount > 0).length), color: '#10b981' },
          { label: 'GENEL VERİM', value: `%${summaryStats.avgOee}`, color: '#8b5cf6' },
          { label: 'TOPLAM ADET', value: summaryStats.totalProduced.toLocaleString(), color: '#f59e0b' }
        ])}

            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #1e293b; color: white;">
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase;">MAKİNE KODU</th>
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase;">MAKİNE ADI</th>
                  <th style="padding: 15px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase;">TOPLAM ADET</th>
                  <th style="padding: 15px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase;">ORT. OEE</th>
                </tr>
              </thead>
              <tbody>
                ${machineStats.map((stat: any, idx: number) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 800; color: #3b82f6;">${stat.machine.code}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${stat.machine.name}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${stat.totalP.toLocaleString()}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 900; color: ${Number(stat.avgOee) >= 80 ? '#10b981' : '#ef4444'};">%${stat.avgOee}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else if (selectedPdfType === 'downtime') {
        const downtimeRecords = records.filter((r: any) => r.downtimeMinutes > 0);
        const totalDowntime = downtimeRecords.reduce((sum: number, r: any) => sum + (r.downtimeMinutes || 0), 0);

        reportHTML = `
          <div style="padding: 40px; font-family: 'Inter', sans-serif;">
            ${getHeader('DURUÅ VE KAYIP ANALÄ°ZÄ°')}
            ${getSummaryCards([
          { label: 'TOPLAM DURUÅ', value: `${totalDowntime} DK`, color: '#ef4444' },
          { label: 'DURUÅ SAYISI', value: String(downtimeRecords.length), color: '#f59e0b' },
          { label: 'SAAT CÄ°NSÄ°NDEN', value: `${(totalDowntime / 60).toFixed(1)} SA`, color: '#3b82f6' },
          { label: 'ORT. DURUÅ', value: `${downtimeRecords.length > 0 ? (totalDowntime / downtimeRecords.length).toFixed(0) : 0} DK`, color: '#6366f1' }
        ])}

            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #fef2f2;">
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; color: #991b1b;">TARİH</th>
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; color: #991b1b;">MAKİNE</th>
                  <th style="padding: 15px; text-align: right; font-size: 11px; font-weight: 800; color: #991b1b;">SÜRE (DK)</th>
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; color: #991b1b;">SEBEP / NOT</th>
                </tr>
              </thead>
              <tbody>
                ${downtimeRecords.slice(0, 30).map((r: any, idx: number) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fef2f2/30'};">
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #fee2e2;">${new Date(r.productionDate).toLocaleDateString('tr-TR')}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #fee2e2; font-weight: 600;">${r.machine.code || '-'}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #fee2e2; text-align: right; font-weight: 800; color: #ef4444;">${r.downtimeMinutes}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #fee2e2; color: #64748b;">${r.notes || 'Belirtilmedi'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else if (selectedPdfType === 'quality') {
        reportHTML = `
          <div style="padding: 40px; font-family: 'Inter', sans-serif;">
            ${getHeader('KALÄ°TE VE FÄ°RE ANALÄ°ZÄ°')}
            ${getSummaryCards([
          { label: 'TOPLAM ÃœRETÄ°M', value: summaryStats.totalProduced.toLocaleString(), color: '#3b82f6' },
          { label: 'TOPLAM HATALI', value: summaryStats.totalDefects.toLocaleString(), color: '#ef4444' },
          { label: 'KALÄ°TE SKORU', value: `%${summaryStats.avgQuality}`, color: '#10b981' },
          { label: 'FÄ°RE ORANI', value: `%${(100 - Number(summaryStats.avgQuality)).toFixed(1)}`, color: '#f59e0b' }
        ])}

            <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background: #f0fdf4;">
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; color: #166534;">TARÄ°H</th>
                  <th style="padding: 15px; text-align: left; font-size: 11px; font-weight: 800; color: #166534;">ÃœRÃœN KODU</th>
                  <th style="padding: 15px; text-align: right; font-size: 11px; font-weight: 800; color: #166534;">HATALI ADET</th>
                  <th style="padding: 15px; text-align: right; font-size: 11px; font-weight: 800; color: #166534;">KALÄ°TE %</th>
                </tr>
              </thead>
              <tbody>
                ${records.filter((r: any) => r.defectQuantity > 0).slice(0, 30).map((r: any, idx: number) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4/30'};">
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #dcfce7;">${new Date(r.productionDate).toLocaleDateString('tr-TR')}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #dcfce7; font-weight: 600;">${r.product.productCode || '-'}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #dcfce7; text-align: right; font-weight: 800; color: #ef4444;">${r.defectQuantity}</td>
                    <td style="padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #dcfce7; text-align: right; font-weight: 900; color: ${r.quality >= 95 ? '#10b981' : '#f59e0b'};">%${r.quality}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      element.innerHTML = reportHTML;

      const opt = {
        margin: 1,
        filename: `${selectedPdfType}_raporu_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in' as const, format: 'a4', orientation: 'portrait' as const }
      };

      const { default: html2pdf } = await import('html2pdf.js');
      html2pdf().from(element).set(opt).save();
    } catch (e) {
      console.error('PDF creation error:', e);
      alert('PDF oluÅŸturulurken hata meydana geldi!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 w-full space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-theme-main tracking-tighter uppercase">RAPORLAMA MERKEZİ</h2>
          <p className="text-theme-muted font-medium text-lg mt-2">İşletme verilerinizi farklı formatlarda dışa aktarın ve paylaşın.</p>
        </div>
      </div>

      {loading && <Loading fullScreen />}

      {/* Date Filter Section */}
      <div className="bg-theme-surface/40 backdrop-blur-3xl border border-theme rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-theme-primary" />
          <h3 className="text-xl font-black text-theme-main tracking-tight">TARİH FİLTRELEME</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-theme-dim uppercase tracking-wider mb-2 block">Başlangıç Tarihi</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-theme-surface border border-theme rounded-xl px-4 py-3 text-sm text-theme-main focus:border-theme-primary/50 transition-all font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-theme-dim uppercase tracking-wider mb-2 block">Bitiş Tarihi</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-theme-surface border border-theme rounded-xl px-4 py-3 text-sm text-theme-main focus:outline-none focus:border-theme-primary/50 transition-all font-bold"
            />
          </div>
        </div>
        {(startDate || endDate) && (
          <div className="mt-4 flex items-center gap-2 text-sm text-theme-primary font-bold">
            <Activity className="w-4 h-4" />
            <span>Filtre aktif: {startDate || 'Başlangıç'} - {endDate || 'Bitiş'}</span>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="ml-auto text-xs text-theme-dim hover:text-theme-main transition-colors"
            >
              Temizle
            </button>
          </div>
        )}
      </div>

      {/* Quick Report Picker */}
      <div className="bg-theme-surface/40 backdrop-blur-3xl border border-theme rounded-2xl p-8">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-black text-theme-main tracking-tight flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-theme-primary" /> Rapor Seç & İndir
            </h3>
            <p className="text-theme-muted text-sm mt-2 font-medium">İndirmek istediğiniz raporu seçin. (Excel raporları ham veri/özet; PDF raporları sunum içindir.)</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-end">
            <div className="w-full sm:w-[360px]">
              <CustomSelect
                options={[
                  { id: 'production_records_excel', label: 'Üretim Kayıtları (Excel)' },
                  { id: 'machine_efficiency_excel', label: 'Makine Verimlilik Özeti (Excel)' },
                  { id: 'oee_trend_excel', label: 'Günlük OEE Trend (Excel)' },
                  { id: 'production_template_excel', label: 'Üretim Excel Şablonu (Excel)' }
                ]}
                value={selectedReport}
                onChange={(val) => setSelectedReport(val)}
                searchable={false}
              />
            </div>
            <button
              onClick={downloadSelected}
              disabled={loading}
              className="bg-theme-primary hover:bg-theme-primary-hover text-white font-black px-6 py-3 rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-theme-primary/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              İNDİR
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-theme-surface/40 backdrop-blur-3xl border border-theme rounded-2xl p-10 flex flex-col justify-between group hover:border-theme-danger/50 transition-all duration-500 hover:shadow-2xl hover:shadow-theme-danger/10">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-theme-danger/10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
              <FileText className="w-10 h-10 text-theme-danger" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-theme-main tracking-tight">PDF ANALİZİ</h3>
              <p className="text-theme-muted font-medium mt-3 leading-relaxed">
                Farklı analiz türlerinde profesyonel PDF raporları oluşturun. Tarih filtreleme ile özelleştirin.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-4">
              {[
                { id: 'performance', title: 'Performans Raporu', desc: 'Genel OEE ve üretim performansı', icon: TrendingUp, color: 'text-rose-400' },
                { id: 'machine', title: 'Makine Bazlı Analiz', desc: 'Her makinenin detaylı performans özeti', icon: Factory, color: 'text-theme-primary' },
                { id: 'downtime', title: 'Duruş Analizi', desc: 'Duruş süreleri ve sebepleri', icon: Activity, color: 'text-amber-400' },
                { id: 'quality', title: 'Kalite Analizi', desc: 'Hatalı ürün ve kalite metrikleri', icon: BarChart3, color: 'text-emerald-400' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedPdfType(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${selectedPdfType === r.id ? 'bg-theme-surface border-theme-danger/40' : 'bg-theme-base/20 border-theme hover:bg-theme-surface hover:border-theme'
                    }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-theme-base/40 border border-theme flex items-center justify-center shrink-0">
                    <r.icon className={`w-5 h-5 ${r.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-theme-main font-black text-sm tracking-tight">{r.title}</p>
                    <p className="text-theme-muted text-xs font-medium mt-1">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-12">
            <button
              onClick={generatePDF}
              disabled={loading}
              className="w-full bg-theme-danger hover:bg-theme-danger-hover text-white font-black py-5 rounded-2xl flex justify-center items-center gap-3 transition-all shadow-xl shadow-theme-danger/30 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-6 h-6" />
              {loading ? 'HAZIRLANIYOR...' : 'RAPORU İNDİR (.PDF)'}
            </button>
          </div>
        </div>

        <div className="bg-theme-surface/40 backdrop-blur-3xl border border-theme rounded-2xl p-10 flex flex-col justify-between group hover:border-theme-success/50 transition-all duration-500 hover:shadow-2xl hover:shadow-theme-success/10">
          <div className="space-y-6">
            <div className="w-20 h-20 bg-theme-success/10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
              <FileDown className="w-10 h-10 text-theme-success" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-theme-main tracking-tight">EXCEL RAPORLARI</h3>
              <p className="text-theme-muted font-medium mt-3 leading-relaxed">
                Ham veri, makine özeti ve OEE trend gibi farklı Excel raporlarını seçerek indirebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-4">
              {[
                { id: 'production_records_excel', title: 'Üretim Kayıtları', desc: 'Tüm kayıtların ham verisi (XLSX).', icon: Factory, color: 'text-emerald-400' },
                { id: 'machine_efficiency_excel', title: 'Makine Verimlilik Özeti', desc: 'Makine bazlı üretim, duruş, OEE (XLSX).', icon: BarChart3, color: 'text-theme-primary' },
                { id: 'oee_trend_excel', title: 'Günlük OEE Trend', desc: 'Günlük ortalama OEE/KPI trendi (XLSX).', icon: Activity, color: 'text-theme-primary' },
                { id: 'production_template_excel', title: 'Üretim Excel Şablonu', desc: 'Toplu içe aktarma şablonu + referans kodlar (XLSX).', icon: ClipboardList, color: 'text-amber-400' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${selectedReport === r.id ? 'bg-theme-surface border-theme-success/40' : 'bg-theme-base/20 border-theme hover:bg-theme-surface hover:border-theme'
                    }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-theme-base/40 border border-theme flex items-center justify-center shrink-0">
                    <r.icon className={`w-5 h-5 ${r.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-theme-main font-black text-sm tracking-tight">{r.title}</p>
                    <p className="text-theme-muted text-xs font-medium mt-1">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-12">
            <button
              onClick={downloadSelected}
              disabled={loading}
              className="w-full bg-theme-success hover:bg-theme-success-hover text-white font-black py-5 rounded-2xl flex justify-center items-center gap-3 transition-all shadow-xl shadow-theme-success/30 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-6 h-6" />
              {loading ? 'HAZIRLANIYOR...' : 'SEÇİLİ RAPORU İNDİR (.XLSX)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsList;
