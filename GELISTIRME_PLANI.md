# Verimlilik Uygulaması – Geliştirme & Raporlar Yol Haritası

Tarih: **2026-03-24**

Bu doküman; mevcut uygulamanın (client + server) kod incelemesi üzerinden:
- geliştirilmesi gereken alanları,
- görsel/UX iyileştirmelerini,
- raporlar sistemini nasıl büyütebileceğimizi (yeni rapor türleri + altyapı),
- tespit edilen hataları ve riskleri,
- ve tüm bunları hayata geçirmek için **detaylı, adım adım bir planı**
toplar.

## Uygulanan İyileştirmeler (2026-03-24)
- Toplu üretim kaydı girişinde `plannedDowntimeMinutes` verisinin DB’ye **0** yazılması düzeltildi.
- Dashboard’da duruş metriği `downtimeSeconds` → `downtimeMinutes` uyumu sağlandı.
- `GET /api/production-records` uç noktası; `start/end` + `machineId/operatorId/productId/shiftId` filtrelerini destekleyecek şekilde genişletildi.
- Rapor sayfaları (`ReportsMachines/Products/Operators`) artık tarih aralığı + seçili varlık filtresiyle server’dan çekiyor (tüm kayıtları indirme yaklaşımı azaltıldı).
- Rapor sayfalarındaki export butonları çalışır hale getirildi (Excel indirme).
- `CustomSelect` çoklu kullanımda portal `id` çakışması riski kaldırıldı (ref tabanlı dış tıklama kontrolü).

---

## 1) Mevcut Durum Özeti (Gözlem)

### İstemci (client)
- React + Vite + Tailwind tabanlı modern bir UI var.
- Raporlar:
  - **/reports**: `client/src/pages/ReportsList.tsx` → PDF (html2pdf) + Excel indirme akışları.
  - **/reports/machines|products|operators**: `client/src/pages/reports/*` → “dashboard benzeri” rapor ekranları.
- Birçok ekranda veri çekme yaklaşımı: `api.get('/production-records')` ile **ham kayıtların tamamını** alıp tarayıcıda filtrelemek/hesaplamak.

### Sunucu (server)
- Express + Prisma (SQLite) + JWT.
- Üretim kayıtları: `server/src/routes/production-records.ts`
- Analitik uçları (trend/özet): `server/src/routes/analytics.ts`
- Raporlar (Excel export + template + bazı import akışları): `server/src/routes/reports.ts` ve ayrıca daha gelişmiş import: `server/src/routes/imports.ts`

---

## 2) Geliştirilmesi Gereken Alanlar (Ürün + Teknik)

### 2.1) Raporlar: ölçeklenebilirlik ve doğruluk
**Sorun:** Rapor ekranları çoğunlukla tüm kayıtları indirip tarayıcıda hesaplıyor. Veri büyüdükçe:
- performans düşer (yükleme süresi, bellek),
- aynı hesaplar farklı ekranlarda tekrar eder,
- raporlar “kurumsal” ihtiyaçlar için genişletilmesi zor hale gelir.

**Hedef:** Raporlamayı “ham kayıt listesi” mantığından çıkarıp:
- server-side filtreleme + agregasyon,
- yeniden kullanılabilir rapor tanımları,
- export/schedule/permission gibi kurumsal ihtiyaçlar
etrafında kurgulamak.

### 2.2) UI/UX: tutarlılık ve erişilebilirlik
- Rapor ekranlarında filtre barları ve aksiyonlar (export vb.) **tutarsız** (bazı ekranlarda ikon buton, bazılarında yazılı buton; quick-range yok/var).
- `CustomSelect` bileşeni görsel olarak iyi; ancak erişilebilirlik ve çoklu instance senaryolarında riskler var (aşağıda hata listesinde).

### 2.3) Tip güvenliği ve validasyon
- Client tarafında rapor ekranlarında çok fazla `any` kullanımı var (`client/src/pages/reports/*`).
- Server tarafında birçok route `req.body`’yi zod vb. ile doğrulamadan DB’ye yazabiliyor.

