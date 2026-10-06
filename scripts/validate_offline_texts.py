#!/usr/bin/env python3
"""Independent integrity/coverage and negative-control checks for offline texts."""
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
import unittest
import extract_offline_texts as extract

HERE=Path(__file__).parent
DATA=extract.DEFAULT_REPO/'public/data/research-evidence/reading-texts-3.42'
REPO=extract.DEFAULT_REPO
SPECS={s['sourceId']:s for s in extract.SPECS}
DOCS={sid:json.loads((DATA/(sid+'.json')).read_text()) for sid in SPECS}
flatten=lambda text:re.sub(r'\s+',' ',text).strip()

class Visible(HTMLParser):
    """Separate parser and whitespace policy; no extraction block logic reused."""
    def __init__(self):super().__init__(convert_charrefs=True);self.parts=[];self.hidden=0;self.anchors=[]
    def handle_starttag(self,tag,attrs):
        if tag in {'script','style','iframe','object','embed','noscript','template'}:self.hidden+=1
        if not self.hidden:
            if tag in {'p','h1','h2','h3','h4','h5','h6','li','td','blockquote','pre','br','div'}:self.parts.append(' ')
            if tag=='a':self.anchors.append(dict(attrs).get('href'))
    def handle_endtag(self,tag):
        if tag in {'script','style','iframe','object','embed','noscript','template'}:self.hidden=max(0,self.hidden-1)
        if not self.hidden and tag in {'p','h1','h2','h3','h4','h5','h6','li','td','blockquote','pre','div'}:self.parts.append(' ')
    def handle_data(self,text):
        if not self.hidden:self.parts.append(text)

def raw_for(sid):
    spec=SPECS[sid];return (REPO/'public/data/research-evidence'/spec['collection']/spec['file']).read_bytes()

def freeze(value):return json.dumps(value,ensure_ascii=False,sort_keys=True)

