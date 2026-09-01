"""Lokální statický server pro vývoj — obdoba serve.js pro stroje bez Node.
   Spuštění:  python serve.py      →  http://localhost:5173
   Na ostro se složka soumrak/ nahraje na hosting (viz soumrak/README.md)."""

import http.server
import os
import socketserver

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'soumrak')
PORT = int(os.environ.get('PORT', 5173))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Vývojový server nesmí cachovat, jinak se změny neprojeví.
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'Soumrak bezi na http://localhost:{PORT}')
    httpd.serve_forever()
