"""Verify delivered bytes, source attributes, empty tiles, and decoded polygon bounds."""
from pathlib import Path
import argparse, collections, gzip, hashlib, json, sqlite3, sys, tempfile
import mapbox_vector_tile
from shapely.geometry import shape
from prepare_metadata import extract as extract_codebook

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--codebook', type=Path, required=True)
parser.add_argument('--publish', type=Path, required=True)
parser.add_argument('--build-report', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args()
PUBLISH = args.publish.resolve()
if sys.flags.optimize:
    parser.error('Do not use python -O: audit assertions must remain enabled')
if args.report.resolve().is_relative_to(PUBLISH) or args.report.resolve() in {
    args.source.resolve(), args.codebook.resolve(), args.build_report.resolve()
}:
    parser.error('Audit report must be outside publish and must not replace an input')
assert hashlib.sha1(args.source.read_bytes()).hexdigest() == '33da3c0222f9a94f3539ad0f780c6b899ab09a97'
assert hashlib.sha1(args.codebook.read_bytes()).hexdigest() == '3ff58e73740970b2af8e54767c1ccb9c7c239aa7'
manifest = json.loads((PUBLISH/'manifest.json').read_bytes())
report = json.loads(args.build_report.read_bytes())
db = sqlite3.connect(args.source.resolve().as_uri()+'?mode=ro',uri=True)
db.row_factory = sqlite3.Row
rows = db.execute('SELECT * FROM "HALC 1500" ORDER BY fid').fetchall()
source = {r['fid']:{k:r[k] for k in r.keys() if k!='geom'} for r in rows}
detail_records = {}
for shard in manifest['details']['shards']:
    path=PUBLISH/shard['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==shard['sha256']
    records=json.loads(gzip.decompress(path.read_bytes()))['records']
    for fid,record in records.items():
        assert int(fid)//256==shard['shard']
        assert record==source[int(fid)]
        detail_records[int(fid)] = record
assert len(detail_records)==len(source)==14863
expected_tiles=set()
for z,limits in manifest['tileRanges'].items():
    for x in range(limits['x'][0],limits['x'][1]+1):
        for y in range(limits['y'][0],limits['y'][1]+1):
            expected_tiles.add(f'tiles/{z}/{x}/{y}.pbf')
actual_tiles={str(p.relative_to(PUBLISH)) for p in (PUBLISH/'tiles').rglob('*.pbf')}
assert expected_tiles==actual_tiles
tile_source_keys=['fid','NAME','SHORT_ID','ADM0','ADM1','TYPE','QUALITY']
ids_by_zoom=collections.defaultdict(set)
empty=0
feature_instances=0
invalid_decoded=[]
max_bound_excess=0
for entry in report['tiles']:
    path=PUBLISH/'tiles'/str(entry['z'])/str(entry['x'])/f"{entry['y']}.pbf"
    raw=path.read_bytes()
    assert len(raw)==entry['bytes']
    assert hashlib.sha256(raw).hexdigest()==entry['sha256']
    layers=mapbox_vector_tile.decode(raw,default_options={'y_coord_down':True})
    assert set(layers)=={'halc_localities'}
    layer=layers['halc_localities']
    assert layer['extent']==8192 and layer['version']==2
    empty+=not layer['features']
    for feature in layer['features']:
        fid=feature['id']
        assert feature['properties']=={k:source[fid][k] for k in tile_source_keys}
        ids_by_zoom[entry['z']].add(fid)
        geom=shape(feature['geometry'])
        assert not geom.is_empty
        if not geom.is_valid:
            invalid_decoded.append({'z':entry['z'],'x':entry['x'],'y':entry['y'],'fid':fid})
        x0,y0,x1,y1=geom.bounds
        max_bound_excess=max(max_bound_excess,-64-x0,-64-y0,x1-8256,y1-8256)
        feature_instances+=1
assert max_bound_excess==0
assert not invalid_decoded
assert all(ids_by_zoom[z]==set(source) for z in range(7,11))
with tempfile.TemporaryDirectory(prefix='halc-codebook-') as temp:
    extracted = Path(temp)
    extract_codebook(args.codebook, extracted)
    for filename in ['polygon-fields.json', 'region-codes.json', 'bibliography.json',
                     'administrative-subdivisions.json', 'legends.json']:
        expected = json.loads((extracted/filename).read_bytes())
        actual = json.loads((PUBLISH/'metadata'/filename).read_bytes())
        assert expected == actual, filename
files=[p for p in PUBLISH.rglob('*') if p.is_file()]
assert len(files)<4000
assert max(p.stat().st_size for p in files)<25*1024*1024
result={'sourceRecordCount':len(source),'detailRecordCount':len(detail_records),'detailsEqualAllOriginalAttributes':True,
        'tileCount':len(actual_tiles),'completeRectangularCoverage':True,'emptyTiles':int(empty),
        'decodedFeatureInstances':feature_instances,'decodedInvalidGeometries':len(invalid_decoded),
        'decodedBoundsStayWithinBuffer':True,'uniqueFidsByZoom':{str(z):len(ids) for z,ids in ids_by_zoom.items()},
        'zoom6MissingFids':sorted(set(source)-ids_by_zoom[6]),
        'sourcePropertiesMatchEveryTileFeature':True,'codebookDictionariesMatchSourceCodebookReExtraction':True,
        'fileCount':len(files),'totalPublishedBytes':sum(p.stat().st_size for p in files),
        'maxPublishedFileBytes':max(p.stat().st_size for p in files)}
args.report.parent.mkdir(parents=True,exist_ok=True)
args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,indent=2))
