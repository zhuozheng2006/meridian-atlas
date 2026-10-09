#!/usr/bin/env python3
"""Combine independently versioned, byte-verified reading documents without copying them."""
import argparse, hashlib, importlib.util, json, pathlib, tempfile

p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1]);p.add_argument('--check',action='store_true');a=p.parse_args()
repo=a.repo.resolve();root=repo/'public/data/research-evidence'
spec=importlib.util.spec_from_file_location('previous_reading_builder',repo/'scripts/build_offline_readings.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
# Retain reproducibility checks for all three older documents and their exact bytes.
with tempfile.TemporaryDirectory() as temp:
    previous.build(repo,pathlib.Path(temp))
    for f in pathlib.Path(temp).glob('*.json'):
        if f.read_bytes()!=(root/'reading-texts-3.43'/f.name).read_bytes():raise ValueError('Stale preceding reading document: '+f.name)
entries=[];ids=set();reading_ids=set()
cards={c['id']:c for collection in ['readings-3.39','readings-3.40','readings-3.43','readings-3.44','readings-3.45'] for c in json.loads((root/collection/'catalog.json').read_text())['cards']}
for collection in ['reading-texts-3.43','readings-3.44/offline','readings-3.45/offline']:
    for entry in json.loads((root/collection/'index.json').read_text())['documents']:
        file=entry['file']
        if pathlib.PurePosixPath(file).name!=file or not file.endswith('.json'):raise ValueError('Unsafe reading file')
        raw=(root/collection/file).read_bytes();doc=json.loads(raw)
        if len(raw)!=entry['bytes'] or hashlib.sha256(raw).hexdigest()!=entry['sha256']:raise ValueError('Reading byte identity mismatch: '+file)
        if entry['sourceId'] in ids:raise ValueError('Duplicate reading source')
        if doc['sourceId']!=entry['sourceId'] or doc['source']!=entry['source'] or doc['readingIds']!=entry['readingIds'] or doc['counts']!=entry['counts']:raise ValueError('Reading index mismatch')
        block_ids={b['id'] for b in doc['blocks']};toc_ids={t['id'] for t in doc['toc']}
        if len(block_ids)!=len(doc['blocks']) or len(doc['blocks'])!=entry['counts']['blocks'] or not toc_ids<=block_ids:raise ValueError('Reading structure mismatch')
        for anchor_set in doc['readingAnchors']:
            if anchor_set['readingId'] not in doc['readingIds'] or not all(x['blockId'] in block_ids and x['blockId'] in toc_ids for x in anchor_set['anchors']):raise ValueError('Unnavigable reading anchor')
        for rid in entry['readingIds']:
            if rid in reading_ids:raise ValueError('Duplicate saved reading identity')
            card=cards[rid]
            if card['sourceId']!=entry['sourceId'] or card['sourceSha256']!=entry['source']['sha256']:raise ValueError('Reading/source association mismatch')
            reading_ids.add(rid)
        ids.add(entry['sourceId']);entries.append({**entry,'collection':collection})
catalog={'schemaVersion':1,'algorithm':'meridian-versioned-reading-catalog-v1','documents':entries}
code=previous.load_base(repo).module_code(catalog);out=repo/'public/research-original-text-data.js'
if a.check:
    if out.read_text()!=code:raise ValueError('Stale combined saved-text catalog')
else:out.write_text(code)
print(json.dumps({'checked':a.check,'documents':len(entries),'blocks':sum(e['counts']['blocks'] for e in entries),'readings':len(reading_ids)}))
