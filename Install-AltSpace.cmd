@echo off
setlocal
title AltSpace Installer
echo ===========================================================
echo  AltSpace - One-Click Installer for Windows 10 / 11
echo ===========================================================
echo.
echo [*] Downloading and installing AltSpace from GitHub...
echo [*] Installing into %LOCALAPPDATA%\Programs\AltSpace
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; irm https://raw.githubusercontent.com/codecheesee/altspace/main/install.ps1 | iex"
if %ERRORLEVEL% equ 0 (
    echo.
    echo ===========================================================
    echo  [+] AltSpace installed and launched successfully!
    echo      Summon anytime with: Alt + Space (or Ctrl + Space)
    echo ===========================================================
) else (
    echo.
    echo [!] Installation encountered an issue. See details above.
)
echo.
pause
