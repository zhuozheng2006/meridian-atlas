#!/usr/bin/env python3
"""Standard-library HALC region release integrity check; suitable for npm test.

This checks fixed assets against the independently audited inventory. Geometry
validation is documented in the required frozen audit, not rerun without GIS
dependencies. Keep the inventory and audit outside public/.
"""
import argparse,collections,gzip,hashlib,json,math
from pathlib import Path

def check(condition,message):
    if not condition:raise ValueError(message)

def digest(data):return hashlib.sha256(data).hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data-dir',type=Path,required=True);p.add_argument('--integrity',type=Path,required=True)
    p.add_argument('--audit',type=Path,required=True);p.add_argument('--report',type=Path)
    p.add_argument('--public-dir',type=Path);p.add_argument('--max-public-files',type=int);a=p.parse_args()
    if a.report:check(not a.report.resolve().is_relative_to(a.data_dir.resolve()),'Report must be outside assets')
    inventory_raw=a.integrity.read_bytes();inventory=json.loads(inventory_raw);audit=json.loads(a.audit.read_bytes())
    check(audit['passed'] and audit['allTileGeometriesComparedToSourceMemberUnions'],'Missing completed geometry audit')
    check(audit['allInventoryHashesVerified'] and audit['allDecodedGeometriesValid'] and audit['allDecodedEdgeGeometriesValid'],'Incomplete geometry audit')
    check(audit['inventorySha256']==digest(inventory_raw),'Audit inventory hash differs')
    check(audit['duplicateDecodedLineSegments']==0 and audit['maxDecodedLineLengthMinusUniqueLineLength']<1e-6,'Unaudited duplicate boundary strokes')
    expected=inventory['files'];actual={f.relative_to(a.data_dir).as_posix() for f in a.data_dir.rglob('*') if f.is_file()}
    check(actual==set(expected),'Missing or unexpected data assets')
    for relative,entry in expected.items():
        path=a.data_dir/relative;check(path.resolve().is_relative_to(a.data_dir.resolve()),'Unsafe asset path')
        raw=path.read_bytes();check(len(raw)==entry['bytes'],'Byte count differs: '+relative)
        check(digest(raw)==entry['sha256'],'SHA256 differs: '+relative)
    check(len(actual)==inventory['fileCount']==audit['files']==817,'Wrong asset count')
    check(sum(v['bytes'] for v in expected.values())==inventory['totalBytes']==audit['totalBytes'],'Wrong total asset bytes')
    m=json.loads((a.data_dir/'manifest.json').read_bytes());i=json.loads(gzip.decompress((a.data_dir/m['index']['path']).read_bytes()))
    check(inventory['snapshotYear']==m['snapshotYear']==i['snapshotYear']==audit['sourceYearBound']==1500,'Wrong source year')
    check(inventory['sourceSha1']==m['sourceSha1']==i['sourceSha1']=='33da3c0222f9a94f3539ad0f780c6b899ab09a97','Wrong source')
    check(inventory['sourceSha256']==m['sourceSha256'],'Source SHA256 differs')
    check(m['sourceDoi']=='10.34894/BTKFHV' and m['sourceVersion']=='15.0','Wrong source version/DOI')
    check(m['license']=='CC BY-SA 4.0' and m['licenseUrl']=='https://creativecommons.org/licenses/by-sa/4.0/','Wrong data license')
    check(m['sourceLayer']=='halc_regions' and m['edgeSourceLayer']=='halc_region_edges','Wrong source layers')
    check(m['extent']==8192 and m['buffer']==64 and m['minzoom']==6 and m['maxzoom']==10,'Wrong tile parameters')
    for key in ('index','notice'):
        entry=m[key];check(expected[entry['path']]=={k:entry[k] for k in ('bytes','sha256')},'Manifest descriptor differs')
    check(m['index']['uncompressedBytes']==len(gzip.decompress((a.data_dir/m['index']['path']).read_bytes())),'Index size differs')
    check(m['conversion']['smoothing'] is False and m['conversion']['TYPE8Excluded'] and m['conversion']['XXExcluded'],'Wrong source conversion')
    groups=i['groups'];fids=[];ids=set();shared=0;type_counts=collections.Counter();quality_counts=collections.Counter()
    check(len(groups)==m['groupCount']==i['groupCount']==audit['groups']==152,'Wrong group count')
    for gid,entry in groups.items():
        adm1=entry['ADM1'];check(adm1 and 'XX' not in adm1.split(';'),'Excluded ADM1 membership')
        check(gid==entry['id']=='halc1500-adm1-'+digest(adm1.encode())[:16],'Unstable ADM1 ID')
        number=int(gid.rsplit('-',1)[1][:13],16)
        check(entry['numericId']==number and number not in ids and number<2**52,'Invalid numeric ID');ids.add(number)
        check(entry['shared']==(';' in adm1),'Shared flag differs');shared+=entry['shared']
        check(entry['memberCount']==len(entry['fids'])==sum(entry['TYPECounts'].values())==sum(entry['QUALITYCounts'].values()),'Member count differs')
        check('8' not in entry['TYPECounts'],'TYPE 8 in group layer')
        check(entry['ADM0Codes']==sorted({c for value in entry['ADM0Values'] for c in value.split(';')}),'ADM0 memberships lost')
        check(entry['fids']==sorted(entry['fids']) and all(isinstance(fid,int) for fid in entry['fids']),'Unstable source fid list')
        bounds=entry['bounds'];point=entry['representativePoint']
        check(len(bounds)==4 and len(point)==2 and all(math.isfinite(v) for v in bounds+point),'Invalid geographic coordinates')
        check(bounds[0]<=point[0]<=bounds[2] and bounds[1]<=point[1]<=bounds[3],'Representative point outside bbox')
        fids.extend(entry['fids']);type_counts.update(entry['TYPECounts']);quality_counts.update(entry['QUALITYCounts'])
    check(shared==98,'Shared group count differs')
    check(len(fids)==len(set(fids))==m['includedLocalities']==i['includedLocalities']==audit['sourceMemberships']==14145,'Duplicated or lost membership')
    check(m['excludedLocalities']==i['excludedLocalities']==718,'Wrong excluded count')
    check(sum(type_counts.values())==sum(quality_counts.values())==14145,'Source code count differs')
    expected_tiles=set()
    for z in range(6,11):
        r=m['tileRanges'][str(z)]
        expected_tiles.update(f'tiles/{z}/{x}/{y}.pbf' for x in range(r['x'][0],r['x'][1]+1) for y in range(r['y'][0],r['y'][1]+1))
    tiles=m['tiles'];check(expected_tiles=={t['path'] for t in tiles}=={v for v in actual if v.endswith('.pbf')},'Incomplete tile rectangle')
    check(len(expected_tiles)==len(tiles)==m['tileCount']==audit['tiles']==814,'Wrong tile count')
    for tile in tiles:
        check(tile['path']==f"tiles/{tile['z']}/{tile['x']}/{tile['y']}.pbf",'Tile path differs')
        check(expected[tile['path']]=={k:tile[k] for k in ('bytes','sha256')},'Tile descriptor differs')
    check(sum(t['features'] for t in tiles)==audit['decodedFeatureInstances']==1919,'Wrong polygon instance count')
    check(sum(t['edgeFeatures'] for t in tiles)==audit['decodedEdgeFeatures']==360,'Wrong line instance count')
    check(sum(not t['features'] for t in tiles)==m['emptyTiles']==audit['emptyTiles']==449,'Wrong empty count')
    check(sum(t['bytes'] for t in tiles)==m['tileBytes'] and max(t['bytes'] for t in tiles)==m['maxTileBytes'],'Wrong tile bytes')
    result={'passed':True,'files':len(actual),'totalBytes':inventory['totalBytes'],'groups':152,'sourceMemberships':14145,'tiles':814,
      'allAssetHashesVerified':True,'frozenGeometryAuditMatched':True,'integritySha256':digest(inventory_raw),
      'geometryAuditSha256':digest(a.audit.read_bytes()),'TYPECounts':dict(type_counts),'QUALITYCounts':dict(quality_counts)}
    if a.public_dir:
        files=[f for f in a.public_dir.rglob('*') if f.is_file()];result['publicFileCount']=len(files)
        result['publicBytes']=sum(f.stat().st_size for f in files)
        if a.max_public_files is not None:check(len(files)<=a.max_public_files,'Public file budget exceeded')
    else:check(a.max_public_files is None,'--max-public-files requires --public-dir')
    if a.report:a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
