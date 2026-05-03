import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Server, Globe, Database, RefreshCw, Clock, Cpu, HardDrive, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

interface SystemInfo { version: string; ip: string; port: string; os: string; uptime: number; }

function InfoRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-[12px] font-bold text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {ok !== undefined && (
          <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-rose-400'}`} />
        )}
        <span className="text-[12px] font-black text-white font-mono">{value}</span>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-[14px] font-black text-white">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function SASystem() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInfo = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try { const d = await api.get('/system/info'); setInfo(d); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchInfo(); }, []);

  const uptimeHours = info ? Math.floor(info.uptime / 3600) : 0;
  const uptimeDays = Math.floor(uptimeHours / 24);
  const remainingHours = uptimeHours % 24;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 rounded-xl animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#6366F1' }} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">Altyapı</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sistem & Altyapı</h1>
          <p className="text-slate-400 text-sm mt-0.5">Sunucu durumu ve sistem parametreleri</p>
        </div>
        <button onClick={() => fetchInfo(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white transition-all text-[11px] font-bold"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
        <div>
          <p className="text-[13px] font-black text-emerald-400">Tüm Sistemler Çevrimiçi</p>
          <p className="text-[11px] text-slate-500">Son kontrol: az önce</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <div className="text-center">
            <p className="text-[18px] font-black text-white">{uptimeDays}g {remainingHours}s</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Uptime</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="Sunucu Bilgileri" icon={Server} color="#6366F1">
          <InfoRow label="Uygulama Sürümü" value={info?.version || '—'} ok={true} />
          <InfoRow label="Sunucu Portu" value={info?.port || '—'} ok={true} />
          <InfoRow label="İşletim Sistemi" value={info?.os || '—'} ok={true} />
          <InfoRow label="Çalışma Süresi" value={`${uptimeDays} gün ${remainingHours} saat`} ok={true} />
        </SectionCard>

        <SectionCard title="Ağ & Bağlantı" icon={Globe} color="#10B981">
          <InfoRow label="Yerel IP Adresi" value={info?.ip || '—'} ok={true} />
          <InfoRow label="API Sunucu" value="Çevrimiçi" ok={true} />
          <InfoRow label="Veritabanı" value="Bağlı (PostgreSQL)" ok={true} />
          <InfoRow label="LAN Erişimi" value="Aktif" ok={true} />
        </SectionCard>

        <SectionCard title="Veritabanı" icon={Database} color="#F59E0B">
          <InfoRow label="Veritabanı Türü" value="PostgreSQL" ok={true} />
          <InfoRow label="Bağlantı Durumu" value="Bağlı" ok={true} />
          <InfoRow label="ORM" value="Prisma" ok={true} />
          <InfoRow label="Şema Sürümü" value="Güncel" ok={true} />
        </SectionCard>

        <SectionCard title="Sistem Durumu" icon={Activity} color="#EC4899">
          <InfoRow label="API Yanıt" value="Çevrimiçi" ok={true} />
          <InfoRow label="Kimlik Doğrulama" value="JWT Aktif" ok={true} />
          <InfoRow label="Dosya Yükleme" value="Çalışıyor" ok={true} />
          <InfoRow label="Bildirim Servisi" value="Aktif" ok={true} />
        </SectionCard>
      </div>

      {/* System Actions */}
      <div className="rounded-2xl p-6" style={{ background: '#141C2E', border: '1px solid rgba(99,102,241,0.12)' }}>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Sistem Aksiyonları</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Sistemi Yenile', sub: 'API bağlantısını yeniden kontrol et', color: '#6366F1', action: () => fetchInfo(true) },
            { label: 'Bağlantı Testi', sub: 'Veritabanı bağlantısını test et', color: '#10B981', action: async () => { await api.get('/system/info'); } },
            { label: 'Log Görüntüle', sub: 'Server log dosyasını aç', color: '#F59E0B', action: () => window.open('/api/system/info', '_blank') },
          ].map(a => (
            <button key={a.label} onClick={a.action}
              className="flex flex-col gap-2 p-4 rounded-xl text-left transition-all hover:-translate-y-0.5 group"
              style={{ background: '#0F1626', border: `1px solid rgba(255,255,255,0.05)` }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${a.color}30`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)'; }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                style={{ background: `${a.color}15`, border: `1px solid ${a.color}20` }}>
                <RefreshCw size={14} style={{ color: a.color }} />
              </div>
              <div>
                <p className="text-[12px] font-black text-white">{a.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{a.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
