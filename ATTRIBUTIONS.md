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

## 3.5 Regional and county boundaries / 地区与历史县界

- The live `ohm_admin` tiles provide dated administrative levels 2–4 from regional scale, and levels 5–6 from closer zoom. Original record IDs and dates remain linked. Source geometries are displayed without invented smoothing or joining local areas into national outlines.
- Available US historical counties include records imported from the Newberry Library's Atlas of Historical County Boundaries. The [official project](https://publications.newberry.org/ahcb/about/) releases its data under CC0 1.0; its [download page](https://publications.newberry.org/ahcb/downloads/united_states.html) supersedes the old license text inside ZIPs. Two example OHM relations, 2789214 (Charlotte County) and 2788960 (Lunenburg County), were individually checked for Newberry source attribution, CC0 tags and legislative citations. This is not a blanket license statement for every OHM feature.
- Tile samples, exact relation tags, dates, source URLs and hashes are retained in `docs/regional-county-evidence-v3.5.json`. These are sampled evidence and renderer checks, not exhaustive historical validation. The global tileset and original source-map images are not bundled.


## CShapes 2.1 beta — COW edition

Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch. 2022. “Mapping The International System, 1886–2017: The CShapes 2.0 Dataset.” Journal of Conflict Resolution 66(1): 144–161. https://doi.org/10.1177/00220027211013563

Original application code is MIT-licensed. Bundled datasets retain their individual source licenses. CShapes 2.1 beta (COW edition) in public/data/cshapes/ and its transformed data remain under CC BY-NC-SA 4.0, including noncommercial and share-alike requirements, and are outside the code’s MIT grant. For commercial use, obtain separate data permission or remove this dataset and its derivatives from distributed packages and deployed assets; disabling a visible layer does not remove bundled data. The CShapes manifest and ATTRIBUTIONS.md provide source links, full attribution, transformations and hashes.

Source: https://icr.ethz.ch/data/cshapes/CShapes-COW-2.1.geojson
License: https://creativecommons.org/licenses/by-nc-sa/4.0/

CShapes and its transformed data retain CC BY-NC-SA 4.0, including attribution, noncommercial use and share-alike terms. This data license is separate from the application code’s MIT license. Changes comprise deduplication, decade bundles, label anchors and Simplified Chinese display names.
Source geometry values, property values and civil dates are preserved. The manifest records source defects; they are not silently repaired. Source SHA256: `6aa7b88a5a8cbc5366c4200af8af3d7d9cd632800a1e62cd1dd2b7bfe8d65a88`.

## 3.10 中欧 1500 年细边界静态抽取 / Frozen Central European boundaries, 1492 and 1500

