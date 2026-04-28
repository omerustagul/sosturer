param(
    [switch]$Restart
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $Root "server"
$ServerJs = Join-Path $ServerDir "dist\index.js"
$EnvPath = Join-Path $ServerDir ".env"
$LogsDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogsDir "sosturer-server.log"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

function Write-SosturerLog {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    try {
        Add-Content -Path $LogFile -Value $line -ErrorAction Stop
    } catch {
        # The server process can hold the log file while it is writing. Logging must not block startup checks.
    }
}

function Get-SosturerPort {
    if (Test-Path $EnvPath) {
        $match = Get-Content $EnvPath | Where-Object { $_ -match '^\s*PORT\s*=\s*"?([^"#]+)"?\s*$' } | Select-Object -First 1
        if ($match -and ($match -match '^\s*PORT\s*=\s*"?([^"#]+)"?\s*$')) {
            return [int]$Matches[1].Trim()
        }
    }

    return 3005
}

$Port = Get-SosturerPort
Write-SosturerLog "Startup requested. Root=$Root Port=$Port Restart=$Restart"

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
    $FallbackNode = "C:\Program Files\nodejs\node.exe"
    if (Test-Path $FallbackNode) {
        $NodePath = $FallbackNode
    } else {
        Write-SosturerLog "ERROR: node.exe was not found."
        exit 1
    }
} else {
    $NodePath = $NodeCommand.Source
}

if (-not (Test-Path $ServerJs)) {
    Write-SosturerLog "ERROR: $ServerJs was not found. Run .\Install-SosturerAutoStart.ps1 first."
    exit 1
}

$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    if ($Restart) {
        $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $pids) {
            Write-SosturerLog "Stopping existing process on port $Port. PID=$processId"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    } else {
        $pidList = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
        Write-SosturerLog "Port $Port is already listening. Existing PID(s): $pidList. Nothing to start."
        exit 0
    }
}

Push-Location $ServerDir
try {
    Write-SosturerLog "Starting Sosturer with $NodePath $ServerJs"
    $env:NO_COLOR = "1"
    $env:FORCE_COLOR = "0"
    $env:NODE_DISABLE_COLORS = "1"
    $commandLine = "`"$NodePath`" `"$ServerJs`" >> `"$LogFile`" 2>&1"
    & cmd.exe /d /c $commandLine
    $exitCode = $LASTEXITCODE
    Write-SosturerLog "Sosturer process exited with code $exitCode"
    exit $exitCode
} finally {
    Pop-Location
}
