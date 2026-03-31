Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- SON GÜNCELLEME: 27.03.2026 / 11:15 ---
base     = fso.GetParentFolderName(WScript.ScriptFullName)
serverJs = base & "\server\dist\index.js"
' Burayı yerel ağ IP'niz ile güncelledim:
appUrl   = "http://10.3.5.55:3001"
logFile  = base & "\tmp_netstat.txt"

' ---- Sosturer Başlatılıyor Modern Splash ----
sh.Run "mshta.exe """ & base & "\Splash.hta""", 0, False

' ---- Sunucu durumunu kontrol et ----
Dim isRunning : isRunning = False
sh.Run "cmd /c netstat -an | findstr :3001 | findstr LISTENING > """ & logFile & """", 0, True
If fso.FileExists(logFile) Then
    If fso.GetFile(logFile).Size > 5 Then isRunning = True
End If

If Not isRunning Then
    ' ---- Port 3001'deki eski süreci öldür (GİZLİ) ----
    sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
    WScript.Sleep 500
    ' ---- Sunucuyu başlat (GİZLİ) ----
    sh.Run "cmd /c cd /d """ & base & "\server"" && ""C:\Program Files\nodejs\node.exe"" dist\index.js", 0, False
    
    ' ---- Port açılana kadar GİZLİ bekle (max 15 sn) ----
    Dim i
    For i = 1 To 30
        WScript.Sleep 500
        sh.Run "cmd /c netstat -an | findstr :3001 | findstr LISTENING > """ & logFile & """", 0, True
        If fso.FileExists(logFile) Then
            If fso.GetFile(logFile).Size > 5 Then Exit For
        End If
    Next
End If

' Geçici log dosyasını sil ve splash'ı kapat
If fso.FileExists(logFile) Then fso.DeleteFile(logFile)
sh.Run "taskkill /f /im mshta.exe", 0, True

' ---- Tarayıcıyı uygulama modunda aç ----
Dim chromePaths(4)
chromePaths(0) = "C:\Program Files\Google\Chrome\Application\chrome.exe"
chromePaths(1) = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
chromePaths(2) = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
chromePaths(3) = sh.ExpandEnvironmentStrings("%PROGRAMFILES%") & "\Google\Chrome\Application\chrome.exe"
chromePaths(4) = sh.ExpandEnvironmentStrings("%PROGRAMFILES(X86)%") & "\Google\Chrome\Application\chrome.exe"

Dim chromeLaunched : chromeLaunched = False
Dim j
For j = 0 To 4
    If fso.FileExists(chromePaths(j)) Then
        sh.Run """" & chromePaths(j) & """ --app=" & appUrl & " --window-size=1400,900", 1, False
        chromeLaunched = True
        Exit For
    End If
Next

If Not chromeLaunched Then sh.Run appUrl
