# CShapes 2.1 beta — Correlates of War



## CShapes 2.1 beta — COW edition

Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch. 2022. “Mapping The International System, 1886–2017: The CShapes 2.0 Dataset.” Journal of Conflict Resolution 66(1): 144–161. https://doi.org/10.1177/00220027211013563

Original application code is MIT-licensed. Bundled datasets retain their individual source licenses. CShapes 2.1 beta (COW edition) in public/data/cshapes/ and its transformed data remain under CC BY-NC-SA 4.0, including noncommercial and share-alike requirements, and are outside the code’s MIT grant. For commercial use, obtain separate data permission or remove this dataset and its derivatives from distributed packages and deployed assets; disabling a visible layer does not remove bundled data. The CShapes manifest and ATTRIBUTIONS.md provide source links, full attribution, transformations and hashes.

Source: https://icr.ethz.ch/data/cshapes/CShapes-COW-2.1.geojson
License: https://creativecommons.org/licenses/by-nc-sa/4.0/

CShapes and its transformed data retain CC BY-NC-SA 4.0, including attribution, noncommercial use and share-alike terms. This data license is separate from the application code’s MIT license. Changes comprise deduplication, decade bundles, label anchors, Simplified Chinese display names and date-aware display aliases. Name periods and their evidence are documented in `name-periods.json`; original archive names remain intact.
Source geometry values, property values and civil dates are preserved. The manifest records source defects; they are not silently repaired. Source SHA256: `6aa7b88a5a8cbc5366c4200af8af3d7d9cd632800a1e62cd1dd2b7bfe8d65a88`.

应用原创代码采用MIT许可；随项目分发的数据按各自来源许可使用。public/data/cshapes/中的CShapes 2.1 beta（COW版）档案及其转换数据采用CC BY-NC-SA 4.0，包含非商业和相同方式共享要求，不纳入代码的MIT授权。若将项目用于商业用途，应另获该数据授权，或从分发包与部署资源中移除这一数据及其衍生成果；仅在界面关闭图层不会移除已分发的数据。来源、完整署名、转换步骤与文件哈希见CShapes清单及ATTRIBUTIONS.md。

Build: `python3 scripts/build-cshapes.py CShapes-COW-2.1.geojson editorial/cshapes-labels.json` from repository root, with Shapely installed. Validate the raw input against the manifest source hash. Geometry arrays are deduplicated without simplification or coordinate changes.
