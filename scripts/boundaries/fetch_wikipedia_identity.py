import pathlib,json,urllib.request,urllib.parse,time
root=pathlib.Path(__file__).parent
fs=json.loads((root/'cliopatria.geojson').read_text())['features']
cache=root/'wikipedia-identities.json';known=json.loads(cache.read_text()) if cache.exists() else {}
titles=sorted({f['properties']['Wikipedia'] for f in fs if f['properties']['Wikipedia'] and f['properties']['Wikipedia'] not in known})
for k in range(0,len(titles),40):
 batch=titles[k:k+40]
 query={'action':'query','titles':'|'.join(batch),'prop':'pageprops|langlinks','ppprop':'wikibase_item','lllang':'zh','lllimit':'max','format':'json','redirects':'1'}
 url='https://en.wikipedia.org/w/api.php?'+urllib.parse.urlencode(query)
 result=None
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'WorldHistoryAtlasEducational/1.0 (read-only citation metadata audit)'})
   result=json.load(urllib.request.urlopen(req,timeout=35));break
  except Exception as e:
   print('retry',k,attempt,str(e),flush=True);time.sleep(15*(attempt+1))
 if result and 'query' in result:
  q=result['query'];renames={x['from']:x['to'] for x in q.get('normalized',[])+q.get('redirects',[])}
  pages={p['title']:p for p in q['pages'].values()}
  for title in batch:
   canonical=title
   seen=set()
   while canonical in renames and canonical not in seen:seen.add(canonical);canonical=renames[canonical]
   p=pages.get(canonical,{})
   known[title]={'canonicalTitle':canonical,'wikidata':p.get('pageprops',{}).get('wikibase_item'),'zhTitle':next((x['*'] for x in p.get('langlinks',[]) if x['lang']=='zh'),None),'missing':'missing' in p or not p,'source':'https://en.wikipedia.org/wiki/'+urllib.parse.quote(canonical.replace(' ','_'),safe='()_')}
  cache.write_text(json.dumps(known,ensure_ascii=False,separators=(',',':')))
  print('audited',len(known),'of',len(titles),flush=True)
 time.sleep(2)
print('DONE',len(known),flush=True)
