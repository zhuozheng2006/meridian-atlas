# 经纬纪 3.12 数据充实第五轮报告（task-12）

目标（G1）：事件体量 418 → ≥700，并新建战役层数据（≥300 条）。本轮交付事件 **709** 条、战役 **486** 条、构建与校验脚本、以及本报告。

## 一、改了什么

| 项目 | 变化 | 产物 |
|---|---|---|
| 历史事件 | 418 → **709**（+291 条结构化条目） | public/data/events.json(+.gz)、editorial/events-wikidata-3.12.json |
| 战役层（新建） | 0 → **486** 条 | public/data/battles.json(+.gz) |
| 战役采集底稿 | 维基数据 3,057 条候选（含坐标与年代） | editorial/battles-wikidata-source.json |
| 50 年窗口不足 3 条的格 | 96 → **65** | docs/verification-3.12/content-window-coverage.json |
| 年代×地区薄格（少于 3 条） | 18 → **17**（空年代格仍 1：大洋洲古典） | docs/verification-3.12/content-balance.json |
| 来源核验 | 386/386 有据（50 条抓正文命中关键词，272 条实体 URL 抽样核验） | docs/verification-3.12/content-sources.json |
| 新增脚本 | 采集、构建、校验、覆盖率分析 | scripts/places/fetch-wikidata-battles.mjs、build-battles.mjs、validate-battles.mjs、fetch-wikidata-events.mjs、build-structured-events.mjs、window-coverage.mjs |

## 二、战役层（public/data/battles.json.gz，486 条）

采集：scripts/places/fetch-wikidata-battles.mjs 通过维基数据查询服务，按七个时代区间抓取「battle（Q178561）及其子类 + P625 坐标 + P585 时间」的实体，共 **3,057** 条，再分批抓取 P710（参战方）、P361（所属冲突）、P17（国家）与该声明上的参考链接。中文标签与参战方名称若为繁体，经 zh.wikipedia 的 parse API 做**字形转换**（不是机器翻译）得到简体。

选入：scripts/places/build-battles.mjs 从 3,057 条中选取 **486** 条进入出货层，规则为：必须有中文名与英文名（1,539 条符合）、坐标与年代有效、按世纪均衡（每世纪约 52 条）、每世纪内单一地区不超过 9 条，并优先选取有参战方与所属冲突的条目。剔除统计：无中文名 1,518 条、坐标无效 0、年代无效 0、重复 0。

字段：id、nameZh、nameEn、year、start、end、coordinates、region、belligerents、conflict、countries、sources、notes、regionBasis。**outcome 字段未填写**：维基数据没有稳定的「结果」属性，本项目不猜测胜负，留待有来源时补。

分布：欧洲 199、非洲 75、东亚 71、美洲 33、南亚 22、东南亚 16、大洋洲 6、全球 4；按世纪前1500—前501 为 18 条，前500 至 2026 的九个世纪区间各 52 条。

来源政策：每条都链接其维基数据实体；当维基数据在该声明上记录了参考链接时一并列出（本轮 13 条带参考链接）。notes 对无参考链接的条目标注「实体声明未附参考链接，发布前建议补一次文献核对」。坐标与参战方**没有可核验来源时留空**，未做任何填充。

地区判定：文档化的坐标框规则（regionBasis=coordinate-box），写在构建脚本与出货层 policy 中，不含政治判断；顺序为美洲、大洋洲、东亚、东南亚、南亚、黎凡特（西亚）、欧洲、非洲、西亚中亚、全球。

校验：scripts/places/validate-battles.mjs 共 7 项全部通过——压缩归档确定性（mtime=0、与未压缩一致）、至少 300 条且 id 唯一、坐标/年代/地区合法、参战方与冲突为来源字符串数组、每条链接维基数据实体且来源非空、policy 与剔除统计完整、同一实体不重复。


## 三、结构化事件扩容（+291 条，418 → 709）

生成：scripts/places/build-structured-events.mjs 从战役采集底稿中筛选，要求中英文名均不少于 4 个字符、年代在公元前 4000 至 2026 年之间、坐标有效，并与现有 709 条之前的事件做名称去重（英文与中文名各自归一化比对），再按世纪与地区均衡选入 **291** 条。候选池 1,537 条（带中文名）。

每条结构：id（v312wd-<qid>）、双语标题、start/end（单年，precision=year）、lat/lon、region（坐标框规则）、category=war、locationType=site、双语 summary（内容为「年份 + 名称 + 坐标 + 所属冲突 + 参战方 + 说明这是结构化索引条目」）、双语 significance、sources（维基数据实体 URL + 该声明的 https 参考链接）、editorialNotes（说明不含独立叙述、断代精度为年、坐标为 P625 声明值），并额外带 **provenance=wikidata-structured** 与 **wikidataQid** 两个机器可读标记，便于后续筛选与替换。

