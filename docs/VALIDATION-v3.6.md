# Meridian Atlas 3.6 validation

## Border portrayal and source review

The July 1500 Alps scene was checked against the pinned Cliopatria coordinates. The Bavaria, Swiss Confederation and Lorraine records have 55, 68 and 102 vertices including closing points. Exact IDs, coordinate samples, source tags and hashes are recorded in `alps-1500-source-audit.json`.

The default overview now uses muted brown-grey strokes, capped at 0.7 CSS pixels from zoom 6 onward, with lower close-zoom opacity and a 0.4-pixel blur. Country fill fades at regional scales. These are pixel styling changes only; no historical coordinates were smoothed or replaced. Detailed OpenHistoricalMap areas remain an independently selected archive. The reviewed Lorraine and Bern records contain unresolved source notes, and Bavaria's administrative circle is not a substitute for the duchy.

The added 1500 bootstrap contains all 137 active polity records, 132 unique geometries and 13,113 vertices in one 151,086-byte gzip request. The integration test compares every geometry with the individually archived native source. The reproducible packaging script updates the native inventory and all hashes.

## CShapes integration

The optional 1886–2023 CShapes 2.1 beta COW archive preserves 805 source periods, 503 unique geometries and 1,305,478 vertices. Separate BY-NC-SA attribution and license files ship with the data; code remains independently MIT-licensed. Sources and downloads retain classification gaps, source-invalid geometry and the full citation.

`country-validation.json` records 13 passing checks: all 16 archive hashes, every raw source record and geometry, an independent UTC-date oracle for all 138 supported year snapshots, frozen-object geometry preservation, same-year fallback, source/year request races, comparison independence, destroyed maps, retained-frame failure labels and atomic regional visibility. This is a local-data-loader test, not a claim of browser-wide offline functionality.

Reproduce the raw-source checks with the official file matching the manifest SHA256:

```
node scripts/validate-country.mjs /path/to/CShapes-COW-2.1.geojson
npm test
```

Full existing regression suite passed after updating the native geometry test harness to instantiate the new source controller. Data-source tests establish conversion fidelity and UI behaviour, not historical ground truth.
