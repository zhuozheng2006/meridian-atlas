from physical_paths import workspace
"""Prepare public-domain Natural Earth map assets; never modifies Site checkout.
Reprojects the 1 arc-minute shaded relief to Web Mercator z0-5 (512px).
Produces transparent cartographic hillshade overlay, not invented elevation.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json, gzip, hashlib, math, time
ROOT=workspace()
OUT=ROOT/'assets'
OUT.mkdir(exist_ok=True)
Image.MAX_IMAGE_PIXELS=None
source=Image.open(ROOT/'source-relief/SR_HR.tif')
a=np.asarray(source)
TILE=512; MAXZ=5; size=TILE*2**MAXZ
out=OUT/'relief'
stats=[]
# Transparent neutral point is the source water value (206). This leaves the
# map's own land, water, and historical fill colors intact under relief.
for y in range(2**MAXZ):
    rows=np.arange(y*TILE,(y+1)*TILE,dtype=np.float64)+.5
    lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*rows/size))))
    sy=np.clip((90-lat)*a.shape[0]/180-.5,0,a.shape[0]-1)
    y0=sy.astype(np.int32); y1=np.minimum(y0+1,a.shape[0]-1)
    wy=(sy-y0).astype(np.float32)[:,None]
    for x in range(2**MAXZ):
        sx=(np.arange(x*TILE,(x+1)*TILE,dtype=np.float64)+.5)*a.shape[1]/size-.5
        x0=np.clip(sx.astype(np.int32),0,a.shape[1]-1);x1=np.minimum(x0+1,a.shape[1]-1)
        wx=(sx-x0).astype(np.float32)[None,:]
        top=a[y0[:,None],x0]*(1-wx)+a[y0[:,None],x1]*wx
        bottom=a[y1[:,None],x0]*(1-wx)+a[y1[:,None],x1]*wx
        value=top*(1-wy)+bottom*wy
        delta=value-206
        rgba=np.zeros((TILE,TILE,4),np.uint8)
        light=delta>0
        rgba[:,:,:3]=[8,15,23]
        rgba[light,:3]=[235,230,207]
        rgba[:,:,3]=np.where(light,np.clip(delta*2.15,0,105),np.clip(-delta*1.48,0,182)).astype(np.uint8)
        p=out/str(MAXZ)/str(x);p.mkdir(parents=True,exist_ok=True)
        Image.fromarray(rgba).save(p/f'{y}.webp',quality=85,method=5,alpha_quality=95)
    print(f'relief highest tier row {y+1}/32',flush=True)
for z in range(MAXZ-1,-1,-1):
    for x in range(2**z):
        p=out/str(z)/str(x);p.mkdir(parents=True,exist_ok=True)
        for y in range(2**z):
            im=Image.new('RGBA',(TILE*2,TILE*2))
            for dx in range(2):
                for dy in range(2):
                    im.paste(Image.open(out/str(z+1)/str(x*2+dx)/f'{y*2+dy}.webp'),(dx*TILE,dy*TILE))
            im.resize((TILE,TILE),Image.Resampling.LANCZOS).save(p/f'{y}.webp',quality=85,method=5,alpha_quality=95)
    print(f'relief tier {z} done',flush=True)
files=list(out.rglob('*.webp'))
manifest={'source':'Natural Earth Shaded Relief Basic 3.2.0','source_url':'https://naciscdn.org/naturalearth/10m/raster/SR_HR.zip','source_sha256':hashlib.sha256((ROOT/'SR_HR.zip').read_bytes()).hexdigest(),'license':'Public domain','license_url':'https://www.naturalearthdata.com/about/terms-of-use/','source_dimensions':[21600,10800],'source_cell_arc_seconds':60,'projection':'EPSG:3857','scheme':'xyz','tile_size':TILE,'minzoom':0,'maxzoom':MAXZ,'tile_count':len(files),'tile_bytes':sum(p.stat().st_size for p in files),'conversion':'Bilinear reprojection at z5; lower levels Lanczos; transparent grayscale relief overlay, source neutral value 206; WebP quality 85/alpha 95. No elevation inference.','bounds':[-180,-85.0511287798,180,85.0511287798]}
(OUT/'relief-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
