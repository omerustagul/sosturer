# LAN (Ortak Ağ) Kurulumu

Bu kurulumda uygulama **tek bir sunucu bilgisayarda** çalışır; ağa bağlı diğer bilgisayarlar tarayıcıyla erişir.

## 1) Sunucu bilgisayar
- Aynı ağda herkesin erişebildiği bir PC/mini-server seçin.
- Mümkünse **sabit IP** verin (ör. `192.168.1.10`).
- Sunucuya Node.js kurun.

## 2) Kurulum (sunucuda)
Repo kök dizininde:

1) Bağımlılıklar
- `npm --prefix server ci`
- `npm --prefix client ci`

2) Veritabanı (ilk kurulum / şema)
- `npm --prefix server run db:push`
- (opsiyonel) `npm --prefix server run db:seed`

3) Build + çalıştır (LAN)
- `npm --prefix server run start:lan`

Bu komut:
- `client` production build alır (UI)
- `server` build alır
- server’ı başlatır ve **UI’yi de aynı porttan servis eder**

## 3) Port / Firewall
Varsayılan port: `3001`

Windows Defender Firewall’da inbound kuralı açın:
- TCP `3001`

## 4) Erişim (istemci bilgisayarlar)
Tarayıcıdan:
- `http://SUNUCU_IP:3001`
  - ör. `http://192.168.1.10:3001`

## 5) SQLite notu
- SQLite dosyası sunucuda **lokal** kalmalı (network share üzerinde kullanılmamalı).
- Yedek için `server/dev.db` (veya `.env` içindeki dosya) düzenli kopyalanmalıdır.

## 6) Ortam değişkenleri (öneri)
`server/.env` içinde en az:
- `DATABASE_URL="file:./dev.db"` (prod için ayrı dosya adı önerilir)
- `JWT_SECRET=...` (prod’da mutlaka değiştirin)
- `CORS_ORIGIN=*` (UI aynı origin’den servis edildiği için genelde sorun olmaz)

