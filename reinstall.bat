@echo off
CHCP 65001 > nul
echo Sosturer Task Reinstallation...
set TASK_NAME=Sosturer_Service
set SCRIPT_PATH=C:\Users\ZBook\Desktop\Sosturer\Sosturer.vbs
echo Deleting old task if exists...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
echo Creating new task...
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f
if %errorlevel% equ 0 (
    echo Task created successfully!
) else (
    echo Task creation failed with error code %errorlevel%
)
pause
