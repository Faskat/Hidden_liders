@echo off
cd /d "%~dp0src\back"
if not exist .env copy .env.example .env
python -m pip install -r requirements.txt
python run.py
pause
