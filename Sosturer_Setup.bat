@echo off
CHCP 65001 > nul
title Sosturer Sistem Kurulumu

:: Yönetici kontrolü
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Yönetici yetkileri doğrulandı.
) else (
    echo [HATA] Lütfen bu dosyaya sağ tıklayıp "Yönetici Olarak Çalıştır" deyin!
    pause
    exit /b 1
)

echo.
echo [1/3] Güvenlik Duvarı İzinleri Tanımlanıyor (Port 3001)...
netsh advfirewall firewall delete rule name="Sosturer LAN" >nul 2>&1
netsh advfirewall firewall add rule name="Sosturer LAN" dir=in action=allow protocol=TCP localport=3001 profile=any description="Sosturer Ag Erisimi"

echo [2/3] Otomatik Başlatma Görevi Ayarlanıyor...
:: Eski görevi sil
schtasks /delete /tn "Sosturer_Service" /f >nul 2>&1
:: Yeni görevi oluştur (Açılışta çalışır)
schtasks /create /tn "Sosturer_Service" /tr "wscript.exe \"C:\Users\ZBook\Desktop\Sosturer\Sosturer.vbs\"" /sc onlogon /rl highest /f

echo [3/3] Sistem Başlatıcı Onarılıyor...
:: Sosturer.vbs dosyasının içindeki yolları doğrula (manuel müdahale gerekmez)

echo.
echo ========================================================
echo [BAŞARILI] Tüm ayarlar tamamlandı.
echo --------------------------------------------------------
echo Yerel IP Adresiniz:
ipconfig | findstr /i "IPv4"
echo --------------------------------------------------------
echo Ağdaki arkadaşlarınız şu adrese girebilir: http://[SizinIP]:3001
echo ========================================================
echo.
pause
