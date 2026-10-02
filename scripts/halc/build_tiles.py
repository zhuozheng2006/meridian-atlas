"""Build HALC v15 MVT + original-property shards from explicit local inputs.

Use --help. Output must be a new or empty directory; source files are read-only.
"""
import argparse
import collections
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import time

import numpy as np
import shapely
from shapely.geometry import box
from shapely import STRtree, from_wkb, get_num_coordinates, set_precision, transform
import mapbox_vector_tile
from mapbox_vector_tile.encoder import on_invalid_geometry_raise
from prepare_metadata import extract as extract_codebook

BASE = Path(__file__).resolve().parent
SOURCE_SHA1 = '33da3c0222f9a94f3539ad0f780c6b899ab09a97'
MIN_ZOOM, MAX_ZOOM, EXTENT, BUFFER = 6, 10, 8192, 64
SHARD_SIZE = 256
LAYER = 'halc_localities'
KEYS = ('fid', 'NAME', 'SHORT_ID', 'ADM0', 'ADM1', 'TYPE', 'QUALITY')

def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compact(value))

def write_gzip(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(compact(value), compresslevel=9, mtime=0))

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decode_gpkg(blob):
    assert blob[:2] == b'GP'
    sizes = {0: 0, 1: 4, 2: 6, 3: 6, 4: 8}
    return from_wkb(blob[8 + sizes[(blob[3] >> 1) & 7] * 8:])

def mercator(coords):
    lon = coords[:, 0]
    lat = np.radians(coords[:, 1])
    return np.column_stack(((lon + 180.) / 360., (1. - np.arcsinh(np.tan(lat)) / math.pi) / 2.))

