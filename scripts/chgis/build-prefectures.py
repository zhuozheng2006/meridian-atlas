"""Build the Fudan CHGIS V4 prefecture time series without coordinate alteration.
Requires Fiona; source archives are preserved alongside the derived data.
"""
import collections, gzip, hashlib, json, pathlib
import fiona

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/data/chgis'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'scripts/chgis/.cache'
def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
def digest(value):
    return hashlib.sha256(value).hexdigest()
records, geometries, keys = [], {}, {}
with fiona.open(SOURCE / 'Prefecture_Bou.TAB', encoding='GB18030') as dataset:
    source_crs = dataset.crs.to_wkt()
    for index, feature in enumerate(dataset):
        original = dict(feature.properties)
        geometry = json.loads(packed(dict(feature.geometry)))
        assert geometry['type'] in ['Polygon', 'MultiPolygon']
        key = digest(packed(geometry))
        if key not in keys:
            keys[key] = 'g' + str(len(keys))
            geometries[keys[key]] = geometry
        records.append({'id':'chgis-prefecture-'+str(index), 'row':index,
                        'start':original['BEG_YR'], 'end':original['END_YR'],
                        'geometryId':keys[key], 'sourceRecord':original})
        assert original['BEG_YR'] <= original['END_YR']
    bounds = list(dataset.bounds)
archive = (SOURCE / 'V4_Prefecture_Bou_TimeSeries.rar').read_bytes()
(OUT / 'V4_Prefecture_Bou_TimeSeries.rar').write_bytes(archive)
metadata = {'title':'CHGIS V4 · Prefecture boundaries time series',
    'sourceURL':'https://yugong.fudan.edu.cn/CHGIS/sjxz.htm',
    'downloadURL':'https://yugong.fudan.edu.cn/V4_Prefecture_Bou_TimeSeries.rar',
    'sourceSHA256':digest(archive), 'sourceCRS':source_crs,
    'coordinateHandling':'Source longitude/latitude values preserved exactly; displayed on the geographic basemap without a datum shift. This is not a survey-accuracy transformation.',
    'dateHandling':'Source BEG_YR and END_YR are inclusive annual bounds; BEG_RULE and END_RULE are retained unexpanded. No intra-year precision is inferred.',
    'identityHandling':'Source row is part of the identity; repeated SYS_ID values are retained as separate source rows.',
    'coverage':'Regional prefecture time series, mainly southern and eastern China; not complete Chinese national territory.',
    'bounds':bounds, 'records':len(records), 'geometries':len(geometries),
    'minYear':min(r['start'] for r in records), 'maxYear':max(r['end'] for r in records)}
def encode_ring(ring):
    result=[]; x=y=0
    for a,b in ring:
        nx,ny=round(a*1e6),round(b*1e6)
        assert nx/1e6==a and ny/1e6==b, 'Non-exact coordinate encoding'
        result.extend([nx-x,ny-y]);x,y=nx,ny
    return result
def encode_geometry(g):
    return {'type':g['type'],'coordinates':[encode_ring(r) for r in g['coordinates']] if g['type']=='Polygon' else [[encode_ring(r) for r in p] for p in g['coordinates']]}
def save(name,data):
    raw=packed(data);compressed=gzip.compress(raw,compresslevel=9,mtime=0)
    (OUT/name).write_bytes(compressed)
    return {'file':name,'bytes':len(compressed),'decodedBytes':len(raw),'sha256':digest(compressed),'decodedSHA256':digest(raw)}
files=[]
for start in range(-300,1901,100):
    end=start+99; selected=[r for r in records if r['start']<=end and r['end']>=start]
    ids=sorted({r['geometryId'] for r in selected})
    files.append(save('century-'+str(start)+'.json.gz',{'schemaVersion':1,'start':start,'end':end,'encoding':'chgis-delta-1e6','geometries':{gid:encode_geometry(geometries[gid]) for gid in ids}}))
files.append(save('index.json.gz',{'schemaVersion':1,'metadata':metadata,'records':records}))
manifest={**metadata,'files':files,'totalBytes':sum(f['bytes'] for f in files)}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False))
