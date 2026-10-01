"""Build display-only Cliopatria geometry assets; original years/properties are retained.
Run with .venv/bin/python build_assets.py. No source geometry repair or temporal interpolation.
"""
import pathlib,json,hashlib,gzip,datetime,collections
from shapely.geometry import shape,mapping
root=pathlib.Path(__file__).parent
out=root/'assets';out.mkdir(exist_ok=True)
source=json.loads((root/'source.json').read_text())
data=json.loads((root/'cliopatria.geojson').read_text())
labels=json.loads((root/'wikidata-labels.json').read_text()) if (root/'wikidata-labels.json').exists() else {}
TOLERANCE=.02;PRECISION=5;MAX_SHARD=1_800_000

def dump(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def rounded(v):
 if isinstance(v,(tuple,list)):return [rounded(x) for x in v]
 return round(v,PRECISION) if isinstance(v,float) else v
records=[];geometries={};geometry_bytes={};hash_ids={};issues=[];raw_invalid=[];zero=[];geom_index={};shards=[]
for i,f in enumerate(data['features']):
 p=f['properties'];rid=f'clio-{i:05d}';raw=shape(f['geometry'])
 if not raw.is_valid:raw_invalid.append(rid)
 simple=raw.simplify(TOLERANCE,preserve_topology=True)
 mapped=mapping(simple);geo={'type':mapped['type'],'coordinates':rounded(mapped['coordinates'])}
 # Decimal rounding must not turn a valid input into an invalid polygon.
 if simple.is_valid and not shape(geo).is_valid:
  geo=mapping(simple);issues.append({'id':rid,'kind':'unrounded_geometry_to_preserve_validity'})
 serialized=dump(geo);key=hashlib.sha256(serialized.encode()).hexdigest()
 if key not in hash_ids:
  gid=f'g{len(hash_ids):05d}';hash_ids[key]=gid;geometries[gid]=geo;geometry_bytes[gid]=serialized
 gid=hash_ids[key]
 label=labels.get(p['Wikidata'],{})
 # A RELATION's QID often points to a participating state or ruler, not the relation.
 zh=label.get('zh') if p['Type']=='POLITY' else None
 en=label.get('en') if p['Type']=='POLITY' else None
 point=raw.representative_point()
 r={'id':rid,'name':p['Name'],'zhName':zh,'enName':en,'start':p['FromYear'],'end':p['ToYear'],'area':p['Area'],'type':p['Type'],'wikidata':p['Wikidata'] or None,'wikipedia':p['Wikipedia'] or None,'seshatId':p['SeshatID'] or None,'components':[x for x in p['Components'].split(';') if x],'memberOf':[x for x in p['MemberOf'].split(';') if x],'geometryId':gid,'bbox':[round(x,5) for x in raw.bounds],'center':[round(point.x,5),round(point.y,5)],'nameTranslationStatus':'wikidata_entity_label' if zh else 'original_name','zhLanguage':label.get('zhLanguage') if zh else None}
 records.append(r)
 if p['FromYear']==0 or p['ToYear']==0:zero.append(rid)
 if i%3000==0:print('records',i,flush=True)

parts={};size=2
def flush():
 global parts,size
 if not parts:return
 idx=len(shards);name=f'geometries-{idx:03d}.json';payload=dump(parts).encode();compressed=gzip.compress(payload,compresslevel=9,mtime=0)
 (out/name).write_bytes(payload);(out/(name+'.gz')).write_bytes(compressed)
 for gid in parts:geom_index[gid]=name
 shards.append({'file':name,'gzipFile':name+'.gz','bytes':len(payload),'gzipBytes':len(compressed),'count':len(parts),'sha256':hashlib.sha256(payload).hexdigest(),'gzipSha256':hashlib.sha256(compressed).hexdigest()})
 parts={};size=2
for gid,geometry in geometries.items():
 n=len(geometry_bytes[gid].encode())+len(gid)+5
 if size+n>MAX_SHARD and parts:flush()
 parts[gid]=geometry;size+=n
flush()
metadata={
 'title':'Cliopatria historical polity boundaries — display derivative',
 'sourceProject':'Seshat Global History Databank / Cliopatria','repository':'https://github.com/'+source['repo'],
 'commit':source['commit'],'sourceDownloadUrl':source['downloadUrl'],'sourceZipSha256':source['sha256'],
 'sourceArchiveMember':'cliopatria_polities_only.geojson','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
 'attribution':'Boundary data: Cliopatria, Seshat Global History Databank (CC BY 4.0). Display geometry simplified by 0.02° and coordinates rounded to five decimals; source dates unchanged.',
 'builtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'yearRange':[-3400,2024],
 'dateSemantics':'FromYear and ToYear inclusive. Negative=BCE, positive=CE. UI must not select year 0. Six source ToYear=0 endpoints are preserved and flagged; source years are not reinterpreted.',
 'yearZeroEndpointRecordIds':zero,'activePredicate':'year !== 0 && record.start <= year && year <= record.end',
 'displayYearToIndex':'year < 0 ? year + 3400 : year + 3399',
 'displayIndexToYear':'index < 3400 ? index - 3400 : index - 3399',
 'coverageWarningZh':'各地区与时期记录疏密不同，空白表示本数据集未提供该位置在该年的疆域，不代表无人居住或不存在政治共同体。相同边界在时间区间内沿用，不表示已掌握每年的精确边界；不对缺失时代插值。',
 'relationWarningZh':'RELATION为联盟、效忠或共主联合等关系范围，常与组成政体重叠；默认仅显示POLITY，关系层需独立选择。',
 'namesWarningZh':'中文/英文补充名来自对应Wikidata实体标签，可能比原数据名称更宽泛；原始name始终保留。未获中文标签时zhName=null并保留原名。RELATION不直接采用参与者或统治者标签作为关系名。',
 'wikidataLabelLicense':'CC0','simplification':{'method':'Shapely simplify(preserve_topology=True)','toleranceDegrees':TOLERANCE,'coordinateDecimalPlaces':PRECISION,'dropsSmallIslands':False,'repairsSourceGeometry':False,'interpolatesDates':False,'scope':'Overview display only, not precise boundary measurement; shared borders may have visual slivers after independent simplification.'},
 'counts':{'records':len(records),'polityRecords':sum(r['type']=='POLITY' for r in records),'relationRecords':sum(r['type']=='RELATION' for r in records),'uniqueNames':len({r['name'] for r in records}),'uniqueGeometries':len(geometries),'geometryShards':len(shards),'recordsWithZh':sum(bool(r['zhName']) for r in records)},
 'sourceInvalidGeometryRecordIds':raw_invalid,'processingExceptions':issues,'shards':shards,
 'areaSemantics':'Source Area field in square kilometers, computed upstream using EPSG:6933; not recomputed from display geometry.',
 'centerSemantics':'Representative point computed from source geometry, rounded to 5 decimals.'
}
cat={'records':records,'geometryIndex':geom_index,'metadata':metadata}
payload=dump(cat).encode();(out/'catalog.json').write_bytes(payload);(out/'catalog.json.gz').write_bytes(gzip.compress(payload,compresslevel=9,mtime=0))
# Dedicated metadata is lightweight enough for the sources/coverage panel.
(out/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
(out/'LICENSE.md').write_bytes((root/'LICENSE.md').read_bytes())
print(json.dumps({'counts':metadata['counts'],'catalogBytes':len(payload),'geometryBytes':sum(s['bytes'] for s in shards),'geometryGzipBytes':sum(s['gzipBytes'] for s in shards),'sourceInvalidGeometryCount':len(raw_invalid),'roundingExceptions':len(issues),'largestShardBytes':max(s['bytes'] for s in shards)},ensure_ascii=False),flush=True)
