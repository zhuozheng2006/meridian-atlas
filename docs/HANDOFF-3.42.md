# 经纬纪 Meridian Atlas · 3.42 本地进展与接续

日期：2026-10-06。最终资源版本 **3.42.0-6de1d2485233**。本轮完整 `npm test` 和 `npm run build` 均退出0；新增独立来源先后顺序检查8/8、名称证据审计181/181通过。Chrome最终资源完成桌面1512宽和手机390×844的原典阅读，以及HALC放大、选择、关闭、切年核验。

本轮实际完成：HALC可见目录延迟展开几何，两份已保存网页原典的页内阅读器，以及14个经来源核对的阶段中文名称。项目继续迭代；完整全球历史覆盖、所有历史边界的高精度、全面超越竞品均未被证明。

## 路径、运行与发布

- 主项目：`/Users/zane/meridian_atlas/world-history-atlas`。
- 本地预览：`http://127.0.0.1:8767/`，本机服务会话72181，PID45233；接续时核验进程，不要因沙盒curl失败重启服务。
- 工作材料：`/Users/zane/Documents/Codex/2026-10-02/new-chat/work/release-342/`。
- 用户可见截图：同一任务目录 `outputs/meridian-3.42/`；副本与证据在 `docs/verification-3.42/`。
- 基线提交：`13ea4d8186e7eb22db40a2533073a2e3e047341a`。最终提交以本文件所在提交与实时Git状态为准。
- 运行：`python3 serve.py --port 8767`；更改前端后 `npm run prepare:assets`，再执行相关验证、`npm test`、`npm run build`。
- 本次完整测试日志：`verification-3.42/npm-test.log`；构建记录：`verification-3.42/build.log`。
- 构建记录：static revision `2e585c28468d61e271eb4a63656c2d84eaa87b024478d6bd3015ec3ba6840b30`，静态存储40文件/128,360,681 B；另一存储集合2,551文件/243,358,114 B。两者是生成器的不同集合，不能相加当作精确部署载荷。

**未 push、上传或部署。线上最后确认仍为Site version21，3.37—3.42均为本地更新。** 原私人站点：`https://meridian-world-history.zhuozheng2006.chatgpt.site`。

此前官方发布被自动审批拦截：私有代码、资料上传到外部站点及存储的确切目的地与载荷缺少所需确认。既有异步问题尚未收到人类答复，其内容是3.37及约128MB，不能推断为对所有后续版本的批准。继续本地工作；收到答复后核对确切范围再按Sites流程发布。用户允许获取个人研究数据，不等同于批准外部上传，也无需因此停止本地完善。

## HALC：延迟展开可见碎片的坐标

`public/halc-boundaries.js` 新增 `halcVisibleUnits(rendered)`。`settle()`继续使用真实 `queryRenderedFeatures` 得到当前可见数据，按fid分组和原顺序保留碎片。每个 `fragments[i]` 先是getter：第一次读取才调用MapLibre的geometry getter，之后缓存原对象。建立目录、索引、普通档案不读取所有经纬度几何。

这利用捆绑MapLibre5.6.2本身的延迟 `toGeoJSON` 行为。来源坐标、可见查询、fid、片段顺序、实际标注算法与选择高亮均保留。3.41的feature-state选择及共享几何桶仍生效。

### 测量与边界

同一本机浏览器、中心 `[4.8,51.3]`、zoom6.3的一组概览→详图观测：

| 步骤 | 3.41基线 | 3.42候选 |
|---|---:|---:|
| 首次HALC settle主线程时间 | 676.6 ms | 231.3 ms |
| 其中queryRenderedFeatures | 168.3 ms | 147.7 ms |
| 地方来源loaded时刻 | 5079.0 ms | 5278.1 ms |
| 随后第二个active render时刻 | 5970.6 ms | 5731.9 ms |
| 可见区划 | 13,464 | 13,464 |

候选的13,679片地方几何在该观测结束时全部仍未展开，12个地区标签已显示。浏览器调用包装会有额外开销，网络与缓存不是严格固定条件；**可报告该次settle约少445ms，不能说整个网站或网络快66%**。候选测量早于原典样式的最终资源戳，地图代码逻辑之后未变。原始结果、包装脚本在 `verification-3.42/browser/`。

