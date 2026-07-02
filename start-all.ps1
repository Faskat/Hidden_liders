# Hidden Leaders — запуск сайта с бэкендом
# Запустите этот скрипт из папки Hidden_liders-main

$root = $PSScriptRoot
$back = Join-Path $root "src\back"
$front = Join-Path $root "src\front"

Write-Host "=== 1. Бэкенд (FastAPI) ===" -ForegroundColor Cyan
Set-Location $back
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
pip install -r requirements.txt
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$back'; python run.py"

Start-Sleep -Seconds 3

Write-Host "`n=== 2. Фронтенд (Next.js) ===" -ForegroundColor Cyan
Set-Location $front
npm install
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$front'; npm run dev"

Write-Host "`nГотово. Откроются 2 окна:" -ForegroundColor Green
Write-Host "  - Бэкенд: http://localhost:8000 (документация API: http://localhost:8000/docs)"
Write-Host "  - Сайт:   http://localhost:3000"
Set-Location $root
