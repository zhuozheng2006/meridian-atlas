# Sources and licenses / 来源与许可

- Historical territories: **Cliopatria / Seshat Global History Databank**, CC BY 4.0. https://github.com/Seshat-Global-History-Databank/cliopatria . Pinned commit: `ad28a691b7c07c1fca89d0e0636d324667d2a258`. The native fine layer preserves every parsed source coordinate, ring and component order. Older 0.02° geometry and 0.04° overview remain as compatibility/overview assets. Source names, intervals and areas are retained. Original source author and dataset attribution must be retained in downstream use.
- Dataset publication: Bennett et al., “Cliopatria — A geospatial database of world-wide political entities from 3400 BCE to 2024 CE”, Scientific Data 12, 247 (2025). https://doi.org/10.1038/s41597-025-04516-9 . The software's data-integrity checks are not an independent historical validation of that dataset.
- Supplementary labels: Wikidata, CC0. https://www.wikidata.org/wiki/Wikidata:Licensing . Labels are identity-checked against source Wikipedia article associations; additional exact-name Chinese editorial translations are identified in the catalog. Association agreement does not validate every historical identity.
- Physical basemap: Natural Earth, public domain. https://www.naturalearthdata.com/about/terms-of-use/ . Modern coastline overview; not an ancient shoreline reconstruction. The 2.1 edition adds the unaltered 1:50m land geometry from https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson ; source hash and processing notes are in `docs/BASEMAP-50M.json`.
- Map engine: MapLibre GL JS 5.6.2, BSD-3-Clause. https://github.com/maplibre/maplibre-gl-js . See `public/assets/maplibre-LICENSE.txt`.
- Original bilingual event summaries: CC BY 4.0, Meridian Atlas contributors, 2026. Each event retains links to its historical references; those underlying publications retain their own copyrights. No license to republish the linked original articles is implied.
- Interface and original code: MIT, see LICENSE.

## Design references / 交互参考

Chronosphere (globe and time navigation), Phersu Atlas (date-oriented history), Running Reality (spatiotemporal exploration), OpenHistory (event filters), HistoryMaps (guided stories), and Strata (layered exploration) informed interaction choices. Their proprietary datasets and code have not been copied or bundled. This project is independent and does not imply endorsement or affiliation.


## 2.0 新增资料与转换

