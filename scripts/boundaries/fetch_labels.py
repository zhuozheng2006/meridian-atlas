import pathlib,json,urllib.request,urllib.parse,concurrent.futures,time,re
root=pathlib.Path(__file__).parent
fs=json.loads((root/'cliopatria.geojson').read_text())['features']
qids=sorted({f['properties']['Wikidata'] for f in fs if re.fullmatch(r'Q[1-9][0-9]*',f['properties']['Wikidata'])})
out=root/'wikidata-labels.json'
labels=json.loads(out.read_text()) if out.exists() else {}
qids=[q for q in qids if q not in labels]
batches=[qids[i:i+45] for i in range(0,len(qids),45)]
def fetch(batch):
 time.sleep(2.0)
 q=urllib.parse.urlencode({'action':'wbgetentities','ids':'|'.join(batch),'props':'labels','languages':'zh-hans|zh|zh-cn|zh-hant|en','format':'json'})
 url='https://www.wikidata.org/w/api.php?'+q
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'WorldHistoryAtlasEducational/1.0 (read-only labels; source attribution included)'})
   data=json.load(urllib.request.urlopen(req,timeout=35))
   if 'entities' not in data:raise ValueError(str(data)[:200])
   return data['entities']
  except Exception as e:
   if attempt==2:return {'_error':str(e),'_ids':batch}
   time.sleep(15*(attempt+1))
 return {}
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 for i,data in enumerate(pool.map(fetch,batches),1):
  if '_error' in data:print('ERROR',data,flush=True);continue
  for q,ent in data.items():
   ls=ent.get('labels',{});z=next((ls[k] for k in ['zh-hans','zh-cn','zh','zh-hant'] if k in ls),None)
   labels[q]={'zh':z['value'] if z else None,'zhLanguage':z['language'] if z else None,'en':ls.get('en',{}).get('value'),'source':'https://www.wikidata.org/wiki/'+q}
  out.write_text(json.dumps(labels,ensure_ascii=False,separators=(',',':')))
  print('BATCH',i,'of',len(batches),'labels',len(labels),flush=True)
print('DONE',len(labels),'zh',sum(bool(l['zh']) for l in labels.values()),'en',sum(bool(l['en']) for l in labels.values()),flush=True)
