#!/usr/bin/env python3
"""Deterministic offline Polaris candidate importer. Standard library only.

The input workbook SHA is pinned. Output must be an empty directory. No network,
joins, inferred dates, sorting of value endpoints, or code translations.
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import posixpath
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = HERE.parents[1] / 'public/data/seshat-polaris-2026'
DEFAULT_SOURCE_DIR = DEFAULT_DATA_DIR / 'sources'
SOURCE_SHA = 'cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41'
COMMIT = '55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa'
DATASET = 'seshat-polaris-2026'
VERSION = 'polaris-2026-cf60c9f76eed'
REPOSITORY = 'https://github.com/Seshat-Global-History-Databank/build_polaris_dataset'
WORKBOOK_URL = f'https://raw.githubusercontent.com/Seshat-Global-History-Databank/build_polaris_dataset/{COMMIT}/Polaris2026.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
COUNTS = {'Variables': 173, 'Polities': 626, 'General': 7239, 'Social complexity': 26033,
          'Warfare': 17536, 'Luxury goods': 1191, 'Religion': 5466, 'CrisisDB - Crisis consequences': 166}

def sha(data): return hashlib.sha256(data).hexdigest()
def encoded(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
def row_key(sheet, row): return f'sha256:{SOURCE_SHA}:{sheet}:{row}'
def kind(sheet):
    if sheet == 'Variables': return 'variable-metadata'
    if sheet == 'Polities': return 'polity-metadata'
    return 'crisis-consequence' if sheet == 'CrisisDB - Crisis consequences' else 'coded-observation'
def envelope(**parts): return {'schemaVersion': 2, 'datasetId': DATASET, 'version': VERSION, 'sourceSha256': SOURCE_SHA, **parts}

def source_tables(source):
    """Decode strings, retain lexical numeric/boolean payloads and all cell types.

