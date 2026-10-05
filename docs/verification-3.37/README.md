# 3.37 verification notes

This work continues the 3.36 handoff in `/Users/zane/meridian_atlas/world-history-atlas`. The source baseline is `95b321b5ef25d99505c1018017bc59d83c453dc4`. The imported local tree was verified against the previously published tree before joining the histories; no source content was replaced.

## Territory loading

- Temporal native packs group transport only: every record keeps its original ID, coordinates and dates. The 258 packs cover the catalog continuously. The independent disk validator checks all 34,494 record copies and 33,426 geometry copies against 11,007 original source geometries, and verifies that the runtime lookup matches the source index exactly.
- A generated 10,385-byte static lookup selects the pack by year. Ordinary-year first frames no longer download the 121,025-byte full native index before requesting geometry. At 1450, the geometry request is one 164,769-byte exact pack. The full index is retained for independent-file lookups and recovery.
- A healthy slow pack is allowed to finish without starting competing megabyte overview downloads. The fixed 1.2-second race has been removed. Connection and stalled-transfer timeouts still apply; actual request or payload-validation failure permits the legacy overview fallback. A stale or canceled request cannot commit a frame.
- Persistent failure of optional bootstrap and temporal packs can recover from original individual geometry files. Every geometry in a pack, every record-to-geometry reference, the requested record membership, and the pack's year or interval are validated before caching. A later first-frame request may retry a failed optional pack.
- After validation and insertion into the native record cache, the resolved bootstrap or temporal pack is removed from the generic resource cache. This releases the redundant whole-pack reference while preserving exact native geometry references. Two maps still share an in-flight pack request, and later native-cache hits require no new download. This is a cache-retention regression check, not a measured browser-heap reduction.
- [Native request regressions](native-request-regressions.json) records 22 passing cases against the actual modules in isolated Node processes. It preserves the executed files' hashes, timestamp and staging path. Coverage includes successful pack release, shared in-flight requests, cache hits, failed-pack retries, independent-file recovery, full-payload validation, stale-frame cancellation and the 59 simplified-ID collision groups. Its controlled 1.5-second delay verifies that a slow healthy pack triggers no overview or large-index request; it does not measure browser loading speed.
- Frozen OHM requests track both request generation and year/window identity. Old completions cannot clear a newer ready view; malformed cached snapshots are evicted.

A separate browser check used a cold 1450 load with controlled 4 Mbps network throughput. The 164,769-byte native pack had a resource start time of 3,495.7 ms and end time of 5,487.7 ms in that navigation's timing record. No full native index or overview request occurred. These timestamps describe that resource, not the time at which the whole first screen became usable. Earlier experiments do not form a reliable timing A/B comparison, so no overall load-time speedup is claimed.

## Editorial content

The release adds eight bilingual overviews and corrects three existing ones, bringing the collection to 900. The other 889 existing entries remain structurally unchanged. This is a focused review, not a new scholarly audit of the entire collection.

- Additions: Mongolia, Korean Empire, Pinya, Hokuzan, Jin, Early Lý, Gojoseon and Cao Wei. Each keeps the reviewed scope, explicit per-section/per-fact citations and individual access dates.
- Corrections: Hawaiian Kingdom, Tangier International Zone, Republic of Benin. They separate narrative scope from source geometry dates, remove post-kingdom Filipino labour from the Hawaiian economy, distinguish Tangier convention and final settlement dates, and replace conflated Benin Kingdom heritage with Dahomey/Abomey material.
- Further checked corrections distinguish the 1875 Hawaiian reciprocity treaty signature from 1876 implementation; use a documented local Māhele example; replace unsupported Tangier economic generalizations with dated diplomatic evidence; replace the Benin phosphate claim with the World Bank's October 2024 economic account.
- Assembly now preserves explicit citations, scope notes and source access dates. Unknown/empty/duplicate references fail before any write. Current `zhIdentityMatch` extract metadata is understood while explicit old editorial rejection remains authoritative.

## Evidence limits

The map source itself retains some coarse historical geometry and uneven regional coverage. Transport optimization adds no invented boundary precision. Institutional records describe their coded evidence and uncertainty. Contemporary physical geography is a reference except where a separately dated historical landscape is supplied. Network timing from localhost must not be presented as a measured public-site or slow-network speedup.

## Physical reference layers

The fine physical reference is now requested by viewport from 648 spatial cells. Global coarse layers remain available while the paired fine land/water frame loads. The layer only commits after the map worker has received the complete current frame; stale requests and partially failed frames retain the fallback. True coast segments are clipped separately from polygon fill closures, so cell edges are never drawn as coasts.

The independent geometry audit reconstructs the source land, water, rivers and lakes, checks holes and the antimeridian, and includes a deliberately incorrect coastline negative case. See `physical-spatial.md` and `physical-spatial-geometry-audit.json`. A live Europe view at zoom 6 loaded six cells (619,425 bytes) plus a 36,043-byte index, with no former global fine physical files. Its total is specific to that viewport. The 1500 Low Countries HALC landscape and administrative layers also rendered above the new physical mask in the live browser.

## Societies and institutions

The Seshat Equinox canonical sheet supplies 47,477 coded rows across 373 source polity phases and 135 variables. Source values, uncertainty categories, dates, row numbers and repeated sampling contexts are retained. Of these rows, 1,446 supply their own date fields; 46,031 do not. Phase metadata never fills a missing observation date. Administrative/coding metadata is included in the total, which is not a count of independently verified historical facts.

The index is 31,947 compressed bytes; individual phase files are 1,124–3,239 bytes, and the optional all-phase search is 555,186 bytes. The original workbook and codebook are linked separately. All 135 variable names have Simplified Chinese display/search labels. The phase-name module supplies 308 display mappings (307 fully Chinese, one partially translated); uncertain source names remain available in English. Chinese search covers all 40 East Asian phases in this source catalog.

The exact workbook is retained and the standard-library builder reproduces the production data byte for byte. A real browser download of the filtered Ming population record for `1500CE` matched original workbook row 2220 exactly; the native browser download-event callback timed out, but the downloaded file was independently inspected successfully. See `seshat/INTEGRATION.txt`, `seshat/browser-export.json`, and `seshat/polity-name-review.json`.

## Research startup and reading state

Research deep links initialize independently: no MapLibre script, WebGL canvas, territory catalog or event file is required. Cold Ming research loaded a 31,947-byte index and a 3,056-byte shard in the observed browser session. The first Atlas navigation then starts the renderer once. Startup failure remains retryable, and stale initial place restoration cannot override subsequent navigation.

The source phase, field, variable, queries and zero-based page are preserved in the URL and when returning from Sources. Large numeric strings are formatted without floating-point conversion; raw rows and exports remain unchanged. Keyboard skip links reach the current main view without destroying the research URL. `browser-checks.json` records the observed local flows and their limits.
