from physical_paths import workspace
from pathlib import Path
from PIL import Image
import json,shutil,numpy as np
ROOT=workspace(); SRC=ROOT/'assets';OUT=ROOT/'publish';OUT.mkdir(exist_ok=True)
for name in ['land-10m.json.gz','lakes-10m.json.gz','rivers-10m.json.gz','physical-manifest.json']:
 shutil.copyfile(SRC/name,OUT/name)
levels=[];errors=[]
for z in range(5):
 fs=sorted((SRC/'relief'/str(z)).rglob('*.webp'))
 for i,f in enumerate(fs):
  dst=OUT/'relief'/f.relative_to(SRC/'relief');dst.parent.mkdir(parents=True,exist_ok=True)
  im=Image.open(f);im.save(dst,quality=75,alpha_quality=75,method=6)
  check=Image.open(dst);assert check.mode=='RGBA' and check.size==(512,512);check.load()
  if i%17==0:
   bg=Image.new('RGBA',(512,512),'#c4bfa6');a=np.array(Image.alpha_composite(bg,im).convert('RGB')).astype(float);b=np.array(Image.alpha_composite(bg,check).convert('RGB')).astype(float);errors.append(float(np.mean(np.abs(a-b))))
 ps=list((OUT/'relief'/str(z)).rglob('*.webp'));assert len(ps)==4**z;levels.append({'zoom':z,'files':len(ps),'bytes':sum(p.stat().st_size for p in ps)});print(levels[-1],flush=True)
manifest=json.loads((SRC/'relief-manifest.json').read_text());manifest.update(maxzoom=4,tile_count=341,tile_bytes=sum(x['bytes'] for x in levels),conversion=manifest['conversion']+' Release subset z0–4 recompressed at WebP quality75/alpha75; full z5 assets kept separately for archival use.')
(OUT/'relief-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
report={'all_tiles_decode':True,'all_sizes_512':True,'all_modes_rgba':True,'levels':levels,'total_tiles':341,'total_tile_bytes':manifest['tile_bytes'],'visual_mae_rgb_0_255_against_q85_a95':{'sample_tiles':len(errors),'mean':float(np.mean(errors)),'maximum_tile_mean':max(errors)},'projection':'EPSG:3857','bounds':manifest['bounds'],'source_tfw':(ROOT/'source-relief/SR_HR.tfw').read_text()}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')

print(json.dumps(report,indent=2),flush=True)
