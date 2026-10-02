# Meridian Atlas 3.8 validation

The release keeps the shared-corner border portrayal introduced in 3.7 and aligns its polity dossiers with the selected year. Historical source geometry and imported profile statements are unchanged.

- Full `npm test` passed, including source-coordinate integrity, border portrayal, civil-year keyboard handling, comparison views, place return, loading failures and source manifests.
- 60 independent date-evidence contract cases: bounded intervals, open bounds, point dates, mixed and multiple qualifiers, BCE/CE, circa, uncertainty and dated entity events.
- 30 real dossier regressions: Switzerland, Bavaria and Lorraine at 1500; retained raw facts and source hashes; Bern’s 1848 start, incomplete capital tenure, approximate Slovenia inception, bounded dissolution, source gaps and scoped narratives.
- Three new bilingual narratives bind to exact source identity, record ID and the reviewed 1500 snapshot. Institutional references appear in `polity-1500-sources.json`; no population or border estimates were invented.
- Lorraine’s OHM note attaches only to relation 2815329 with the reviewed 1480–1661-02-28 interval. It preserves the distinction between an editorial date and an evidenced boundary change.

Browser checks are recorded separately. These checks validate implementation and evidence handling, not a historian’s comprehensive audit of all imported claims.

## Further cartographic research

HALC v15 has been downloaded and verified against official checksums at its migrated DataverseNL DOI (10.34894/BTKFHV). All 14,863 polygons passed geometry validity checks. It reconstructs local units in the Low Countries at 1500, with varied source dates, methods and confidence. The reviewed data does not cover the Alpine scene and is not yet integrated. See `halc-source-research-v3.8.json`. Original research files remain outside this release in the working archive.
