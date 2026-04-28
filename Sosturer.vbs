Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base    = fso.GetParentFolderName(WScript.ScriptFullName)
appUrl  = "http://10.3.5.55:3005"
logFile = base & "\tmp_netstat.txt"

sh.Run "mshta.exe """ & base & "\Splash.hta""", 0, False

Dim isRunning : isRunning = False
sh.Run "cmd /c netstat -an | findstr :3005 | findstr LISTENING > """ & logFile & """", 0, True
If fso.FileExists(logFile) Then
    If fso.GetFile(logFile).Size > 5 Then isRunning = True
End If

If Not isRunning Then
    sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & base & "\Start-SosturerServer.ps1""", 0, False

    Dim i
    For i = 1 To 30
        WScript.Sleep 500
        sh.Run "cmd /c netstat -an | findstr :3005 | findstr LISTENING > """ & logFile & """", 0, True
        If fso.FileExists(logFile) Then
            If fso.GetFile(logFile).Size > 5 Then Exit For
        End If
    Next
End If

If fso.FileExists(logFile) Then fso.DeleteFile(logFile)
sh.Run "taskkill /f /im mshta.exe", 0, True

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
