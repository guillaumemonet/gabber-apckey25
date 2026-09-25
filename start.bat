@echo off
REM Starts GabberKey on http://localhost:8025 (Web MIDI requires localhost or HTTPS).
cd /d "%~dp0"
start "" http://localhost:8025
python -m http.server 8025 --bind 127.0.0.1
