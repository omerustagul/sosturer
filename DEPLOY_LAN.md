# LAN kurulumu

Bu kurulumda uygulama tek bir Windows bilgisayarda calisir. Aga bagli diger bilgisayarlar tarayicidan ayni uygulamayi acar.

## Hizli kurulum

Repo kok dizininde `Setup_AutoStart.bat` dosyasina sag tiklayip **Yonetici olarak calistir**.

Bu kurulum:

- Client ve server production build alir.
- Windows Firewall uzerinde TCP `3005` portunu acar.
- `Sosturer_Server_AutoStart` adli gorevi olusturur.
- Yonetici olarak calistirilirsa bilgisayar acilisinda, oturum acilmadan SYSTEM ile baslatir.
- Yonetici degilse mevcut kullanici oturum actiginda baslatir.

## Manuel komut

```powershell
cd C:\dev\Sosturer
.\Install-SosturerAutoStart.ps1
```

## Erisim

Sunucu bilgisayarda:

```text
http://localhost:3005
```

Ayni agdaki diger bilgisayarlarda:

```text
http://SUNUCU_IP:3005
```

Bu bilgisayarda gorunen IP adreslerinden biri su olabilir:

```text
http://10.3.5.55:3005
http://192.168.1.111:3005
```

## Notlar

- Aktif port `server/.env` icindeki `PORT` degerinden okunur. Su an beklenen port `3005`.
- Backend `0.0.0.0` uzerinden dinler, bu nedenle LAN erisimine uygundur.
- Production UI `client/dist` klasorunden ayni backend portu uzerinden servis edilir.
- Log dosyasi: `logs\sosturer-server.log`
