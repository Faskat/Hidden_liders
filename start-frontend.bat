@echo off
cd /d "%~dp0src\front"
call npm install
call npm run dev
pause