### 2.4) Mimari: veri çekme, cache, tekrarlar
- Aynı veriler birden fazla ekranda tekrar tekrar çekiliyor.
- “Rapor/analitik” hesapları hem client’ta hem server’da farklı şekillerde tekrar edebiliyor.

---

## 3) Görsel / UX İyileştirmeleri (Öneri Listesi)

### 3.1) Ortak “Rapor Filtre Bar” standardı
Tüm rapor ekranlarında aynı pattern:
- Tarih aralığı: “Son 7/14/30” + “Özel aralık”
- Boyut filtreleri: Makine / Ürün / Operatör / Vardiya
- Aksiyonlar: PDF, Excel, Paylaş, Zamanla (schedule)
- “Uygula / Sıfırla” davranışı (özellikle büyük raporlarda otomatik re-fetch yerine)

Öneri: `components/reports/ReportFiltersBar.tsx` gibi bir ortak bileşen.

### 3.2) Rapor ekranlarında bilgi mimarisi
Her rapor şu bloklardan oluşsun:
1) **KPI kartları** (özet)
2) **Trend** (zaman serisi)
3) **Kırılım** (ör. makine/operatör/ürün bazında)
4) **Detay tablo** (drill-down)

### 3.3) Boş durumlar + hata durumları + skeleton
- “Veri yok” durumlarında standardize boş-state
- API hatasında kullanıcıya anlaşılır mesaj
- Büyük raporlarda skeleton loading (spinner yerine)

### 3.4) Erişilebilirlik (A11y)
- `CustomSelect` için klavye ile gezinme, `role="combobox/listbox"`, `aria-*`
- Tablo başlıklarında sort durumlarının ekran okuyucuya iletilmesi

---

## 4) Raporlar Sistemini Geliştirme (Altyapı + Yeni Rapor Türleri)

### 4.1) Hedef Mimari (öneri)
**Tek amaç:** Rapor üretimini “tanımlı rapor → filtreler → server-side query → UI + export” hattına oturtmak.

Önerilen bileşenler:
- **Report Query API** (server): Parametreli ve agregasyon yapan uçlar
- **Report Definition** (DB): Kaydedilebilir rapor tanımları (mevcut `Report` modeli bu iş için kullanılabilir; `server/prisma/schema.prisma`)
- **Export Service**: Aynı query’nin Excel/PDF çıktısı
- **(Opsiyonel) Scheduler**: Günlük/haftalık rapor üretip e-posta/indirilebilir link

### 4.2) Server tarafında rapor uçları (öneri)
Mevcut yaklaşım:
- `GET /api/production-records` ham veri (şu an: filtre sınırlı; `server/src/routes/production-records.ts`)
- `GET /api/analytics/*` bazı agregasyonlar (`server/src/routes/analytics.ts`)

Önerilen yeni uçlar (örnek):
- `GET /api/reports/oee` → (time series) günlük/haftalık OEE + A/P/Q
- `GET /api/reports/machines/summary` → makine bazında KPI
- `GET /api/reports/operators/summary` → operatör bazında KPI
- `GET /api/reports/products/summary` → ürün bazında KPI
- `GET /api/reports/downtime/pareto` → duruş Pareto (neden alanı yoksa önce model genişletilir)
- `GET /api/reports/quality/pareto` → hata Pareto (qualityIssues alanı kullanılabilir)

Filtre standardı:
- `start`, `end` (yyyy-mm-dd)
- `machineId`, `operatorId`, `productId`, `shiftId` (opsiyonel)
- `groupBy` (day|week|month) gibi seçenekler

### 4.3) Yeni rapor türleri (eklenebilir backlog)

#### A) Operasyon & OEE
- **OEE Trend Drilldown**: Gün → vardiya → makine/ürün/operatör kırılımı
- **Vardiya Karşılaştırma**: Aynı gün içinde vardiyalar arası OEE/A/P/Q farkı
- **Kapasite Kullanımı**: planlanan kapasite vs gerçekleşen (plannedQuantity/üretim)

