# Meridian Atlas 3.5 — selectable, dated boundary detail

The angular national outlines reported in the Alps are present in the global source geometry. This release improves use of a separate dated regional source and its display, rather than manufacturing extra border coordinates. Global Cliopatria geometry and its historical limitations remain preserved.

## Source selection

- Automatic, Global overview and Regional detail are independent choices on each comparison map and survive share-link reloads. Legacy `regional=0` links retain the global overview.
- Automatic uses a 9 × 7 viewport sample grid. Only land samples count; at least five are required. Detail enters at 80% coverage and remains until coverage drops below 65%; sampled quadrants and the central area must each have at least half coverage. These are display heuristics, not historical accuracy estimates.
- A small regional polygon no longer hides the whole global map. Partial coverage exposes a direct detail button. Explicit Regional detail preserves source gaps. Empty or failed regional sources restore the global archive.
- Archive switching has zero opacity-transition duration, avoiding temporary double borders. National labels take precedence; tile fragments are retained to choose a useful visible label anchor. Regional labels avoid lake labels and map controls.
- Regional polygons use July 1 of the selected civil year. Administrative levels 2–4 appear from zoom 6; levels 5–6 appear from zoom 8. Overlapping original records remain separately identifiable by dates and IDs.
- The regional index updates as tiles arrive without replacing its search input. Identical results do not rebuild the list; changed results preserve list scroll. The centered panel fits within the map, including a 390 × 844 mobile viewport, and sits above map headings and tools.

## Source evidence

`regional-county-evidence-v3.5.json` documents four live OHM tile samples and two directly checked Newberry-derived county relations, including exact IDs, dates, source/license tags, legislative citations, original URLs and file hashes. Sampled counts describe those tiles, not national or worldwide coverage. The website reads existing OHM tiles; it does not bundle the global tile archive or assert that every OHM feature has the same license.

## Validation

- Full `npm test` passes; the saved output is `automated-checks-v3.5.txt`. This includes 15 regional checks and 56 view-state checks, alongside original geometry, place, lake, data, interaction and release tests.
- Alps, 1492, 8.2° E / 47.7° N / zoom 7: 28 visible deduplicated source records. Automatic retained the global archive with 13 of 63 land samples covered. Manual detail opened the regional outlines; overview restored the original polygons.
- The corresponding 1500 view displayed 33 regional records, with 21 of 63 land samples covered. Separate detail and original-overview screenshots use the same camera. No console errors were reported in that browser document.
- Great Ming, 1400, 116.4° E / 39.9° N / zoom 7: 61 of 61 land samples covered. Automatic displayed regional detail and the previously missing `大明 / Great Ming` national label. The actual modern-reference button hid the regional layer, and turning it off restored the label and detail.
- Virginia, 1850, −78.5° / 37.3° / zoom 8: 50 deduplicated records at the desktop viewport, including country, state and county levels. Starting in overview and choosing detail inside the index populated the already-open panel when tiles arrived. Searching Charlotte found exact relation 2789214 with date 1845-05-01 and the 1850-07-01 source-map link.
- Comparison reload retained left Regional detail and right Automatic. Closing comparison hid the right source controls immediately. At 390 × 844, the right source group spans the layer grid and there is no document horizontal overflow. The centered index bounds were 20, 130.5, 350 × 440 inside the 390 × 571 map.
- Screenshots are provided beside the source package. Counts may vary with viewport and upstream updates.

## Remaining limits

Detailed historical coverage is geographically and temporally uneven. A detailed national record does not imply complete local subdivisions. The global overview can still contain angular source boundaries in areas without finer evidence. Live regional data depends on upstream availability and is not independently verified in its entirety. This release improves source selection and rendering; it does not claim complete surveyed borders throughout world history.

The existing owner-only audience and lake storage configuration are retained.
