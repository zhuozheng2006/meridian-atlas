#!/usr/bin/env python3
"""Independent source-cell, partition, identity and deterministic rebuild checks."""
import argparse
from collections import Counter
from copy import deepcopy
from decimal import Decimal, InvalidOperation
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

HERE=Path(__file__).resolve().parent
DEFAULT_DATA_DIR=HERE.parents[1]/'public/data/seshat-polaris-2026'
SHA='cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41'
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
checks=[]
def read(path):return json.loads(gzip.decompress(path.read_bytes()) if path.name.endswith('.gz') else path.read_bytes())
def digest(data):return hashlib.sha256(data).hexdigest()
def check(name, fn):
    fn();checks.append({'name':name,'passed':True});print('PASS',name)
def assert_that(value,message='Assertion failed'):assert value,message

def validate_files(root):
    manifest=read(root/'manifest.json'); names=set()
    for item in manifest['files']:
        path=root/item['file'];assert path.resolve().is_relative_to(root.resolve())
        data=path.read_bytes();assert len(data)==item['bytes'] and digest(data)==item['sha256'],item['file']
        assert item['file'] not in names;names.add(item['file'])
    assert {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}==names|{'manifest.json'}
    assert digest((root/'sources/Polaris2026.xlsx').read_bytes())==SHA
    return manifest

def source_cell_match(source, schemas, exported):
    # Independent flat-cell walk over each original XML sheet; no importer helpers.
    with zipfile.ZipFile(source) as archive:
        shared=[]
        if 'xl/sharedStrings.xml' in archive.namelist():
            for si in ET.fromstring(archive.read('xl/sharedStrings.xml')):
                shared.append(''.join(n.text or '' for n in si.iter('{'+NS['s']+'}t')))
        counts={}; type_counts=Counter();null_count=0
        for schema in schemas:
            sheet=schema['sourceSheet'];columns={c['column']:c['name'] for c in schema['columns']}
            known_rows=exported[sheet];actual_rows=set()
            for row in ET.fromstring(archive.read(schema['xmlPart'])).findall('s:sheetData/s:row',NS):
                row_number=row.attrib['r'];source_values={};source_types={}
                for cell in row.findall('s:c',NS):
                    key=re.sub('[0-9]','',cell.attrib['r']);typ=cell.attrib.get('t','n')
                    v=cell.find('s:v',NS);val=v.text if v is not None else None
                    if typ=='s' and val is not None:val=shared[int(val)]
                    if typ=='inlineStr':
                        inline=cell.find('s:is',NS)
                        val=None if inline is None else ''.join(n.text or '' for n in inline.iter('{'+NS['s']+'}t'))
                    source_values[key]=val;source_types[key]=typ
                if not any(v is not None for v in source_values.values()):continue
                if row_number==schema['headerRow']:
                    assert source_values==columns
                    assert source_types=={c['column']:c['cellType'] for c in schema['columns']}
                    continue
                actual_rows.add(row_number);out=known_rows[row_number]
                assert set(out['raw'])==set(columns.values())==set(out['cellTypes'])
                assert out['sourceSheet']==sheet and out['sourceRow']==row_number
                assert out['id']==f'sha256:{SHA}:{sheet}:{row_number}'
                for col,field in columns.items():
                    expected=source_values.get(col);expected_type=source_types.get(col)
                    assert out['raw'][field]==expected,(sheet,row_number,field,'raw-value')
                    assert out['cellTypes'][field]==expected_type,(sheet,row_number,field,'cell-type')
                    type_counts[expected_type if expected_type is not None else 'missing-cell']+=1
                    null_count+=expected is None
            assert actual_rows==set(known_rows),sheet
            counts[sheet]=len(actual_rows)
        return {'sourceCellTypes':dict(type_counts),'nullRawFields':null_count,'sourceSheetCounts':counts}

