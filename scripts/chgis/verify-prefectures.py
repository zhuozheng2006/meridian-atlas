"""Independent raw MapInfo -> runtime identity/coordinate verification (Fiona)."""
import fiona, pathlib, json, gzip, hashlib
root=pathlib.Path(__file__).resolve().parents[2]; data=root/'public/data/chgis'
index=json.load(gzip.open(data/'index.json.gz'))
with fiona.open(root/'scripts/chgis/.cache/Prefecture_Bou.TAB',encoding='GB18030') as source:
    rows=list(source)
assert len(rows)==len(index['records'])==2016
for i,(original,record) in enumerate(zip(rows,index['records'])):
    assert record['row']==i and record['sourceRecord']==dict(original.properties)
def decode_ring(values):
    x=y=0;out=[]
    for i in range(0,len(values),2):
        x+=values[i];y+=values[i+1];out.append([x/1000000,y/1000000])
    return out
checks=0
for path in sorted(data.glob('century-*.json.gz')):
    pack=json.load(gzip.open(path));expected={r['geometryId'] for r in index['records'] if r['start']<=pack['end'] and r['end']>=pack['start']}
    assert expected==set(pack['geometries'])
    for record in index['records']:
        if not(record['start']<=pack['end'] and record['end']>=pack['start']):continue
        raw=rows[record['row']].geometry;g=pack['geometries'][record['geometryId']]
        coords=[decode_ring(r) for r in g['coordinates']] if g['type']=='Polygon' else [[decode_ring(r) for r in p] for p in g['coordinates']]
        assert g['type']==raw.type
        assert coords==json.loads(json.dumps(raw.coordinates))
        checks+=1
report={'passed':True,'rawRecords':len(rows),'centuryRecordChecks':checks,'everySourceAttributePreserved':True,'everyCoordinateAndRingPreserved':True,'sourceArchiveSHA256':hashlib.sha256((data/'V4_Prefecture_Bou_TimeSeries.rar').read_bytes()).hexdigest(),'reader':'Fiona '+fiona.__version__}
(root/'docs/verification-3.55/chgis-source-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