- Wikidata实体、标签与结构化声明：CC0。每份实体档案保留QID、声明链接、参考资料、时间限定与抓取元数据。附引证仅描述记录具备引证，不等同于本项目逐句完成历史学审稿。
- 23篇文明概览及47条历史侧记：本项目原创中英文摘要，CC BY 4.0。每篇`sourceIds`对应博物馆、UNESCO等原始资料链接；原网页版权各自保留。
- [OpenCC Python Reimplemented](https://github.com/yichen0831/opencc-python)：Apache-2.0，用于构建时繁简转换（t2s），不随运行页面加载。人工补充译名沿用既有归属。
- Chronosphere与Phersu Atlas仅作为交互设计参考，未合并其专有数据。

## 3.0 地理与城市 / Geography and places

- Natural Earth: public domain. Bundled 1:10 million land, rivers, lakes and authentic shaded relief; `10m` is a scale abbreviation, not ten-metre accuracy. Contemporary coast alignment changes rendering only. Exact sources, transformations and file hashes: `public/data/physical/ATTRIBUTION.md`, `physical-manifest.json` and `files.json`.
- Mapterhorn online elevation: upstream attribution and licenses vary by region. [Full attribution](https://mapterhorn.com/attribution/); a retrieved attribution snapshot is bundled. Mapterhorn terrain is a contemporary geographic reference.
- OpenFreeMap / OpenMapTiles / © OpenStreetMap contributors: online vector service, ODbL source data. [OpenStreetMap copyright](https://www.openstreetmap.org/copyright), [OpenFreeMap](https://openfreemap.org/). Close-zoom default coastline reads only the ocean class, while fine waterways read river/stream classes; contemporary roads, buildings, full water and modern cities are separately enabled. No vector tile archive is bundled.
- Pleiades ancient places: CC BY 3.0; [downloads and attribution](https://pleiades.stoa.org/downloads). Per-record contributors, original names, attested periods, location evidence and URLs remain in the lazy place archives. The two contradictory date attestations and clearly non-settlement records are documented in `city-quarantine.json.gz`; raw inputs are unchanged.
- Reba, Reitsma & Seto (2016), historical urban population research: CC BY 4.0; [publication](https://doi.org/10.1038/sdata.2016.34). Chandler and Modelski source observations stay discrete; estimates are never added or interpolated. The China modern column uses the paper's stated 1990 observation year.
- Dated capital relationships and city coordinate/label statements: Wikidata, CC0. Statement and revision links are retained; a capital tenure is not a city lifespan.
- Twelve original bilingual city chapters: CC BY 4.0, Meridian Atlas contributors, 2026. Their 39 institutional references retain their own copyrights. No source prose, photographs or third-party city reconstructions are reproduced. Exact source-ID and date bindings are stored with each chapter.

Build instructions: `scripts/cartography/README.md`, `scripts/places/README.md`, and `docs/MAINTENANCE.md`. Original code remains MIT; licenses of embedded datasets remain separate.


## HydroLAKES v1.0 — detailed lake shores

Messager, M.L., Lehner, B., Grill, G., Nedeva, I. & Schmitt, O. (2016), *Estimating the volume and age of water stored in global lakes using a geo-statistical approach*. Nature Communications 7, 13603. https://doi.org/10.1038/ncomms13603. Dataset: https://www.hydrosheds.org/products/hydrolakes. License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

This project distributes a transformed selection in `public/data/lakes/`, with attribution and the original download link. It does not mirror the raw shapefile archive. We retain types 1 (lake, the default classification) and 3 (natural lake with regulation), and exclude type 2 (reservoir). Type 1 may include unidentified reservoirs. The shorelines describe varying modern source dates, not historical yearly shorelines. Regional mapping scales range approximately from 1:100,000 to 1:1,000,000; no metre-level source-accuracy claim is made.

Transformations: spatial partitioning without clipping or smoothing; original vertex counts retained; coordinates quantized to 0.000001 degree and delta-encoded. Maximum coordinate displacement is below 0.08 metre at the equator, far below the source scale. The 122 geometries whose validity would be degraded by quantization retain original floating-point coordinates. The manifest lists 649 remaining source-invalid geometries; they are retained without invented repair. This list covers invalid outputs, not a full inventory of all upstream invalid geometries. Label points are interior representative points calculated from the source; 24 Chinese lake names are editorial translations bound to exact HydroLAKES IDs.


## 3.2 Historical streets and buildings / 历史街区

- OpenHistoricalMap contributors: live vector tiles at `https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf`; selected `transport_lines` and `buildings` layers only. CC0 by default, with separately licensed elements; preserve the [central source acknowledgments](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources) and [copyright explanation](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Copyright). No blanket CC0 claim applies to the whole tile contents. We do not reproduce the global tileset or original source maps in the download.
- The date convention follows the official OpenHistoricalMap [start_date documentation](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Tags/Key/start_date) and [maplibre-gl-dates](https://github.com/OpenHistoricalMap/maplibre-gl-dates) at commit `e76d0297dff9cbf88cb41307bb4b5f5bef1ce9c4`. Our independent annual filter requires known starts and omits malformed ends and reversed intervals. Construction/proposed transport records are not drawn as completed streets. The audited fixture property excerpts retain source tile URLs and SHA256 in `scripts/fixtures/historical-records.json`.
- Styling is original Meridian code. The official [OHM stylesheet](https://github.com/OpenHistoricalMap/map-styles) was inspected at commit `dd9f378675689548c3ff8e6b5bea566eba3bf2c2` to establish current source-layer conventions. Date and style research notes are in `docs/historical-source-research.json`.
