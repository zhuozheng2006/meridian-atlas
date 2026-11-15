import numpy as np,json,math,pathlib
P=pathlib.Path(__file__).resolve().parent;rad=np.pi/180
# Manual reading of labelled ticks on the original 2802 x 3156 single-panel scan.
# Each point constrains only its printed coordinate, not an invented latitude/longitude pair.
points=[]
for lon,x in [(60,269),(64,540),(68,807),(72,1073),(76,1340),(80,1608),(84,1874),(88,2149),(92,2413),(96,2682)]:points.append(dict(id='top-'+str(lon),axis='lon',value=lon,x=x,y=23,role='holdout' if lon in [64,76,88] else 'fit'))
for lon,x in [(68,627),(72,987),(76,1326),(80,1659),(84,1995),(88,2350)]:points.append(dict(id='bottom-'+str(lon),axis='lon',value=lon,x=x,y=3142,role='holdout' if lon in [72,84] else 'fit'))
for lat,y in [(40,307),(32,995),(28,1341),(24,1686)]:points.append(dict(id='left-'+str(lat),axis='lat',value=lat,x=26,y=y,role='holdout' if lat==28 else 'fit'))
for lat,y in [(36,660),(32,1007),(28,1350),(24,1698),(20,2041),(16,2388),(12,2737),(8,3082)]:points.append(dict(id='right-'+str(lat),axis='lat',value=lat,x=2777,y=y,role='holdout' if lat in [32,20,12] else 'fit'))
phi1,phi2=12*rad,26*rad

def inverse(model,xy):
 x,y=xy.T
 if model=='equidistant-conic':
  n=(np.cos(phi1)-np.cos(phi2))/(phi2-phi1);g=np.cos(phi1)/n+phi1;r0=g;r=np.hypot(x,r0-y);phi=g-r
 elif model=='lambert-conformal-conic':
  n=np.log(np.cos(phi1)/np.cos(phi2))/np.log(np.tan(np.pi/4+phi2/2)/np.tan(np.pi/4+phi1/2));f=np.cos(phi1)*np.tan(np.pi/4+phi1/2)**n/n;r0=f;r=np.hypot(x,r0-y);phi=2*np.arctan((f/r)**(1/n))-np.pi/2
 elif model=='albers-equal-area':
  n=(np.sin(phi1)+np.sin(phi2))/2;c=np.cos(phi1)**2+2*n*np.sin(phi1);r0=np.sqrt(c)/n;r=np.hypot(x,r0-y);phi=np.arcsin(np.clip((c-(r*n)**2)/(2*n),-1,1))
 lon=80+np.arctan2(x,r0-y)/n/rad
 return np.column_stack([lon,phi/rad])

def predict(model,a,pts):
 p=np.array([[r['x']/1000,r['y']/1000,1] for r in pts]);return inverse(model,p@a.reshape(2,3).T)
def res(model,a,pts):
 ll=predict(model,a,pts);return np.array([ll[i,0 if r['axis']=='lon' else 1]-r['value'] for i,r in enumerate(pts)])
fit=[p for p in points if p['role']=='fit'];held=[p for p in points if p['role']=='holdout'];models=[]
for model in ['equidistant-conic','lambert-conformal-conic','albers-equal-area']:
 a=np.array([.20,0,-.32,0,-.20,.77]);lam=1e-5
 for it in range(200):
  r=res(model,a,fit);J=np.column_stack([(res(model,a+np.eye(6)[j]*1e-6,fit)-r)/1e-6 for j in range(6)]);delta=np.linalg.solve(J.T@J+lam*np.eye(6),-J.T@r)
  candidate=a+delta
  if np.linalg.norm(res(model,candidate,fit))<np.linalg.norm(r):a=candidate;lam=max(1e-10,lam/3)
  else:lam=min(1e12,lam*10)
  if np.linalg.norm(delta)<1e-10:break
 results=[]
 for p,pred in zip(points,predict(model,a,points)):
  error=pred[0 if p['axis']=='lon' else 1]-p['value'];km=error*111.195*(math.cos(pred[1]*rad) if p['axis']=='lon' else 1)
  results.append(dict(**p,predictedKnownCoordinate=round(float(pred[0 if p['axis']=='lon' else 1]),6),residualDegrees=round(float(error),6),singleCoordinateResidualKm=round(float(km),3)))
 metrics={role:{'count':sum(p['role']==role for p in results),'rmsSingleCoordinateKm':float(np.sqrt(np.mean([p['singleCoordinateResidualKm']**2 for p in results if p['role']==role]))),'maxAbsSingleCoordinateKm':max(abs(p['singleCoordinateResidualKm']) for p in results if p['role']==role)} for role in ['fit','holdout']}
 models.append(dict(model=model,affinePixelPer1000ToUnitSphere=a.reshape(2,3).tolist(),metrics=metrics,points=results))
print(json.dumps([{k:m[k] for k in ['model','metrics']} for m in models],indent=2))
(P/'graticule-model-comparison.json').write_text(json.dumps({'source':'055_b.jpg','width':2802,'height':3156,'method':'Fit a six-parameter scan affine transform separately for three spherical conic projection families, using source-stated parallels 12N and 26N and central meridian 80E. Labelled edge ticks constrain only one coordinate. Fixed holdouts are not used in fitting.','cautions':['Manual tick positions are preliminary and have not received independent digitizer review.','Residuals are single-coordinate constraints, NOT full 2D positional accuracy or boundary historical accuracy.','Source says conic, without identifying the conic family or datum. Model selection is an inference, not source metadata.'],'models':models},indent=2)+'\n')
(P/'graticule-control-points.json').write_text(json.dumps(points,indent=2)+'\n')