Absent cells: raw=null, cellTypes=null. A present cell with no payload also has
raw=null but retains its type. Explicit empty inline/shared strings stay ''.
Header order, names, cell types and exact worksheet row numbers are preserved.
No float, date, bool or inferred formula-result conversion is performed.
    """
    assert sha(source.read_bytes()) == SOURCE_SHA, 'Unexpected workbook SHA; register a distinct version.'
    tables, schemas = {}, []
    with zipfile.ZipFile(source) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in si.findall('.//s:t', NS))
                       for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        relationships = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS):
            name = sheet.get('name'); target = relationships[sheet.get(RID)]
            part = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            assert part.startswith('xl/worksheets/') and '..' not in part
            source_rows = []
            for row in ET.fromstring(archive.read(part)).findall('s:sheetData/s:row', NS):
                values, types = {}, {}
                for cell in row:
                    if cell.tag != '{' + NS['s'] + '}c': continue
                    column = re.sub(r'\d+', '', cell.get('r')); cell_type = cell.get('t', 'n')
                    assert cell.find('s:f', NS) is None, 'Formula cell requires an explicit importer policy.'
                    value_node = cell.find('s:v', NS); value = value_node.text if value_node is not None else None
                    if cell_type == 's': value = strings[int(value)] if value is not None else None
                    elif cell_type == 'inlineStr':
                        inline = cell.find('s:is', NS)
                        value = ''.join(t.text or '' for t in inline.findall('.//s:t', NS)) if inline is not None else None
                    assert cell_type in ('n', 'b', 's', 'inlineStr', 'str', 'e', 'd'), cell_type
                    values[column] = value; types[column] = cell_type
                if any(value is not None for value in values.values()): source_rows.append((row.get('r'), values, types))
            header_row, headers, header_types = source_rows[0]
            assert all(headers.values()) and len(set(headers.values())) == len(headers), 'Invalid original headers'
            schema = {'sourceSheet': name, 'xmlPart': part, 'headerRow': header_row,
                      'columns': [{'column': col, 'name': title, 'cellType': header_types[col]} for col, title in headers.items()]}
            records = []
            for row_number, values, types in source_rows[1:]:
                assert set(values).issubset(headers), f'Unexpected populated column in {name}:{row_number}'
                records.append({'id': row_key(name, row_number), 'sourceSheet': name, 'sourceRow': row_number,
                                'recordKind': kind(name), 'raw': {title: values.get(col) for col, title in headers.items()},
                                'cellTypes': {title: types.get(col) for col, title in headers.items()}})
            assert len(records) == COUNTS[name], (name, len(records))
            schemas.append({**schema, 'recordCount': len(records)}); tables[name] = records
    assert list(tables) == list(COUNTS), 'Workbook sheet identity/order changed'
    return tables, schemas

def build(source_dir, output):
    source_dir = source_dir.resolve(); source = source_dir / 'Polaris2026.xlsx'
    output = output.resolve()
    assert output != source_dir, 'Output must not replace the source directory'
    assert not output.exists() or not any(output.iterdir()), 'Output must be empty; never mix builds'
    tables, schemas = source_tables(source)
    output.mkdir(parents=True, exist_ok=True)
    file_manifest = []
    def emit(path, value):
        raw = encoded(value); data = gzip.compress(raw, mtime=0) if path.endswith('.gz') else raw
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
        entry = {'file': path, 'bytes': len(data), 'decodedBytes': len(raw), 'sha256': sha(data)}
        file_manifest.append(entry); return entry
    def copy_source(source_path, path):
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(source_path, target)
        data = target.read_bytes(); file_manifest.append({'file': path, 'bytes': len(data), 'sha256': sha(data)})

    phases = {row['raw']['polity_id']: row for row in tables['Polities']}
    assert len(phases) == 626 and len({r['raw']['polity_number'] for r in phases.values()}) == 626
    observations = [r for sheet, rows in tables.items() if sheet not in ('Variables', 'Polities') for r in rows]
    assert len(observations) == len({r['id'] for r in observations}) == 57631
    grouped = collections.defaultdict(list)
    for row in observations:
        raw = row['raw']; pid = raw['polity_id']; assert pid in phases
        assert raw['polity_number'] == phases[pid]['raw']['polity_number']
        grouped[pid].append(row)
    entries, reassembled = [], []
    for position, (pid, metadata) in enumerate(sorted(phases.items())):
        rows = grouped[pid]; raw = metadata['raw']; filename = f'polities/p{position:03d}.json.gz'
        info = emit(filename, envelope(polityId=pid, metadata=[metadata], observations=rows))
        restored = json.loads(gzip.decompress((output / filename).read_bytes()))
        assert restored['metadata'] == [metadata]
        reassembled.extend(restored['observations'])
        entries.append({'id': pid, 'sourceNumber': raw['polity_number'], 'names': [raw['long_name']],
                        'regions': [raw['seshat_region']], 'samplingAreas': [raw['homeNGA']] if raw['homeNGA'] is not None else [],
                        'periods': [{'startRaw': raw['start_year'], 'endRaw': raw['end_year'], 'sourceSheet': 'Polities', 'sourceRow': metadata['sourceRow']}],
                        'recordCount': len(rows), 'variableCount': len({r['raw']['variable_name'] for r in rows}),
                        'explicitDateCount': sum(any(r['raw'].get(key) is not None for key in ('year_from', 'year_to')) for r in rows),
                        'crisisCount': sum(r['recordKind'] == 'crisis-consequence' for r in rows), **info})
    by_id = lambda rows: {row['id']: row for row in rows}
    assert len(reassembled) == len(observations) and by_id(reassembled) == by_id(observations), 'Observation loss or mutation'
    searches = []
    for number, (sheet, rows) in enumerate((s, r) for s, r in tables.items() if s not in ('Variables', 'Polities')):
        info = emit(f'search/s{number}.json.gz', envelope(sourceSheet=sheet, observations=rows))
        assert json.loads(gzip.decompress((output / info['file']).read_bytes()))['observations'] == rows
        searches.append({'sourceSheet': sheet, 'recordKind': kind(sheet), 'recordCount': len(rows), **info})
    for sheet, path in [('Variables', 'metadata/variables.json.gz'), ('Polities', 'metadata/polities.json.gz')]:
        emit(path, envelope(sourceSheet=sheet, records=tables[sheet]))
        assert json.loads(gzip.decompress((output / path).read_bytes()))['records'] == tables[sheet]
    schema_info = emit('schema.json', envelope(sheets=schemas))
    index = envelope(polityCount=len(entries), recordCount=len(observations), variableCount=len(tables['Variables']),
                     recordKinds=dict(collections.Counter(r['recordKind'] for r in observations)), polities=entries,
                     searchFiles=searches, schemaFile='schema.json', variableMetadataFile='metadata/variables.json.gz',
                     polityMetadataFile='metadata/polities.json.gz', provenanceFile='provenance.json')
    emit('index.json', index); index_info = emit('index.json.gz', index)
    copy_source(source, 'sources/Polaris2026.xlsx')
    readme = source_dir / 'README-original.md'; copy_source(readme, 'sources/README-original.md')
    # Preserve the supplied download evidence verbatim, including its original names/times.
    copy_source(source_dir / 'download-records.json', 'sources/download-records.json')
    emit('provenance.json', envelope(sourceURL=REPOSITORY, commit=COMMIT, workbookURL=WORKBOOK_URL,
         workbookFile='sources/Polaris2026.xlsx', sourceBytes=source.stat().st_size,
         importerSha256=sha(Path(__file__).read_bytes()), importerVersion=1,
         license={'status': 'Not specified in the preserved pinned README. No Equinox license assertion is transferred to Polaris.', 'evidenceFile': 'sources/README-original.md', 'personalResearch': True},
         cellSemantics={'raw': 'All original headers exist. Numeric and boolean XML values remain strings; string payloads are resolved exactly. Null denotes no supplied payload.',
                        'cellTypes': 'Original Excel type including default n; null means no cell element. Empty cell elements retain their source type.',
                        'dates': 'Observation year_from/year_to only; no phase imputation, clipping, endpoint sorting, or year-zero rewrite.'},
         identity='Row identity is source SHA-256 + exact worksheet name + Excel row number, not an API record identifier.',
         evidenceLimits='The workbook has no per-record coding explanation or bibliography; no evidence associations are inferred.',
         transformations=['Parse all eight original worksheets and preserve raw fields and cell types.', 'Partition observations by exact original polity_id.', 'Keep CrisisDB rows separate by recordKind.', 'Retain all 626 polity records, including seven without observations.', 'Deterministic compact JSON and gzip mtime=0.']))
    raw_all = [row for rows in tables.values() for row in rows]
    report = envelope(counts=COUNTS, observedRows=len(observations), metadataRows=len(raw_all)-len(observations),
                      uniqueRecordIds=len({row['id'] for row in raw_all}), distinctBareObservationRows=len({r['sourceRow'] for r in observations}),
                      observationsConserved=True, metadataConserved=True,
                      sourceCanonicalRowsSha256=sha(encoded(raw_all)), reassembledObservationRowsSha256=sha(encoded(sorted(reassembled, key=lambda r: r['id']))),
                      sourceObservationRowsSha256=sha(encoded(sorted(observations, key=lambda r: r['id']))),
                      zeroObservationPolities=[p['id'] for p in entries if p['recordCount'] == 0],
                      indexGzipBytes=index_info['bytes'], allShardsGzipBytes=sum(p['bytes'] for p in entries),
                      smallestShardBytes=min(p['bytes'] for p in entries), largestShardBytes=max(p['bytes'] for p in entries),
                      allSearchGzipBytes=sum(s['bytes'] for s in searches), allSearchDecodedBytes=sum(s['decodedBytes'] for s in searches),
                      searchFiles=searches, samples=[p for p in entries if p['id'] in ('cn_ming_dyn', 'pe_inca_emp', 'it_roman_rep_1', 'it_roman_rep_2', 'it_roman_rep_3')])
    emit('build-verification.json', report)
    # The manifest intentionally excludes itself to avoid a circular hash.
    (output / 'manifest.json').write_bytes(encoded(envelope(files=sorted(file_manifest, key=lambda f: f['file']))))
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE_DIR, help='Contains Polaris2026.xlsx, README-original.md and download-records.json')
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir()) / 'meridian-polaris-rebuild', help='Empty output directory; existing files are never replaced')
    args = parser.parse_args(); result = build(args.source_dir, args.output)
    print(json.dumps({k:v for k,v in result.items() if k not in ('samples', 'searchFiles')}, ensure_ascii=False, indent=2))
