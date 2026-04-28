param(
    [switch]$NoStart,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $Root "Start-SosturerServer.ps1"
$ServerDir = Join-Path $Root "server"
$ClientDir = Join-Path $Root "client"
$TaskName = "Sosturer_Server_AutoStart"
$Port = 3005

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-EnvPort {
    $envPath = Join-Path $ServerDir ".env"
    if (Test-Path $envPath) {
        $match = Get-Content $envPath | Where-Object { $_ -match '^\s*PORT\s*=\s*"?([^"#]+)"?\s*$' } | Select-Object -First 1
        if ($match -and ($match -match '^\s*PORT\s*=\s*"?([^"#]+)"?\s*$')) {
            return [int]$Matches[1].Trim()
        }
    }

    return 3005
}

$Port = Get-EnvPort
$IsAdmin = Test-IsAdmin

Write-Host ""
Write-Host "Sosturer LAN/AutoStart kurulumu basladi." -ForegroundColor Cyan
Write-Host "Klasor: $Root"
Write-Host "Port: $Port"
Write-Host ""

if (-not (Test-Path $StartScript)) {
    throw "Baslatma scripti bulunamadi: $StartScript"
}

if ($SkipBuild) {
    Write-Host "[1/4] Production build atlandi." -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Production build aliniyor..." -ForegroundColor Yellow
    npm --prefix $ClientDir run build
    if ($LASTEXITCODE -ne 0) {
        throw "Client build basarisiz oldu."
    }
    npm --prefix $ServerDir run build
    if ($LASTEXITCODE -ne 0) {
        throw "Server build basarisiz oldu."
    }
}

Write-Host "[2/4] Firewall kurali ayarlaniyor..." -ForegroundColor Yellow
if ($IsAdmin) {
    netsh advfirewall firewall delete rule name="Sosturer LAN" | Out-Null
    netsh advfirewall firewall add rule name="Sosturer LAN" dir=in action=allow protocol=TCP localport=$Port profile=any description="Sosturer LAN access" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Firewall kurali olusturulamadi."
    }
    Write-Host "Firewall kurali acildi: TCP $Port" -ForegroundColor Green
} else {
    Write-Host "Bu oturum yonetici degil. Firewall kurali icin Setup_AutoStart.bat dosyasini yonetici olarak calistirin." -ForegroundColor DarkYellow
}

Write-Host "[3/4] Windows otomatik baslatma gorevi ayarlaniyor..." -ForegroundColor Yellow
$TaskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartScript`""
$TaskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -Hidden `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

if ($IsAdmin) {
    $TaskTrigger = New-ScheduledTaskTrigger -AtStartup
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $TaskAction -Trigger $TaskTrigger -Principal $TaskPrincipal -Settings $TaskSettings -Force | Out-Null
    Write-Host "Gorev kuruldu: bilgisayar acilisinda SYSTEM ile baslar." -ForegroundColor Green
} else {
    $TaskTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $TaskAction -Trigger $TaskTrigger -Principal $TaskPrincipal -Settings $TaskSettings -Force | Out-Null
    Write-Host "Gorev kuruldu: bu kullanici oturum actiginda baslar." -ForegroundColor Green
}

Write-Host "[4/4] Su anki sunucu baslatiliyor..." -ForegroundColor Yellow
if (-not $NoStart) {
    Start-Process powershell.exe -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Hidden",
        "-File", "`"$StartScript`"",
        "-Restart"
    ) -WorkingDirectory $Root -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "Kurulum tamamlandi." -ForegroundColor Green
Write-Host "Bu bilgisayardan: http://localhost:$Port"
foreach ($ip in $ips) {
    Write-Host "Agdaki bilgisayarlardan: http://$ip`:$Port"
}
Write-Host ""
