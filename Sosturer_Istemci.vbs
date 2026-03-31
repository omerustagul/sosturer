Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- AYARLAR ---
' Buraya sunucu bilgisayarın IP adresini yazın (Örn: 192.168.1.10)
serverIp = "10.3.5.55"
port     = "3001"
' ---------------

appUrl = "http://" & serverIp & ":" & port

' Chrome'u uygula modunda açmak için konumları kontrol et
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

' Chrome bulunamazsa varsayılan tarayıcıda aç
If Not chromeLaunched Then
    sh.Run appUrl
End If
