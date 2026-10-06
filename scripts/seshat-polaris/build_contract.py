#!/usr/bin/env python3
# Priority IDs are the fixed reviewed 3.38 display selection, not an entity/record join.
import pathlib,json,gzip,hashlib,argparse
project=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Generate pinned Polaris client integrity metadata; no network or data joins.')
parser.add_argument('--data-dir',type=pathlib.Path,default=project/'public/data/seshat-polaris-2026')
parser.add_argument('--output',type=pathlib.Path,default=project/'public/polaris-contract.js')
parser.add_argument('--check',action='store_true')
args=parser.parse_args();source=args.data_dir;target=args.output
schema=json.loads((source/'schema.json').read_text())
index=json.loads(gzip.decompress((source/'index.json.gz').read_bytes()))
expected='cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41'
assert index['sourceSha256']==expected and hashlib.sha256((source/'sources/Polaris2026.xlsx').read_bytes()).hexdigest()==expected, 'Source snapshot mismatch'
decoded={}
for file in sorted(source.rglob('*')):
 if file.is_file() and file.suffix=='.gz':
  raw=gzip.decompress(file.read_bytes());decoded[str(file.relative_to(source))]=[hashlib.sha256(raw).hexdigest(),len(raw)]
contract={'datasetId':index['datasetId'],'version':index['version'],'sourceSha256':index['sourceSha256'],'recordCount':index['recordCount'],'polityCount':index['polityCount'],'variableCount':index['variableCount'],'indexSha256':hashlib.sha256((source/'index.json.gz').read_bytes()).hexdigest(),'sourceURL':json.loads((source/'provenance.json').read_text())['sourceURL'],'workbookURL':json.loads((source/'provenance.json').read_text())['workbookURL']}
tables={s['sourceSheet']:{'headers':[c['name']for c in s['columns']],'recordCount':s['recordCount'],'recordKind':('polity-metadata'if s['sourceSheet']=='Polities'else'variable-metadata'if s['sourceSheet']=='Variables'else'crisis-consequence'if s['sourceSheet'].startswith('CrisisDB')else'coded-observation')}for s in schema['sheets']}
priorityIds=['polity_territory', 'polity_population', 'population_of_the_largest_settlement', 'settlement_hierarchy', 'administrative_level', 'full_time_bureaucrat', 'examination_system', 'merit_promotion', 'formal_legal_code', 'judge', 'court', 'irrigation_system', 'market', 'road', 'bridge', 'canal', 'port', 'script', 'calendar', 'scientific_literature', 'foreign_coin', 'indigenous_coin', 'paper_currency', 'courier', 'postal_station', 'general_postal_service']
assert len(priorityIds)==26
enc=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
content=('// Generated only from pinned importer outputs and reviewed metadata; no data joins.\n'+f'export const SNAPSHOT=Object.freeze({enc(contract)});\n'+f'export const TABLES=Object.freeze({enc(tables)});\n'+f'export const DECODED_FILES=Object.freeze({enc(decoded)});\n'+f'export const PRIORITY_VARIABLE_IDS=Object.freeze({enc(priorityIds)});\n')
if args.check:
 assert target.read_text()==content, 'Stale Polaris client contract'
else:
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content)
print(json.dumps({'contractBytes':target.stat().st_size,'contractGzipBytes':len(gzip.compress(target.read_bytes(),mtime=0)),'knownGzipFiles':len(decoded),'priorityVariables':len(priorityIds)},indent=2))
