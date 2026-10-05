import pathlib,json,zipfile,xml.etree.ElementTree as E,re,gzip,hashlib,collections,shutil
import sys
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'public/data/seshat/sources');out=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/seshat-rebuild');data=out/'data';(data/'polities').mkdir(parents=True,exist_ok=True);(out/'sources').mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest(); encode=lambda obj:json.dumps(obj,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
workbook=p/'Equinox_on_GitHub_June9_2022.xlsx';assert sha(workbook.read_bytes())=='48c7fbd00b6ebca4405d171e1d8e4fb2ea74a2fcd3edd0762e699e7d472f0556'
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(workbook) as z:
 ss=[''.join(si.itertext()) for si in E.fromstring(z.read('xl/sharedStrings.xml'))]
 def sheet(n):
  a=[]
  for row in E.fromstring(z.read(f'xl/worksheets/sheet{n}.xml')).findall('s:sheetData/s:row',ns):
   d={}
   for c in row:
    v=c.find('s:v',ns);v=v.text if v is not None else ''
    if c.get('t')=='s' and v:v=ss[int(v)]
    if v:d[re.sub('[0-9]','',c.get('r'))]=v
   if d:a.append((row.get('r'),d))
  h=a[0][1];return [dict({'_sourceRow':num},**{h.get(k,k):v for k,v in d.items()}) for num,d in a[1:]]
 observations=sheet(2);metadata=sheet(9)
assert len(observations)==47477;assert len({r['_sourceRow'] for r in observations})==47477
by=collections.defaultdict(list);meta=collections.defaultdict(list)
for row in observations:by[row['Polity']].append(row)
for row in metadata:meta[row['PolID']].append(row)
assert set(by)==set(meta)
index=[];files=[];reassembled=[]
for i,pid in enumerate(sorted(by)):
 rows=by[pid];m=meta[pid];file=f'polities/p{i:03d}.json.gz'
 raw=encode({'schemaVersion':1,'dataset':'seshat-equinox-2020-2022-06-09','polityId':pid,'sourceSheet':'Equinox2020_CanonDat','metadata':m,'observations':rows});gz=gzip.compress(raw,mtime=0)
 (data/file).write_bytes(gz);reassembled.extend(json.loads(gzip.decompress(gz))['observations'])
 index.append({'id':pid,'names':list(dict.fromkeys(x['PolName'] for x in m)),'regions':list(dict.fromkeys(x['World Region'] for x in m)),'samplingAreas':list(dict.fromkeys(x['NGA'] for x in m)),'periods':[{'startRaw':x['Start'],'endRaw':x['End'],'samplingArea':x['NGA'],'sourceRow':x['_sourceRow']} for x in m],'recordCount':len(rows),'variableCount':len({r['Variable'] for r in rows}),'explicitDateCount':sum(bool(x.get('Date.From') or x.get('Date.To')) for x in rows),'file':file,'bytes':len(gz),'sha256':sha(gz)})
 files.append({'file':file,'bytes':len(gz),'decodedBytes':len(raw),'sha256':sha(gz),'records':len(rows)})
reassembled.sort(key=lambda x:int(x['_sourceRow']));original=sorted(observations,key=lambda x:int(x['_sourceRow']));assert reassembled==original
manifest={'schemaVersion':1,'dataset':'seshat-equinox-2020-2022-06-09','title':{'zh':'社会、制度与知识的历史编码','en':'Historical coding of societies, institutions and knowledge'},'polityCount':len(index),'recordCount':len(observations),'variableCount':len({r['Variable'] for r in observations}),'polities':index}
global_bytes=gzip.compress(encode({'schemaVersion':1,'dataset':manifest['dataset'],'sourceSheet':'Equinox2020_CanonDat','observations':observations}),mtime=0)
(data/'search.json.gz').write_bytes(global_bytes)
manifest['searchFile']='search.json.gz';manifest['searchBytes']=len(global_bytes);manifest['searchSha256']=sha(global_bytes)
(data/'index.json').write_bytes(encode(manifest));(data/'index.json.gz').write_bytes(gzip.compress(encode(manifest),mtime=0))
for src,target in [('Equinox_on_GitHub_June9_2022.xlsx','Equinox_on_GitHub_June9_2022.xlsx'),('README-original.txt','README-original.txt'),('LICENSE-original.txt','LICENSE-original.txt'),('code-book-4.20.2021.pdf','code-book-4.20.2021.pdf')]:shutil.copyfile(p/src,out/'sources'/target)
provenance={'dataset':manifest['dataset'],'sourceURL':'https://github.com/seshatdb/Equinox_Data','workbookURL':'https://raw.githubusercontent.com/seshatdb/Equinox_Data/main/Equinox_on_GitHub_June9_2022.xlsx','downloadedOn':'2026-10-06','workbookSha256':sha(workbook.read_bytes()),'codebookURL':'https://seshatdatabank.info/sitefiles/code-book-4.20.2021.pdf','codebookSha256':sha((p/'code-book-4.20.2021.pdf').read_bytes()),'codebookRelevantPages':[6,7,8,9,12,13,14,15,16,17],'license':{'readme':'CC BY-NC-SA (version not specified in README)','repositoryFile':'LICENSE file contains CC0-1.0; declaration conflict with README retained. Do not relabel data CC0.','licenseURL':'https://raw.githubusercontent.com/seshatdb/Equinox_Data/main/LICENSE','licenseSha256':sha((p/'LICENSE-original.txt').read_bytes()),'application':'Reader code and source data have separate provenance.','personalUse':'Non-commercial datasets remain eligible for this personal research project.'},'transform':['Read original XLSX string values without numeric/date coercion.','Keep every populated canonical-sheet field, including exact source row number.','Group by original Polity ID; preserve every metadata row and repeated sampling-area association.','Ignore imputed and aggregate worksheets.','Gzip with mtime=0; no interpolation, entity joins or geometry.'],'timeSemantics':'Date.From/To are explicit source strings; absent observation dates remain absent. Polities sheet periods are coding context, not automatically exact lifespans.','geographySemantics':'NGA and World Region are source sampling contexts; no map boundaries or capital coordinates are derived.','evidenceLimits':'The workbook canonical sheet does not include the narrative coding justification or per-statement bibliography. Those require the original Seshat coding sheets.'}
(data/'provenance.json').write_bytes(encode(provenance))
report={'conserved':reassembled==original,'observationCount':len(original),'uniqueSourceRows':len({r['_sourceRow'] for r in original}),'polityShards':len(files),'metadataRows':len(metadata),'observedVariables':len({r['Variable'] for r in original}),'sourceRowsCanonicalSha256':sha(encode(original)),'reassembledRowsCanonicalSha256':sha(encode(reassembled)),'indexBytes':(data/'index.json').stat().st_size,'indexGzipBytes':(data/'index.json.gz').stat().st_size,'allRecordSearchGzipBytes':len(global_bytes),'allShardsGzipBytes':sum(f['bytes'] for f in files),'smallestShard':min(f['bytes'] for f in files),'largestShard':max(f['bytes'] for f in files),'files':files}
(out/'build-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
