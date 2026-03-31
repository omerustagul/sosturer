Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- 2026-03-30 Update for Background Service ---
base     = fso.GetParentFolderName(WScript.ScriptFullName)
serverJs = base & "\server\dist\index.js"
nodePath = "C:\Program Files\nodejs\node.exe"

' 1. Port 3001'i kontrol et ve lazımsa temizle
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True

' 2. Sunucuyu arka planda başlat
' cd komutu .env ve veritabanı yolları için şarttır
If fso.FileExists(nodePath) Then
    sh.Run "cmd /c cd /d """ & base & "\server"" && """ & nodePath & """ dist/index.js", 0, False
Else
    ' Node.exe bulunamazsa path'den dene
    sh.Run "cmd /c cd /d """ & base & "\server"" && node dist/index.js", 0, False
End If
