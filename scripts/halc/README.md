# Portable HALC 1500 build tools

Place `build_tiles.py`, `prepare_metadata.py`, `verify_assets.py`, `requirements.txt` and `NOTICE.txt` together, for example under `scripts/halc/`. Source data are local inputs downloaded from the official URLs in NOTICE. Both source SHA1 values are checked.

```sh
python3 -m venv .venv-halc
.venv-halc/bin/python -m pip install -r scripts/halc/requirements.txt
.venv-halc/bin/python scripts/halc/build_tiles.py --source SOURCE/HALC-1500.gpkg --codebook SOURCE/HALC-Codebook.xlsx --output work/halc-build/assets --report work/halc-build/build-report.json
.venv-halc/bin/python scripts/halc/verify_assets.py --source SOURCE/HALC-1500.gpkg --codebook SOURCE/HALC-Codebook.xlsx --publish work/halc-build/assets --build-report work/halc-build/build-report.json --report work/halc-build/verification-report.json
```

Replace SOURCE with the real input directory. Output must be new or empty. Existing assets are never deleted. Do not use Python `-O`; validation assertions must stay enabled. The builder defaults to the adjacent formal NOTICE; use `--notice` for an explicitly reviewed alternative.

Place `verify-halc-data.py` under `scripts/` and `halc-1500.integrity.json` under `scripts/data-integrity/`. This fast release check requires only Python 3.9+ standard library:

```sh
python3 scripts/verify-halc-data.py --data-dir public/data/halc --public-dir public --allow-extra labels.json
```

The actual data directory is a parameter. Editorial files added inside it need an explicit `--allow-extra labels.json`; that flag never overrides a source-asset checksum mismatch. Audit reports belong outside both the data directory and public. Set `--max-public-files` only from an independently verified deployment limit.

The checked-in integrity inventory retains the original complete source-data audit unchanged. It records exactly one post-audit prose update, NOTICE.txt, with before/after hashes and byte lengths. All 880 other assets remain byte-identical to the original audited set. The fast check refuses post-audit exceptions for data files.

Current reproducibility result: the portable builder completed from the original GPKG/XLSX in the pinned existing environment. All 880 data assets matched the original SHA256 values; only the formal NOTICE differed. A fresh full audit decoded 84,950 feature instances, found zero invalid geometries, confirmed source attributes and all 14,863 fids at z7–10, and re-extracted all five codebook dictionaries directly from the source XLSX. The source inputs retained their original SHA1 values.

The original geometry audit used Shapely 2.0.7 / GEOS 3.11.4. GEOS, Python/zlib or encoder environment changes can affect exact bytes. A different build must pass the full audit and have a reviewed new inventory; do not auto-regenerate expected checksums in release CI.
