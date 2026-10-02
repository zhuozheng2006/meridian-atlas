# Physical map build toolkit

Copy this complete directory to a repository location such as `scripts/cartography/`. It contains code, locked public-source references, reviewed bilingual naming metadata, and small attribution snapshots. Do not copy the temporary `__pycache__` directory. Raw source downloads and generated assets belong in a separate build workspace.

The toolkit never changes historical territory geometry. Natural Earth `10m` means **1:10 million map scale**, not 10-metre positional accuracy. Local relief is a one-arc-minute cartographic shaded raster. Modern shorelines and river names are reference geography, not reconstructed historical geography.

## Dependencies

- Python; 3.12 is recommended for a fresh environment.
- `shapely`, `opencc-python-reimplemented`: vector preparation, mask topology, geometry checks.
- `numpy`, `Pillow` with WebP support: reprojection, pyramids, tile decoding.
- Standard-library modules only: source fetching, reviewed label application, manifest reconciliation and release assembly.

Install the compatible ranges in `requirements.txt`. The original vector build was verified under Python 3.9.6 / Shapely 2.0.7 / NumPy 2.0.2 / OpenCC 0.1.7. The original relief build used Python 3.12.14 / Pillow 12.3.0 / libwebp 1.6.0 / NumPy 2.3.5. Both dependency groups are required in a fresh single build environment. Other encoder/library versions may produce different compressed bytes; the release inventory must always be regenerated and checked after rebuilding.

## Complete build

Use a cache directory for raw inputs and intermediates, plus a separate empty directory for the release. For example:

```sh
python scripts/cartography/fetch_sources.py --workspace .cache/physical
python scripts/cartography/prepare_physical.py --workspace .cache/physical
python scripts/cartography/build_local_relief.py --workspace .cache/physical
python scripts/cartography/build_publish_relief.py --workspace .cache/physical
python scripts/cartography/build_river_names.py --workspace .cache/physical
python scripts/cartography/build_ocean_mask.py --workspace .cache/physical
python scripts/cartography/build_physical_overview.py --workspace .cache/physical
python scripts/cartography/assemble_release.py --workspace .cache/physical --output-dir build/physical-release
python scripts/cartography/audit_physical.py --physical-dir build/physical-release --raw-dir .cache/physical --output build/physical-audit.json
```

`fetch_sources.py` accepts only the SHA256 values in `source-lock.json`. The URLs are upstream public files, some on a mutable upstream branch; a changed source intentionally stops the build and requires a reviewed lock update. Existing matching downloads are reused. Only explicitly named relief ZIP entries are extracted. Historical city and polity datasets have their own independent build pipelines.

The full relief pyramid is built at z0–5, 512 pixels, using inverse Web Mercator mapping and bilinear sampling at z5; lower levels are generated with Lanczos filtering. A transparent shadow/highlight overlay is derived from the source shade values. The publish pass retains z0–4 and recompresses with WebP quality 75 / alpha quality 75. The original build's 341 published tiles occupy 23,428,186 bytes. The z5 working archive is not published. Expect several hundred MB of workspace storage for the source TIFF, archive, intermediate tiles and release.

## Vector and naming policy

`prepare_physical.py` preserves detailed coordinates, excludes synthetic Null island, repairs the two known zero-area self-intersections with `make_valid`, tags artificial waterways/reservoirs, and converts supplied Chinese names to Simplified Chinese. It preserves source feature order and identifiers. One Natural Earth Loire record is an empty MultiLineString; it is retained as a known source record. Two other Loire records contain the visible geometry. The detailed river asset has 1,455 records and 1,454 nonempty geometries.

`build_river_names.py` applies the reviewed `data/river-names-zh-en.json` mapping to exact feature IDs. It preserves source names and coordinates. A change in upstream identifiers stops the build. Naming sources, PDF page numbers where available, and source verification depth remain in the mapping; rebuilding does not need to download the IAEA PDF again.

`build_ocean_mask.py` produces the unsimplified modern-ocean complement within ±180° and the Mercator latitude limit. Six longitude strips prevent a world-spanning ring from creating antimeridian ambiguity. Its manifest includes winding, validity, area-partition, longitude-span and 12,063-point classification checks.

`build_physical_overview.py` selects natural rivers/lakes with `rank <= 3 OR minzoom <= 3`, simplifies them at 0.02 degrees, and derives a 0.03-degree generalized land/ocean partition. Generalized land components are re-unioned before the complement is constructed. Shared coast edges are never simplified independently. `layer` is `rivers` or `lakes`; visible river strokes should filter out `kind == 'Lake Centerline'`. The optional generated `land-overview` / `coastline-overview` files are not part of the current release, which uses the separate existing 50m land overview.

## Release inventory and reconciliation

`assemble_release.py` copies an explicit allowlist, renames the enriched river asset to its shipped `rivers-10m.json.gz` path, and invokes `reconcile_manifest.py`. It refuses a nonempty destination to avoid stale tiles. The checked-in map application decides how to copy that reviewed release into its own static-data directory.

To audit and repair metadata for an existing release without changing any input file:

```sh
python scripts/cartography/audit_physical.py --physical-dir dist/data/physical --mode geometry --raw-dir .cache/physical --output build/physical-geometry-audit.json
python scripts/cartography/audit_physical.py --physical-dir dist/data/physical --mode tiles --output build/physical-tile-audit.json
python scripts/cartography/reconcile_manifest.py --physical-dir dist/data/physical --output-dir build/physical-metadata-overlay --geometry-report build/physical-geometry-audit.json --tile-report build/physical-tile-audit.json
```

The overlay contains six metadata files only: `ATTRIBUTION.md`, `physical-manifest.json`, `physical-overview.manifest.json`, `modern-ocean-mask.manifest.json`, `release-manifest.json`, and `files.json`. Review these and copy them together. `files.json` indexes every resulting release file except itself, using the actual delivered compressed bytes. Reconciliation checks that the audited inputs have not changed before embedding audit results. The generator recalculates river hashes after name enrichment, distinguishes published and optional overview outputs, and preserves original-source hashes and transformations.

The current assets were independently checked for gzip CRC, valid geometry, ring winding and coordinate bounds for ocean masks, Simplified Chinese names, exact bilingual ID mappings, unchanged original river geometries, a complete z0–4 XYZ tile set, and successful RGBA 512×512 decoding. The portable vector/name/mask/overview scripts rebuilt seven published files byte-for-byte under the validated vector runtime. The relief algorithms were preserved and all release tiles were re-decoded; a second full relief reprojection was not performed during this packaging pass.
