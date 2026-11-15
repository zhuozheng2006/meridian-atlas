import json,pathlib,gzip,hashlib,math,argparse
import numpy as np
# Reuse exactly the candidate formulas and coefficients. The landmark pairs are never fit.
from fit_graticule import inverse
parser=argparse.ArgumentParser();parser.add_argument('--repo',required=True);args=parser.parse_args();p=pathlib.Path(__file__).resolve().parent;repo=pathlib.Path(args.repo)
landmarks=[('pleiades:59978','Pataliputra',2068,1608,'settlements-012.json.gz'),('pleiades:961886','Bactria city symbol',719,597,'settlements-035.json.gz')]
checks=[]
for model in json.loads((p/'graticule-model-comparison.json').read_text())['models']:
 a=np.array(model['affinePixelPer1000ToUnitSphere']);rows=[]
 for id,label,x,y,sourceFile in landmarks:
  file=repo/'public/data/places'/sourceFile;raw=file.read_bytes();record=json.loads(gzip.decompress(raw))[id];expected=record['coordinates'];actual=inverse(model['model'],np.array([[x/1000,y/1000,1]])@a.T)[0]
  lon1,lat1,lon2,lat2=map(math.radians,[*actual,*expected]);distance=6371.0088*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))
  rows.append({'id':id,'labelOnMap':label,'pixel':[x,y],'expectedCoordinates':expected,'predictedCoordinates':list(actual),'greatCircleResidualKm':distance,'source':record['sourceUrl'],'localSource':str(file.relative_to(repo)),'localSourceSHA256':hashlib.sha256(raw).hexdigest(),'independentOfGraticuleFit':True})
 checks.append({'model':model['model'],'checks':rows})
report={'method':'Two manually read capital-symbol centers compared with already bundled Pleiades records. Neither landmark was used in the conic fitting or model selection. This is an independent location sanity check, not a validation of political boundaries.','models':checks,'limitations':['Only two point symbols; further geographically distributed landmarks and independent manual pixel rereading needed.','Pleiades site live page returned bot protection; these checks use pinned local copies already in project, not a new live coordinate fetch.']}
(p/'independent-landmarks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(checks,indent=2))
