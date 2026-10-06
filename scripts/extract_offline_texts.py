#!/usr/bin/env python3
"""Extract two pinned HTML archives as inert, source-traceable reading blocks.
Only the Python standard library is used. No HTML is executed or fetched.
"""
import argparse
from bisect import bisect_right
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit

VERSION = 'meridian-offline-text-v1'
DEFAULT_REPO = Path(__file__).resolve().parents[1]
SPECS = [
    {'sourceId': 'twelve-tables-yale', 'collection': 'readings-3.39',
     'file': 'sources/twelve-tables.html.txt',
     'sha256': '4a280cef6a403c2757c559fe7c4e417b13e3f7f276549917e8e2b593c87c0167',
     'url': 'https://avalon.law.yale.edu/ancient/twelve_tables.asp'},
    {'sourceId': 'ibn-battuta-gibb-fordham', 'collection': 'readings-3.40',
     'file': 'sources/ibn-battuta-fordham.html.txt',
     'sha256': 'a334156f1d44d7f3ef51fd953ce90634cafe6306023327c791822e639d5c0fdf',
     'url': 'https://sourcebooks.web.fordham.edu/source/1354-ibnbattuta.asp'},
]
ACTIVE = {'script','style','iframe','object','embed','noscript','template'}
BREAK_BLOCK = {'p','h1','h2','h3','h4','h5','h6','li','td','blockquote','pre'}
VOID = {'br','hr','img','input','meta','link','wbr','source','area','base','embed','param','track','col'}
sha = lambda value: hashlib.sha256(value).hexdigest()


def normalized(text):
    # Preserve authored punctuation/spelling and explicit BR line breaks. Source
    # indentation, CR/LF and NBSP normalize to ordinary intra-paragraph spaces.
    return '\n'.join(re.sub(r'\s+', ' ', part).strip() for part in text.split('\u0000')).strip()


def byte_map(text):
    positions, total = [0], 0
    for character in text:
        total += len(character.encode('utf-8'))
        positions.append(total)
    return positions


class Reader(HTMLParser):
    def __init__(self, text, raw, start, end, role, url, char_to_byte):
        super().__init__(convert_charrefs=False)
        self.full, self.raw, self.start, self.end = text, raw, start, end
        self.part, self.url, self.role, self.positions = text[start:end], url, role, char_to_byte
        self.lines = [0] + [m.end() for m in re.finditer('\n', self.part)]
        self.stack, self.fragments, self.links, self.blocks = [], [], [], []
        self.block_tag, self.source_note, self.ignored = None, role == 'source-note', []

    def pos(self):
        line, column = self.getpos()
        return self.start + self.lines[line - 1] + column

    def span(self, a, b, kind='text'):
        x, y = self.positions[a], self.positions[b]
        return {'startByte': x, 'endByte': y, 'kind': kind, 'sha256': sha(self.raw[x:y])}

    def blocked(self):
        return any(tag in ACTIVE for tag in self.stack)

    def add(self, a, b, kind='text'):
        if self.blocked():
            self.ignored.append(self.span(a, b, kind)); return
        self.fragments.append({**self.span(a,b,kind), '_strong': 'strong' in self.stack or 'b' in self.stack})

    def text_of(self, fragments):
        return normalized(''.join('\u0000' if f['kind'] == 'break' else unescape(self.raw[f['startByte']:f['endByte']].decode('utf-8')) for f in fragments))

    def flush(self):
        text = self.text_of(self.fragments)
        if text:
            strong = self.text_of([f for f in self.fragments if f['_strong']])
            remainder = text[len(strong):].strip() if strong and text.startswith(strong) else None
            heading = bool(self.block_tag and self.block_tag.startswith('h') and self.block_tag[1:].isdigit())
            strong_heading = bool(strong and (remainder == '' or re.fullmatch(r'pp?\.?\s+[\d–—\- ]+\.?', remainder or '')))
            title = self.block_tag == 'document-title'
            kind = 'heading' if heading or title or strong_heading and not self.source_note else 'paragraph'
            if text.startswith('Source:') or text.startswith('Source.'):
                self.source_note = True; kind = 'paragraph'
            block = {'type': kind, 'role': 'source-note' if self.source_note else self.role,
                     'text': text, 'textSha256': sha(text.encode()),
                     'sourceTag': self.block_tag or 'text',
                     'sourceSpans': [{k:v for k,v in f.items() if k != '_strong'} for f in self.fragments]}
            if kind == 'heading':
                block['level'] = int(self.block_tag[1:]) if heading else 1 if title else 2
                block['headingBasis'] = 'source-heading-tag' if heading else 'source-document-title' if title else 'source-bold-paragraph'
            if self.links: block['links'] = self.links
            self.blocks.append(block)
        self.fragments, self.links = [], []

    def handle_starttag(self, tag, attrs):
        a = self.pos(); raw_tag = self.get_starttag_text(); b = a + len(raw_tag); attributes = dict(attrs)
        if not self.blocked():
            if tag in BREAK_BLOCK or tag == 'div' and attributes.get('class') in {'document-title','Copyright'}:
                self.flush(); self.block_tag = 'document-title' if attributes.get('class') == 'document-title' else tag
            if tag == 'br': self.add(a,b,'break')
            if tag == 'a' and attributes.get('href'):
                value = urljoin(self.url,attributes['href']); safe = urlsplit(value).scheme.lower() in {'https','http','mailto'}
                self.links.append({'originalHref': attributes['href'], 'url': value if safe else None,
                                   'safeProtocol': safe, 'sourceSpan': self.span(a,b,'link-tag')})
            if tag in {'img','input'}:
                raise ValueError('Unexpected non-text content inside reviewed article: '+tag)
        if tag not in VOID: self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID: self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.blocked() and (tag in BREAK_BLOCK or tag == 'div'):
            self.flush(); self.block_tag = None
        if tag in self.stack:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            del self.stack[index:]

    def handle_data(self, data): self.add(self.pos(),self.pos()+len(data))
    def handle_entityref(self, name): self.reference('&'+name)
    def handle_charref(self, name): self.reference('&#'+name)
    def reference(self, prefix):
        a = self.pos(); value = prefix + (';' if self.full.startswith(prefix+';',a) else '')
        self.add(a,a+len(value),'entity')
    def extract(self):
        self.feed(self.part); self.close(); self.flush(); return self.blocks


