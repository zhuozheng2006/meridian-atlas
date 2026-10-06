# HALC selection: share existing geometry buckets

This follows the initial 3.41 feature-state selection candidate. The original candidate's source and reports are preserved in `halc-before-shared-buckets/`; new evidence uses `*-shared` or `halc-shared-buckets` names.

## Change

`public/halc-boundaries.js` keeps the public selection API and full `fid` feature-state identity. `halc-selected` now uses the exact fixed filter/layout of `halc-edges`; `halc-independent-selected` uses those of `halc-independent-edges`. Both selection passes retain the former color, width stops and constant active opacity. Both remain above `halc-region-query` and `halc-region-edges`, including after retry/recreation. Ordinary, independent and regional border styling is unchanged.

`HALC_LAYERS[2]` remains `halc-selected`; the independent selection ID is appended. Region insertion continues to use `halc-selected` as its anchor. No source data, coordinates, simplification, source provenance, or region lifecycle logic changed.

The actual bundled MapLibre v5.6.2 worker groups layers by type, source, source-layer, min/max zoom, filter and layout; paint is excluded. Consequently each selection layer shares its base line bucket. This avoids the preceding candidate's third, unfiltered full-locality geometry bucket while retaining feature-state updates and zero source reload on selection.

## Evidence

- `scripts/validate-halc-shared-buckets.mjs`: **5/5**. Exposes `StyleLayerIndex` and `WorkerTile` constructors only in an isolated copy of the shipped bundle, replacing the worker bootstrap return. Grouping, PBF decoding, bucket construction, geometry population and program configuration execute the actual bundled code. Hook signatures fail closed if the bundle changes.
- Real shipped `6/32/20.pbf`: **432** features, ordinary and independent groups both present. The worker creates **2** line buckets instead of **3**; line vertices **344,574 → 172,287**. Each base/selected pair is the *same bucket object and same geometry array objects*. Both base geometries' vertex/index byte digests exactly match the preceding candidate. Every source feature matches exactly one selection filter.
- `scripts/validate-halc-selection.mjs`: **24/24**, including full identity, state cleanup, async dossier races, source recreation, eligibility, comparison maps, actual bundled style reload behavior, exact selected layer order and low-zoom independent highlight opacity.
- Existing production-controller checks remain green: actual style reload **13/13**, lifecycle **29/29**, continuity **24/24**, regions **30/30**, render readiness **18/18**. Logs have `-shared.log` suffix.
- Structural selection benchmark remains **200 old filter changes → 200 source reloads**, versus **200 feature-state selections → 0 source reloads**.
- `git diff --check` passed.

## Boundaries and browser follow-up

The parser test uses fixed subdivision granularity 1, no network or GPU. Its recorded parse times are observations of one Node process, not a browser latency comparison. Sharing eliminates duplicated vertex/index geometry; state-dependent paint arrays and selection draw calls still exist. Browser first-frame latency and GPU/memory benefits must be verified separately.

The selected feature belongs to `halc-selected` for ordinary attribution or `halc-independent-selected` when ADM1 contains an exact `XX` token, including composite memberships. For browser assertions, use source feature state plus screenshot; an all-layer query count is not proof of highlight opacity. Query both selected layers if checking layer features. Both share `{source:'halc-boundaries',sourceLayer:'halc_localities',id:fid}`.

Production files are frozen for the parent browser pass. No version/stamp/package changes, commit, upload or deployment were made by this subagent.
