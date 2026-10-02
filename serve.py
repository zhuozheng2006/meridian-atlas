#!/usr/bin/env python3
"""Serve the atlas locally. Bundled layers work offline; fine online layers are optional."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, functools, threading, webbrowser
parser=argparse.ArgumentParser(description='Meridian Atlas local server')
parser.add_argument('--port',type=int,default=8766)
parser.add_argument('--open',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent/'public'
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(root))
try:
    server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
except OSError:
    parser.exit(1,f'Port {args.port} is busy. Use --port 8767, or open an existing atlas preview.\n')
url=f'http://127.0.0.1:{args.port}/'
print(f'Meridian Atlas: {url}',flush=True)
if args.open:threading.Timer(.5,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
