"""Verify final deployment bytes/hashes; --rebuild refreshes the manifest first.

Run last, after validate_assets.py and validate_labels.py. The manifest excludes
itself to avoid a self-hash cycle. No files outside work/boundaries are changed.
"""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
assets = root / "assets"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--rebuild", action="store_true")
args = parser.parse_args()
manifest_path = assets / "production-manifest.json"
expected = [
    "catalog.json.gz", "metadata.json", "coverage.json", "LICENSE.md",
    "identity-audit.json", "manual-translations.json", "validation-report.json",
    "translation-validation.json",
] + [f"geometries-{i:03d}.json.gz" for i in range(37)]

def entry(name):
    data = (assets / name).read_bytes()
    return {"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

source = json.loads((root / "source.json").read_text())
assert hashlib.sha256((root / "cliopatria.geojson.zip").read_bytes()).hexdigest() == source["sha256"]
if args.rebuild:
    rows = [entry(name) for name in expected]
    manifest = {
        "files": rows,
        "totalBytes": sum(row["bytes"] for row in rows),
        "loadContract": "Gzip JSON files must be decompressed by loader unless server Content-Encoding already decoded them. geometryIndex contains .json names; append .gz.",
        "sourceCommit": source["commit"],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

manifest = json.loads(manifest_path.read_text())
assert len(manifest["files"]) == len(expected)
assert {row["file"] for row in manifest["files"]} == set(expected)
assert manifest["sourceCommit"] == source["commit"]
for row in manifest["files"]:
    assert row == entry(row["file"]), f"Stale manifest entry: {row['file']}"
assert manifest["totalBytes"] == sum(row["bytes"] for row in manifest["files"])
report = {
    "passed": True,
    "listedFiles": len(expected),
    "allSizesAndSha256Match": True,
    "payloadBytesExcludingManifest": manifest["totalBytes"],
    "manifestBytes": manifest_path.stat().st_size,
    "totalBytesIncludingManifest": manifest["totalBytes"] + manifest_path.stat().st_size,
    "sourceCommit": source["commit"],
    "catalogGzip": entry("catalog.json.gz"),
    "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
}
(root / "manifest-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
(root / "deployment-files.txt").write_text("\n".join(expected + ["production-manifest.json"]) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