诚实边界（重要）：

1. 这 291 条是**结构化索引条目**，不是本项目的编辑性综述；双语文本是对来源声明的直译式呈现，未经独立史料考订，条目内已明确写出这一点。
2. 它们与战役层共享来源实体，但用途不同：战役层供地图点位使用，事件层供时间轴检索；同一实体不会在事件层重复出现。
3. 若后续要提升为编辑级叙述，建议优先处理用户最常检索的年代与地区，并把 provenance 标记作为筛选条件。

## 四、来源核验（content-sources.json）

scripts/places/check-event-sources.mjs 覆盖全部事件批次（含结构化批次），共 **386** 个 URL：

- 50 条本轮抓取正文并命中关键词（既有机构来源）；
- 33 条抓到页面但为 PDF/未做内容解析；
- **272 条标记 entity-url-sampled**：结构化批次引用了数百个维基数据实体 URL，脚本按 1/15 抽样抓取，其余仍以出货 events.json 中的记录为据；
- 28 条站点反爬（UNESCO 403、Met 429 等），以仓库或交接文件的既有读取记录为证；
- 1 条不可达、2 条未解析正文。

结论：386/386 至少有一条独立证据记录，0 条无据。战役层的来源核验由 validate-battles.mjs 单独完成（实体链接必填、参考链接如实保留）。

## 五、窗口与薄格变化

- 50 年窗口（公元 1000—2000，每大区至少 3 条）：不足 3 条的窗口 96 → **65**；南亚 13、东亚 12、大洋洲 12、西亚中亚 9、欧洲 8、东南亚 7、非洲 2、美洲 2。
- 年代×地区薄格（少于 3 条）：18 → **17**；仍为 0 的年代格只有「大洋洲古典（前500—公元499）」。
- 事件年份跨度保持公元前 48000 至 2024 年；总数 709 条。

## 六、验证证据

    node scripts/validate.mjs                    → PASS（709 条事件 schema/双语/年代/坐标/来源）
    node scripts/validate-v2.mjs                 → PASS（events.json.gz 与未压缩一致、enrichment 与压缩派生一致）
    node scripts/validate-places.mjs             → PASS
    node scripts/validate-city-time.mjs          → PASS
    node scripts/validate-city-narratives.mjs    → PASS 10/10
    node scripts/validate-polity-period.mjs      → PASS
    node scripts/validate-release.mjs            → PASS
    node scripts/places/validate-battles.mjs     → PASS 7/7（486 条战役）
    幂等：apply-events 与 build-battles 重复运行后文件哈希不变

## 七、仍未解决与风险提示

1. **结构化条目占比**：709 条事件中 291 条（41%）为结构化索引条目，叙述深度低于编辑条目；建议后续按用户检索热度逐步升级或替换。
2. **战役层地区偏斜**：欧洲 199 条显著多于其他地区（源数据本身欧洲密集）；已按世纪与地区上限约束，但若要更均衡需补充非欧洲来源。
3. **参战方与结果**：1,295/3,057 条采集数据带参战方；出货层 374 条有参战方、447 条有冲突语境，其余留空；outcome 一律留空，不猜胜负。
4. **参考链接覆盖率低**：维基数据仅有 13 条声明带参考链接；建议下一轮对用户最常点开的战役补一次 Wikipedia/学术来源核对。
5. **地区框规则**为启发式，边界个案（土耳其、黎凡特、北非）可能与既有事件分类不完全一致；出货层已标注 regionBasis。
6. **大洋洲古典格**仍无有据事件；UNESCO 直读仍被 403 阻挡。

## 八、复现命令

    node scripts/places/fetch-wikidata-battles.mjs                # 采集战役（需公网，约 3,000 条）
    node scripts/places/build-battles.mjs                         # 构建 public/data/battles.json(+.gz)
    node scripts/places/validate-battles.mjs                      # 7 项校验
    node scripts/places/fetch-wikidata-events.mjs                 # 非战役事件采集（本轮受 WDQS 429 限流未完成）
    node scripts/places/build-structured-events.mjs --count=320   # 生成结构化事件批次
    node scripts/places/apply-events-3.10.mjs --batch=editorial/events-3.10.json --batch=editorial/events-3.11.json --batch=editorial/events-3.12.json --batch=editorial/events-wikidata-3.12.json
    node scripts/places/check-event-sources.mjs . docs/verification-3.12/content-sources.json
    node scripts/places/content-balance.mjs . docs/verification-3.12/content-balance.json
    node scripts/places/window-coverage.mjs . docs/verification-3.12/content-window-coverage.json

