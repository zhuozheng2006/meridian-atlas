from physical_paths import workspace
from pathlib import Path
import json,gzip,hashlib,collections
from shapely.geometry import shape, mapping
from shapely.validation import make_valid, explain_validity
from opencc import OpenCC
cc=OpenCC("t2s")
ROOT=workspace(); OUT=ROOT/'assets'; OUT.mkdir(exist_ok=True)
manifest=[]
for name in ['land','lakes','rivers_lake_centerlines']:
    src=ROOT/f'ne_10m_{name}.geojson'; d=json.loads(src.read_text()); props=[]; repairs=[]
    if name=='land': d['features']=[f for f in d['features'] if f['properties'].get('featurecla')!='Null island']
    for i,f in enumerate(d['features']):
        p=f['properties'];geom=shape(f['geometry'])
        if not geom.is_valid:
            repaired=make_valid(geom);repairs.append({'source_id':p.get('ne_id'),'reason':explain_validity(geom),'method':'Shapely make_valid','area_difference_square_degrees':abs(repaired.area-geom.area)})
            f['geometry']=mapping(repaired)
        kind=p.get('featurecla') or ('Land' if name=='land' else '')
        artificial=kind in ['Reservoir','Canal'] or 'canal' in (p.get('name') or '').lower() or bool(p.get('dam_name')) or (name=='lakes' and (p.get('year') or -99)>0)
        f['properties']={'id':str(p.get('ne_id') or f'ne-{name}-{i}'),'kind':kind,'rank':p.get('scalerank') or 0,'minzoom':p.get('min_zoom') or 0,'minlabel':p.get('min_label') or 0,'name':p.get('name_en') or p.get('name') or '', 'zh':cc.convert(p.get('name_zh') or ''), 'artificial':artificial}
        if p.get('wikidataid'):f['properties']['wikidata']=p['wikidataid']
        if p.get('year') and p['year']>0:f['properties']['built']=p['year']
        props.append(kind)
    dst=OUT/f'{name.replace("rivers_lake_centerlines","rivers")}-10m.json.gz'; raw=json.dumps(d,ensure_ascii=False,separators=(',',':')).encode();dst.write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
    m={'name':name,'feature_count':len(d['features']),'kinds':dict(collections.Counter(props)),'artificial_count':sum(f['properties']['artificial'] for f in d['features']),'source_url':f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_{name}.geojson','source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':dst.name,'gzip_bytes':dst.stat().st_size,'json_bytes':len(raw),'output_sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'coordinates':'No geometry simplification. Synthetic Null island excluded; zero-area ring self-intersections repaired with make_valid and separately logged.','topology_repairs':repairs,'zh_conversion':'OpenCC t2s on source name_zh','license':'Public domain','license_url':'https://www.naturalearthdata.com/about/terms-of-use/'}
    manifest.append(m);print(json.dumps(m,ensure_ascii=False))
(OUT/'physical-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
