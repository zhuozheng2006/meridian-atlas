# OpenHistoricalMap frozen extract (1492 / 1500, central Europe)

Source: OpenHistoricalMap (OHM), queried through the OHM Overpass API on 2026-10-02T18:09:08Z.
Endpoint: https://overpass-api.openhistoricalmap.org/api/interpreter
Bounding box: 44, 4.5, 50.5, 14.5 (south, west, north, east)
Admin levels: 2, 3, 4 — relations that overlap 1492 or 1500 at the July 1 snapshot used by the atlas.

Licence: OHM states that its data is made available under CC0 1.0 Universal (public domain dedication):
https://www.openhistoricalmap.org/copyright — https://creativecommons.org/publicdomain/zero/1.0/
Individual OHM features may carry a source tag pointing at a third-party map or dataset; those
references are preserved verbatim in the feature properties (source, wikidata, wikipedia) so that
a future release can review them separately.

Pipeline: scripts/ohm/build-ohm-1500.mjs. Member ways are chained in stored order, coordinates are
copied without simplification, rounding or boolean repair, and holes / multiple polygons are kept.
Relations whose members do not close a ring are listed in manifest.json under "excluded" and are
not drawn at all rather than patched up.

Attribution wording for the atlas: OpenHistoricalMap contributors (CC0).
