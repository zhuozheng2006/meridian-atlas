# Lake data distribution

The hosting service enforces a 256 MiB input-archive limit, including remote builds. The complete atlas exceeds that limit. The web application is therefore built as a small Worker with static assets, while the 2,551 compressed lake geometry shards are held in the same private Site's R2 bucket.

- `public/` retains the complete portable atlas, including every lake shard. `python3 serve.py` still runs the full local copy without the cloud storage service.
- `worker/atlas-worker.mjs` handles lake reads. Other pages and assets delegate to the platform `ASSETS` binding.
- `npm run build` creates `dist/client/`, `dist/server/index.js` and the hosting manifest. It excludes only the exact lake geometry files enumerated in the audited manifest. The public index, lake names, sources and audit manifest remain static assets.
- R2 object keys include a content-derived release revision. Reads verify the stored object's length and recorded SHA256 against the build's immutable manifest. Missing data returns a retryable error, preserving the existing overview in the browser.
- A temporary import build accepts only the exact bytes and hashes listed in that manifest. Imports are idempotent, size bounded, restricted to the existing owner-private Site boundary, and time limited. The final build disables all import endpoints.
- The bootstrap build command uses `node scripts/build-worker.mjs --import-until 2026-10-02T10:00:00Z`. Normal builds omit this argument and serve reads only. No service credentials are included in the source, artifacts or browser code.

Validation: nine server behavior checks cover byte integrity, idempotent storage, conditional reads, failures, unknown paths, cross-origin imports and disabled/expired import windows. All existing front-end/data checks also pass after moving editable web assets from `dist/` to `public/`.

Cloud bindings were confirmed on the existing owner-private Site. On 2026-10-02, all 2,551 objects (243,358,114 bytes) were imported with server-side hash verification; the complete stored inventory matched the immutable manifest. Six downloaded objects, including the largest shard and the three Biwa shards, matched local bytes and SHA256. Evidence: `lake-storage-audit.json`. The final local build has `importUntil: 0`; its import routes return 404 while asset routing and lake reads remain available. Final publication status is recorded in the release metadata.
