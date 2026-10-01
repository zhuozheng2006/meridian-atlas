# Sources and licenses / 来源与许可

- Historical territories: **Cliopatria / Seshat Global History Databank**, CC BY 4.0. https://github.com/Seshat-Global-History-Databank/cliopatria . Pinned commit: `ad28a691b7c07c1fca89d0e0636d324667d2a258`. Geometry is simplified with topology preservation at 0.02°; source names, intervals and areas are retained. Original source author and dataset attribution must be retained in downstream use.
- Dataset publication: Bennett et al., “Cliopatria — A geospatial database of world-wide political entities from 3400 BCE to 2024 CE”, Scientific Data 12, 247 (2025). https://doi.org/10.1038/s41597-025-04516-9 . The software's data-integrity checks are not an independent historical validation of that dataset.
- Supplementary labels: Wikidata, CC0. https://www.wikidata.org/wiki/Wikidata:Licensing . Labels are identity-checked against source Wikipedia article associations; additional exact-name Chinese editorial translations are identified in the catalog. Association agreement does not validate every historical identity.
- Physical basemap: Natural Earth, public domain. https://www.naturalearthdata.com/about/terms-of-use/ . Modern coastline overview; not an ancient shoreline reconstruction.
- Map engine: MapLibre GL JS 5.6.2, BSD-3-Clause. https://github.com/maplibre/maplibre-gl-js . See `dist/assets/maplibre-LICENSE.txt`.
- Original bilingual event summaries: CC BY 4.0, Meridian Atlas contributors, 2026. Each event retains links to its historical references; those underlying publications retain their own copyrights. No license to republish the linked original articles is implied.
- Interface and original code: MIT, see LICENSE.

## Design references / 交互参考

Chronosphere (globe and time navigation), Phersu Atlas (date-oriented history), Running Reality (spatiotemporal exploration), OpenHistory (event filters), HistoryMaps (guided stories), and Strata (layered exploration) informed interaction choices. Their proprietary datasets and code have not been copied or bundled. This project is independent and does not imply endorsement or affiliation.


## 2.0 新增资料与转换

- Wikidata实体、标签与结构化声明：CC0。每份实体档案保留QID、声明链接、参考资料、时间限定与抓取元数据。附引证仅描述记录具备引证，不等同于本项目逐句完成历史学审稿。
- 23篇文明概览及47条历史侧记：本项目原创中英文摘要，CC BY 4.0。每篇`sourceIds`对应博物馆、UNESCO等原始资料链接；原网页版权各自保留。
- [OpenCC Python Reimplemented](https://github.com/yichen0831/opencc-python)：Apache-2.0，用于构建时繁简转换（t2s），不随运行页面加载。人工补充译名沿用既有归属。
- Chronosphere与Phersu Atlas仅作为交互设计参考，未合并其专有数据。