class OfflineTexts(unittest.TestCase):
    def test_01_pinned_inputs_and_manifest(self):
        index=json.loads((DATA/'index.json').read_text())
        self.assertEqual(len(index['documents']),2)
        for item in index['documents']:
            raw=raw_for(item['sourceId']);file=DATA/item['file']
            self.assertEqual(extract.sha(raw),SPECS[item['sourceId']]['sha256'])
            self.assertEqual(item['source']['bytes'],len(raw));self.assertEqual(item['bytes'],file.stat().st_size)
            self.assertEqual(item['sha256'],extract.sha(file.read_bytes()))
            self.assertEqual(item['source']['url'],SPECS[item['sourceId']]['url'])

    def test_02_every_paragraph_reconstructs_from_exact_utf8_bytes(self):
        for sid,doc in DOCS.items():
            raw=raw_for(sid);seen=set()
            for block in doc['blocks']:
                self.assertNotIn(block['id'],seen);seen.add(block['id']);pieces=[]
                for span in block['sourceSpans']:
                    a,b=span['startByte'],span['endByte'];self.assertTrue(0<=a<b<=len(raw))
                    part=raw[a:b];self.assertEqual(extract.sha(part),span['sha256'])
                    pieces.append('\x00' if span['kind']=='break' else unescape(part.decode('utf-8')))
                self.assertEqual(extract.normalized(''.join(pieces)),block['text'],block['id'])
                self.assertEqual(extract.sha(block['text'].encode()),block['textSha256'])

    def test_03_full_selected_article_and_notices_have_no_text_omissions(self):
        for sid,doc in DOCS.items():
            raw=raw_for(sid);visible=[]
            for region in doc['extraction']['regions']:
                part=raw[region['startByte']:region['endByte']]
                self.assertEqual(extract.sha(part),region['sha256'])
                parser=Visible();parser.feed(part.decode('utf-8'));visible.append(''.join(parser.parts))
            self.assertEqual(flatten(' '.join(visible)),flatten(' '.join(b['text'] for b in doc['blocks'])),sid)

    def test_04_every_text_span_is_in_an_explicit_reviewed_region(self):
        for sid,doc in DOCS.items():
            regions=doc['extraction']['regions']
            for block in doc['blocks']:
                previous=None
                for span in block['sourceSpans']:
                    a,b=span['startByte'],span['endByte'];self.assertTrue(any(r['startByte']<=a<b<=r['endByte'] for r in regions))
                    if previous is not None:self.assertGreaterEqual(a,previous)
                    previous=b

    def test_05_twelve_tables_retains_all_twelve_sections_and_introduction(self):
        doc=DOCS['twelve-tables-yale'];headings=[b['text'] for b in doc['blocks'] if b['type']=='heading']
        self.assertEqual(headings[:2],['The Twelve Tables','Introduction'])
        self.assertEqual([re.match(r'Table ([IVX]+)\.',t).group(1) for t in headings[2:]],['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])
        self.assertEqual(doc['counts']['blocks'],139)
        self.assertTrue(any('Whatever the people ordain last' in b['text'] for b in doc['blocks']))

    def test_06_fordham_contains_the_whole_page_not_only_mali(self):
        doc=DOCS['ibn-battuta-gibb-fordham'];text=' '.join(b['text'] for b in doc['blocks'])
        for anchor in ['I left Tangier','Damascus','Constantinople','Timbuktoo','This is the end of Ibn Battuta']:
            self.assertIn(anchor,text)
        self.assertEqual(doc['counts']['blocks'],366)
        self.assertEqual(doc['counts']['headings'],118)
        self.assertGreater(doc['counts']['characters'],160000)

    def test_07_edition_copyright_editorial_notes_are_preserved_as_data(self):
        yale=' '.join(b['text'] for b in DOCS['twelve-tables-yale']['blocks'] if b['role']=='source-note')
        fordham=' '.join(b['text'] for b in DOCS['ibn-battuta-gibb-fordham']['blocks'] if b['role']=='source-note')
        for value in ['University of Texas Press, 1961','Used with the Permission','© 2008','Copyright 2001']:
            self.assertIn(value,yale)
        for value in ['H. A. R. Gibb','Broadway House, 1929','No permission is granted for commercial use','© Paul Halsall, February 21, 2001']:
            self.assertIn(value,fordham)
        article=' '.join(b['text'] for b in DOCS['ibn-battuta-gibb-fordham']['blocks'])
        self.assertIn('[22 lunar years; 21 and 4 months by solar reckoning]',article)
        self.assertEqual(DOCS['ibn-battuta-gibb-fordham']['language'],'en')

    def test_08_navigation_styles_and_site_forms_are_excluded(self):
        all_text=' '.join(b['text'] for d in DOCS.values() for b in d['blocks'])
        for value in ['Avalon Home','Document Collections','Search Morris','Search Orbis','max-width','google.com/search','Site Concept and Design']:
            self.assertNotIn(value,all_text)
        for doc in DOCS.values():self.assertEqual(doc['extraction']['execution'],'none')

    def test_09_links_retain_exact_original_tags_and_safe_resolved_urls(self):
        for sid,doc in DOCS.items():
            raw=raw_for(sid);source_links=[]
            for region in doc['extraction']['regions']:
                parser=Visible();parser.feed(raw[region['startByte']:region['endByte']].decode());source_links.extend(parser.anchors)
            links=[link for block in doc['blocks'] for link in block.get('links',[])]
            self.assertEqual([link['originalHref'] for link in links],source_links)
            for link in links:
                span=link['sourceSpan'];part=raw[span['startByte']:span['endByte']]
                self.assertEqual(extract.sha(part),span['sha256']);self.assertTrue(part.lower().startswith(b'<a '));self.assertTrue(link['safeProtocol'])

    def test_10_all_three_reading_routes_have_exact_existing_heading_anchors(self):
        ids=[]
        for doc in DOCS.values():
            headings={b['id']:b['text'] for b in doc['blocks'] if b['type']=='heading'}
            for reading in doc['readingAnchors']:
                ids.append(reading['readingId']);self.assertIn(reading['readingId'],doc['readingIds'])
                for target in reading['anchors']:self.assertEqual(headings[target['blockId']],target['sourceHeading'])
        self.assertEqual(set(ids),{'early-rome-code--it_roman_rep_1','mali-qadi-court--ml_mali_emp','mali-salt-money--ml_mali_emp'})

    def test_11_active_markup_is_inert_and_unsafe_links_never_get_urls(self):
        text='<h1>Title</h1><p>caf&#233; &amp; 中文<br>text<script>doEvil()</script><style>secret-css</style><a href="javascript:bad()">label</a> &lt;img onerror=bad()&gt;</p>'
        raw=text.encode();reader=extract.Reader(text,raw,0,len(text),'article','https://example.org/page',extract.byte_map(text));blocks=reader.extract()
        self.assertEqual(blocks[1]['text'],'café & 中文\ntextlabel <img onerror=bad()>')
        self.assertNotIn('doEvil',freeze(blocks));self.assertNotIn('secret-css',freeze(blocks))
        self.assertIsNone(blocks[1]['links'][0]['url']);self.assertFalse(blocks[1]['links'][0]['safeProtocol'])
        self.assertGreaterEqual(len(reader.ignored),2)

    def test_12_hash_drift_fails_before_catalog_or_output(self):
        with tempfile.TemporaryDirectory() as temp:
            repo=Path(temp);spec=extract.SPECS[0];path=repo/'public/data/research-evidence'/spec['collection']/spec['file'];path.parent.mkdir(parents=True);path.write_bytes(raw_for(spec['sourceId'])+b' ')
            with self.assertRaisesRegex(ValueError,'Pinned source hash mismatch'):extract.extract(repo,spec)

    def test_13_reproducible_build_and_original_files_unchanged(self):
        before={sid:extract.sha(raw_for(sid)) for sid in SPECS}
        with tempfile.TemporaryDirectory() as temp:
            extract.build(REPO,Path(temp))
            for file in (DATA).glob('*.json'):self.assertEqual((Path(temp)/file.name).read_bytes(),file.read_bytes(),file.name)
        self.assertEqual(before,{sid:extract.sha(raw_for(sid)) for sid in SPECS})

    def test_14_extraction_implementation_is_pinned_in_each_derived_document(self):
        actual=extract.sha(Path(extract.__file__).read_bytes())
        for doc in DOCS.values():self.assertEqual(doc['extraction']['scriptSha256'],actual)

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(OfflineTexts);result=unittest.TextTestRunner(verbosity=2).run(suite)
    summary={'tests':result.testsRun,'passed':result.testsRun-len(result.errors)-len(result.failures),'failures':[name for name,_ in result.failures],'errors':[name for name,_ in result.errors],'skipped':len(result.skipped),'sources':len(DOCS),'blocks':sum(d['counts']['blocks'] for d in DOCS.values()),'sourceFilesUnchanged':all(extract.sha(raw_for(sid))==SPECS[sid]['sha256'] for sid in SPECS)}
    (REPO/'docs/verification-3.42/offline-text-verification.json').write_text(json.dumps(summary,indent=2,default=str)+'\n');raise SystemExit(0 if result.wasSuccessful() else 1)
