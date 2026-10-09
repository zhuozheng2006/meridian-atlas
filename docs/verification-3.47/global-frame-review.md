# Global current-frame cache: diagnosis, verification, and limits

## Why the same year was expensive

`BoundaryController.prepareOverview` produces a new FeatureCollection and feature wrappers for each commit even when native geometry references are unchanged. Both existing portrayal caches, `curvedBorders` and `boundaryMesh`, use the collection identity as their WeakMap key. A language change invokes `setYear` and therefore missed both caches, transformed the same geometry, and submitted the large source again.

The exact 1492 local native gzip is 150,207 bytes (506,889 decompressed), with 136 active records. The prepared source collection is 579,124 UTF-8 bytes. Executing the frozen complete 3.46 display method with the real unchanged algorithms produces 18,752,670 UTF-8 bytes in this Node runtime, SHA-256 `877f7cdf6aaafd53a6a69787739a68dc37a47e084d6c882ac81419aa71573949`. The Chrome baseline recorded by the parent is 18,752,685 characters; no cross-engine byte-identity claim is made. The frozen method, its source commit, and hashes are retained in `scripts/test-support/display-territories-3.46.oracle.*`.

The parent separately measured the old code in Chrome at global 1492, center [25,18], zoom 1.54, map 1512×599. Language changes en/zh/bi spent 485.2/465.1/468 ms in displayTerritories, each called polities.setData once, and also incurred later large tasks. Those measurements belong to `work/release-347/browser`; they are not measurements made by this subagent.

## What changes

One TerritoryFrameCache is owned by each AtlasMap. Its only persistent entry represents the current source collection and current portrayal. It fingerprints lightweight header/feature/geometry metadata and compares geometry and coordinate-array references in original feature order. A fresh canonical collection lets the existing portrayal WeakMaps reuse the current immutable input. Replacement references, metadata changes, order changes, or mode changes rebuild the appropriate payload. No deep coordinate copying, simplification, snapping, or new smoothing is introduced.

Raw, curved, and country-source output uses the original code. `rawTerritories` still points to the current unmodified input; BoundaryController current frame/record mapping, selection IDs, download code, language updates, geometry status events, and stale-year guards are unchanged. The test executes the frozen old method as an independent oracle and compares the full serialized real 1492 payload exactly in the same runtime.

Repeated display can skip setData only after the actual source is settled and ownership of its accepted data is proven. The cache observes the source's dataloading, metadata data, and error events. MapLibre replaces its main-thread `_data` with a worker clone, so the cache records the accepted serialized value at metadata completion instead of comparing only the original input reference. A new source detaches the retired observer and resubmits the cached derivation. Errors invalidate submission ownership so the same input retries.

## Source lifecycle constraints

- Native and overview geometry is treated as immutable by the existing project. New geometry or coordinate-array references are detected. Arbitrary deep coordinate mutations in place require `atlas.territoryFrames.invalidate()` before display; the test proves this also bypasses the original WeakMap entries. This does not claim to detect every possible mutation automatically.
- MapLibre queued load completion can replace `_data` with the preceding result before the next queued load begins. When event provenance is uncertain, the cache deliberately resubmits rather than guessing ownership. Derivation can still be reused. Zero redundant submissions is promised only for the settled, unchanged frame.
- An external queued `updateData(diff)` does not immediately change `_data`. Requiring `source.loaded()` before skipping prevents a later same-year display from leaving an earlier external diff queued. This case failed in the early draft and is fixed in the frozen candidate. The independent reviewer reproduced baseline/fixed final IDs `[1]` versus the draft's `[1,2]` using the actual vendor classes; see `work/release-347/independent-review/queued-diff-repro.*`.
- Actual same-source external setData and new-source replacement are tested here. A full browser `setStyle(style, {diff:true})` test belongs to the parent task; a VM source test alone is not represented as a full style-renderer test.
- `destroy()` removes the three observers and clears callback closures, accepted/input/flight/submitted references, source, and cached entry. Two maps own separate caches and lifetimes. A removed source is detached on rebinding or destruction. No global listener or strong all-year cache is added.

The cache retains one current frame per map; the existing portrayal WeakMaps may retain the raw/curved forms for that current canonical key. MapLibre still owns its input/worker clone/index, and the native store still owns its normal source geometry cache. Transient requests may retain older data while completing. This is a bound on the new cache's frame count, not a bound on total browser memory or a claim that total memory always decreases.

## Verification completed

The final new suite passed **14/14** using actual AtlasMap, BoundaryController, native loading, vendored GeoJSONSource/GeoJSONWorkerSource, and structured-clone actor responses:

1. Full real 1492 output equals the frozen oracle; source input remains unchanged; en/zh/bi language commits preserve labels/events/selection and skip settled duplicate submissions.
2. Properties, order, and replacement geometry invalidate the single entry.
3. Raw, curved, and country portrayal remain equal to the original without accumulating synthetic line features.
4. Explicit invalidation handles deep in-place coordinate edits.
5. External setData on the same source is restored by the intended frame.
6. Source replacement resubmits and detaches old observation.
7. A real source load failure allows retry.
8. Own A in flight then own B preserves final B.
9. External A in flight then own B preserves final B.
10. Queued external updateData is superseded by the later same-year frame.
11. Rapid curved/raw/curved switching ends with the correct exact payload.
12. Overlapping async years keep the existing stale-result guard.
13. Two maps have independent caches and destruction.
14. Destroy releases observers, callback closures, source, and cached payload.

Existing relevant suites also passed against the candidate: border curves **10/10**, point-layer gate **8/8**, boundary app races **5/5**, boundary mesh **20/20**. Thus 14 new cases and 43 existing regression cases passed. The final raw reports are `global-frame-cache.json`, `boundary-app-races.json`, and `boundary-mesh.json`; border-curve and point-layer-gate counts were observed from their console summaries. The parent still runs the integrated whole-project release checks.

The final Node real-data run spent 378.87 ms in the first setYear call and 0.77/0.28/0.30 ms in subsequent en/zh/bi calls; setData counts were 1/0/0/0 and the derivation build count stayed at 1. These timings exclude browser rendering and use local data transport. They demonstrate elimination of repeated work in this test, not a universal speed ratio.

## Remaining cost and rejected alternative

The first large frame, a new year with different geometry/metadata, or return to an evicted year still requires the original derivation and MapLibre submission. No first-load improvement is claimed. The independent reviewer measured pre-expanding the 1492 frame at about 7.9 MB gzip versus the 150 KB native pack, about 52.6 times larger; this candidate does not trade away the small native download for that prebuilt geometry. First-frame work remains a separate problem.
