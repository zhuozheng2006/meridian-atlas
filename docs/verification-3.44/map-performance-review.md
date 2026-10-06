# 3.44 HALC first detailed frame audit

Baseline: repository `cbc1f22d`, package 3.43. Production was read only for this investigation. The root agent subsequently integrated the regional candidate and a conservative two-worker policy; the portable scripts below were rerun against that integrated production. Browser captures belong to the root agent.

## Reproducible deliverables

- `lazy-regions.patch`: minimal original candidate patch; the root already integrated its behavior.
- `halc-regions.candidate.mjs`: preserved candidate source.
- `benchmark-regions-lazy.mjs` / `regions-lazy-benchmark.json`: original frozen candidate comparison (4/4).
- **`validate-halc-regions-lazy.portable.mjs`** → `scripts/validate-halc-regions-lazy.mjs`: production `halcVisibleRegions` comparison against the preceding eager grouping loop (3/3).
- **`validate-halc-worker-pool.portable.mjs`** → `scripts/validate-halc-worker-pool.mjs`: actual bundled WorkerPool semantics (5/5).
- `production-regions-lazy.json` and `production-worker-pool.json`: current portable-script verification outputs.
- Independent source/lifecycle review: `../audit/validate-regions-lazy-lifecycle.mjs` and `../audit/regions-lazy-lifecycle.json` (12/12, owned by the cartography audit agent).

Portable scripts resolve the repository from `import.meta.url` relative to `scripts/`, with an optional explicit root argument. The geometry suite writes `HALC_REGIONS_LAZY_REPORT` or defaults to `docs/verification-3.44/halc-regions-lazy.json`; the pool suite writes `HALC_WORKER_POOL_REPORT` or defaults to `docs/verification-3.44/halc-worker-pool.json`. The scripts do not assert timing thresholds.

## What actually remains on the first-frame path

The root's one-worker baseline `baseline-browser.json` separates these milestones for `[4.8,51.3]`, z4.5 → z6.3:

| Milestone | Relative time |
|---|---:|
| Locality source loaded event | 3198.3 ms |
| Locality queryRenderedFeatures starts / duration | 3230.2 / 160.6 ms |
| Locality frame active, 12,455 units | 3434.6 ms |
| Region source loaded event | 3432.8 ms |
| Region queryRenderedFeatures starts / duration | 3456.6 / 22.1 ms |
| Region frame ready, 133 groups | 3699.8 ms |
| 12 labels present | 3778.2 ms |
| Landscape source/content ready | 7112.9 ms |

The baseline also records long tasks of 229, 159, 96 and 382 ms. Without function-level traces, these cannot all be assigned to a single phase. Locality query time is directly measured. Regions had an avoidable eager geometry conversion after their query. Label ranking is already asynchronous in 3.43 and must not be conflated with source readiness or the first boundary paint.

`HalcBoundaries.settle()` still asks `queryRenderedFeatures` for the complete `halc-wash` viewport and uses the full result as its metadata registry. Replacing it with `querySourceFeatures` would change membership, tile-fragment coverage and hit/display semantics; it is not a safe drop-in acceleration. No such shortcut is proposed.

## Regional eager conversion: smallest demonstrated fix

Before integration, `public/halc-regions.js`'s `settle()` grouped every visible `gid` and explicitly called `f.geometry` in `fragments.push(f.geometry)`. MapLibre's `geometry` accessor is on the prototype; the preceding object spread itself is not the decoding trigger. The accessor converts all tile coordinates to geographic coordinates.

The new `halcVisibleRegions` preserves the exact existing truthy-`gid` gate, key type, first feature properties, group insertion order and fragment query order. Each array index reads the original `Feature.geometry` only when accessed, then replaces itself with the same geometry object. Source/frame readiness, style visibility, revision, callbacks and cache guards remain unchanged. Current production hook: `public/halc-regions.js:6` and `:61`.

Actual shipped MapLibre Feature objects and all six z6 region tiles establish:

| Input | Fragments / groups | Coordinate points | Eager grouping | Lazy grouping |
|---|---:|---:|---:|---:|
| Largest center tile | 103 / 103 | 168,321 | 66.16 ms | 0.074 ms |
| Six z6 tiles together | 185 / 152 | 253,101 | 91.04 ms | 0.102 ms |

These are bounded Node observations, not browser speed ratios. Candidate ordering, GC/JIT and device load affect timings. No feature or coordinate is removed. Every group anchor's exact coordinate and score matches the eager algorithm. Full geometry JSON also matches; the combined SHA-256 is `099c6c377fd24bc20ce5d8cefa088737ab400a42d34974cfbdb621e4b5c47643`.

