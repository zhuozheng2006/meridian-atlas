# Border portrayal refinement — 3.8.1

The 1500 Alpine overview retains stepped outlines in the underlying Cliopatria archive. This update improves the bounded display curves; it does not add historical survey detail. OpenHistoricalMap regional detail and CShapes bypass this transformation.

Each candidate quadratic curve is contained in a corner triangle. The whole triangle must avoid nonincident original edges and every other accepted corner triangle. This replaces the previous distance-only cutoff, which unnecessarily restricted ordinary staircase corners. Shared nodes are calculated once and reused in reverse by adjacent rings. Curve cuts remain capped at 4 km and 45% of either incident edge.

If a ring's signed planar area changes by over 2%, affected shared cuts are halved together and every ring is checked again. Cuts below 20 m revert to their source corner. This avoids reverting an entire viable ring to right angles. Junctions, dateline and polar rings remain protected. Curves are sampled to a maximum two-metre chord deviation in the local equirectangular approximation; this is a drawing tolerance, not historical positional accuracy.

Validation:

- Full existing `npm test` passed. The new independent envelope suite additionally passed 26/26 cases.
- Twelve real snapshots (3400 BCE–2024 CE), 1,202 records: unchanged source hashes; exact feature-order independence; preserved component and hole counts. No newly invalid geometry, previously disjoint pair overlap, or interior gap was found within the audit thresholds.
- Every ring stayed within the 2% signed planar area limit. In 1500, Bavaria, Switzerland and Lorraine changed by approximately −0.004%, +0.042% and −0.136% respectively.
- The 1500 transform took about 98 ms in the local Node run; the largest of twelve snapshots took about 202 ms. Results are cached by source collection. This is local geometry timing, not an end-to-end browser benchmark.
- Browser: 1440×900 Alpine overview, original-outline toggle and URL persistence, regional-detail switch. The page loaded asset revision `3.8.1-2ea22886372e`; no horizontal overflow at the desktop validation size.

Reports are `border-shapely-v3.8.1.json`, `border-export-integrity-v3.8.1.json` and `border-shapely-summary-v3.8.1.json`. Reproduce exports with `scripts/export-border-curves.mjs` and audit them with `scripts/audit-border-curves.py`; run synthetic checks with `scripts/validate-border-envelopes.mjs`.

Existing source overlaps and invalid shapes are retained. Global interior-gap checks use a 0.12-degree inward buffer, excluding narrow coasts and islands; these results are not a proof covering every source year or every possible topology. Original archives, downloads and city membership use unmodified source geometry.
