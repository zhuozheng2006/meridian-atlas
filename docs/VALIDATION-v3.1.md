# Meridian Atlas 3.1 — validation record

The 3.1 update adds a worldwide lake-shore layer to the existing bilingual historical atlas. Historical territory and city records retain their existing evidence and date conventions.

## Data and geometry

- Pinned HydroLAKES v1.0 archive: SHA256 `9ef63498569dd7ccd0b8d8852da026e009a75f42d293f00e483f3b9fcfe8e1f9`; ZIP CRC passed. Source input locks cover SHP, SHX, DBF and PRJ.
- 1,421,001 retained lake bodies; 61,535,170 shoreline vertices; 2,551 spatial shards. The 6,687 explicitly identified reservoirs (type 2) are excluded. Type 1 includes the default lake class and may still contain unidentified reservoirs. Type 3 retains regulated natural lakes.
- All retained records were compared against original source coordinates, ring structure and vertex order. Quantized positions differ by no more than 0.078716 metres at the equator. This is encoding fidelity, **not source positional accuracy**.
- 122 geometries retain exact floating-point coordinates because grid quantization would degrade validity. 649 remaining invalid outputs also have invalid source geometry and are listed in the manifest. No synthetic shoreline smoothing or speculative geometry repair is applied.
- 1,115 named lake labels; 24 ID-bound Simplified Chinese translations. Interior representative points are computed from the source polygons. Unknown translations retain their source name.
- Archive geometry shrank from 785,470,302 bytes (original-coordinate GeoJSON gzip) to 324,502,424 bytes (delta-coordinate gzip). The geographic index is 131,887 bytes.

## Runtime and interaction

- Area tiers: >=100 km² at zoom 4; >=5 km² at zoom 6; all retained source lakes at zoom 9. World overview does not request the detailed lake archive.
- Four concurrent fetch workers, shared pending requests between comparison maps, and a bounded completed cache. Only features intersecting the current expanded viewport are decoded to GeoJSON.
- A fine layer replaces the overview only after its current source tiles finish rendering. Failed shards leave the overview usable. Obsolete responses cannot overwrite a newer viewport or a destroyed map.
- A 20% loaded margin on each side preserves fine shores during small pans. Larger pans and tier changes restore the overview until replacement geometry is ready.
- Opaque lake fills hide river centerlines within lake surfaces. Lake labels yield to visible events, cities and controls. Invisible globe-backside event markers no longer suppress lake names.
- Geographic status is re-rendered on language changes and layer toggles, avoiding stale status text.

## Browser checks completed

Desktop scenes at 1280×720: Lake Biwa (1600, zoom 9.1), Titicaca (1500, zoom 7.7), Victoria (1500, zoom 6.3), and Geneva (1500, zoom 8.5). Fine shores and labels were visible. The Geneva label exposed and then verified the invisible-marker collision fix. The city of Geneva retained its separate historical population observation label.

On the Biwa scene, recorded lake requests were a 131,887-byte index plus 5,068-, 7,817- and 31,539-byte geometry shards: **176,311 bytes for this lake layer**, not the whole page. Local serving times are not used as claims about production network speed. After a small keyboard pan, the request count stayed at four.

Right Arrow advanced 1600 to 1601 while preserving camera position. Alt+Right moved the camera from longitude 136.05 to 136.15251 while preserving 1601 and the fine lake layer. English/bilingual switching updated lake labels. Turning labels off hid them; modern reference hid the fine natural-lake labels, and switching back restored them.

At a 390×844 emulated viewport, DOM measurements confirmed no horizontal overflow, a 390×571 map canvas, ready lake status and a Geneva lake label. The normal browser viewport-control API repeatedly timed out; page-level emulation worked, but its WebGL screenshot capture was blank. This is recorded as a visual-verification limitation, not a successful phone screenshot check. Temporary emulation was cleared and 1280×720 was verified afterward. The new code does not change the existing mobile layout rules; existing 3.0 phone/tablet visual checks remain in `VALIDATION-v3.md`.

## Automated checks and limits

`npm test` combines the existing geometry, geography, places, city chapters, keyboard and view-state suites with 15 new lake checks. It verifies every lake shard hash, feature count, encoding, ring closure, ID uniqueness and reservoir exclusion, plus the index inventory. Separate full source-coordinate comparison is saved in `lake-coordinate-audit.json`. The packaged builder was executed from the pinned raw input, and all 2,553 output files matched the published-data directory byte for byte (`lake-rebuild-audit.json`).

The static site contains 15,901 files; all remain under the 25 MiB individual file limit. There are no new browser dependencies. Build-only tools are PyShp 2.3.1 and Shapely 2.0.7.

This update improves contemporary geographic context. It does not reconstruct historical lake levels, seasonal inundation, or ancient shorelines. HydroLAKES uses varying regional data dates and approximate mapping scales from 1:100,000 to 1:1,000,000. Trade-route geometry, additional conflict narratives, broader historical city coverage, and independent scholarly review remain ongoing work. No claim of complete world-history coverage or comprehensive superiority over specialist projects is made.
