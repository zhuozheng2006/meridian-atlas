# Research routing fixture update

The original line 24 map-request assertion reports `0 !== 1`. Directly executing the same extracted functions exposes `ReferenceError: eventsStatus is not defined`. The VM still declares the old `coreDataPromise`; the new ensureEventsData fails before the renderer request. showView correctly catches that error, which surfaces later as the request-count assertion failure. The production app declares all these variables. No product regression was found.

The patch changes only two test-environment boundaries:

1. Replace obsolete `coreDataPromise:null` with `catalogDataPromise:null,eventsDataPromise:null,eventsStatus:'idle',pendingInitialEvent:null`.
2. Add `renderDatasetStatus(){}` beside the existing renderDensity/renderEvents DOM stubs. This renders loading text only; it does not navigate.

All 15 test bodies and assertions remain byte-for-byte unchanged. The actual showView, ensureCatalogData, ensureEventsData, refreshEventData, ensureAtlas and restoration functions continue to be extracted from app.js and executed. None of those business functions is stubbed. The candidate passed 15/15 against the current integrated main-repository 3.48 names+events app, accessed read-only.

Install only `scripts/validate-research-routing.mjs`, or apply its exact patch. SHA values are in `routing-fix-manifest.json`. No product, asset-stamp or assertion change is needed.

The routing-review directory is a verification harness; its public directory is a read-only symlink to main. Do not copy that directory into the repo.
