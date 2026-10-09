"""Create byte-traceable offline English texts; downloaded HTML is never run.
Usage: python3 extract_texts.py /path/to/world-history-atlas
"""
import hashlib, importlib.util, json, pathlib, re, sys

ROOT=pathlib.Path(sys.argv[1]).resolve();HERE=pathlib.Path(__file__).resolve().parent
OUT=HERE/'offline';OUT.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
write=lambda path,value:path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
catalog=json.loads((HERE/'catalog.json').read_text())['cards']
sources=json.loads((HERE/'sources.json').read_text())['sources']
spec=importlib.util.spec_from_file_location('html_reader',ROOT/'scripts/extract_offline_texts.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
requested={
 'aksum-periplus-port-hinterland--et_aksum_emp_1':['4. Below Ptolemais'],
 'aksum-periplus-goods-exchange--et_aksum_emp_1':['6. There are imported'],
 'hawaii-constitution-legislation-records--us_hawaii_k':['Respecting the Representative Body.','Respecting the Meetings of the Legislative Body.'],
 'hawaii-constitution-tax-administration--us_hawaii_k':['Respecting the Tax Officers.'],
 'hawaii-constitution-courts-appeals--us_hawaii_k':['Of the Judges.','Of the Supreme Judges.'],
}
documents=[]
for source in sources:
 sid=source['sourceId'];raw=(HERE/source['acquisition']['file']).read_bytes();assert sha(raw)==source['sha256']
 text=raw.decode('utf-8');positions=reader.byte_map(text)
 if sid.startswith('periplus'):
  start=text.index('<h1 class="H_body_text"><span class="H_Title">Ancient History Sourcebook')
  end=text.index('</blockquote>',text.index('© Paul Halsall, October 2000',start))+len('</blockquote>')
  selections=[(start,end,'article')]
  scope='Complete acquired numbered text 1–66, document headings, source citation and source-specific educational/personal-use notice. General site navigation and footer are excluded.'
 else:
  titleStart=text.index('<h1><span class="title">Constitution of the Hawaiian Kingdom (1840)')
  titleEnd=text.index('</h1>',titleStart)+len('</h1>')
  start=text.index('<div class="media-render html"><h4>');end=text.index('</div>    </div>',start)
  selections=[(titleStart,titleEnd,'article'),(start,end,'article')]
  scope='Complete UNL transcribed declaration of rights, constitutional clauses, date and signatures. Title is retained; site navigation, repeated item metadata, JSON-LD and unrelated links are excluded. Original transcript editorial differences from the State Archives scan are recorded separately and not corrected in the body.'
 blocks=[];regions=[]
 for start,end,role in selections:
  r=reader.Reader(text,raw,start,end,role,source['acquisition']['url'],positions)
  b=r.extract();assert not r.ignored
  blocks+=b;regions.append(dict(startByte=positions[start],endByte=positions[end],sha256=sha(raw[positions[start]:positions[end]]),role=role,blocks=len(b)))
 for n,b in enumerate(blocks,1):b['id']=sid+'--b'+str(n).zfill(4)
 if sid.startswith('periplus'):
  numbered=[b for b in blocks if re.match(r'^\d+\. ',b['text'])]
  assert [int(re.match(r'^(\d+)\.',b['text'])[1]) for b in numbered]==list(range(1,67))
 cards=[c for c in catalog if c['sourceId']==sid];anchors=[]
 for c in cards:
  links=[]
  for prefix in requested[c['id']]:
   match=[b for b in blocks if b['text'].startswith(prefix)];assert len(match)==1,(c['id'],prefix)
   b=match[0];title=b['text'] if b['type']=='heading' else 'Section '+str(int(re.match(r'^(\d+)\.',b['text'])[1]))
   links.append(dict(blockId=b['id'],sourceHeading=title,locatorBasis='source-heading-tag' if b['type']=='heading' else 'source-numbered-paragraph'))
  anchors.append(dict(readingId=c['id'],anchors=links))
 nav={b['id']:dict(id=b['id'],title=b['text'],level=b['level']) for b in blocks if b['type']=='heading'}
 # All original numbered sections are navigable, without turning paragraphs into headings.
 if sid.startswith('periplus'):
  for b in numbered:nav[b['id']]=dict(id=b['id'],title='Section '+re.match(r'^(\d+)\.',b['text'])[1],level=2,anchorBasis='source-numbered-paragraph')
 for aset in anchors:
  for a in aset['anchors']:
   nav[a['blockId']]={**nav.get(a['blockId'],{}),**dict(id=a['blockId'],title=a['sourceHeading'],level=nav.get(a['blockId'],{}).get('level',2),anchorBasis=a['locatorBasis'])}
 toc=[nav[b['id']] for b in blocks if b['id'] in nav]
 doc=dict(schemaVersion=1,sourceId=sid,language='en',readingIds=[c['id'] for c in cards],
  source=dict(url=source['acquisition']['url'],localURL=source['localURL'],sha256=source['sha256'],bytes=source['bytes'],encoding='utf-8',snapshot=source['version']),
  extraction=dict(algorithm='meridian-offline-3.45-v1',scriptSha256=sha(pathlib.Path(__file__).read_bytes()),helperScriptSha256=sha((ROOT/'scripts/extract_offline_texts.py').read_bytes()),regions=regions,offsetUnit='UTF-8 byte; start inclusive, end exclusive',normalization='HTML entities decoded; source whitespace/NBSP collapsed; BR retained as newline. Authored words, spelling, punctuation and digital transcription variants retained.',execution='none',translation='none',scope={'selection':scope}),
  readingAnchors=anchors,blocks=blocks,toc=toc,
  counts=dict(blocks=len(blocks),headings=sum(b['type']=='heading' for b in blocks),sourceNotes=sum(b['role']=='source-note' for b in blocks),characters=sum(len(b['text']) for b in blocks)))
 file=sid+'.json';write(OUT/file,doc)
 (OUT/(sid+'.txt')).write_text('\n\n'.join(b['text'] for b in blocks)+'\n')
 documents.append(dict(sourceId=sid,file=file,sha256=sha((OUT/file).read_bytes()),bytes=(OUT/file).stat().st_size,readingIds=doc['readingIds'],source=doc['source'],counts=doc['counts']))
write(OUT/'index.json',dict(schemaVersion=1,algorithm='meridian-offline-3.45-v1',documents=documents))
print(json.dumps([{'sourceId':d['sourceId'],'counts':d['counts']} for d in documents]))
