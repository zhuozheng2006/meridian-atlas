"""Assemble a fresh physical release directory from the validated build workspace."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--workspace', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
root = args.workspace.resolve()
out = args.output_dir.resolve()
kit = Path(__file__).resolve().parent
assert not out.exists() or not any(out.iterdir()), 'Use an empty destination to avoid stale output files.'
assert out != root and root not in out.parents, 'Release destination must be separate from build workspace.'
out.mkdir(parents=True, exist_ok=True)
for name in ['land-10m.json.gz','lakes-10m.json.gz','physical-manifest.json','relief-manifest.json','validation.json']:
    shutil.copyfile(root/'publish'/name, out/name)
shutil.copytree(root/'publish/relief', out/'relief')
shutil.copyfile(root/'rivers-10m-named.json.gz', out/'rivers-10m.json.gz')
for name in ['modern-ocean-mask.json.gz','modern-ocean-mask.manifest.json','modern-ocean-mask-overview.json.gz','physical-overview.json.gz','physical-overview.manifest.json','river-names-zh-en.json']:
    shutil.copyfile(root/name, out/name)
for name in ['ATTRIBUTION.md','mapterhorn-attribution.json','mapterhorn-tilejson.json']:
    shutil.copyfile(kit/'data'/name, out/name)
overlay = root/'release-metadata'
subprocess.run([sys.executable,str(kit/'reconcile_manifest.py'),'--physical-dir',str(out),'--output-dir',str(overlay)],check=True)
for path in overlay.iterdir():
    if path.is_file():
        shutil.copyfile(path,out/path.name)
print('Assembled physical release:',out)
