"""Work-only readable derivatives of 3.44 originals. Does not execute source JS.
Usage: python3 extract_texts.py /path/to/world-history-atlas
English documents follow existing saved-text schema. Separate Chinese paragraphs
and all four original language variants remain in review assets, not silently lost.
"""
import hashlib, importlib.util, json, pathlib, re, sys
from html.parser import HTMLParser

ROOT=pathlib.Path(sys.argv[1]).resolve(); HERE=pathlib.Path(__file__).resolve().parent
OUT=HERE/'offline';OUT.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
write=lambda p,v:p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
catalog=json.loads((HERE/'catalog.json').read_text())['cards']
sources=json.loads((HERE/'sources.json').read_text())['sources']
spec=importlib.util.spec_from_file_location('html_reader',ROOT/'scripts/extract_offline_texts.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

class Plain(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True);self.parts=[]
    def handle_data(self,data):self.parts.append(data)
    def handle_starttag(self,tag,attrs):
        if tag=='br':self.parts.append('\x00')
        elif tag in {'script','style','iframe','img','object'}:raise ValueError('Unexpected active/non-text content')
def plain(value):
    p=Plain();p.feed(value);p.close()
    return reader.normalized(''.join(p.parts))

def span(raw,a,b,kind):
    return dict(startByte=a,endByte=b,kind=kind,sha256=sha(raw[a:b]))

documents=[]
for s in sources:
    sid=s['sourceId'];raw=(HERE/s['acquisition']['file']).read_bytes();assert sha(raw)==s['sha256']
    cards=[c for c in catalog if c['sourceId']==sid];blocks=[];anchors=[];regions=[]
    if s['representation']=='original-javascript-data-bytes':
        chapter=int(sid.rsplit('-',1)[1]);expected=38 if chapter==16 else 12
        matches=list(re.finditer(rb'(?m)^(ChaptTitle|(?:eng|schin|pin|tchin)\[\d+\])\s*=\s*("(?:[^"\\]|\\.)*")\s*;',raw))
        assert len(matches)==1+expected*4
        assignments={m.group(1).decode():m for m in matches}
        chinese=[]
        for key in ['ChaptTitle']+[f'eng[{n}]' for n in range(1,expected+1)]:
            m=assignments[key];text=plain(json.loads(m.group(2).decode()))
            isTitle=key=='ChaptTitle';num=None if isTitle else int(re.search(r'\d+',key).group())
            b=dict(id=sid+('--title' if isTitle else f'--segment-{num:02d}'),
                type='heading' if isTitle else 'paragraph',role='article',text=text,textSha256=sha(text.encode()),
                sourceTag='javascript-string-literal',sourceAssignment=key,
                sourceSpans=[span(raw,m.start(2),m.end(2),'javascript-string-literal')])
            if isTitle:b.update(level=1,headingBasis='source-ChaptTitle-assignment')
            else:b.update(chapter=chapter,segment=num)
            blocks.append(b);regions.append(dict(startByte=m.start(),endByte=m.end(),sha256=sha(raw[m.start():m.end()]),role='article',blocks=1))
        for n in range(1,expected+1):
            m=assignments[f'schin[{n}]'];text=plain(json.loads(m.group(2).decode()))
            chinese.append(dict(chapter=chapter,segment=n,text=text,textSha256=sha(text.encode()),
                sourceAssignment=f'schin[{n}]',sourceSpans=[span(raw,m.start(2),m.end(2),'javascript-string-literal')]))
        write(OUT/f'{sid}.zh-Hans-review.json',dict(schemaVersion=1,sourceId=sid,language='zh-Hans',
            sourceSha256=s['sha256'],scope='Complete simplified-Chinese chapter text supplied by the edition, with no new translation or silent character correction.',paragraphs=chinese))
        starts={'gupta-faxian-tax-penalties--in_gupta_emp':[8,9,11,12],
                'gupta-faxian-monastic-deeds--in_gupta_emp':[19,20],
                'gupta-faxian-vinaya-manuscripts--in_gupta_emp':[1,2,3,9]}
        for c in cards:
            anchors.append(dict(readingId=c['id'],anchors=[dict(blockId=f'{sid}--segment-{n:02d}',
                sourceHeading=f'Chapter {chapter}, segment {n} (teaching edition)',locatorBasis='source-assignment-index') for n in starts[c['id']]]))
        normalization='JSON string literals decoded without evaluation; HTML tags removed; entities decoded; source whitespace collapsed and BR retained as newline; authored punctuation, bracketed notes and spelling retained.'
        scope={'includedLanguages':['eng'],'completeSegments':expected,'excludedLanguages':['schin','pin','tchin'],
            'alternateChineseFile':f'{sid}.zh-Hans-review.json',
            'allLanguageReviewFile':'../verification/faxian-segments.json',
            'reason':'English primary reading document; full simplified Chinese is separately supplied, while traditional Chinese and romanization remain traceable in the parsed review and raw originals.'}
    else:
        text=raw.decode();positions=reader.byte_map(text)
        start=text.index('<span class="H_Title">Modern History Sourcebook:')
        end=text.index('<hr />',text.index('© Paul Halsall June1998',start))
        r=reader.Reader(text,raw,start,end,'article',s['acquisition']['url'],positions);blocks=r.extract()
        assert not r.ignored
        for n,b in enumerate(blocks,1):b['id']=sid+'--b'+str(n).zfill(4)
        # The original document title uses malformed SPAN/H1 nesting. Retain the
        # text and trace its bytes; promote only this source title for navigation.
        assert 'Hernan Cortés: from Second Letter' in blocks[0]['text']
        blocks[0].update(type='heading',level=1,headingBasis='source-title-span')
        for c in cards:
            prefixes=['This city has many public squares','Every kind of merchandise'] if 'market-justice' in c['id'] else ['All the principle chiefs']
            targets=[]
            for prefix in prefixes:
                match=[b for b in blocks if b['text'].startswith(prefix)];assert len(match)==1
                targets.append(dict(blockId=match[0]['id'],sourceHeading=prefix,locatorBasis='source-paragraph-prefix'))
            anchors.append(dict(readingId=c['id'],anchors=targets))
        regions=[dict(startByte=positions[start],endByte=positions[end],sha256=sha(raw[positions[start]:positions[end]]),role='article-and-source-notes',blocks=len(blocks))]
        normalization='HTML entities decoded; source whitespace/NBSP collapsed; BR retained as newline; punctuation, spelling and bracketed notes retained.'
        scope={'selection':'Document title, complete acquired letter excerpt, attribution, usage notice and June 1998 copyright. Website navigation and generic project footer excluded.'}
    # Every card entry is navigable from the reader's select menu. These are
    # locator labels, not assertions that source paragraphs were headings.
    nav={b['id']:dict(id=b['id'],title=b['text'],level=b['level']) for b in blocks if b['type']=='heading'}
    for reading in anchors:
        for anchor in reading['anchors']:
            nav.setdefault(anchor['blockId'],dict(id=anchor['blockId'],title=anchor['sourceHeading'],level=2,
                anchorBasis=anchor['locatorBasis']))
    toc=[nav[b['id']] for b in blocks if b['id'] in nav]
    doc=dict(schemaVersion=1,sourceId=sid,language='en',readingIds=[c['id'] for c in cards],
        source=dict(url=s['acquisition']['url'],localURL=s['localURL'],sha256=s['sha256'],bytes=s['bytes'],encoding='utf-8',snapshot=s['version']),
        extraction=dict(algorithm='meridian-offline-3.44-candidate-v1',scriptSha256=sha(pathlib.Path(__file__).read_bytes()),
            helperScriptSha256=sha((ROOT/'scripts/extract_offline_texts.py').read_bytes()),regions=regions,
            offsetUnit='UTF-8 byte; start inclusive, end exclusive',normalization=normalization,
            execution='none',translation='none',scope=scope),
        readingAnchors=anchors,blocks=blocks,toc=toc,
        counts=dict(blocks=len(blocks),headings=sum(b['type']=='heading' for b in blocks),sourceNotes=sum(b['role']=='source-note' for b in blocks),characters=sum(len(b['text']) for b in blocks)))
    file=sid+'.json';write(OUT/file,doc)
    (OUT/(sid+'.txt')).write_text('\n\n'.join((f"[Chapter {b['chapter']}, segment {b['segment']}]\n" if 'segment' in b else '')+b['text'] for b in blocks)+'\n')
    documents.append(dict(sourceId=sid,file=file,sha256=sha((OUT/file).read_bytes()),bytes=(OUT/file).stat().st_size,readingIds=doc['readingIds'],source=doc['source'],counts=doc['counts']))
write(OUT/'index.json',dict(schemaVersion=1,algorithm='meridian-offline-3.44-candidate-v1',documents=documents))
print(json.dumps(documents,ensure_ascii=False))
