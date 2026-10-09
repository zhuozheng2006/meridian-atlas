# 3.46 data URL / MapLibre return review

## Contract and exact scope

The original 5.6.2 `GeoJSONWorkerSource.loadData` parses, rewinds, optionally filters, and builds the GeoJSON index, then returns `{data:i}`. The main `GeoJSONSource._updateWorkerData` assigns that response into `_data`, fires metadata/content events, and synchronous `serialize()` exposes `_data`. `Map.getStyle()` calls style serialization; this application's layer ordering also calls `getStyle()`. Omitting the response property would therefore break ordinary synchronous behavior.

The patch changes only that return expression. For source ID `halc-landscape` and a request URL beginning exactly `data:application/geo+json;base64,`, it returns the request URL. The worker's `_pendingData`, updateable data, index, GD/getData handler, and tile generation remain unchanged. Main `_data` is a complete, reloadable URL. A normal `updateData` request has no request URL and returns the full updated object as before. Other source IDs, ordinary HTTP/Blob/custom URLs and other MIME prefixes retain the original response.

The source text is JSON.stringify of the exact selected source records, encoded in the preparation worker. Chrome's FileReaderSync reads a UTF-8 `application/geo+json` Blob to a base64 URL; no geometry object URL is created or revoked. The fallback encoder uses UTF-8 bytes and native `toBase64`, or independently encoded chunks whose size is a multiple of three. Metadata sent to the UI preserves every original non-geometry feature field, ID and ordering. Guide/coverage/hit behavior is preserved; geometry coverage queries still use the actual rendered source.

Original native request dispatch tests for `://`. This canonical base64 data URL has no `://`; original 5.6.2 already handles it with fetch in the MapLibre worker. The unpublished 3.45 Blob-protocol patch is neither needed nor included.

Actual-source tests cover GD, synchronous source serialization and `Map.getStyle`, reconstruction of a source from a serialized style, filters/winding/getBounds, updateData, queued setData, errors/cancellation, and exact PBF output at three tile locations. The independent selection oracle checks all 2,980 features / 514,392 coordinate pairs across five views, including wrapping, empty coverage, overlapping records, and null dates.

## Browser and deployment boundaries

Chromium's generic Mojo GURL trait has a roughly 2 MiB bound, but that is not proof that a local data URL fetch fails. Blink handles ordinary data URL requests locally through `CanHandleDataURLRequestLocally`/`HandleDataUrl`; transport paths and actual full-size inputs matter. Root has reported that Chrome successfully handled a 26,141,825-character URL for the common 2,884-polygon viewport, then returned all features through GD, and reloaded a JSON-cloned style with `setStyle(...,{diff:false})` to the identical normalized GeoJSON hash. This candidate does not claim all browsers or all URL use cases accept that size.

Primary references: [MapLibre 5.6.2 GeoJSON worker source](https://github.com/maplibre/maplibre-gl-js/blob/v5.6.2/src/source/geojson_worker_source.ts), [GeoJSON source](https://github.com/maplibre/maplibre-gl-js/blob/v5.6.2/src/source/geojson_source.ts), [request routing](https://github.com/maplibre/maplibre-gl-js/blob/v5.6.2/src/util/ajax.ts), [Chromium GURL/Mojo warning](https://chromium.googlesource.com/chromium/src/+/7e4e4023dfeb5be7ae4390d5307e544ad92e726f%5E%21/), [Blink resource loader](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/platform/loader/fetch/resource_loader.cc).

Root inspected the actual 3.45 deployment response: no CSP or report-only CSP header and JavaScript Content-Type `text/javascript`. The module-worker assets must keep a JavaScript MIME type. If a restrictive CSP is introduced later, the prepared data fetch needs data: in the relevant connect policy, and existing workers need their relevant worker policy. Do not treat the local server check as a substitute for deployed header/browser verification.

## Failure and cancellation

Preparation-worker availability failure already falls back to the original JSON path. Data validation/network errors during archive preparation retain the normal explicit retry experience.

For the new URL source-load path, the controller observes the specific GeoJSONSource object. Only a current, eligible, non-superseded pending URL request can trigger fallback. A `source.loaded() === false` error is ignored because 5.6.2 clears its in-flight flag before error firing, but a newer queued setData still makes loaded false; its queued update runs in finally. Old source identities and inactive or destroyed views are ignored. The same Evented error object is tracked weakly to prevent its subsequent map-level propagation from causing a second failure. Source listeners and controller references are removed immediately on retry/source removal and destruction, even when the fallback subsequently fails; retired source URLs are not retained by this watcher.

A current URL load error releases only that map's preparation lease, permanently disables its preparation-worker path, rebuilds the source and loads via the original JSON route once. A second failure remains visible and requires explicit retry; it does not loop. The other map retains its shared-worker lease. Root is verifying this with an actual rejected MapLibre LD actor request, rather than an artificial error emitted while its source is still busy.

## Memory is a tradeoff, not an asserted reduction

The full archive selection serializes to **19,949,092 UTF-8 bytes**, becoming **26,598,825 ASCII URL characters** (33-byte prefix plus four characters per three encoded bytes). The common measured viewport is slightly smaller. No array/object heap bound can be derived from the JSON byte count.

During preparation, the worker retains the selected decoded source shards in its cache. JSON text, a UTF-8 Blob, and encoded URL can overlap during encoding. FileReaderSync avoids the explicit large JavaScript binary-string intermediate, but the Blob and URL still cost memory. The fallback path can transiently allocate UTF-8 bytes and chunks. Cross-worker string structured clones still copy data; this change removes the automatic full geometry object response, not all copying.

The MapLibre worker still retains full parsed objects, updateable data and its tile index. The main source retains its URL. MapLibre's shared anchor used for URL resolution can retain the last URL, and a source created from a serialized style retains its initial URL in `_options.data` even after later setData calls. These references are bounded by live source lifetimes / the last resolved URL, but they must not be described as zero-copy or zero-retention. Two maps retain two map-worker/index states while sharing one preparation archive; their URLs can overlap in lifetime. Explicit getData intentionally incurs a full object clone and callers can retain it.

Before starting a preparation worker, browsers reporting numeric `navigator.deviceMemory <= 4` use the original JSON route. The coarse device hint is not available in all browsers and is not current free memory. This policy avoids this experiment's additional cache/encoding peak on those reported tiers; it does **not** establish lower total application memory or guarantee low-memory-device usability. Where the hint is absent, ordinary capability/error handling applies.

The data scope is fixed at the current 1500 archive (2,980 records, 49 shards plus index). Broader datasets or another large self-contained source require a new memory review. Deferred worker preparation shares one archive cache and worker between maps; last lease disposal terminates that preparation worker. It is not a generic unlimited prefetch/cache system.

Performance release evidence should compare complete source-ready timing and main-thread long tasks under the same viewport/build, include cached repeated view changes, and separate explicit GD/hash test allocations from normal browsing. A forced-GC retained-heap comparison is useful but does not measure all renderer/worker/native/GPU memory; process memory and real low-memory-device validation remain distinct. No mobile or constrained-device result is claimed here.