最终资源的另一个Mercator视图是13,240区划/13,454未展开碎片/12标签，不与上表混作同一视角样本。zoom10.2阿姆斯特丹地区412区划，打开fid564 Nieuwer-Amstel后 `halcSelected=true`，关闭后清空；1501年退出HALC，1500年恢复。截图 `screenshots/halc-detail.png`。

### 验证和仍慢的路径

- `scripts/validate-halc-lazy-fragments.mjs`：9/9，使用真实捆绑Feature、真实MVT及生产控制器。验证零提前解码、精确对象、重复片段顺序、JSON几何逐字一致、标注位置、缓存及生命周期。
- `scripts/validate-halc-fallback-labels.mjs`：额外8/8，使用432个地方要素和2个地区面的真实瓦片，验证地区晚到、先到、失败、隐藏标签后开启等情况。投影、DOM、GPU边界是可控fixture，不能当浏览器性能结果。
- 当 `zoom<8 && regions.ready===false` 且启用标签时，回退算法仍为所有符合条件的地方候选计算anchor。本瓦片401个候选全部展开，最后显示Holland/Frisia两个标签，文字、坐标、顺序、宽度和点击分组与旧实现完全一致。其余31片保持延迟；全部序列化后仍与旧几何相同。
- 下一轮可以处理回退anchor计算的调度/缓存，以及真实queryRenderedFeatures、地区几何、绘制/上传的成本；不能偷偷删标签、改变可见目录、降低坐标精度来制造提速。

额外回归命令：

```sh
HALC_FALLBACK_REPORT=docs/verification-3.42/halc-fallback-labels.json node scripts/validate-halc-fallback-labels.mjs
```

## 页内原典阅读

新增 `public/research-original-reader.js`、小型登记模块 `research-original-text-data.js`，接入现有 `research-reading-guide.js`。数据位于 `public/data/research-evidence/reading-texts-3.42/`。

| 已保存网页史料 | 内容块 | 目录标题 | 对应导读 |
|---|---:|---:|---|
| Yale Avalon《十二铜表法》英译 | 139 | 14 | 罗马共和国早期法律 |
| Fordham伊本·白图泰游记选段 | 366 | 118 | 马里司法宫廷、盐块与交换 |

总计505块、132个目录标题、三张导读的8个真实章节入口。是两份网页保存内容，**并非1929年游记整本书**；正文保持来源英文，没有把它当作新增翻译或新观察。原典书架仍25导读/9阶段/10来源。

原件未改：

- Yale：`readings-3.39/sources/twelve-tables.html.txt`，25,029 B，SHA-256 `4a280cef6a403c2757c559fe7c4e417b13e3f7f276549917e8e2b593c87c0167`；来源 https://avalon.law.yale.edu/ancient/twelve_tables.asp 。1961是英译版本信息。
- Fordham：`readings-3.40/sources/ibn-battuta-fordham.html.txt`，225,583 B，SHA-256 `a334156f1d44d7f3ef51fd953ce90634cafe6306023327c791822e639d5c0fdf`；来源 https://sourcebooks.web.fordham.edu/source/1354-ibnbattuta.asp 。

生成器 `scripts/extract_offline_texts.py` 从固定原件抽取文本，移除网页导航/脚本/样式，统一HTML空白与实体，保留段落、括注、书目信息和来源说明。每块带原始UTF-8字节范围、片段SHA及文本SHA；保留原始标题标签、识别依据和级别。`--check`重新生成并逐字核对JSON和登记模块；已接入prepare与测试。

正文仅打开时请求，核对长度及SHA后使用纯文本DOM呈现；从不执行来源HTML。同一来源多个导读复用请求/缓存。失败可重试；关闭内层原文或外层导读、离开DOM均阻止迟到渲染和首次定位。默认定位相关章节只滚动正文，不抢键盘焦点；目录选择或章节按钮把焦点落到确切标题。来源下载与网页链接仍在卡片上方。

排版：纸面深墨色，桌面18px、手机17px，正文列宽44rem；手机展开时减小嵌套留白。真实检查修复了旧CSS造成的14px浅色文字覆盖以及错误减去外层offsetTop的跳转偏移。

### 验证

- 文本抽取与完整性14/14；阅读器行为13/13，均纳入完整 `npm test`。
- 最终资源冷开原典直达页：原文JSON请求0、地图JS请求0、canvas0；点开之后仅该来源JSON载入。
- 手机390×844：文档宽390、原文正文框294px、无横向溢出，17px深墨色。
- 桌面1512宽：18px；Taghaza、Walata和Table IX目录点击定位到正确块，标题在正文顶部约17px内边距，焦点与选项一致。
- 两份原文完整呈现139/366块；英文、简体中文和双语控件实际核验。证据见 `browser/reading-browser-qa.json` 与 `screenshots/original-*.png`。