#### B) Duruş & Kayıp Analizi
Mevcut modelde “duruş nedeni” yok; eklenirse:
- **Duruş Pareto (80/20)** (neden bazlı)
- **MTBF/MTTR** (bakım/arıza logu gerekiyorsa ayrı tablo)

#### C) Kalite
Mevcut: `defectQuantity` ve `qualityIssues` alanı var.
- **Hata Pareto** (qualityIssues normalize edilirse)
- **First Pass Yield (FPY)** trendi
- Ürün/operatör/makine bazında kalite kıyas

#### D) Ürün & Planlama
- **Ürün Grubu Trendleri** (productGroup)
- **Ürün geçiş etkisi** (SMED için “ürün değişim” event’i lazım olabilir)

#### E) Yönetici / Yönetim Paneli
- “Haftalık Yönetici Özeti” (KPI + en iyi/en kötü + risk listesi)
- “Hedef / KPI takibi” (hedefler DB’de tutulursa)

### 4.4) Export stratejisi
Şu an:
- Excel export var (`server/src/routes/reports.ts`, `server/src/services/reportService.ts`)
- PDF: client-side html2pdf (`client/src/pages/ReportsList.tsx`)

Öneri:
- Excel export’u “report query” ile aynı kaynaktan besle (tek hesap/tek doğruluk).
- PDF için iki yol:
  1) Hızlı: client-side PDF (mevcut) → fakat büyük veride zor.
  2) Kurumsal: server-side PDF (Playwright/Puppeteer) → stabil ve tekrarlanabilir.

---

## 5) Tespit Edilen Hatalar / Riskler (Öncelikli)

### 5.1) Üretim kayıtlarında toplu girişte planlı duruş kaybı (kritik)
Dosya: `server/src/routes/production-records.ts`
- Toplu girişte `plannedDowntimeMinutes` hesaplamaya giriyor ama DB’ye **0** yazılıyor.
- Bu; OEE, downtime, shift-context ve rapor doğruluğunu bozar.

İlgili satırlar: `plannedDowntimeMinutes: 0` (bulk-entry create).

**Öneri:** DB’ye `plannedDowntimeMinutes` gerçek değeri yazılmalı.

### 5.2) Dashboard’da downtime alan adı uyumsuzluğu
Dosya: `client/src/pages/Dashboard.tsx`
- `downtimeSeconds` alanı kullanılıyor; server şeması `downtimeMinutes` içeriyor (`server/prisma/schema.prisma`).
- Sonuç: downtime KPI’sı yanlış/0 görünebilir.

### 5.3) CustomSelect portal id çakışması (çoklu instance riski)
Dosya: `client/src/components/common/CustomSelect.tsx`
- Portal container id sabit: `custom-select-portal`
- Aynı sayfada birden fazla select varsa DOM id çakışması ve “dış tıklama” kontrolünde yanlış eleman yakalanması riski oluşur.

**Öneri:** Her instance için benzersiz id (örn. `useId()`), dış tıklama kontrolünü ref bazlı yapmak.

### 5.4) “Export” butonları UX var ama işlev yok
Dosyalar:
- `client/src/pages/reports/ReportsMachines.tsx`
- `client/src/pages/reports/ReportsOperators.tsx`
- `client/src/pages/reports/ReportsProducts.tsx`

Butonlar görünüyor; ancak click handler yok (kullanıcıda beklenti oluşturur).

### 5.5) Güvenlik riskleri (ürünleşme için)
Dosyalar:
- `server/src/routes/auth.ts` (register açık; “admin only” yorumu var ama kontrol yok)
- `server/src/middleware/auth.ts` (JWT secret için fallback değer)
- `server/src/index.ts` (CORS origin fallback `*`)

**Öneri:** Prod ortamı için register kapatma/role guard, JWT secret zorunlu, CORS sıkılaştırma.

---

## 6) Geliştirme Yol Haritası (Fazlar + Öncelik)

Aşağıdaki plan “en hızlı değer” yaklaşımıyla düzenlendi.

