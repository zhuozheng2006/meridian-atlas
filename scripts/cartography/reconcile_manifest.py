"""Create metadata-only release overlay; never edits the input physical directory."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--physical-dir', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--geometry-report', type=Path)
parser.add_argument('--tile-report', type=Path)
args = parser.parse_args()
root = args.physical_dir.resolve()
out = args.output_dir.resolve()
assert root != out and root not in out.parents, 'Output must be separate from the input release.'
out.mkdir(parents=True, exist_ok=True)
expected_overlay = {'ATTRIBUTION.md','files.json','modern-ocean-mask.manifest.json','physical-manifest.json','physical-overview.manifest.json','release-manifest.json'}
assert all(p.is_file() and p.name in expected_overlay for p in out.iterdir()), 'Use a dedicated metadata overlay directory.'

def sha(b):
    return hashlib.sha256(b).hexdigest()
def read(name):
    return json.loads((root/name).read_text())
def write(name, value):
    (out/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
def info(name):
    b = (root/name).read_bytes()
    return {'bytes':len(b), 'sha256':sha(b)}

mapping = read('river-names-zh-en.json')
vectors = read('physical-manifest.json')
for item in vectors:
    name = item['output']
    packed = (root/name).read_bytes()
    raw = gzip.decompress(packed)
    d = json.loads(raw)
    item.update(gzip_bytes=len(packed), json_bytes=len(raw), output_sha256=sha(packed), feature_count=len(d['features']))
    empty = [{'id':f['properties'].get('id'),'name':f['properties'].get('name')} for f in d['features'] if not f['geometry'].get('coordinates')]
    item['nonempty_feature_count'] = len(d['features'])-len(empty)
    item['known_empty_source_records'] = empty
    if name == 'rivers-10m.json.gz':
        item['name_enrichment'] = {'mapping':'river-names-zh-en.json', 'mapping_sha256':info('river-names-zh-en.json')['sha256'], 'river_groups':len(mapping['rivers']), 'feature_count':sum(len(r['featureIds']) for r in mapping['rivers']), 'changed_properties':['zh','label_en','name_source'], 'geometry_changed':False, 'sources':'Official/institutional naming references and per-entry verification depth retained in river-names-zh-en.json', 'source_name_preserved':True}
write('physical-manifest.json', vectors)

overview = read('physical-overview.manifest.json')
overview['optional_build_outputs'] = [x for x in overview['outputs'] if not (root/x['file']).exists()]
overview['outputs'] = [x for x in overview['outputs'] if (root/x['file']).exists()]
for item in overview['outputs']:
    b = (root/item['file']).read_bytes()
    item.update(gzip_bytes=len(b), json_bytes=len(gzip.decompress(b)), sha256=sha(b))
for layer, name in [('rivers','rivers-10m.json.gz'), ('lakes','lakes-10m.json.gz')]:
    entry = overview['physical_inputs'][layer]
    entry['build_workspace_file'] = entry.get('build_workspace_file', entry['file'])
    entry.update(file=name, sha256=info(name)['sha256'])
overview['land_input']['build_workspace_file'] = overview['land_input'].get('build_workspace_file', overview['land_input']['file'])
overview['land_input'].update(file='land-10m.json.gz', sha256=info('land-10m.json.gz')['sha256'])
write('physical-overview.manifest.json', overview)

mask = read('modern-ocean-mask.manifest.json')
mask['build_input_file'] = mask.get('build_input_file', mask['input_file'])
mask['input_file'] = 'land-10m.json.gz'
mask['input_sha256'] = info('land-10m.json.gz')['sha256']
mask.update(gzip_bytes=info(mask['file'])['bytes'], sha256=info(mask['file'])['sha256'])
write('modern-ocean-mask.manifest.json', mask)

attribution = (root/'ATTRIBUTION.md').read_text()
attribution = attribution.replace('Processing: no coordinate simplification for physical vectors.', 'Processing: detailed land, river and lake vectors retain the source coordinates without simplification; the explicitly separate overview datasets are generalized for display.')
addition = '''

## Display overviews, coastline alignment, and bilingual names

The overview selects natural rivers/lakes with rank <= 3 or minzoom <= 3 and simplifies them at 0.02 degrees with topology preservation. The overview ocean mask is derived from the modern land union generalized at 0.03 degrees, re-unioned to dissolve nested shells, and then complemented; land and water are not simplified independently. The detailed ocean mask uses the unsimplified modern land complement. Both masks are clipped to the Web Mercator latitude range and partitioned into six 60-degree longitude strips. Historical territory coordinates remain unchanged. This visual alignment uses present-day coasts and does not reconstruct ancient shorelines or river courses.

Thirty major rivers have reviewed Simplified Chinese and English labels applied to 56 Natural Earth segments. The original source name and all river coordinates remain unchanged. The mapping, naming references, exact IAEA PDF pages where applicable, and the verification depth of the other institutional references are recorded in river-names-zh-en.json. These labels are modern reference names, not claims of ancient name attestation.

Natural Earth “10m” means 1:10 million map scale, not 10-metre accuracy. Local relief is a 1-arc-minute cartographic shaded raster; pixel dimensions and zoom capability do not establish historical border accuracy.
'''
if '## Display overviews, coastline alignment, and bilingual names' not in attribution:
    attribution += addition
(out/'ATTRIBUTION.md').write_text(attribution)

reports = {}
for key,path in [('geometry',args.geometry_report), ('tiles',args.tile_report)]:
    if path:
        r = json.loads(path.read_text())
        for name,meta in r['inventory'].items():
            assert info(name) == meta, 'Input changed after audit: '+name
        reports[key] = {k:v for k,v in r.items() if k not in ['inventory','root','old_inventory_differences']}

relief = read('relief-manifest.json')
payload_names = sorted([p.name for p in root.glob('*.json.gz')]+[str(p.relative_to(root)) for p in (root/'relief').rglob('*.webp')])
payload = {name:info(name) for name in payload_names}
manifest = {
    'schema_version':2,
    'inventory_file':'files.json',
    'inventory_rule':'files.json inventories every release file except itself. Tile and geometry payload checksums are SHA256 of the delivered compressed bytes.',
    'payload_file_count':len(payload),
    'payload_bytes':sum(x['bytes'] for x in payload.values()),
    'coordinate_and_time_scope':'Modern physical geography; detailed vector source coordinates retained, separate display overviews generalized. Historical polity and settlement data retain independent provenance.',
    'vectors':vectors,
    'local_relief':relief,
    'ocean_mask':{'manifest':'modern-ocean-mask.manifest.json','historical_geometry_modified':False},
    'overview':{'manifest':'physical-overview.manifest.json','display_only':True,'published_outputs':[x['file'] for x in overview['outputs']]},
    'bilingual_rivers':{'mapping':'river-names-zh-en.json','groups':len(mapping['rivers']),'matched_features':sum(len(r['featureIds']) for r in mapping['rivers'])},
    'remote_terrain':{'provider':'Mapterhorn','tilejson_snapshot':'mapterhorn-tilejson.json','source_attribution_snapshot':'mapterhorn-attribution.json','tile_template':'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp','source_licenses':'See source attribution snapshot; do not equate the renderer/code license with data licenses.','local_fallback':True},
    'verification':reports,
}
write('release-manifest.json', manifest)

virtual_files = {str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file() and p.name != 'files.json'}
virtual_files.update({p.name:p.read_bytes() for p in out.iterdir() if p.is_file() and p.name != 'files.json'})
inventory = {name:{'bytes':len(b),'sha256':sha(b)} for name,b in sorted(virtual_files.items())}
write('files.json', inventory)
print(json.dumps({'overlay':str(out),'replace_or_add':sorted(p.name for p in out.iterdir() if p.is_file()),'reconciled_release_file_count':len(inventory)+1,'indexed_files':len(inventory),'payload_file_count':len(payload),'payload_bytes':manifest['payload_bytes']},indent=2))
