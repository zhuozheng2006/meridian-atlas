# Meridian Atlas 3.4 — country dossiers and dated places

This release connects the existing territorial and place archives. It adds no new historical place records and makes no claim of exhaustive settlement coverage.

## Selection and provenance

- Spatial inclusion uses the original native territory geometry, including separate islands, holes and dateline crossings. It does not use overview geometry or regional OHM polygons.
- Capitals require the record’s checked Wikidata identity, an accepted profile binding and an active tenure. Ambiguous names and conflicting period bindings are excluded. This check establishes the archived entity relationship, not independent corroboration of every Wikidata statement.
- Other places require an active attestation/location period. Cultural period ranges remain source-defined; they do not establish precise occupation dates.
- Population uses the nearest source observation within 50 civil years, preserves its actual year and number, and keeps separate studies as separate records.
- UI methodology is consolidated under “How places are selected”. Source archive detail remains available in each city reader.

## Automated validation

`npm test` passes. `automated-checks-v3.4.txt` contains the full run.

`validate-polity-places.mjs` checks date gaps, BCE/CE, invalid years, holes, edges, islands, datelines, dated locations, identity exclusions, partial failure recovery, cancellation, aliases and actual archives. Its 1,250 seeded points across five original source geometries agree with an independently generated Shapely 2.0.7 `covers()` fixture. This verifies the inclusion implementation, not historical truth.

`validate-place-return.cjs` runs 16 checks against actual source functions: both comparison sides, stale years, removed maps, captured city promises, user interactions and reader state changes. It verifies that old returns cannot reset a newer view’s scroll or focus. It also covers Chinese composition and Aachen’s actual “Aix-la-Chapelle” alias.

Actual archive snapshots (counts of records, not unique cities):

| Polity | Year | Capital records | Settlement records | Population records |
| --- | ---: | ---: | ---: | ---: |
| Roman Empire | 100 | 1 | 6,062 | 9 |
| Ming Dynasty | 1492 | 1 | 0 | 19 |
| Ottoman Empire | 1600 | 1 | 36 | 29 |
| French Second Republic | 1850 | 0 | 10 | 61 |
| Swiss Confederation | 1492 | 0 | 1 | 0 |

These differences expose the source collections’ uneven regional and temporal coverage. A zero is no matching record, not absence of a capital or settlement.

## Browser checks

- Roman Empire, 100 CE: 6,072 records; name query, opening Rome’s capital record/city chapter and returning with query and camera preserved.
- Mobile viewport 390 × 844: no horizontal document overflow; scrollable section navigation; list expansion from 40 to 80 records; opening item 45 and returning preserves the 80-item list, reading position and item focus.
- Section-arrow navigation changes the section without changing year or camera. English/Chinese switching preserves the query and selected section.
- Comparison: left 100 CE, right 1492 CE Ming dossier. Opening Beijing and returning retains left year 100, right year 1492, right selection and original camera.
- A real browser fixture fires composition events through the shipped reader: live input and asynchronous dossier re-render do not replace the editor during composition; committed Chinese query and caret survive; stale detached composition events cannot overwrite the query. See `polity-places-ime-browser-audit.json`. This is event-level browser validation, not a claim of exhaustive OS input-method testing.
- City heading focus is retained when its full archive arrives asynchronously.

## Regional coverage sampling

`regional-coverage-audit-v3.4.json` records nine public OHM administrative tile samples, source URLs, byte hashes, filtered counts and point-in-polygon checks. Successful tile retrieval does not prove historical correctness or complete viewport coverage. The selected 1400 West African and Java tiles contain no matching level 2–4 administrative polygons. Other sample tiles contain matches that do not necessarily cover their center. Existing fallback and source separation are retained; this release does not invent missing boundaries or alter the 3.3 border rendering.

## Release boundaries

Core country/city lookup stays local, uses cached archives and yields during geometry scanning. The list mounts 40 rows initially. Partial source results remain marked and retryable; incomplete selections are not cached. Regional historical borders still depend on the public OHM service and its uneven source coverage. Site access remains owner-only.
