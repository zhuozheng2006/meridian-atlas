#!/usr/bin/env python3
"""Download or verify a frozen place-data snapshot without accepting source drift."""
import argparse, concurrent.futures, hashlib, json, pathlib, time, urllib.request

HERE=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input-dir',type=pathlib.Path,required=True)
parser.add_argument('--manifest',type=pathlib.Path,default=HERE/'input-manifest.json')
parser.add_argument('--verify-only',action='store_true',help='Check local files without any network request.')
group=parser.add_mutually_exclusive_group()
group.add_argument('--datasets-only',action='store_true')
group.add_argument('--entities-only',action='store_true')
parser.add_argument('--workers',type=int,default=2,choices=range(1,5))
parser.add_argument('--report',type=pathlib.Path)
args=parser.parse_args();root=args.input_dir.resolve();root.mkdir(parents=True,exist_ok=True)
manifest=json.loads(args.manifest.read_text())
headers={'User-Agent':'MeridianHistoryAtlas/1.0 (public historical-place snapshot rebuild)'}

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def verify(path,item,entity=False):
    if entity:
        e=json.loads(path.read_text())['entities'][item['qid']]
        if e.get('lastrevid')!=item['revision']:raise ValueError('Wikidata revision differs from lock')
        actual=hashlib.sha256(json.dumps(e,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        expected=item['canonicalEntitySha256']
    else:
        actual=sha(path);expected=item['sha256']
    if actual!=expected:raise ValueError(f'Frozen SHA-256 mismatch for {path.name}; source drift must be reviewed, not silently accepted')

def fetch_one(item,entity=False):
    name=f"wikidata-cities/{item['qid']}.json" if entity else item['name']
    path=root/name
    try:
        if path.exists():
            verify(path,item,entity);return {'name':name,'status':'verified-cache'}
        if args.verify_only:raise FileNotFoundError(name)
        path.parent.mkdir(parents=True,exist_ok=True)
        temporary=path.with_name(path.name+'.partial')
        for attempt in range(3):
            try:
                request=urllib.request.Request(item['url'],headers=headers)
                with urllib.request.urlopen(request,timeout=60) as response,temporary.open('wb') as output:
                    while True:
                        chunk=response.read(1024*1024)
                        if not chunk:break
                        output.write(chunk)
                verify(temporary,item,entity)
                temporary.replace(path)
                return {'name':name,'status':'downloaded-and-verified'}
            except Exception:
                temporary.unlink(missing_ok=True)
                if attempt==2:raise
                time.sleep(attempt+1)
    except Exception as error:return {'name':name,'status':'failed','error':str(error)}

results=[]
if not args.entities_only:
    for item in manifest['sourceFiles']:results.append(fetch_one(item))
if not args.datasets_only:
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results.extend(pool.map(lambda item:fetch_one(item,True),manifest['wikidataCities']))
report={'schemaVersion':1,'verified':sum(r['status']!='failed' for r in results),'failed':[r for r in results if r['status']=='failed'],'results':results}
if args.report:args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False,indent=2))
raise SystemExit(bool(report['failed']))
