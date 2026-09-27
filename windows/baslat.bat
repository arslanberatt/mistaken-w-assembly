@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Ders Akisi
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. Once su komutla kur, sonra bu dosyayi tekrar ac:
  echo   winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
node ders-akisi.mjs
pause
