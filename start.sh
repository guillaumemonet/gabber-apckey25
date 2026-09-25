#!/bin/sh
# Starts GabberKey on http://localhost:8025 (Web MIDI requires localhost or HTTPS).
cd "$(dirname "$0")"
URL=http://localhost:8025
( sleep 1; (command -v xdg-open >/dev/null && xdg-open "$URL") || (command -v open >/dev/null && open "$URL") ) >/dev/null 2>&1 &
exec python3 -m http.server 8025 --bind 127.0.0.1
