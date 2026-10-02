# Physical geography and relief sources

## Natural Earth

Land, rivers, lakes: Natural Earth 1:10 million vector geography. Shaded relief: Natural Earth Shaded Relief Basic 3.2.0, based on downsampled SRTM Plus, original raster 21,600 × 10,800 at 1 arc minute.

All Natural Earth raster and vector data are public domain. They may be modified, redistributed, printed, and used commercially. No permission or mandatory attribution is required; this atlas acknowledges the cartographers and data contributors.

Official terms: https://www.naturalearthdata.com/about/terms-of-use/
Data: https://www.naturalearthdata.com/
Source vectors: https://github.com/nvkelso/natural-earth-vector

Processing: no coordinate simplification for physical vectors. Synthetic Null island excluded. Zero-area self-intersections in two lake rings are repaired using Shapely make_valid, documented in physical-manifest.json. Chinese names pass OpenCC t2s. The relief raster is reprojected to EPSG:3857 XYZ tiles, 512px z0–4; shadow and highlight intensity are encoded as a transparent overlay. The geographic coverage stops at ±85.0511287798°, without invented polar texture. Local relief is cartographic shading, not a downloadable elevation model.

This is a modern physical reference. Coastlines, rivers, reservoirs, and lakes can change over historical time. Features tagged artificial are hidden in historical physical context unless separately dated. The historical polity overlays retain their own source attribution, dating and uncertainty.

## Optional online terrain: Mapterhorn

Mapterhorn provides public terrain tiles for interactive web maps and distributes data extracts for reuse.

Data access: https://mapterhorn.com/data-access/
Attribution: https://mapterhorn.com/attribution/
TileJSON: https://tiles.mapterhorn.com/tilejson.json

The online data combine multiple sources under their respective open-data licenses. The full source/producer/license list is preserved in mapterhorn-attribution.json. The map should keep a visible linked credit “© Mapterhorn” when this data source is in use. Mapterhorn's BSD-3 code license is distinct from its terrain source licenses.

The terrain service is a third-party dependency. Local relief remains available independently when online data cannot be loaded.
