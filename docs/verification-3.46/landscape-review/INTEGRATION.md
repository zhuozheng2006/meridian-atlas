# Meridian 3.46 landscape candidate

This is an isolated experiment directory. Only the root agent integrates or publishes. Product files are frozen after adding the source-error fallback and the reported-memory guard. No coordinate, geometry simplification, source property, feature ordering, or tile option changes are included.

## Copy into the matching project paths

Product (six files, including the subsequently discovered first-view label recovery):

- `public/halc-boundaries.js`
- `public/halc-landscape.js`
- `public/halc-landscape-client.js`
- `public/halc-landscape-worker.js`
- `public/halc-landscape-prepare.js`
- `public/assets/maplibre-gl.js`

Build/provenance and regression checks:

- `scripts/patch-maplibre-landscape-dataurl.mjs`
- `scripts/vendor/maplibre/maplibre-landscape-dataurl-patch.json`
- `scripts/vendor/maplibre/maplibre-gl-5.6.2.upstream.js`
- `scripts/test-support/maplibre-runtime.mjs`
- `scripts/test-support/halc-landscape-web-worker.mjs`
- `scripts/validate-maplibre-landscape-dataurl.mjs`
- `scripts/validate-halc-landscape-real-data.mjs`
- `scripts/validate-halc-landscape-worker.mjs`
- `scripts/validate-halc-landscape.mjs` (replace the existing lifecycle check)
- `scripts/validate-halc-landscape-assets.mjs`
- `scripts/validate-halc-label-context-recovery.mjs`

Reports under `docs/verification-3.46/` are evidence from this candidate and may be copied with their stated scope. Copy this integration note and the review note into the project documentation if desired. `install-manifest.json` records final product/build/test SHA-256 values.

Do **not** copy the candidate `package.json`, `public/data` or `public/map-engine.js` symlinks, or its test-only copy of `public/halc-landscape-reader.js`. These provide the isolated tests with existing project dependencies; they are not product changes.

The preserved original vendor is intentionally under `scripts/vendor/`, outside the deployed static tree. Its existing copyright header stays intact. The modified vendor derives directly from original 5.6.2, not the unpublished 3.45 Blob patch.

## Commands after integration

Run once from the main project after copying the six product files:

```sh
node scripts/stamp-assets.mjs
node scripts/patch-maplibre-landscape-dataurl.mjs --check
node scripts/validate-halc-landscape-assets.mjs
node scripts/validate-halc-label-context-recovery.mjs
node scripts/validate-halc-landscape.mjs
node scripts/validate-halc-landscape-worker.mjs
node scripts/validate-halc-landscape-real-data.mjs
node scripts/validate-maplibre-landscape-dataurl.mjs
```

Add the new commands to the repository's required test sequence as appropriate. Existing `validate-halc-landscape.mjs` remains the replacement lifecycle check. The tests resolve data and modules relative to their installed locations, write reports to `docs/verification-3.46`, and need no extra packages.

Asset stamping already handles all static `from './*.js'` imports: controller → client, worker → prepare, prepare → reader. The client carries its own `import.meta.url` query verbatim into the dynamically created worker URL. The asset check validates that graph against `index.html` and the actual local server's JavaScript MIME mapping. This check needs a full stamped project, so it was supplied for integration rather than falsely run against an incomplete candidate tree.

## Verified here

- Controller lifecycle: 30/30.
- Preparation worker: original 11/11 plus the new reported-memory policy 1/1, saved in the separate `*-focused.json` report (12 distinct tests).
- Source-preserving real data and exact UTF-8/base64 bytes: 6/6.
- Actual bundled MapLibre source/worker/request API: original 8/8 plus queued `setData` 1/1, saved in its separate focused report (9 distinct tests).
- Total: **57 distinct checks passed**, without rerunning unchanged full-data tests merely to combine report counts. Installed full runs produce the combined counts 30, 12, 6, 9.
- Precise one-site vendor patch `--check` passed, original SHA-256 `1525f971223d81f169f049f1ce50083e6f1643aa6b0ea0716653a550d2d57fc2`, candidate SHA-256 `ce1a6e48007792219265ead1fc233089e591128b6a1e538ea538d208ddc3850c`.

The API tests use actual 5.6.2 code and native Node fetch/Request/Response with structured-clone actor boundaries. They are not browser performance measurements. Actual `Map.setStyle` diff/render, Chrome, CSP, live deployed MIME, and low-memory-device behavior belong to root's browser/deployment checks. Root has separately reported successful Chrome `getData`/`getStyle`/`setStyle(style,{diff:false})` round trips and is doing controlled A/B/fallback verification.

## First-view label recovery follow-up

A fresh direct high-zoom load exposed an existing label-job gap: collision boxes can change after the final map idle, invalidating a queued exact-anchor job before its first slice. The old controller leaves the canceled job without scheduling the latest context. Root captured `context-changed`, zero computed anchors and no pending job; the original 3.45 controller has the same refreshLabels logic.

The candidate adds a completion callback only to the currently owned canceled job. With `context-changed` and all ordinary eligibility/loading/movement guards still satisfied, it requests the newest context. There are at most three automatic recoveries per originating request. Newer explicit requests take ownership and supersede recovery, and no map repaint, timer polling or endless idle loop is introduced. Ranking, source geometry and collision rules remain unchanged.

`halc-label-context-original-failure.json` records the original production module failing the deterministic no-new-idle reproduction. The fixed production module passes all 10 new context-recovery checks. Existing label lifecycle (13/13) and exact scheduler + real-MVT anchor/marker oracle (22/22) also pass against this candidate. Reports are under `docs/verification-3.46/`. This is 10 additional checks beyond the 57 landscape-path checks above; existing label regressions are listed separately. Root owns the actual fresh browser rerun.

The extra candidate symlinks `public/halc-label-scheduler.js`, `public/halc-regions.js`, `public/regional-boundaries.js` and `scripts/halc-test-adapter.mjs` are test dependencies, not product changes; do not copy them.
