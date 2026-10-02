#!/usr/bin/env python3
"""Serve the atlas locally. Bundled layers work offline; fine online layers are optional."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import argparse, functools, gzip, os, threading, webbrowser

# Text assets ship uncompressed on disk; gzip on the fly cuts the wire size about
# 3-4x (maplibre-gl.js 915 -> 241 KB, CSS ~75%, coverage.json -94%). Files that are
# already compressed (.gz/.br/.webp/...) are never re-encoded.
COMPRESSIBLE=('.js','.css','.html','.json','.geojson','.svg','.txt','.md','.xml','.webmanifest')
COMPRESS_CACHE={}
COMPRESS_CACHE_MAX=64

class AtlasHandler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keeps the connection alive. One year of native geometry is ~130 small
    # files and the fine detail layers are dozens more; with HTTP/1.0 each of them
    # needed a fresh TCP connection. SimpleHTTPRequestHandler always sends
    # Content-Length, so a keep-alive client can delimit every response.
    protocol_version='HTTP/1.1'
    timeout=65

    def compressed(self,path):
        stat=os.stat(path)
        key=(path,stat.st_mtime_ns,stat.st_size)
        hit=COMPRESS_CACHE.get(key)
        if hit is not None:return hit
        with open(path,'rb') as f:raw=f.read()
        body=gzip.compress(raw,6)
        if len(COMPRESS_CACHE)>=COMPRESS_CACHE_MAX:COMPRESS_CACHE.clear()
        COMPRESS_CACHE[key]=body
        return body

    def do_GET(self):
        path=self.translate_path(urlsplit(self.path).path)
        if (self.headers.get('Range') or 'gzip' not in self.headers.get('Accept-Encoding','')
                or not os.path.isfile(path) or os.path.getsize(path)<1024
                or not path.lower().endswith(COMPRESSIBLE)):
            return SimpleHTTPRequestHandler.do_GET(self)
        try:body=self.compressed(path)
        except OSError:
            return SimpleHTTPRequestHandler.do_GET(self)
        self.send_response(200)
        self.send_header('Content-Type',self.guess_type(path))
        self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Vary','Accept-Encoding')
        self.send_header('Last-Modified',self.date_time_string(os.stat(path).st_mtime))
        self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass

parser=argparse.ArgumentParser(description='Meridian Atlas local server')
parser.add_argument('--port',type=int,default=8766)
parser.add_argument('--open',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent/'public'
handler=functools.partial(AtlasHandler,directory=str(root))
try:
    server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
except OSError:
    parser.exit(1,f'Port {args.port} is busy. Use --port 8767, or open an existing atlas preview.\n')
server.daemon_threads=True
url=f'http://127.0.0.1:{args.port}/'
print(f'Meridian Atlas: {url}',flush=True)
if args.open:threading.Timer(.5,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