可直接打开：
`http://127.0.0.1:8767/#view=research&lang=zh&srDataset=polaris-2026&seshat=ml_mali_emp&srDomain=all&srReading=mali-salt-money--ml_mali_emp`

**后续阅读体验**：外层研究页在导出、换语言等操作时重建卡片，仍会丢失页内原文的展开与滚动。当前标题呈现统一为H3；原始级别在数据里但尚未映射为完整无障碍层次。原文内部章节和滚动尚未写入分享链接。这些是后续改进，不应宣称本轮全部解决。

## 14个经核对的中文阶段名

`public/polaris-polity-names.js`增加14个严格绑定原源信息的元组。Polaris626阶段：完整中文369→383，来源英文回退257→243。仍保留英文原名、日期、编号、原行、地区、采样区、来源快照；日期冲突没有被显示译名悄悄修正。

名称：卡卡提亚王朝；朱罗·早期；潘迪亚·早期/王朝/帝国；帕拉瓦帝国后期；布干达I/II；诺克文化·中晚期（两个独立来源阶段）；伊费·古典时期；奥约；弗里敦；阿坎·前阿散蒂时期。

10份证据来源、7份实际来源表示，总533,633 B。含中国官方/UNESCO中文名称及学术论文；每个候选列出准确链接、短引文、locator、原身份及译名范围。一个南印度译名PDF确有原始字节和可读页图；其他部分是明确标注的网页/检索提取文本，不能写成全部原始网页或全文PDF已归档。奥约论文PDF直接下载403，保留可得的正式论文文字表示，未绕过。

- `scripts/validate-polaris-polity-names.mjs`：626全阶段核对、166次错误身份回退检查通过。
- `scripts/validate-phase-name-evidence-342.py`：181/181，逐文件bytes/SHA、逐引文和名称源绑定核对。需Python+pypdf，本轮使用Codex自带Python；未加入默认npm测试的额外Python依赖。
- 证据：`verification-3.42/phase-names/`；最终审计：`verification-3.42/phase-name-audit.json`。
- `verify-runtime-work-snapshot.mjs.txt` 是工作目录的历史测试快照，依赖当时临时文件，勿当作当前可运行命令。实际运行生产脚本。`indian-ocean-page-5-pdfium.png` 是成功的PDF页图，其他旧渲染尝试与日志不是成功证明。
- 优先区域的107个待译名中本轮完成14，剩余93仍保留候选/延期理由。不要从相似名称直接推断身份。

审计命令：

```sh
python3 scripts/validate-phase-name-evidence-342.py . docs/verification-3.42/phase-name-audit.json
```

浏览器双语选择潘迪亚王朝仍准确显示 `in_pandya_emp_2`、590–915、来源编号697；三个潘迪亚阶段与两个布干达阶段保持独立选项。

## 数据与下一轮优先事项

Polaris仍57,631观察/626阶段/173变量；Equinox独立47,477/373/135。本轮文本拆分和译名不增加原始观察数。有据遗址仍14处。多数阶段尚无阅读线索，17项编码细则仍待核。

1. 优化地区轮廓未就绪时的标签anchor，以及更高缩放的地方标签成本；用受控浏览器测量检验，而不是只报单个函数测试。
2. 保留原典阅读展开、章节和滚动，完善标题层次及可分享章节；从来源原件补充其他地区真实文本与精确关联，扩大目前9阶段的窄覆盖。
3. 继续核对西非、东非、南印度的译名及编码细则，避免将翻译当作事实校正。
4. 中欧1500年细边界仍缺：原全球数据巴伐利亚55顶点、瑞士68、洛林102的稀疏问题并未由此解决。现代高精度底图不能冒充历史国界证据。
5. 吴哥2021补充工作簿仍未取得；3.40保存正式下载403证据，不能生成假想坐标数据。
6. 不重复已经通过的检查，除非新变化、失败或具体未决风险需要。更改生产资源后重新prepare、相应回归、完整测试及构建；提供真实浏览器截图和准确的本地/线上状态。

用户要求持续本地完善，主动目标保持active。发布等待不构成本地任务blocked，也没有达到“完美”或完整研究覆盖。
