import sys,pathlib,json,gzip,math,time,argparse
import shapefile
from lake_codec import decode
parser=argparse.ArgumentParser();parser.add_argument('--source',type=pathlib.Path,required=True);parser.add_argument('--data',type=pathlib.Path,required=True);parser.add_argument('--report',type=pathlib.Path,required=True);args=parser.parse_args();root=args.data;m=json.loads((root/'manifest.json').read_text())
r=shapefile.Reader(str(args.source),encoding='cp1252')
for i,v in enumerate(r.iterRecords(fields=['Hylak_id'])):assert v[0]==i+1
checked=0;maxerror=[0,0];floating=0;start=time.time()
for meta in m['shards']:
 raw=gzip.decompress((root/meta['file']).read_bytes());d=decode(raw) if meta['file'].endswith('.bin.gz') else json.loads(raw)
 for f in d['features']:
  g=f['geometry'];original=r.shape(f['id']-1).__geo_interface__;assert g['type']==original['type']
  ps=[original['coordinates']] if original['type']=='Polygon' else original['coordinates']
  if 'coordinates' in g:
   assert json.dumps(g,separators=(',',':'))==json.dumps(original,separators=(',',':'));floating+=1
  else:
   assert len(ps)==len(g['deltas'])
   for op,ep in zip(ps,g['deltas']):
    assert len(op)==len(ep)
    for ring,deltas in zip(op,ep):
     assert len(deltas)==len(ring)*2
     x=y=0
     for i,(ox,oy) in enumerate(ring):
      x+=deltas[2*i];y+=deltas[2*i+1]
      errors=[abs(x/1e6-ox),abs(y/1e6-oy)]
      assert max(errors)<=5.000001e-7
      maxerror=[max(a,b) for a,b in zip(maxerror,errors)]
  checked+=1
 if int(meta['file'].split('.')[0])%200==0:print(checked,round(time.time()-start),flush=True)
result={'recordsComparedToOriginal':checked,'floatFallbackExact':floating,'maxCoordinateErrorDegrees':maxerror,'maxEquatorialDisplacementBoundMeters':math.hypot(*maxerror)*111320,'sourceZipSha256':m['sourceSha256'],'vertexOrderAndRingStructureCompared':True}
args.report.write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