The complete six-tile set has 54 qualifying low-zoom label groups. All 54 are still evaluated; they demand 75 original fragments. The other 110 fragments stay lazy until explicitly serialized/read. At high zoom, labels use locality candidates; with labels hidden, no region anchor is needed. The lifecycle suite separately verifies these zero-region-decode paths, metadata-only reads, grouped clicks, same-gid new epochs, error/year changes and destroy.

Deferred coordinate work still costs CPU when required. In the production portable sample, the largest exact anchor took 7.43 ms and the largest slice 9.41 ms. A polygon anchor remains indivisible; this candidate neither claims a hard 4 ms ceiling nor pretends deferred label computation has vanished.

## Worker contention and a bounded resource policy

The actual shipped 5.6.2 bundle sets its worker count as `isSafari ? clamp(floor(hardwareConcurrency / 2), 1, 3) : 1`. Thus Chrome defaults to one worker, even in the tested 18-logical-core environment. A VM check of the actual bundle reproduces Chrome=1 and Safari=3; the root separately confirmed actual Chrome=1 before changing production.

The shared pool creates its workers on first acquire. Each map owner receives the same worker objects; releasing one map does not terminate them while another map remains. Changing `setWorkerCount()` after pool creation only changes the configured number reported by the getter; it does not resize an existing pool. Prewarm also fixes the initial pool size. A meaningful A/B must reload the page or release every owner before recreation.

Vector tiles choose actors via the dispatcher, so additional workers permit tile tasks from different sources to run concurrently. A GeoJSON source chooses one actor in its constructor; one landscape indexing job is not split across two or four workers. More workers add worker-global runtime, style and resident task/cache costs; resident memory was not measured here. Keeping a small global cap, with low-core fallback, is preferable to scaling to all 18 logical cores. The root selected two workers after an actual fresh-page observation; further worker-count tuning is outside this release scope.

The root's two-worker/eager-region observation (`two-workers-eager-browser.json`) was locality ~2491 ms, regions ~2658 ms, labels ~2786 ms and landscape ~4617 ms. This is a separate browser run with cache/load variability, not a controlled speedup guarantee. The final two-worker plus lazy-region measurement belongs to the root and must be reported separately.

## Network evidence boundary

The six z6 locality files total 3,763,248 raw bytes and 1,875,853 bytes after lossless level-6 gzip. Their region counterparts total 902,816 / 433,675 bytes. The benchmark explicitly decompresses each compressed result back to the original byte string; this is payload arithmetic, not a hosted-network measurement.

The local `serve.py` already applies gzip to `.pbf` and caches compressed results. Its first compression has a cost; the bounded Node compressor observations were ~186 ms for the locality set and ~48 ms for regions, but these are not Python server timings. No server change is proposed.

`network-baseline.json` contains 418 events with `truncated=false` and `hasMore=false`, but its 140 request records contain **zero `.pbf` requests**. It is complete for the captured target, not evidence that worker-originated vector tile fetching was captured. The page's performance resources similarly omit the worker PBF requests. Therefore the ~3-second locality source load cannot be classified as network-free from these files.

In contrast, the page does record 48 landscape gzip responses totaling 7,961,522 compressed bytes, with the last page fetch finishing around 220 ms in this captured warm/cache context. This supports separating that page fetch stage from the much later landscape readiness; it is not a general cold-network claim.

## Next release: landscape serialization/indexing, not more scope now

`public/halc-landscape.js:85–93` loads all intersecting shards, preserves and sorts all selected features, then passes a GeoJSON object to `setData`. The bundled GeoJSON source synchronously performs `JSON.stringify` on that object, sends it to its fixed actor, parses it in the worker, and builds a geojson-vt index. The root separately measured an approximately 443 ms landscape serialization task; preserve that as the next profiling target.

Candidate future investigations should measure stringify, structured-clone response delivery, geojson-vt indexing and individual tile bucket/upload stages separately. Any binary/vector-tile migration must prove full source geometry, class, feature-id, chronology, coverage and click equivalence; this release does not add such a conversion.

One other source of later work is landscape's hidden-to-visible layout switch after source readiness. In the bundled style implementation, changing layout/filter can mark a source for reload; constant opacity gates and layer moves have different effects. Existing locality and region selection/activation paths already have dedicated real-bundle no-reload regressions. The initial locality `paint()` waits for labels metadata and sets the fixed data-driven palette; verify event/reload counts before attributing later sourceLoaded notifications to it. No further style, terrain or landscape behavior change is included in this candidate.
