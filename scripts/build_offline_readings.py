#!/usr/bin/env python3
"""Build source-preserving readable texts and their combined catalog.
python3 prepare_offline.py --repo REPOSITORY [--output OUTPUT] [--check]
"""
import argparse,hashlib,importlib.util,json,pathlib,re,tempfile
HERE=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
SOURCE_ID='hammurabi-king-yale'
SOURCE_SHA='93410a95441d28fd498df423ec7860ae5ee821df3811989bb469838075c9eb12'
BASE_SHA='4048ed092537cf0f169e61e5ff049ce60b263b2ae10700a1284911b5947b02f3'
REQUESTS={
 'babylonia-judgment-witnesses--iq_babylonia_1':[5,9,10,11,12],
 'babylonia-irrigation-liability--iq_babylonia_1':[53,54,55,56],
 'babylonia-contracts-receipts--iq_babylonia_1':[104,105,106,107,122,123,124],
}

def load_base(repo):
    path=repo/'scripts/extract_offline_texts.py'
    if sha(path.read_bytes())!=BASE_SHA:raise ValueError('Production base extractor changed; review before reusing')
    spec=importlib.util.spec_from_file_location('source_preserving_reader',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def extract(repo):
    base=load_base(repo);archive=repo/'public/data/research-evidence/readings-3.43'
    raw=(archive/'sources/hammurabi-king-yale.html.txt').read_bytes()
    if sha(raw)!=SOURCE_SHA:raise ValueError('Pinned source drift')
    text=raw.decode('utf-8');pos=base.byte_map(text)
    catalog=json.loads((archive/'catalog.json').read_text())
    cards=[c for c in catalog['cards'] if c['sourceId']==SOURCE_ID]
    if {c['id'] for c in cards}!=set(REQUESTS):raise ValueError('Card set mismatch')
    for c in cards:
        if c['sourceSha256']!=SOURCE_SHA or c['sourceBytes']!=len(raw):raise ValueError('Card/source mismatch')
    url=cards[0]['url'];start=text.index('<div class="document-title">')
    epilogue=text.index('<H3>THE EPILOGUE</H3>',start)
    end=text.index('<DIV ALIGN="center"><TABLE BORDER=1 CELLPADDING=5>',epilogue)
    copyright=re.search(r'<div class="Copyright">.*?</div>',text,re.S)
    if not copyright:raise ValueError('Missing source notice')
    regions=[(start,end,'article'),(copyright.start(),copyright.end(),'source-note')]
    blocks=[];metadata=[];excluded=[]
    for a,b,role in regions:
        reader=base.Reader(text,raw,a,b,role,url,pos);part=reader.extract();blocks+=part;excluded+=reader.ignored
        metadata.append({'role':role,'startByte':pos[a],'endByte':pos[b],'sha256':sha(raw[pos[a]:pos[b]]),'blocks':len(part)})
    for i,b in enumerate(blocks,1):b['id']=SOURCE_ID+'--b'+str(i).zfill(4)
    laws=[];in_laws=False
    for b in blocks:
        if b['text']=='CODE OF LAWS':in_laws=True;continue
        if b['text']=='THE EPILOGUE':in_laws=False
        if not in_laws:continue
        # Match the archived numbering, including 229 without a period. The
        # prefix is navigation metadata; it never replaces paragraph wording.
        m=re.match(r'^(\d+)(\.|(?=\s))',b['text'])
        if not m:raise ValueError('Unexpected unnumbered law-region block: '+b['id'])
        first=b['sourceSpans'][0];part=raw[first['startByte']:first['endByte']]
        prefix=re.match(rb'\s*(\d+)(\.|(?=\s))',part)
        if not prefix:raise ValueError('Prefix not present in first original span')
        a=first['startByte']+prefix.start(1);z=first['startByte']+prefix.end()
        source_prefix=raw[a:z].decode()
        if source_prefix!=m.group():raise ValueError('Number prefix differs from paragraph')
        laws.append({'number':int(m.group(1)),'blockId':b['id'],'sourcePrefix':source_prefix,
                     'sourcePrefixSpans':[{'startByte':a,'endByte':z,'kind':'text','sha256':sha(raw[a:z])}]})
    by_number={l['number']:l for l in laws}
    if len(by_number)!=len(laws):raise ValueError('Duplicate source numbers')
    reading_anchors=[]
    for c in cards:
        anchors=[]
        for n in REQUESTS[c['id']]:
            law=by_number[n]
            anchors.append({'blockId':law['blockId'],'sourceHeading':law['sourcePrefix'],
                            'anchorBasis':'source-clause-number','clauseNumber':n,
                            'sourcePrefixSpans':law['sourcePrefixSpans']})
        reading_anchors.append({'readingId':c['id'],'anchors':anchors})
    law_by_block={l['blockId']:l for l in laws};toc=[]
    for b in blocks:
        if b['type']=='heading':toc.append({'id':b['id'],'title':b['text'],'level':b['level']})
        elif b['id'] in law_by_block:
            l=law_by_block[b['id']]
            toc.append({'id':b['id'],'title':l['sourcePrefix'],'level':4,'anchorBasis':'source-clause-number',
                        'clauseNumber':l['number'],'sourcePrefixSpans':l['sourcePrefixSpans']})
    counts={'blocks':len(blocks),'headings':sum(b['type']=='heading' for b in blocks),
            'sourceNotes':sum(b['role']=='source-note' for b in blocks),'characters':sum(len(b['text']) for b in blocks),
            'numberedLaws':len(laws),'tocEntries':len(toc)}
    return {'schemaVersion':1,'sourceId':SOURCE_ID,'language':'en','readingIds':[c['id'] for c in cards],
      'source':{'url':url,'localURL':cards[0]['localURL'],'sha256':SOURCE_SHA,'bytes':len(raw),'encoding':'utf-8','snapshot':cards[0]['sourceSnapshot']},
      'extraction':{'algorithm':base.VERSION,'scriptSha256':sha(pathlib.Path(__file__).read_bytes()),'baseScriptSha256':BASE_SHA,
        'regions':metadata,'offsetUnit':'UTF-8 byte; start inclusive, end exclusive',
        'normalization':'HTML entities decoded; source whitespace/NBSP collapsed; explicit BR retained as newline; punctuation, spelling, bracketed notes and language retained.',
        'headingRule':'Native H1-H6/document-title retained. Law paragraphs remain paragraphs. Exact source number prefixes additionally index the TOC and reading anchors; their byte spans are recorded.',
        'excludedActiveContentSpans':excluded,'execution':'none','translation':'none'},
      'readingAnchors':reading_anchors,'blocks':blocks,'toc':toc,'counts':counts,
      'numbering':{'basis':'Number prefixes actually present in the saved CODE OF LAWS paragraphs',
        'presentNumbers':[l['number'] for l in laws], 'absentNumbersWithin1To282':sorted(set(range(1,283))-set(by_number)),
        'undottedNumbers':[l['number'] for l in laws if not l['sourcePrefix'].endswith('.')],
        'reconstructedClauses':0}}

def write_json(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def build(repo,out):
    out.mkdir(parents=True,exist_ok=True);base=load_base(repo);entries=base.build(repo,out);data=extract(repo);file=SOURCE_ID+'.json';write_json(out/file,data)
    entry={'sourceId':SOURCE_ID,'file':file,'sha256':sha((out/file).read_bytes()),'bytes':(out/file).stat().st_size,
           'readingIds':data['readingIds'],'source':data['source'],'counts':data['counts']}
    write_json(out/'index.json',{'schemaVersion':1,'algorithm':'meridian-offline-text-v1','documents':entries+[entry]});return data

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,default=None);p.add_argument('--check',action='store_true');a=p.parse_args();a.output=a.output or a.repo/'public/data/research-evidence/reading-texts-3.43';module=a.repo/'public/research-original-text-data.js'
    if a.check:
        with tempfile.TemporaryDirectory() as temp:
            out=pathlib.Path(temp);data=build(a.repo,out)
            for f in out.glob('*.json'):
                if (a.output/f.name).read_bytes()!=f.read_bytes():raise ValueError('Stale candidate: '+f.name)
            expected=load_base(a.repo).module_code(json.loads((a.output/'index.json').read_text()))
        if module.read_text()!=expected:raise ValueError('Stale saved-text catalog module')
    else:
        data=build(a.repo,a.output);module.write_text(load_base(a.repo).module_code(json.loads((a.output/'index.json').read_text())))
    print(json.dumps({'checked':a.check,**data['counts'],'missingNumbers':data['numbering']['absentNumbersWithin1To282']}))