def polygonal(g):
    if g.geom_type in ('Polygon', 'MultiPolygon'):
        return g
    if g.geom_type == 'GeometryCollection':
        parts = []
        for member in g.geoms:
            if member.geom_type == 'Polygon':
                parts.append(member)
            elif member.geom_type == 'MultiPolygon':
                parts.extend(member.geoms)
        return shapely.MultiPolygon(parts)
    return shapely.MultiPolygon([])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Official HALC-1500.gpkg')
    parser.add_argument('--codebook', type=Path, required=True, help='Official HALC-Codebook.xlsx')
    parser.add_argument('--output', type=Path, required=True, help='New or empty asset directory')
    parser.add_argument('--report', type=Path, required=True, help='Build report outside output directory')
    parser.add_argument('--notice', type=Path, default=BASE/'NOTICE.txt')
    args = parser.parse_args()
    SOURCE, PUBLISH = args.source.resolve(), args.output.resolve()
    codebook, report_path, notice_path = args.codebook.resolve(), args.report.resolve(), args.notice.resolve()
    if not SOURCE.is_file() or not codebook.is_file() or not notice_path.is_file():
        parser.error('Source, codebook and notice must exist')
    if PUBLISH.exists() and (not PUBLISH.is_dir() or any(PUBLISH.iterdir())):
        parser.error('Output must be a new or empty directory; existing assets will not be removed')
    if report_path.is_relative_to(PUBLISH) or report_path in (SOURCE, codebook, notice_path):
        parser.error('Build report must be outside output and must not replace an input')
    if sys.flags.optimize:
        parser.error('Do not use python -O: build validation assertions must remain enabled')
    started = time.perf_counter()
    assert hashlib.sha1(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA1, 'Unexpected HALC source version'
    db = sqlite3.connect(SOURCE.as_uri()+'?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    assert db.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    rows = db.execute('SELECT * FROM "HALC 1500" ORDER BY fid').fetchall()
    attrs = [{key: row[key] for key in row.keys() if key != 'geom'} for row in rows]
    geometries = np.array([decode_gpkg(row['geom']) for row in rows], dtype=object)
    assert len(rows) == 14863
    assert all(shapely.is_valid(geometries))
    fids = [r['fid'] for r in rows]
    assert len(set(fids)) == len(fids)
    source_bounds = list(map(float, shapely.total_bounds(geometries)))
    merc = transform(geometries, mercator)
    west, north, east, south = list(map(float, shapely.total_bounds(merc)))
    # Never delete a supplied directory. All source files remain untouched.
    PUBLISH.mkdir(parents=True, exist_ok=True)
    shards = collections.defaultdict(dict)
    for attr in attrs:
        shards[attr['fid'] // SHARD_SIZE][str(attr['fid'])] = attr
    shard_stats = []
    for n, records in sorted(shards.items()):
        path = PUBLISH / 'details' / f'shard-{n:03d}.json.gz'
        write_gzip(path, {'dataset': 'halc-v15-1500', 'records': records})
        shard_stats.append({'shard': n, 'path': str(path.relative_to(PUBLISH)), 'count': len(records),
                            'bytes': path.stat().st_size, 'sha256': sha256(path)})
    assert hashlib.sha1(codebook.read_bytes()).hexdigest() == '3ff58e73740970b2af8e54767c1ccb9c7c239aa7'
    extract_codebook(codebook, PUBLISH / 'metadata')
    shutil.copyfile(notice_path, PUBLISH / 'NOTICE.txt')

    tile_stats = []
    zoom_stats = []
    all_ids = set(fids)
    for zoom in range(MIN_ZOOM, MAX_ZOOM + 1):
        zstart = time.perf_counter()
        n = 2 ** zoom
        world = n * EXTENT
        # Canonical global grid for this zoom: adjacent tiles share quantized coordinates.
        # valid_output drops only grid-collapsed polygon parts and gives valid tile-grid topology.
        scaled = transform(merc, lambda xy: xy * world)
        quantized = set_precision(scaled, grid_size=1., mode='valid_output')
        # Remove only exactly redundant collinear points on this integer grid.
        # Tolerance is zero, and equality is checked for every unit: no boundary moves.
        before_vertices = int(sum(get_num_coordinates(quantized)))
        encoded_shapes = shapely.simplify(quantized, tolerance=0., preserve_topology=True)
        assert all(shapely.equals(quantized, encoded_shapes)), 'Lossless optimization changed an outline'
        quantized = encoded_shapes
        nonempty = [i for i, g in enumerate(quantized) if not g.is_empty]
        tree = STRtree(quantized)
        minx, maxx = math.floor(west*n), math.floor(east*n)
        miny, maxy = math.floor(north*n), math.floor(south*n)
        seen = set()
        empties = 0
        local_count = 0
        local_bytes = 0
        for x in range(minx, maxx+1):
            for y in range(miny, maxy+1):
                origin = np.array([x*EXTENT, y*EXTENT], dtype=float)
                clip_box = box(origin[0]-BUFFER, origin[1]-BUFFER,
                               origin[0]+EXTENT+BUFFER, origin[1]+EXTENT+BUFFER)
                candidates = sorted(map(int, tree.query(clip_box, predicate='intersects')))
                features = []
                for i in candidates:
                    g = polygonal(shapely.intersection(quantized[i], clip_box, grid_size=1.))
                    if g.is_empty:
                        continue
                    assert g.is_valid
                    local_geom = transform(g, lambda xy: xy - origin)
                    features.append({'id': fids[i], 'geometry': local_geom,
                                     'properties': {key: attrs[i][key] for key in KEYS if attrs[i][key] is not None}})
                encoded = mapbox_vector_tile.encode({'name': LAYER, 'features': features}, default_options={
                    'extents': EXTENT, 'y_coord_down': True,
                    'on_invalid_geometry': on_invalid_geometry_raise,
                    'check_winding_order': True,
                })
                # Decode the wire representation to audit actual encoded feature identities.
                decoded = mapbox_vector_tile.decode(encoded, default_options={'y_coord_down': True})[LAYER]
                ids_here = set()
                for feature in decoded['features']:
                    fid = feature['properties']['fid']
                    assert feature['id'] == fid and fid in all_ids
                    ids_here.add(fid)
                    assert set(feature['properties']) == set(KEYS)
                seen.update(ids_here)
                if not ids_here:
                    empties += 1
                path = PUBLISH / 'tiles' / str(zoom) / str(x) / f'{y}.pbf'
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(encoded)
                tile_stats.append({'z':zoom,'x':x,'y':y,'bytes':len(encoded),'features':len(decoded['features']),
                                   'sha256':hashlib.sha256(encoded).hexdigest()})
                local_count += 1
                local_bytes += len(encoded)
        stat = {'zoom': zoom, 'tileRange': {'x':[minx,maxx], 'y':[miny,maxy]},
                'tiles':local_count,'emptyTiles':empties,'bytes':local_bytes,'uniqueFids':len(seen),
                'missingFids':sorted(all_ids-seen),
                'gridCollapsedSourceFids':[fids[i] for i,g in enumerate(quantized) if g.is_empty],
                'quantizedVerticesBeforeLosslessCollinearRemoval':before_vertices,
                'quantizedVerticesIncludingRingClosures':int(sum(get_num_coordinates(quantized))),
                'elapsedSeconds':round(time.perf_counter()-zstart,3)}
        zoom_stats.append(stat)
        print(json.dumps(stat), flush=True)
    max_missing = zoom_stats[-1]['missingFids']
    tile_bytes = sum(x['bytes'] for x in tile_stats)
    files = [p for p in PUBLISH.rglob('*') if p.is_file()]
    assert len(files) + 2 < 4000
    assert max(p.stat().st_size for p in files) < 25*1024*1024
    bounds = source_bounds
    tilejson = {
        'tilejson':'3.0.0','name':'HALC · Low Countries localities · 1500',
        'description':'Historical local administrative reconstruction, HALC v15, 1500 snapshot.',
        'version':'15.0.0','scheme':'xyz','minzoom':MIN_ZOOM,'maxzoom':MAX_ZOOM,
        'bounds':bounds,'center':[4.8,51.3,7],
        'attribution':'Rombert Stapel · HALC v15 · CC BY-SA 4.0',
        'tiles':['tiles/{z}/{x}/{y}.pbf'],
        'vector_layers':[{'id':LAYER,'minzoom':MIN_ZOOM,'maxzoom':MAX_ZOOM,
                          'description':'Original local units; not an ADM1 state union.',
                          'fields':{k:('Number' if k in ('fid','TYPE','QUALITY') else 'String') for k in KEYS}}],
    }
    write_json(PUBLISH/'tilejson.json',tilejson)
    manifest = {
        'schemaVersion':1,'datasetId':'halc-v15-1500','sourceVersion':'15.0','snapshotYear':1500,
        'sourceDoi':'10.34894/BTKFHV','sourceUrl':'https://doi.org/10.34894/BTKFHV',
        'sourceGeometryUrl':'https://dataverse.nl/api/access/datafile/639014',
        'sourceCodebookUrl':'https://dataverse.nl/api/access/datafile/639016',
        'sourceSha1':SOURCE_SHA1,'license':'CC BY-SA 4.0',
        'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
        'conversionNotice':'NOTICE.txt',
        'attribution':'Rombert Stapel, Historical Atlas of the Low Countries (1350–1800), v15, DataverseNL, doi:10.34894/BTKFHV.',
        'paperUrl':'https://doi.org/10.1163/24523666-bja10033',
        'recordCount':len(rows),'fidMin':min(fids),'fidMax':max(fids),
        'typeCounts':dict(collections.Counter(str(a['TYPE']) for a in attrs)),
        'qualityCounts':dict(collections.Counter(str(a['QUALITY']) for a in attrs)),
        'bounds':bounds,'sourceLayer':LAYER,'minzoom':MIN_ZOOM,'maxzoom':MAX_ZOOM,
        'extent':EXTENT,'buffer':BUFFER,'tileFormat':'MVT2 uncompressed protobuf','tileUrlTemplate':'tiles/{z}/{x}/{y}.pbf',
        'tileCount':len(tile_stats),'tileBytes':tile_bytes,'emptyTileCount':sum(z['emptyTiles'] for z in zoom_stats),
        'maxTileBytes':max(x['bytes'] for x in tile_stats),'tileRanges':{str(z['zoom']):z['tileRange'] for z in zoom_stats},
        'details':{'shardSize':SHARD_SIZE,'shardFormula':'Math.floor(fid / 256)',
                   'urlTemplate':'details/shard-{shard:03d}.json.gz','rootKey':'records','recordKey':'String(fid)',
                   'encoding':'gzip JSON bytes; decompress before JSON.parse unless served with Content-Encoding:gzip',
                   'geometryIncluded':False,'originalAttributesComplete':True,'shards':shard_stats},
        'metadata':{'fields':'metadata/polygon-fields.json','regions':'metadata/region-codes.json',
                    'bibliography':'metadata/bibliography.json','legends':'metadata/legends.json',
                    'administrativeSubdivisions':'metadata/administrative-subdivisions.json'},
        'transformation':{'webMercatorProjection':True,'quantization':'Shapely set_precision valid_output at integer global tile grid, consistently across adjacent tiles',
                          'clipping':'Buffered tile rectangle, intersection snapped to same integer grid',
                          'losslessCollinearVertexRemoval':'Zero-tolerance removal after tile-grid quantization; topological equality asserted per original unit and zoom. No geographic outline simplification.',
                          'smoothing':False,'geographicInterpolation':False,'adm1Union':False,
                          'originalGeometryUnmodified':True,'fidIdentity':'Original v15 fid preserved as both MVT feature id and property; not guaranteed stable across future source versions.',
                          'collapsedAtMaxZoomFids':max_missing},
        'semantics':{'names':'NAME uses source modern normalized spelling. NAME_EXT is retained only in detailed source attributes and can contain later-period statistical labels.',
                      'time':'1500 reconstruction snapshot; TIME_START/END disambiguate instances and are not exact historical existence dates.',
                      'adm1':'Preserve complete semicolon memberships. XX means small sovereign regions, not one state.',
                      'type8':'Exclusively natural feature; distinguish from administrative localities.',
                      'quality':'Documentary support varies; preserve TYPE, QUALITY, SOURCE and REMARKS.'},
    }
    write_json(PUBLISH/'manifest.json',manifest)
    report = {'sourceRecords':len(rows),'sourceVertices':int(sum(get_num_coordinates(geometries))),
              'zooms':zoom_stats,'tileCount':len(tile_stats),'tileBytes':tile_bytes,
              'maxTileBytes':max(x['bytes'] for x in tile_stats),'tiles':tile_stats,
              'maxZoomMissingFids':max_missing,'detailsShards':len(shards),
              'detailBytes':sum(x['bytes'] for x in shard_stats),'publishedFileCount':len(files)+2,
              'targetTileBytes':25*1024*1024,'meetsTileTarget':tile_bytes < 25*1024*1024,
              'elapsedSeconds':round(time.perf_counter()-started,3),
              'dependencies':{'shapely':shapely.__version__,'geos':shapely.geos_version_string,'numpy':np.__version__}}
    report['tileGzipBytesSum'] = sum(len(gzip.compress((PUBLISH/'tiles'/str(t['z'])/str(t['x'])/f"{t['y']}.pbf").read_bytes(),compresslevel=6,mtime=0)) for t in tile_stats)
    report['tileGzipNote'] = 'Measured sum if each PBF is individually gzip-compressed; published PBFs remain uncompressed and require no custom transport.'
    write_json(report_path,report)
    print(json.dumps({k:v for k,v in report.items() if k not in ('tiles','zooms')},indent=2),flush=True)

if __name__ == '__main__':
    main()