def selection(text, source_id):
    if source_id == 'twelve-tables-yale':
        start = text.index('<div class="document-title">')
        source = text.index('<table class="sourcetable">',start)
        end = re.search(r'</TABLE>\s*</DIV>',text[source:]).end() + source
        copyright = re.search(r'<div class="Copyright">.*?</div>',text,re.S)
        rights = re.search(r'<META NAME="DC.Rights" CONTENT="([^"]+)">',text)
        if not copyright or not rights: raise ValueError('Missing Yale notices')
        return [(start,end,'article'),(copyright.start(),copyright.end(),'source-note')], rights.span(1)
    start = text.index('<h1 align="left" class="H_Title">Medieval Sourcebook</h1>')
    end = text.index('<h1 align="left" class="H_Title">&nbsp;</h1>',start)
    return [(start,end,'article')], None


def extract(repo,spec):
    archive = repo/'public/data/research-evidence'/spec['collection']
    raw = (archive/spec['file']).read_bytes()
    if sha(raw) != spec['sha256']: raise ValueError('Pinned source hash mismatch: '+spec['sourceId'])
    text = raw.decode('utf-8',errors='strict'); positions = byte_map(text)
    catalog = json.loads((archive/'catalog.json').read_text())
    cards = [c for c in catalog['cards'] if c['sourceId']==spec['sourceId']]
    if not cards or any(c['sourceSha256']!=spec['sha256'] or c['sourceBytes']!=len(raw) or c['url']!=spec['url'] for c in cards):
        raise ValueError('Reading catalog/source identity mismatch')
    regions, rights = selection(text,spec['sourceId']); blocks, region_meta, excluded = [], [], []
    for a,b,role in regions:
        reader = Reader(text,raw,a,b,role,spec['url'],positions); extracted = reader.extract()
        blocks.extend(extracted);excluded.extend(reader.ignored)
        region_meta.append({'role': role,'startByte': positions[a],'endByte': positions[b],
                            'sha256': sha(raw[positions[a]:positions[b]]),'blocks':len(extracted)})
    if rights:
        a,b=rights; value=unescape(text[a:b]);blocks.append({'type':'paragraph','role':'source-note','text':value,
            'textSha256':sha(value.encode()),'sourceTag':'meta:DC.Rights','sourceSpans':[{'startByte':positions[a],'endByte':positions[b],'kind':'text','sha256':sha(raw[positions[a]:positions[b]])}]})
        region_meta.append({'role':'metadata-notice','startByte':positions[a],'endByte':positions[b],'sha256':sha(raw[positions[a]:positions[b]]),'blocks':1})
    for i,block in enumerate(blocks,1):block['id']=spec['sourceId']+'--b'+str(i).zfill(4)
    requested = {
        'early-rome-code--it_roman_rep_1': ['Introduction','Table I. Proceedings','Table II. Trial','Table IX. Public'],
        'mali-qadi-court--ml_mali_emp': ['Ibn Battuta arrives at the city of Mali,','Ibn Battuta meets the king of Mali'],
        'mali-salt-money--ml_mali_emp': ['The saltworks at the oasis of Taghaza','From Walata to the river Niger'],
    }
    reading_anchors=[]
    for card in cards:
        anchors=[]
        for prefix in requested[card['id']]:
            matches=[b for b in blocks if b['type']=='heading' and b['text'].startswith(prefix)]
            if len(matches)!=1:raise ValueError('Reading anchor is not unique: '+prefix)
            anchors.append({'blockId':matches[0]['id'],'sourceHeading':matches[0]['text']})
        reading_anchors.append({'readingId':card['id'],'anchors':anchors})
    return {'schemaVersion':1,'sourceId':spec['sourceId'],'language':'en','readingIds':[c['id'] for c in cards],
        'source':{'url':spec['url'],'localURL':cards[0]['localURL'],'sha256':spec['sha256'],'bytes':len(raw),
                  'encoding':'utf-8','snapshot':cards[0]['sourceSnapshot']},
        'extraction':{'algorithm':VERSION,'scriptSha256':sha(Path(__file__).read_bytes()),'regions':region_meta,
            'offsetUnit':'UTF-8 byte; start inclusive, end exclusive','normalization':'HTML entities decoded; source whitespace/NBSP collapsed; explicit BR retained as newline; punctuation, spelling, bracketed notes and language retained.',
            'headingRule':'Native H1-H6/document-title retained; fully bold paragraph or bold paragraph plus page locator is a level-2 reading heading.',
            'excludedActiveContentSpans':excluded,'execution':'none','translation':'none'},
        'readingAnchors':reading_anchors,'blocks':blocks,'toc':[{'id':b['id'],'title':b['text'],'level':b['level']} for b in blocks if b['type']=='heading'],
        'counts':{'blocks':len(blocks),'headings':sum(b['type']=='heading' for b in blocks),'sourceNotes':sum(b['role']=='source-note' for b in blocks),'characters':sum(len(b['text']) for b in blocks)}}


