@echo off
CHCP 65001 > nul
title Sosturer Otomatik Başlatma Kurulumu

:: Yönetici kontrolü
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [HATA] Lütfen bu dosyaya sağ tıklayıp "Yönetici Olarak Çalıştır" deyin!
    pause
    exit /b 1
)

set "base=%~dp0"
set "vbsPath=%base%Sosturer_Startup.vbs"

echo.
echo [1/2] Güvenlik Duvarı İzinleri Kontrol Ediliyor...
netsh advfirewall firewall delete rule name="Sosturer LAN" >nul 2>&1
netsh advfirewall firewall add rule name="Sosturer LAN" dir=in action=allow protocol=TCP localport=3005 profile=any description="Sosturer Ag Erisimi"

echo [2/2] Sunucu Görevi Ayarlanıyor (Bilgisayar Açılışında)...
:: Eski görevleri temizle
schtasks /delete /tn "Sosturer_Service" /f >nul 2>&1
schtasks /delete /tn "Sosturer_Server_AutoStart" /f >nul 2>&1

:: Yeni görevi oluştur (Açılışta çalışır, şifre sormaz)
:: /ru SYSTEM ile her açılışta login olmadan çalışır
schtasks /create /tn "Sosturer_Server_AutoStart" /tr "wscript.exe \"%vbsPath%\"" /sc onstart /ru SYSTEM /rl highest /f

echo.
echo ========================================================
echo [BAŞARILI] Tüm ayarlar tamamlandı.
echo --------------------------------------------------------
echo Yerel IP Adresiniz:
ipconfig | findstr /i "IPv4"
echo --------------------------------------------------------
echo Bilgisayar her açıldığında Sosturer sunucusu (3005) 
echo otomatik olarak arka planda başlayacaktır.
echo ========================================================
echo.
pause