### Faz 0 — Hızlı Kazanımlar (0–2 gün)
1) Kritik bug fix listesi:
   - Bulk-entry `plannedDowntimeMinutes` hatası (`server/src/routes/production-records.ts`)
   - Dashboard `downtimeSeconds` alanı (`client/src/pages/Dashboard.tsx`)
   - Export butonlarına en azından “yakında / plan gate / disabled” veya gerçek indirme bağlama
2) Rapor ekranlarında `/production-records` çağrılarına tarih aralığı parametresi ekleme (minimum data transfer).
3) Client tarafında raporlar için ortak tarih aralığı bileşeni (UI tutarlılığı).

**Kabul kriteri:** Büyük veri setinde rapor ekranları “tüm kayıtları” çekmeden çalışır; KPI’lar doğru.

### Faz 1 — Rapor Query API (1–2 hafta)
1) `GET /api/reports/*` uçlarını ekleme (machine/product/operator summary + trend).
2) Client rapor ekranlarını yeni uçlara geçirmek:
   - `ReportsMachines` → `machine summary + trend`
   - `ReportsOperators` → `operator summary`
   - `ReportsProducts` → `product summary`
3) API sözleşmesi + tipler:
   - Client’ta `any` azaltma (DTO tipleri)
   - Server’da zod ile query/body validasyonu

**Kabul kriteri:** Rapor ekranları server-side agregasyonla çalışır; ölçümler tek kaynaktan tutarlı.

### Faz 2 — Rapor Tanımları & Kaydet/Paylaş (2–3 hafta)
1) `Report` modelini aktif kullanma:
   - `reportType`, `filters` alanını JSON olarak standardize etme
2) “Raporu Kaydet”:
   - kullanıcı seçtiği filtreleri kaydeder
   - daha sonra tek tıkla çalıştırır
3) Basit paylaşım:
   - rol bazlı erişim
   - (opsiyonel) “salt okunur link”

### Faz 3 — Export & Scheduler (2–4 hafta)
1) Excel export’ları report query ile birleştirme (`server/src/services/reportService.ts` yeniden düzenleme).
2) PDF üretimi:
   - kısa vadede client-side PDF şablonlarını rapor tiplerine göre standardize etme
   - orta vadede server-side PDF (kurumsal)
3) Zamanlanmış raporlar:
   - günlük/haftalık
   - e-posta entegrasyonu (varsa)

---

## 7) Uygulama İçi Teknik İyileştirmeler (Genel)

### 7.1) Data fetching standardı
Seçenekler:
- Hafif: `useEffect + api` devam, ama ortak “fetch + error + abort” hook’u çıkar.
- Daha iyi: TanStack Query ile cache/refetch/invalidations.

### 7.2) Loglama & gözlemlenebilirlik
- Server log rotasyonu
- Request-id / correlation id
- Kritik rapor uçlarında performans metrikleri

### 7.3) Test stratejisi (minimum)
- Server: rapor query fonksiyonlarına unit test
- Client: kritik rapor sayfalarında smoke test

---

## 8) Önerilen “İlk Sprint” Görev Listesi (Detay)

1) Bulk-entry planlı duruş fix + regression kontrolü
2) Dashboard downtime alan fix
3) `ReportsMachines/Products/Operators` export butonlarını gerçek endpoint’lere bağlama (en az Excel) veya devre dışı bırakma
4) Raporlarda tarih filtresini API query parametreleriyle server’a taşıma
5) `CustomSelect` portal id çakışmasını düzeltme
6) Rapor Query API tasarımı + 1 adet örnek uç (örn. makine özeti) + client entegrasyonu

---

## 9) Notlar / Varsayımlar
- Veritabanı SQLite olduğu için rapor yükü büyürse Postgres’e geçiş değerlendirilmelidir.
- OEE modeli şu an “performance=100” varsayımıyla basitleştirilmiş (`server/src/services/oeeCalculator.ts`). Eğer “hız kaybı” raporlanacaksa model genişletilmeli.
