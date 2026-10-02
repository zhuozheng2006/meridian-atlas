"""Standard-library validation of exact HALC Landscape 1500 publication.

Independent of the builder, Shapely and the GeoPackage. The fixed record-set
lock was derived only after the official file length and SHA-1 were verified,
then its features were compared with a second complete source export. Changing
both shards and their index cannot silently pass this source-fidelity check.
"""
from pathlib import Path
import argparse,collections,gzip,hashlib,json,math

SOURCE_BYTES=9252864
SOURCE_SHA1='ad5923b98e627eed5c8663790b9b3f71ff45f98b'
SOURCE_SHA256='7fc499517b9a71737fd932716e3faa1ed13334ec51f020358f7bc6bc1e9041a2'
SOURCE_RECORD_SET_SHA256='c86b23dad9a505da2f3206ed5d20a96a5c1c089aa84296b387042e79450f1593'
CLASS_COUNTS={0:813,1:87,2:368,3:384,4:10,7:1278,8:33,9:7}
NULL_DATE_IDS=[106,2477,2478]
FIELDS={'fid','LANDSCAPE','TIME_START','TIME_END','QUALITY','SOURCE','REMARKS'}
def encode(value,canonical=False):return json.dumps(value,sort_keys=canonical,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')
def digest(raw):return hashlib.sha256(raw).hexdigest()
def combine_boxes(boxes):return [min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
def validate(data):
    data=Path(data).resolve();rawindex=gzip.decompress((data/'index.json.gz').read_bytes());index=json.loads(rawindex)
    assert index['schemaVersion']==1 and index['snapshotYear']==1500,'Unexpected schema/snapshot'
    if (data/'index.json').exists():assert index==json.loads((data/'index.json').read_bytes()),'Index variants differ'
    source=index['source'];assert source['bytes']==SOURCE_BYTES and source['sha1']==SOURCE_SHA1 and source['sha256']==SOURCE_SHA256,'Source identity mismatch'
    assert source['dataFileId']==639024 and source['datasetVersion']==15 and source['coordinateReferenceSystem']=='EPSG:4326','Source provenance mismatch'
    records={};manifest_files=set();shard_boxes=[];total_vertices=0;compressed_bytes=0
    for shard in index['shards']:
        rel=shard['file'];path=(data/rel).resolve()
        assert not Path(rel).is_absolute() and path.is_relative_to(data),'Unsafe shard path'
        assert rel not in manifest_files,'Repeated shard entry';manifest_files.add(rel)
        raw=path.read_bytes();assert len(raw)==shard['bytes'],'Shard byte count mismatch: '+rel
        assert digest(raw)==shard['sha256'],'Shard checksum mismatch: '+rel
        payload=json.loads(gzip.decompress(raw));assert payload['type']=='FeatureCollection'
        fs=payload['features'];assert len(fs)==shard['count']==len(shard['features']),'Shard record count mismatch'
        meta={x['id']:x for x in shard['features']};assert len(meta)==len(fs),'Duplicate feature manifest id'
        count=0;boxes=[]
        for f in fs:
            fid=f['id'];assert isinstance(fid,int) and not isinstance(fid,bool) and fid not in records,'Duplicate/invalid original fid'
            assert fid in meta and f['type']=='Feature'
            p=f['properties'];g=f['geometry'];assert set(p)==FIELDS and p['fid']==fid,'Changed source attribute schema'
            assert g['type']=='Polygon','Unexpected source geometry type'
            assert digest(encode(f))==meta[fid]['sha256'],'Per-record checksum mismatch: '+str(fid)
            xs=[];ys=[]
            for ring in g['coordinates']:
                assert len(ring)>=4 and ring[0]==ring[-1],'Source ring no longer closed'
                for point in ring:
                    assert len(point)==2 and all(isinstance(n,(int,float)) and not isinstance(n,bool) and math.isfinite(n) for n in point),'Invalid source coordinate'
                    xs.append(point[0]);ys.append(point[1])
            assert xs,'Empty polygon';bbox=[min(xs),min(ys),max(xs),max(ys)]
            assert bbox==meta[fid]['bbox'],'Feature bbox differs from actual coordinates'
            count+=len(xs);boxes.append(bbox);records[fid]=f
        assert count==shard['vertices'],'Shard vertex count mismatch'
        assert combine_boxes(boxes)==shard['bbox'],'Shard bbox mismatch'
        total_vertices+=count;compressed_bytes+=len(raw);shard_boxes.append(shard['bbox'])
    actual_files={str(p.relative_to(data)) for p in (data/'shards').glob('*.geojson.gz')}
    assert actual_files==manifest_files,'Unmanifested or missing shard file'
    assert set(records)==set(range(1,2981)) and len(records)==2980,'Source fid set/count changed'
    assert total_vertices==514392,'Source vertex count changed'
    assert combine_boxes(shard_boxes)==index['bounds'],'Dataset bounds changed'
    assert dict(collections.Counter(f['properties']['LANDSCAPE'] for f in records.values()))==CLASS_COUNTS,'Source class distribution changed'
    nulls=[];dated=0;quality=collections.Counter()
    for fid,f in sorted(records.items()):
        p=f['properties'];quality[p['QUALITY']]+=1;a,b=p['TIME_START'],p['TIME_END']
        if a is None and b is None:nulls.append(fid)
        else:assert (a,b)==('1500-01-01','1500-12-31'),'Source date fields changed';dated+=1
    assert nulls==NULL_DATE_IDS and dated==2977,'Null/dated source records changed'
    assert quality=={None:2881,1:99},'Source quality distribution changed'
    record_hashes=[[fid,digest(encode(f,True))] for fid,f in sorted(records.items())]
    record_set_lock=digest(encode(record_hashes,True))
    assert record_set_lock==SOURCE_RECORD_SET_SHA256,'Fixed official-source record lock mismatch; self-consistent index is not sufficient'
    return {'result':'pass','records':len(records),'vertices':total_vertices,'shards':len(manifest_files),'compressedBytes':compressed_bytes,'indexSHA256':digest(rawindex),'officialSourceSHA1':SOURCE_SHA1,'fixedOfficialRecordSetSHA256':record_set_lock,'allShardBytesAndHashesMatch':True,'allPerRecordHashesMatch':True,'allRecordCoordinatesAndAttributesMatchOfficialBaseline':True,'nullDateIds':nulls,'classCounts':CLASS_COUNTS,'qualityCounts':{'null':quality[None],'1':quality[1]}}
def main():
    p=argparse.ArgumentParser();p.add_argument('--data',type=Path,default=Path(__file__).resolve().parents[1]/'public/data/halc-landscape');p.add_argument('--report',type=Path);a=p.parse_args();result=validate(a.data)
    if a.report:a.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
