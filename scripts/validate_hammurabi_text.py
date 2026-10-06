#!/usr/bin/env python3
"""Independent archived-byte/visible-text coverage audit; no generator logic reused."""
from html import unescape
from html.parser import HTMLParser
import copy,hashlib,json,pathlib,re,subprocess,sys
HERE=pathlib.Path(__file__).resolve().parent
REPO=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else HERE.parent
DATA=REPO/'public/data/research-evidence/reading-texts-3.43'
ARCHIVE=REPO/'public/data/research-evidence/readings-3.43'
sha=lambda b:hashlib.sha256(b).hexdigest()
flat=lambda s:re.sub(r'\s+',' ',s).strip()
raw=(ARCHIVE/'sources/hammurabi-king-yale.html.txt').read_bytes()
text=raw.decode('utf-8')
doc=json.loads((DATA/'hammurabi-king-yale.json').read_text())
checks=[]
def check(name,fn):
    try: detail=fn();checks.append({'name':name,'passed':True,'detail':detail})
    except Exception as e:checks.append({'name':name,'passed':False,'detail':str(e)})

class Visible(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.parts=[];self.hidden=0;self.anchors=[]
    def handle_starttag(self,tag,attrs):
        if tag in {'script','style','iframe','object','embed','noscript','template'}:self.hidden+=1
        if not self.hidden:
            if tag in {'p','h1','h2','h3','h4','h5','h6','li','td','blockquote','pre','br','div'}:self.parts.append(' ')
            if tag=='a':self.anchors.append(dict(attrs).get('href'))
    def handle_endtag(self,tag):
        if tag in {'script','style','iframe','object','embed','noscript','template'}:self.hidden=max(0,self.hidden-1)
        if not self.hidden and tag in {'p','h1','h2','h3','h4','h5','h6','li','td','blockquote','pre','div'}:self.parts.append(' ')
    def handle_data(self,data):
        if not self.hidden:self.parts.append(data)

def visible(fragment):
    p=Visible();p.feed(fragment);return flat(''.join(p.parts))

start=text.index('<div class="document-title">')
end=text.index('<DIV ALIGN="center"><TABLE BORDER=1 CELLPADDING=5>',text.index('<H3>THE EPILOGUE</H3>'))
article=text[start:end];copyright=re.search(r'<div class="Copyright">.*?</div>',text,re.S).group()
expected=flat(visible(article)+' '+visible(copyright))

def source_identity():
    assert sha(raw)=='93410a95441d28fd498df423ec7860ae5ee821df3811989bb469838075c9eb12'
    assert len(raw)==74531==doc['source']['bytes'];assert doc['source']['sha256']==sha(raw)
    idx=next(x for x in json.loads((DATA/'index.json').read_text())['documents'] if x['sourceId']=='hammurabi-king-yale');data=(DATA/'hammurabi-king-yale.json').read_bytes()
    assert idx['sha256']==sha(data) and idx['bytes']==len(data);assert idx['counts']==doc['counts']
    return {'originalBytes':len(raw),'derivedBytes':len(data),'derivedSha256':sha(data)}
check('pinned-source-and-output-manifest',source_identity)

def rebuild_blocks():
    count=0
    for b in doc['blocks']:
        chunks=[]
        for s in b['sourceSpans']:
            x,y=s['startByte'],s['endByte'];assert 0<=x<y<=len(raw)
            part=raw[x:y];assert sha(part)==s['sha256'];chunks.append('\0' if s['kind']=='break' else unescape(part.decode()));count+=1
        recovered='\n'.join(flat(p) for p in ''.join(chunks).split('\0')).strip()
        assert recovered==b['text'],b['id'];assert sha(b['text'].encode())==b['textSha256']
    return {'sourceSpansVerified':count}
check('every-block-reconstructs-from-original-utf8-bytes',rebuild_blocks)

def coverage(candidate=doc):
    actual=flat(' '.join(b['text'] for b in candidate['blocks']))
    assert actual==expected,'Independent visible text differs'
    return {'normalizedCharacters':len(expected),'normalizedSha256':sha(expected.encode()),'omittedCharacters':0,'extraCharacters':0}
check('independent-full-visible-article-and-notice-coverage',coverage)

def regions():
    assert len(doc['extraction']['regions'])==2
    for r in doc['extraction']['regions']:
        assert sha(raw[r['startByte']:r['endByte']])==r['sha256']
    for b in doc['blocks']:
        last=-1
        for s in b['sourceSpans']:
            assert any(r['startByte']<=s['startByte']<s['endByte']<=r['endByte'] for r in doc['extraction']['regions'])
            assert last<=s['startByte'];last=s['endByte']
    return None
check('source-spans-are-monotone-and-inside-reviewed-regions',regions)

lawraw=article.split('<H3>CODE OF LAWS</H3>',1)[1].split('<H3>THE EPILOGUE</H3>',1)[0]
lawfragments=re.findall(r'<P>\s*(.*?)(?=<P>|<HR>|$)',lawraw,re.I|re.S)
lawtexts=[visible(t) for t in lawfragments]
numbers=[int(re.match(r'^(\d+)(?:\.|\s)',s).group(1)) for s in lawtexts]
lawblocks=[b for b in doc['blocks'] if b['type']=='paragraph' and re.match(r'^\d+(?:\.|\s)',b['text'])]

def all_laws():
    assert len(lawfragments)==247==len(lawblocks)
    assert [b['text'] for b in lawblocks]==lawtexts
    assert len(set(numbers))==247 and numbers==sorted(numbers)
    assert doc['numbering']['presentNumbers']==numbers
    missing=sorted(set(range(1,283))-set(numbers));assert missing==[13]+list(range(66,100))
    assert doc['numbering']['absentNumbersWithin1To282']==missing
    assert doc['numbering']['reconstructedClauses']==0
    return {'lawParagraphs':247,'first':numbers[0],'last':numbers[-1],'absentNumbers':missing,'numberOrderPreserved':True}
check('all-247-existing-law-paragraphs-with-exact-number-gaps',all_laws)

def gaps_and_damage():
    by={n:t for n,t in zip(numbers,lawtexts)}
    assert 'Here a portion of the text is missing, apparently comprising thirty-four paragraphs.' in by[65]
    assert by[100].startswith('100. . . . interest')
    assert by[229].startswith('229 If a builder') and not by[229].startswith('229.')
    assert by[262]=='262. If any one, a cow or a sheep . . .'
    assert doc['numbering']['undottedNumbers']==[229]
    return {'preservedCases':[65,100,229,262]}
check('source-lacunae-and-undotted-229-not-repaired',gaps_and_damage)

def prologue_epilogue():
    b=doc['blocks'];code=next(i for i,x in enumerate(b) if x['text']=='CODE OF LAWS');epi=next(i for i,x in enumerate(b) if x['text']=='THE EPILOGUE')
    assert [x['type'] for x in b[:2]]==['heading','heading']
    assert b[0]['text']=='The Code of Hammurabi';assert b[1]['text']=='Translated by L. W. King'
    pro=[x for x in b[2:code] if x['type']=='paragraph'];tail=[x for x in b[epi+1:] if x['role']=='article']
    assert len(pro)==3 and len(tail)==7
    assert 'When Anu the Sublime' in pro[0]['text']
    assert tail[-1]['text'].endswith('and may they come upon him forthwith.')
    assert b[-1]['text']=='© 2008 Lillian Goldman Law Library' and b[-1]['role']=='source-note'
    return {'prologueParagraphs':len(pro),'epilogueParagraphs':len(tail),'translatorPreserved':True,'copyrightPreserved':True}
check('complete-prologue-epilogue-translator-and-footer-notice',prologue_epilogue)

def toc_and_readings():
    by_id={b['id']:b for b in doc['blocks']};assert len(by_id)==262
    assert len(doc['toc'])==251 and len({t['id'] for t in doc['toc']})==251
    entries={t['id']:t for t in doc['toc']};numbered=0
    for t in doc['toc']:
        b=by_id[t['id']]
        if t.get('anchorBasis')=='source-clause-number':
            assert b['type']=='paragraph' and b['text'].startswith(t['title']+' ')
            for s in t['sourcePrefixSpans']:
                part=raw[s['startByte']:s['endByte']];assert sha(part)==s['sha256'] and part.decode()==t['title']
            assert int(t['title'].rstrip('.'))==t['clauseNumber'];numbered+=1
        else:assert b['type']=='heading' and t['title']==b['text']
    assert numbered==247
    expected_routes={
        'babylonia-judgment-witnesses--iq_babylonia_1':[5,9,10,11,12],
        'babylonia-irrigation-liability--iq_babylonia_1':[53,54,55,56],
        'babylonia-contracts-receipts--iq_babylonia_1':[104,105,106,107,122,123,124]}
    for r in doc['readingAnchors']:
        assert [a['clauseNumber'] for a in r['anchors']]==expected_routes[r['readingId']]
        for a in r['anchors']:
            assert a['sourceHeading']==entries[a['blockId']]['title']
            assert a['sourcePrefixSpans']==entries[a['blockId']]['sourcePrefixSpans']
    assert len(doc['readingAnchors'])==3
    return {'originalHeadings':4,'clauseEntries':numbered,'readingRoutes':3,'preciseClauseEntrypoints':16}
check('toc-and-16-related-entrypoints-bind-real-source-prefix-bytes',toc_and_readings)

def links():
    p=Visible();p.feed(article);source=[h for h in p.anchors if h]
    saved=[l for b in doc['blocks'] for l in b.get('links',[])]
    assert [l['originalHref'] for l in saved]==source
    for l in saved:
        s=l['sourceSpan'];assert sha(raw[s['startByte']:s['endByte']])==s['sha256'];assert l['safeProtocol']
    assert p.anchors.count(None)==1
    assert 'Nergal' in expected
    return {'retainedValidLinks':len(saved),'malformedSourceAnchorsWithoutHref':1,'malformedAnchorTextRetained':'Nergal'}
check('all-valid-links-retained-and-malformed-link-text-preserved',links)

def excluded():
    alltext=' '.join(b['text'] for b in doc['blocks'])
    for value in ['Avalon Home','Ancient Documents','Hammurabi Page','Search Morris','Contact Us','google.com/search']:
        assert value not in alltext
    assert doc['extraction']['execution']=='none' and doc['extraction']['translation']=='none'
    assert doc['extraction']['excludedActiveContentSpans']==[]
    return {'siteNavigationExcluded':True,'originalHTMLExecuted':False}
check('site-navigation-excluded-without-dropping-article',excluded)

def negative_drop():
    c=copy.deepcopy(doc);c['blocks']=[b for b in c['blocks'] if not b['text'].startswith('229 If a builder')]
    try:coverage(c)
    except AssertionError:return 'Dropping the unusually numbered law is detected'
    raise AssertionError('Missing law escaped coverage check')
check('negative-control-missing-229-detected',negative_drop)

def negative_repair():
    c=copy.deepcopy(doc);next(b for b in c['blocks'] if b['text'].startswith('229 If a builder'))['text']='229. Fabricated correction'
    try:coverage(c)
    except AssertionError:return 'Changing original punctuation/content is detected'
    raise AssertionError('Rewrite escaped coverage check')
check('negative-control-silent-rewrite-detected',negative_repair)

def deterministic():
    repo=REPO;subprocess.run([sys.executable,str(HERE/'build_saved_text_catalog.py'),'--repo',str(repo),'--check'],check=True,capture_output=True)
    assert sha(raw)==sha((ARCHIVE/'sources/hammurabi-king-yale.html.txt').read_bytes())
    return {'rebuildByteIdentical':True,'originalUnchanged':True}
check('deterministic-rebuild-and-frozen-original',deterministic)

report={'passed':all(c['passed'] for c in checks),'checksPassed':sum(c['passed'] for c in checks),'checksTotal':len(checks),'checks':checks,'counts':doc['counts'],
        'missingNumberPolicy':'Numbers absent from this exact saved page are retained as gaps; no claim that every law in a modern critical edition is absent.',
        'sourceSha256':sha(raw),'wholeSelectedTextSha256':sha(expected.encode())}
(REPO/'docs/verification-3.44/hammurabi-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['passed','checksPassed','checksTotal','counts']},ensure_ascii=False))
for c in checks:
    if not c['passed']:print(c)
sys.exit(0 if report['passed'] else 1)
