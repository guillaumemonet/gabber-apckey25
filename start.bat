@echo off
REM Starts GabberKey on http://localhost:8025 (Web MIDI requires localhost or HTTPS).
cd /d "%~dp0"
start "" http://localhost:8025
python tools\serve.py 8025