def verify(root, report_path=None, source_dir=None):
    global checks
    root=root.resolve();source=(source_dir or root/'sources')/'Polaris2026.xlsx';check('Every manifest file has its declared bytes and SHA; no extra files',lambda:validate_files(root))
    index=read(root/'index.json.gz');schemas=read(root/'schema.json')['sheets']
    allrows=[];phase_metadata=[];zero=[]
    for p in index['polities']:
        part=read(root/p['file']);assert part['polityId']==p['id'];assert len(part['observations'])==p['recordCount']
        assert part['schemaVersion']==2 and part['sourceSha256']==SHA
        assert all(r['raw']['polity_id']==p['id'] for r in part['observations'])
        allrows+=part['observations'];phase_metadata+=part['metadata']
        if not p['recordCount']:zero.append(p['id'])
    variables=read(root/index['variableMetadataFile'])['records']
    metadata=read(root/index['polityMetadataFile'])['records']
    all_by_id={r['id']:r for r in allrows}
    def no_collisions():
        assert len(index['polities'])==626
        assert len(allrows)==len(all_by_id)==57631
        assert len({r['sourceRow'] for r in allrows})==26033
        assert len({r['id'] for r in allrows+metadata+variables})==58430
    check('58,430 source row IDs are unique; repeated bare sheet row numbers do not collide',no_collisions)
    check('All 7 phases without observations remain in the index and have readable empty shards',lambda:assert_that(len(zero)==7))
    check('All 626 polity metadata rows and 173 variable metadata rows remain exact',lambda:assert_that(len(metadata)==626 and len(variables)==173 and {r['id']:r for r in phase_metadata}=={r['id']:r for r in metadata}))
    by_sheet={s['sourceSheet']:{} for s in schemas}
    for row in allrows+metadata+variables:by_sheet[row['sourceSheet']][row['sourceRow']]=row
    source_audit=source_cell_match(source,schemas,by_sheet)
    checks.append({'name':'Every original header, raw field, null, cell type and source row equals the workbook XML','passed':True});print('PASS',checks[-1]['name'])
    searchrows=[]
    for part in index['searchFiles']:
        rows=read(root/part['file'])['observations'];assert len(rows)==part['recordCount']
        assert all(r['sourceSheet']==part['sourceSheet'] and r['recordKind']==part['recordKind'] for r in rows)
        searchrows+=rows
    check('Six source-sheet search bundles reconstruct the same 57,631 observations',lambda:assert_that(len(searchrows)==len(allrows) and {r['id']:r for r in searchrows}==all_by_id))
    crisis=[r for r in allrows if r['recordKind']=='crisis-consequence'];normal=[r for r in allrows if r['recordKind']=='coded-observation']
    def crisis_preserved():
        assert len(crisis)==166 and len(normal)==57465
        outcome_fields=['decline','collapse','epidemic','downward_mobility','extermination','uprising','revolution','successful_revolution','civil_war','century_plus','fragmentation','capital','conquest','assassination','depose','constitution','labor','unfree_labor','suffrage','public_goods','religion']
        for row in crisis:
            assert 'value_from' not in row['raw'] and 'value_to' not in row['raw']
            for field in outcome_fields:
                assert row['raw'][field] in {'A','P','IA','IP','SU','DIS'}
                assert row['cellTypes'][field] in ('inlineStr','s')
        assert sum(r['raw']['is_disputed'] is None for r in crisis)==140
        assert sum(r['raw']['is_uncertain'] is None for r in crisis)==143
        assert all(r['raw']['is_uncertain'] in (None,'0') for r in crisis)
    check('CrisisDB keeps 166 whole records, 21 coded outcomes and null uncertainty flags',crisis_preserved)
    phases={r['raw']['polity_id']:r['raw'] for r in metadata}
    dated_zero=[];one_sided=[];outside=[];reversed_values=[]
    for row in allrows:
        raw=row['raw'];dates=[raw.get('year_from'),raw.get('year_to')]
        if any(v is not None and Decimal(v)==0 for v in dates):dated_zero.append(row['id'])
        if sum(v is None for v in dates)==1:one_sided.append(row['id'])
        phase=phases[raw['polity_id']]
        if any(v is not None and not Decimal(phase['start_year'])<=Decimal(v)<=Decimal(phase['end_year']) for v in dates):outside.append(row['id'])
        a,b=raw.get('value_from'),raw.get('value_to')
        if a is not None and b is not None:
            try:
                if Decimal(a)>Decimal(b):reversed_values.append(row['id'])
            except InvalidOperation:pass
    def unusual_rows():
        assert len(dated_zero)==4 and len(one_sided)==8 and len(outside)==117 and len(reversed_values)==8
        ming=by_sheet['CrisisDB - Crisis consequences']['26']['raw']
        inca=by_sheet['CrisisDB - Crisis consequences']['120']['raw']
        assert (ming['polity_id'],ming['year_from'],ming['year_to'])==('cn_ming_dyn','1644','1683')
        assert (inca['polity_id'],inca['year_from'],inca['year_to'])==('pe_inca_emp','1528','1570')
    check('Zero years, one-sided dates, beyond-phase dates and reverse value endpoints are not normalized away',unusual_rows)
    def negative_control():
        target=next(r for r in allrows if r['cellTypes'].get('is_uncertain')=='b')
        value=target['raw']['is_uncertain'];target['raw']['is_uncertain']=False
        try:
            try:source_cell_match(source,schemas,by_sheet)
            except AssertionError:return
            raise RuntimeError('A changed source boolean escaped the independent XML check')
        finally:target['raw']['is_uncertain']=value
    check('Negative control rejects a boolean value converted from original lexical encoding',negative_control)
    with tempfile.TemporaryDirectory(prefix='meridian-polaris-verify-') as temp:
        other=Path(temp)/'candidate'
        subprocess.run([sys.executable,str(HERE/'build_polaris.py'),'--source-dir',str(source.parent),'--output',str(other)],check=True,capture_output=True)
        source_files={str(p.relative_to(root)):digest(p.read_bytes()) for p in root.rglob('*') if p.is_file()}
        rebuilt={str(p.relative_to(other)):digest(p.read_bytes()) for p in other.rglob('*') if p.is_file()}
        check('Independent rebuild produces the exact same file set and every byte hash',lambda:assert_that(source_files==rebuilt))
    report={'sourceSha256':SHA,'method':'Independent workbook XML cell comparison, output manifests, reassembly, anomaly assertions, negative control, and a second standalone importer process.',
            'passed':len(checks),'total':len(checks),'checks':checks,'sourceAudit':source_audit,
            'fileCount':len(source_files),'totalBytes':sum(p.stat().st_size for p in root.rglob('*') if p.is_file()),
            'preservedAnomalies':{'zeroDateRows':dated_zero,'oneSidedDateRows':one_sided,'outsidePhaseDateRows':outside,'reverseValueEndpointRows':reversed_values}}
    if report_path:report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('checks','preservedAnomalies','sourceAudit')},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--data',type=Path,default=DEFAULT_DATA_DIR);parser.add_argument('--source-dir',type=Path,help='Defaults to the selected data directory / sources');parser.add_argument('--report',type=Path);args=parser.parse_args();verify(args.data,args.report,args.source_dir)
