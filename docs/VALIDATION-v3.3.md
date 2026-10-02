# Meridian Atlas 3.3 — regional historical boundaries

## Change

The reported staircase borders are present in the original Cliopatria geometry, not introduced by a rendering simplifier. At 1492 the archived Swiss Confederation has 66 ring coordinates; the Duchy of Bavaria has 55. These coordinate counts diagnose visual granularity; they are not historical accuracy scores.

Regional views (zoom 6+) now load the official OpenHistoricalMap administrative polygon tileset. The map switches the visible territorial fill and stroke to dated source areas, rather than smoothing or warping the archived geometry. All archived Cliopatria records remain byte-identical and can be restored with the Regional boundary detail toggle. The selected regional area has an accessible record popup and a direct source element link. Simplified Chinese labels use explicit labels, OpenCC dictionary conversion, existing exact-name translations, and a small editorial name list; the original English title remains available.

The regional view uses administrative levels 2–4 and a July 1 snapshot of the selected civil year. A midyear snapshot avoids drawing successive within-year phases simultaneously. BCE conversion skips civil year zero. Missing starts, malformed ends, reversed intervals and incompatible levels are excluded.

## Coverage and display limits

This is a separate regional dataset, not a complete replacement for all world history. Its divisions include states, imperial territories and subdivisions. Areas with no source coverage remain blank within an otherwise populated regional view. A wholly empty view, a disabled regional layer, low zoom, modern-reference mode or a source failure restores the global overview. The map badge and Sources page explain which source is visible. No claim is made that all countries or dates now have complete or surveyed borders. Upstream tiles are live and coverage can change.

No new historical curves were invented. Polygon vertices are supplied by the source. The source's native vector-tile generalization still varies with zoom. The more subdued overview stroke is only a style change. Physical relief and water remain contemporary geographic context as previously documented.

## Validation

- Full `npm test` passed; `automated-checks-v3.3.txt` contains the output. The final label clipping refinement was rerun through the regional tests. Raw geometry, lake, physical asset and city integrity checks passed.
- Ten new regional checks cover date evidence, same-year changes, BCE/CE, Simplified Chinese, source IDs, interior labels and holes, lazy loading, source switching, stale-year rejection, failure recovery, disable/modern mode and listener cleanup.
- Real MapLibre 5.6.2 independently evaluated five date scenarios with no style errors: `regional-browser-filter-audit.json`.
- A real browser received malformed tile payloads: the overview retained 136 polity records, no fatal map errors occurred, retry recovered 23 regional areas in an 800 × 500 test map, and 70000 BCE cleared all regional records: `regional-browser-recovery-audit.json`.
- A direct source audit at 1492 near the Alps found 2,034 source tile features, 44 date/level matches and 27 rendered features in a 900 × 500 isolated map: `regional-live-source-audit.json`. These counts include tile duplication and differ from deduplicated UI counts.
- The desktop product view at 8.2° E, 47.7° N, zoom 7 displayed 28 deduplicated areas. The Basel record opened the correct OHM relation 2852254 and the 1492-07-01 source-map URL.
- The UI toggle restored the original overview and encoded `regional=0` in the share link. It then returned to regional detail. Desktop and 390 × 844 layouts were visually inspected.
- Temporary browser fixtures were removed from public assets; reproducible harnesses remain in `scripts/fixtures/`.

## Source research

- Official tile definition: https://vtiles.openhistoricalmap.org/maps/ohm_admin.json
- Reuse, date filtering, and attribution: https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Reuse
- Project coverage and hierarchy: https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Projects/Holy_Roman_Empire
- Consolidated upstream attributions: https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources
- ETH's automatically extracted HRE dataset was examined, but not imported: its source describes a 16th-century static dataset based on a circa-1400 map, with CC BY-NC-SA licensing. It is not an unambiguous higher-resolution 1492 replacement.

The complete source package includes the new renderer, tests, documentation and OpenCC notices. It does not bulk mirror worldwide OHM tiles. The existing private audience and lake-object-storage configuration remain unchanged.