- OpenHistoricalMap contributors, [openhistoricalmap.org](https://www.openhistoricalmap.org/copyright). The data is dedicated to the public domain under **CC0 1.0** unless an individual feature carries its own source. `public/data/ohm-1500/` is a static extraction of dated administrative relations (levels 2–4) inside the window 4.5–14.5°E, 44–50.5°N, taken from the OpenHistoricalMap Overpass API on 2026-10-02T18:09:08Z, with every relation id, ring count, incomplete-ring count and coordinate set recorded in its manifest. No coordinate was moved, simplified or repaired.
- Only 1492 and 1500 are frozen. Other years continue to read the live `ohm_admin` vector tiles described in 3.5. Where OpenHistoricalMap holds no dated record for a territory at these dates — including the Old Swiss Confederacy, the Duchy of Bavaria, Württemberg, Baden, Habsburg Austria and Tirol — the atlas says so instead of drawing an invented outline. Three imperial circles whose member ways do not close into rings are drawn as dashed outlines without fill and are excluded from labelling and area figures.

## 3.10 有据遗址层 / Attested archaeological sites

- UNESCO World Heritage Centre listing descriptions, **CC BY-SA IGO 3.0**. Twelve reviewed sites in `public/data/places/attested-places.json.gz` keep only short factual statements (dates, spatial scope, representative coordinates) and original bilingual synthesis written for this atlas; no source prose, photograph or map is reproduced. Each record links its property page and retains the listed degrees-minutes-seconds coordinate.
- The representative point of a listed property is not an ancient city centre, a boundary, or a population observation. Sites are dated inside the range their source states, never to a single year, and are never merged with a nearby urban observation by name or distance.
- Additional institutional sources used for the events added in 3.10 (Iranica, Library of Congress, Japanese Agency for Cultural Affairs, Xi'an municipal sources, Nijo Castle, Press Information Bureau India, Egyptian Ministry of Tourism and Antiquities, University of Sydney, UNESCO Silk Roads) retain their own terms. Only short factual statements and original bilingual summaries are stored; the full list with read dates is in `docs/verification-3.10/content-sources.json`.

## HALC 地方区划与地区归属轮廓

Rombert Stapel, Historical Atlas of the Low Countries (1350–1800), version 15.0, [doi:10.34894/BTKFHV](https://doi.org/10.34894/BTKFHV). `public/data/halc/` 与 `public/data/halc-regions/` 中的转换数据采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。本项目将1500年原始地方单元转换为视野瓦片，并按完整原始 ADM1 值归并显示轮廓、去除重复共边；复合归属顺序保留，XX 与自然单元不并为领地。详细转换、核验与署名见相应目录 NOTICE 和 `docs/HALC-1500.md`。

## CHGIS V4 prefecture time series (3.55)

Fudan University / China Historical GIS, in collaboration with Harvard University. Original public MapInfo archive: https://yugong.fudan.edu.cn/V4_Prefecture_Bou_TimeSeries.rar (SHA-256 `9b624256c7a43835b1f061c073a1075d72b526f9b7720ab0de2e5ec3c0ba3ca4`). Source and method: https://yugong.fudan.edu.cn/CHGIS/sjxz.htm and https://yugong.fudan.edu.cn/CHGIS/sjsm.htm. This dataset retains its source terms; it is not relicensed under the application code's MIT license.

2,016 source rows, 1,322 distinct geometries, annual intervals from 224 BCE to 1911 CE, mainly southern/eastern China. Original archive, all source fields, repeated SYS_ID rows and polygon coordinates are retained. Coordinates are losslessly encoded for delivery and displayed without datum conversion (source MapInfo declares Pulkovo 1942). Annual boundaries and rule codes remain source statements, with no inferred month/day precision. Five obvious romanization mismatches use display aliases derived from NAME_CH; NAME_PY remains in source records and downloads (会稽 pronunciation also checked against https://zdic.net/hans/会稽).

## ResearchArea historical divisions (3.56)

Zheng & Wu (2026), Scientific Data, https://doi.org/10.1038/s41597-026-07086-6. Data v2: https://doi.org/10.6084/m9.figshare.30518417.v2, CC BY 4.0. This release displays only the 2 CE and 742 CE ResearchArea snapshots (420 research units), preserving merged prefectures, source names and every polygon vertex. The original eight ResearchArea components from official Figshare file 59320670 are preserved byte-for-byte in ResearchArea-originals.zip; the ZIP container was rebuilt.

Coordinates are inverse-projected from Krasovsky_1940_Albers onto its original ellipsoid without datum shift or rounding. Some frontier areas and water surfaces are outside the research area. Names follow the research layer, including labels that require further year-specific name review. Source and RECORDS describe population evidence, not boundary citations. SimulatedCountyBoundaries is excluded. 1102 and 1820 remain available in the original files but are not displayed by this release.

## AWMC Roman snapshots and name review (3.57)

For expanded name review and new scholarly reference plates, see the 3.58 note below.

Ancient World Mapping Center, University of North Carolina at Chapel Hill, [geodata](https://github.com/AWMC/geodata), pinned revision `7ecf8bccea2efe1e1e9df2daf6001942de73fb87`, ODbL 1.0. Original CE117/CE200 extent polygons and CE200 province lines are preserved in `public/data/awmc/`, including source README, license and hashes. Each extent groups 112 fragments into one MultiPolygon without coordinate edits. The 81 province lines remain unnamed linework. Only the two publisher-labelled years are displayed, focused on western Asia; this is not full regional polity coverage.

Thirty display names in the 2 CE / 742 CE ResearchArea snapshots have now been checked: 12 Han entries against [Book of Han, juan 28](https://zh.wikisource.org/zh-hans/漢書/卷028) and 18 Tang period names against [Old Book of Tang, juan 40](https://zh.wikisource.org/zh-hans/舊唐書/卷40). Exact record keys, evidence and original source labels are retained in `public/data/china-prefectures/name-audit.json`. This checks names, not source geometry; the remaining 390 records and merged units still need review. Left Pingyi retains the source romanization, consistent with the historical reading of 冯 in 冯翊.

## South Asian scholarly plates and expanded Han name review (3.58)

Joseph E. Schwartzberg (ed.), *A Historical Atlas of South Asia*, 1992 edition, hosted by the [University of Chicago Digital South Asia Library](https://dsal.uchicago.edu/reference/schwartzberg/). Three source-linked plate records describe III.B.4 (p.18), III.D.1 (p.25), and XIV.1 (p.145). Original map images are not bundled or mirrored; the interface opens the institution's high-resolution reader. The plate's printed Gupta/Vakataka period is c.300–550 CE, while the catalog label says 300–500. XIV.1 compares maxima at different dates. These are research references, not newly digitized annual borders. Source terms remain with the publisher.

Fifty further Han display names are cross-checked against Book of Han, juan 28, bringing reviewed ResearchArea names to 80/420 (62 Han, 18 Tang). Exact source identities and short evidence extracts are recorded in the name audit. Remaining 340 entries and merged units still require review. Source romanization and geometry are retained.
