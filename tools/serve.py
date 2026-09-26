"""Local web server for GabberKey (Web MIDI requires localhost or HTTPS).

Unlike `python -m http.server`, it tells the browser to always revalidate files,
so updated code and sound banks show up on a simple reload, and it forces the
right MIME types (Windows can map .js to text/plain, which breaks JS modules).

Usage: python tools/serve.py [port]   (default port: 8025)
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8025


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.flac': 'audio/flac',
        '.wav': 'audio/wav',
        '.apckit': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass   # silencieux : seules les erreurs du serveur s'affichent


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler) as httpd:
        print(f'GabberKey: http://localhost:{PORT}  (Ctrl+C to stop)')
        httpd.serve_forever()
