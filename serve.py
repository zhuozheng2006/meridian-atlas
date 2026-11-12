#!/usr/bin/env python3
"""Serve the atlas locally. Bundled layers work offline; fine online layers are optional."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import argparse, functools, gzip, hashlib, io, json, os, threading, webbrowser

# Text and MVT assets ship uncompressed on disk; gzip on the fly cuts wire size.
# HALC's largest z6 tile is 2.27 MB -> 1.16 MB without changing decoded bytes. Files that are
# already compressed (.gz/.br/.webp/...) are never re-encoded.
COMPRESSIBLE=('.js','.css','.html','.json','.geojson','.svg','.txt','.md','.xml','.webmanifest','.pbf')
COMPRESS_CACHE={}
COMPRESS_CACHE_MAX=64

def accepts_gzip(value):
    # An explicit gzip refusal overrides wildcard acceptance. Invalid quality
    # values are refusals; substring matching would wrongly accept gzip;q=0.
    codings={}
    for item in value.split(','):
        parts=[part.strip() for part in item.split(';')]
        if not parts[0]:continue
        quality=1.0
        for option in parts[1:]:
            if option.lower().startswith('q='):
                try:quality=float(option[2:])
                except ValueError:quality=0.0
                if not 0 <= quality <= 1:quality=0.0
        codings[parts[0].lower()]=quality
    return codings.get('gzip',codings.get('*',0)) > 0

class AtlasHandler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,
                    '.pbf':'application/vnd.mapbox-vector-tile'}
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
        body=gzip.compress(raw,6,mtime=0)
        if len(COMPRESS_CACHE)>=COMPRESS_CACHE_MAX:COMPRESS_CACHE.clear()
        COMPRESS_CACHE[key]=body
        return body

    def send_head(self):
        # Match the production Worker route without changing source asset paths.
        self.pinned_native=False
        route=urlsplit(self.path)
        if route.path.startswith('/__atlas-native/'):
            file=route.path[len('/__atlas-native/'):]
            manifest=json.loads((Path(self.directory)/'data/native/manifest.json').read_text())
            item=next((f for f in manifest['bootstrap'].values() if f['file']==file),None)
            if not item:
                self.send_error(404);return None
            if parse_qs(route.query).get('sha256')!=[item['gzipSha256']]:
                self.send_error(412);return None
            raw=(Path(self.directory)/'data/native'/file).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=item['gzipSha256']:
                self.send_error(503);return None
            self.pinned_native=True
            self.send_response(200)
            self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(len(raw)))
            self.end_headers()
            return io.BytesIO(raw)
        path=self.translate_path(urlsplit(self.path).path)
        compressible=os.path.isfile(path) and path.lower().endswith(COMPRESSIBLE)
        self.vary_encoding=compressible
        if (self.headers.get('Range') or not accepts_gzip(self.headers.get('Accept-Encoding',''))
                or not compressible or os.path.getsize(path)<1024):
            return super().send_head()
        try:body=self.compressed(path)
        except OSError:
            return super().send_head()
        self.send_response(200)
        self.send_header('Content-Type',self.guess_type(path))
        self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Last-Modified',self.date_time_string(os.stat(path).st_mtime))
        self.end_headers()
        # Standard GET copies this stream; HEAD closes it without sending a body.
        return io.BytesIO(body)

    def end_headers(self):
        if getattr(self,'pinned_native',False):self.send_header('Cache-Control','private, max-age=31536000, immutable')
        if getattr(self,'vary_encoding',False):self.send_header('Vary','Accept-Encoding')
        super().end_headers()

    def copyfile(self,source,outputfile):
        try:super().copyfile(source,outputfile)
        except (BrokenPipeError,ConnectionResetError):pass

def main():
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

if __name__=='__main__':main()