def write_json(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def build(repo,output):
    output.mkdir(parents=True,exist_ok=True); entries=[]
    for spec in SPECS:
        data=extract(repo,spec);name=spec['sourceId']+'.json';write_json(output/name,data)
        entries.append({'sourceId':spec['sourceId'],'file':name,'sha256':sha((output/name).read_bytes()),'bytes':(output/name).stat().st_size,'readingIds':data['readingIds'],'source':data['source'],'counts':data['counts']})
    write_json(output/'index.json',{'schemaVersion':1,'algorithm':VERSION,'documents':entries})
    return entries

def module_code(index):
    return '// Derived readable texts; originals remain separately archived.\nexport const SAVED_TEXTS='+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\n'

if __name__ == '__main__':
    import tempfile
    parser=argparse.ArgumentParser();parser.add_argument('--repo',type=Path,default=DEFAULT_REPO);parser.add_argument('--output',type=Path);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    output=args.output or args.repo/'public/data/research-evidence/reading-texts-3.42'
    module=args.repo/'public/research-original-text-data.js'
    if args.check:
        with tempfile.TemporaryDirectory() as temp:
            generated=Path(temp);entries=build(args.repo,generated)
            for file in generated.glob('*.json'):
                if not (output/file.name).is_file() or (output/file.name).read_bytes()!=file.read_bytes():raise ValueError('Stale derived text: '+file.name)
            if module.read_text()!=module_code(json.loads((generated/'index.json').read_text())):raise ValueError('Stale saved-text catalog module')
    else:
        entries=build(args.repo,output);module.write_text(module_code(json.loads((output/'index.json').read_text())))
    print(json.dumps({'checked':args.check,'documents':len(entries),'blocks':sum(x['counts']['blocks'] for x in entries)}))
