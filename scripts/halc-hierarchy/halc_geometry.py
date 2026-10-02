"""Shared HALC v15 source and unchanged z10 MVT-grid transformation."""
import hashlib,json,math,sqlite3
from pathlib import Path
import numpy as np
import shapely
from shapely import from_wkb,set_precision,transform

SOURCE_SHA1='33da3c0222f9a94f3539ad0f780c6b899ab09a97'
ZOOM,EXTENT,BUFFER=10,8192,64
WORLD=(2**ZOOM)*EXTENT

def check(test,message):
    if not test: raise ValueError(message)

def compact(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()

def source(path):
    raw=path.read_bytes()
    check(hashlib.sha1(raw).hexdigest()==SOURCE_SHA1,'Unexpected HALC source input')
    db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    dates=db.execute('SELECT DISTINCT TIME_START,TIME_END FROM "HALC 1500"').fetchall()
    check([tuple(v) for v in dates]==[('1500-01-01','1500-12-31')],'Source snapshot is not 1500')
    rows=db.execute('SELECT fid,ADM0,ADM1,TYPE,QUALITY,geom FROM "HALC 1500" ORDER BY fid').fetchall();db.close()
    attrs=[];geoms=[]
    for row in rows:
        blob=row['geom'];check(blob[:2]==b'GP','Invalid GeoPackage geometry header')
        size={0:0,1:4,2:6,3:6,4:8}[(blob[3]>>1)&7]
        geoms.append(from_wkb(blob[8+size*8:]));attrs.append({k:row[k] for k in row.keys() if k!='geom'})
    check(len(rows)==14863,'Unexpected source count')
    check(all(shapely.is_valid(geoms)),'Invalid source geometry')
    return attrs,np.array(geoms,dtype=object),hashlib.sha256(raw).hexdigest()

def forward(coords):
    lon=coords[:,0];lat=np.radians(coords[:,1])
    return np.column_stack(((lon+180.)/360.,(1.-np.arcsinh(np.tan(lat))/math.pi)/2.))*WORLD

def inverse(coords):
    x=coords[:,0]/WORLD;y=coords[:,1]/WORLD
    return np.column_stack((x*360.-180.,np.degrees(np.arctan(np.sinh(math.pi*(1.-2.*y))))))

def grid_geometries(geoms):
    projected=transform(geoms,forward)
    quantized=set_precision(projected,grid_size=1.,mode='valid_output')
    simple=shapely.simplify(quantized,tolerance=0.,preserve_topology=True)
    check(all(shapely.equals(quantized,simple)),'Zero-tolerance removal altered geometry')
    return projected,simple

def eligible(attr):
    return attr['TYPE']!=8 and bool(attr['ADM1']) and 'XX' not in attr['ADM1'].split(';')

def group_id(adm1):
    return 'halc1500-adm1-'+hashlib.sha256(adm1.encode()).hexdigest()[:16]

def parts_holes(geom):
    polys=[geom] if geom.geom_type=='Polygon' else list(geom.geoms)
    return len(polys),sum(len(p.interiors) for p in polys)
