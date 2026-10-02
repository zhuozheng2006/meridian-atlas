import pathlib,json,gzip,collections,hashlib
root=pathlib.Path(__file__).parent;a=root/'assets';cat=json.loads((a/'catalog.json').read_text());records=cat['records']
assert gzip.decompress((a/'catalog.json.gz').read_bytes())==(a/'catalog.json').read_bytes()
assert len(records)==13765
assert all(len(r['evidenceWarnings'])==len(r['evidenceWarningsEn']) for r in records)
assert all(r.get('translationNoteEn') for r in records)
for name,expected in {'Qin':'秦国','Qin Dynasty':'秦朝','Han':'韩（古代诸侯国）','Han Dynasty':'汉朝','Jin':'晋国','Republic of Korea':'大韩民国','Western Liang':'西凉（十六国）','Later Western Liang':'西梁（南朝）'}.items():
 rs=[r for r in records if r['name']==name];assert rs and all(r['zhName']==expected for r in rs),name
for r in records:
 if (r['name']=='Later Zhou' and r['end']<0) or (r['name']=='Hashemite Arab Federation' and r['end']<1900):
  assert r['zhName'] is None and r['nameTranslationStatus']=='ambiguous_source_period' and r['evidenceWarnings']
 for geometry in [r['geometryId']]:assert geometry in cat['geometryIndex']
source=json.loads((root/'cliopatria.geojson').read_text())['features']
for f,r in zip(source,records):
 p=f['properties'];assert (p['Name'],p['FromYear'],p['ToYear'],p['Wikipedia'],p['Wikidata'])==(r['name'],r['start'],r['end'],r['wikipedia'] or '',r['wikidata'] or '')
untranslated=[r for r in records if r['type']=='POLITY' and not r['zhName']]
report={'passed':True,'manualExactNameTranslations':183,'untranslatedPolityRecords':len(untranslated),'untranslatedPolityNames':len({r['name'] for r in untranslated}),'untranslatedRelationRecords':sum(r['type']=='RELATION' and not r['zhName'] for r in records),'recordsWithChinese':sum(bool(r['zhName']) for r in records),'englishWarningsAndNotesPresent':True,'upstreamIdentityAndDatesUnchanged':True,'sampleDisambiguationCasesPassed':8}
(a/'translation-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
report_path=a/'validation-report.json';old=json.loads(report_path.read_text());old['gzipGeometryDeploymentBytes']=sum(s['gzipBytes'] for s in cat['metadata']['shards'])+sum((a/n).stat().st_size for n in ['catalog.json','metadata.json','coverage.json','LICENSE.md']);old['fullyCompressedDeploymentBytes']=old['gzipGeometryDeploymentBytes']-(a/'catalog.json').stat().st_size+(a/'catalog.json.gz').stat().st_size;old['rawDeploymentBytes']=old['gzipGeometryDeploymentBytes']-sum(s['gzipBytes'] for s in cat['metadata']['shards'])+sum(s['bytes'] for s in cat['metadata']['shards']);report_path.write_text(json.dumps(old,ensure_ascii=False,indent=2))
files=['catalog.json.gz','metadata.json','coverage.json','LICENSE.md','identity-audit.json','manual-translations.json','validation-report.json','translation-validation.json']+sorted(p.name for p in a.glob('geometries-*.json.gz'))
items=[{'file':n,'bytes':(a/n).stat().st_size,'sha256':hashlib.sha256((a/n).read_bytes()).hexdigest()} for n in files]
manifest={'files':items,'totalBytes':sum(x['bytes'] for x in items),'loadContract':'Gzip JSON files must be decompressed by loader unless server Content-Encoding already decoded them. geometryIndex contains .json names; append .gz.','sourceCommit':cat['metadata']['commit']};(a/'production-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('production bytes',manifest['totalBytes'])
