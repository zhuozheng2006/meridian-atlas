# Meridian Atlas 3.2 — historical street detail

This release adds dated city-scale exploration; it does not establish complete historical urban coverage. The overall product goal remains open.

## Implemented

- Lazy OpenHistoricalMap transport and building layers, first requested at zoom 11; building footprints at zoom 14. The atlas now supports zoom 18 and preserves these cameras in view links.
- Roads, railways and building footprints use valid source dates. Civil BCE years are converted to astronomical years. All records overlapping the selected year are included; missing starts, malformed ends and reversed intervals are omitted. Construction/proposed transport records are excluded.
- Street names, accessible selectable labels, a street-record list, date cards and contextual source-map links. Unnamed buildings remain unnamed. Cards report source record years, without inferring identities or foundation dates.
- Historical detail pauses under modern reference. Layer state is encoded in shared views. Comparison maps filter their own years.
- The comparison year input is disabled until the new map's initial year is ready. This fixes an observed race where an early input was overwritten by the initial year load.
- Sources centralizes temporal, source precision, naming and license explanations. The live upstream tiles are not represented as a frozen or complete offline archive.

## Automated checks

`npm test` passed for the final product code. Raw results are in `automated-checks-v3.2.txt`. The existing integrity checks still cover every archived territory, physical asset, city manifest and lake shard. Added nine historical date/lifecycle/source-fixture checks; the view-state suite now passes 52 checks, including the comparison initialization race.

`historical-browser-filter-audit.json` records six year scenarios executed with the real bundled MapLibre 5.6.2 renderer. Visible feature IDs match independently written expectations for 2 BCE, 1 BCE, 1 CE, 1949, 1950 and 1951, including malformed and reversed dates. No renderer errors occurred. Reproducible browser harnesses and attributed fixture excerpts are in `scripts/fixtures/`; the harnesses are copied temporarily into the local web root for testing and removed before packaging.

`historical-browser-recovery-audit.json` verifies a deliberately malformed tile response in the real renderer: the historical layer reports a retryable error, the base layer remains present, and no fatal map error is raised. Switching the test endpoint back and retrying restores 246 visible records in the 650 × 450 test viewport.

## Visual and interaction checks

- New York, 1870 and 1700, at zoom 15.3: dated streets, railways and footprints render; moving to 1700 removes later records. Date card, contextual source link, accessible street-name buttons, Escape close and English layer text were checked.
- Comparison at 1870 / 1700: the two maps share the camera and show distinct street/footprint coverage. After initial readiness, entering 1700 commits that year and updates the URL.
- Modern reference hides historical detail and its browsing button. Restoring historical mode retains the view.
- At 390 × 844, the document has no horizontal overflow. The street browsing control remains above the timeline; the selected street card stays inside the viewport. The actual WebGL map and labels were visually checked and captured. Alt + Right changes longitude while the year remains 1870.
- Rome, 200 CE, zoom 15.4: ancient streets, building footprints, terrain and the existing dated city label render together.
- Desktop screenshots use the normal viewport. The browser's default mobile capture path mis-scaled or omitted WebGL; a native CDP capture with an explicit 390 × 844 clip and `captureBeyondViewport: false`, after a normal map movement, returned the correctly rendered mobile image. The viewport override and temporary request blocking were cleared afterward.

## Remaining work

Coverage differs greatly across cities and centuries. This release samples five upstream city tiles for schema/date evidence and checks selected rendered views; it is not a city-by-city historical audit. Trade networks, more city narratives, regional event balance and deeper independent historical review remain in progress. Modern terrain, coastlines and water remain geographic context; historical street detail does not reconstruct past shorelines.
