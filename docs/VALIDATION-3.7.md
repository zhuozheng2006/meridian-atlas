# Meridian Atlas 3.7 validation

This release adds reversible corner rounding to the Cliopatria overview and dated city-name selection. It does not increase the historical positional accuracy of the territory archive.

## Border portrayal

`public/border-curves.js` constructs one shared node/edge graph for the displayed year's polygons. Eligible corners use the same quadratic curve for every touching country. Canonical edge orientation and batch fallback make the result independent of feature order. Fill, outline and selection use the same display geometry.

Cut lengths are capped at 4 km in a local equirectangular approximation, 45% of each incident edge, and 30% of the distance to every nearby nonincident edge. Junctions, unsplit T contacts, narrow passages, near-reversals, long survey-like corners, polar and dateline rings are protected. Rings exceeding a 2% planar area change lock their shared nodes and are rechecked. Source archives, place membership and downloads remain unchanged. CShapes and OpenHistoricalMap bypass this portrayal.

- 8 focused algorithm and display-lifecycle checks passed.
- Independent Shapely audit: 12 representative years, 1,202 records, 2,582 global intersection candidates; no new invalid polygons, polygon/hole-count changes, new positive-area overlaps or interior gaps under the stated numerical thresholds.
- Feature-order reversal produced byte-identical geometry for every audited record.
- In the screenshot's 1500 Western Europe view, maximum approximate local projected deviation was 1.978 km. This is a portrayal measurement, not an accuracy claim.
- The sampled 1500 transformation took about 18 ms; the slowest sampled frame took about 46 ms in the local Node runtime. These timings do not measure network loading or browser rendering.

The global gap audit excludes a conservative 0.12-degree band along the union's existing external edges. It therefore cannot prove the absence of every tiny gap on narrow islands. These are 12 representative frames, not an exhaustive test of every historical year. Full parameters, source module hash and per-frame results are in `border-portrayal-validation-v3.7.json`.

To reproduce the independent geometry audit, use a Python environment with Shapely:

```sh
node scripts/export-border-curves.mjs . /tmp/meridian-border-audit
python3 scripts/audit-border-curves.py --input-dir /tmp/meridian-border-audit --report /tmp/meridian-border-report.json
```

## City dates and provenance

22 regression checks cover real and synthetic city records, zero/25/50-year observation windows, name transitions, BCE/CE, exact quarantine and polity caches. Tokyo's record shows Edo/1854 for the 1867 map and Tokyo/1875 for 1869. Selecting exact-year observations closes an out-of-window reader without changing the selected map year or camera.

The conversion audit confirms all original values for 2,043 city rows and 10,350 observations are retained across 2,042 visible rows and one quarantined row. All 307 capital claims remain unchanged apart from sourced name timelines; 51 other place archives retain their exact bytes. The quarantined same-name conflict is not reassigned to another city.

## Application verification

The complete existing `npm test` suite passed after integration. Following the final deterministic-order correction, the border algorithm checks and full 12-frame independent geometry audit passed again. The view-state suite passed 59/59, including portrayal sharing; CShapes archive/controller validation passed 14/14.

Browser checks covered the 1500 Europe toggle at the same camera and scale, URL/reload restoration, bilingual city dates, and a 390×844 mobile layer panel with no document overflow and a visible exit. See `browser-validation-v3.7.json`. Before/after screenshots accompany the release outside the source tree.
