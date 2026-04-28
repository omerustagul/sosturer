@echo off
CHCP 65001 > nul
title Sosturer Otomatik Baslatma Kurulumu

set "base=%~dp0"
set "installScript=%base%Install-SosturerAutoStart.ps1"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] Yonetici yetkisi isteniyor...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%installScript%""'"
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%installScript%"
pause
