# 经纬纪 · Meridian Atlas｜3.37 当前检查点

整理日期：2026-10-06。`package.json` 当前版本为 `3.37.0`。

这是本轮工作的**检查点与续作入口**，不是停止任务的声明，也不代表用户要求的完整性、精度和产品品质已经全部达到。用户要求继续丰富世界史资料、改善边界与加载体验，并允许为个人学习研究使用可获取的非商业数据。

**本检查点已完成本地整站回归与浏览器验证；发布结果另存于发行记录。** 本文不会把这些检查称为世界史资料已经全面、权威或完美。

## 1. 真实项目、运行与收尾

当前实际项目：

```text
/Users/zane/meridian_atlas/world-history-atlas
```

本次协作中间材料：

```text
/Users/zane/Documents/Codex/2026-10-02/new-chat/work/
```

旧 `new-chat` 工作区中的同名网站副本不能代替实际项目。旧交接提到的版本、提交、服务端口只是当时状态，使用前检查。3.37 导入源基线记录为 `95b321b5ef25d99505c1018017bc59d83c453dc4`，不等于最终提交。

```sh
cd /Users/zane/meridian_atlas/world-history-atlas
python3 serve.py --port 8767 --open
```

`serve.py` 默认端口其实是 8766；上面显式指定 8767，避免打开旧副本。已有服务占用时先核对它服务的目录，不要盲目重启。

协作修改全部完成后，由收尾者顺序执行：

```sh
npm run prepare:assets
npm test
npm run build
```

- `prepare:assets` 重建 enrichment 压缩档案、统一全部脚本样式的 `?v=`，会修改很多文件；并行编辑时不要抢跑。
- `npm test` 是 `package.json` 中的全量校验链，应保留真正退出码。不能用管道尾部命令成功来替代测试成功。
- `npm run build` 会重建 `dist/client` 与 `dist/server/index.js`，并生成湖泊与大型静态数据存储清单；**构建成功不等于已发布**。
- `.json.gz` 使用确定性压缩。若同名 `.json` 存在，两者必须语义一致；清单的 bytes 与 SHA-256 必须随资源更新。
- 本会话的真实浏览器验证使用 `cua_repl`。旧 CDP／Playwright 驱动仍在仓库，仅保留为历史材料；不要把它们在本会话重新作为 UI 操作入口。

### 最终收尾栏（主 agent 填写）

| 项目 | 当前记录 |
|---|---|
| 源码冻结／最后修正 | 已冻结：独立启动、筛选 URL、数值显示与跨页竞态保护完成；见第 7 节 |
| 最终 `prepare:assets` | 已完成，版本戳 `3.37.0-153ba418f166` |
| 最终 `npm test` | 2026-10-06：全链退出码 0；日志 `docs/verification-3.37/final-test.log` |
| 最终 `npm run build` | 发布工作流由本提交构建；最终构建结果见发行记录 |
| 真实浏览器最终回归 | 已通过本轮记录的场景；见 `verification-3.37/browser-checks.json` |
| 提交／发布 URL／线上版本 | 构建时待发布到既有私人网站；完成后的 commit / deployment / status 见下述发行记录 |

发行记录位置：`/Users/zane/Documents/Codex/2026-10-02/new-chat/outputs/meridian-3.37/release.json`。既有私人网站：<https://meridian-world-history.zhuozheng2006.chatgpt.site>。

## 2. 本轮做成了什么

| 方向 | 本轮结果 | 必须保留的解释 |
|---|---|---|
| 历史疆域运输 | 258 个按年代分组的原始坐标包、轻量静态查找表、逐文件恢复 | 只改变传输与缓存，不改变原始边界或年代 |
| 物理地理 | 648 个 10° 空间包，按视野读取陆地、海罩、真实海岸、河流和湖泊 | 同源陆地求补；裁剪边不能画成海岸 |
| OHM | 冻结快照请求按代次、年份及窗口校验；坏缓存可恢复 | 旧请求完成不能清空新年份已显示的内容 |
| 社会与制度资料 | 完整保留 Seshat 指定 canonical 工作表的 47,477 行，373 个 PolID，135 个变量 | 编码行包含研究元数据，**不是 47,477 个独立考证过的历史事实** |
| 中文资料阅读 | 135 个变量中文标签；308 个阶段中文显示名，含 1 个部分翻译；65 个原名回退 | 译名是显示层，不是 QID／疆域身份绑定 |
| 政体叙述 | 892 → 900，新增 8 篇、修正 3 篇 | 其余 **889 篇旧叙述未全面重新考订** |
| 叙述装配 | 保留逐节／逐事实来源、叙述范围与访问日期；错误引文写入前失败 | 校验通过不等于事实本身已完成学术复核 |

完整历史基线仍见 [HANDOFF-3.36.md](HANDOFF-3.36.md)。本轮没有借叙述和编码行扩容去宣称所有城市、战争、文明、科技、贸易或地区历史已覆盖。

## 3. 历史疆域：从大量小请求改为精确年代包

主要文件：

- `public/native-geometry.js`、`public/native-temporal-index.js`、`public/map-engine.js`
- `public/data/native/temporal/`、原 native 索引与独立几何文件
- `scripts/build-temporal-native.py`、`scripts/validate-native-bundles.mjs`
- 证据：[verification-3.37/README.md](verification-3.37/README.md)、`native-bundle-build.json`、`native-request-regressions.json`

258 包覆盖目录中的连续时期，合计 64,539,958 B，最大单包 404,098 B。每个包保存其闭区间内曾有效的记录并集，显示时仍按**所选年**筛选原记录；没有插值、补画疆域或把整个包误当成某一年的政体集合。

生成的静态查找表为 10,385 B，普通年份首次取图不必先读完整 native 索引 121,025 B。1450 年使用一个 164,769 B 原始坐标包，避免先下数 MB 的概览再经过多轮小文件请求。

运行时契约：

1. 首帧入口 `loadNativeFrame` 优先 bootstrap／可用年代包。真实失败后允许旧概览回退；首帧不因包失败而等待所有独立小文件补齐。
2. 后续详情入口保留独立文件恢复，失败的可选包不污染永久缓存，之后允许重试。
3. 对整包坐标、记录引用、所请求成员与年份区间进行校验，再加入 native 缓存。不能只检查首个图形或当前可见子集。
4. 取消／过期请求不能提交帧；两个地图可共享正在进行的包请求。
5. 已验证包写入 native 缓存后，释放通用 JSON 缓存中的整包引用，避免同时长期持有整包与几何引用。该改动有缓存保留回归，尚无可用的浏览器堆内存降幅测量。
6. 已删除固定 1.2 秒后抢跑概览的竞争。健康但慢的 native 传输可以完成；连接／停滞超时和真实错误仍触发恢复。

独立磁盘校验逐一对照 34,494 份记录副本、33,426 份几何副本与 11,007 份原始几何，并验证运行时查找表等于来源索引。构建报告中的 45,494 是跨变更区间的有效记录检查次数，**不是不同政体数量**。请求回归报告记录 22 项场景，包括 59 组简化 ID 碰撞的正确别名处理。

阶段性浏览器抽查：本地冷启动 1450、受控 4 Mbps 时，164,769 B 包的资源开始／结束为 3,495.7／5,487.7 ms，未发生大索引或旧概览请求。这仅是该导航中单个资源的时间戳；不能宣称整页在 1,992 ms 内可用，也不能与旧环境数字拼成整体加速百分比。

## 4. 物理地理：按视野分片且不制造海岸接缝

主要文件：

- `public/physical-grid.js`、`public/geography.js`
- `public/data/physical-spatial/index.json.gz` 与 `cells/`
- `scripts/cartography/build-physical-spatial.py`
- `scripts/cartography/decode-published-physical.mjs`
- `scripts/cartography/audit-physical-spatial.py`
- `scripts/validate-physical-grid.mjs`、`scripts/validate-geography.mjs`
- 说明：[physical-spatial.md](verification-3.37/physical-spatial.md)

旧放大链要读取 5,327,275 B 全球物理文件。新链在 zoom ≥ 4 时读取视野及四边 20% 缓冲；较低缩放保留完整概览，原全球资源仍在。

以下为 1400×900 视野的**磁盘资源冷字节**，包含首次索引；不是浏览器耗时：

| 视野 | zoom 4 | zoom 6 | zoom 9 |
|---|---:|---:|---:|
| 欧洲（8.2°E，46.9°N） | 2,171,402 B | 655,468 B | 96,385 B |
| 东亚（116.4°E，35.1°N） | 1,552,354 B | 587,447 B | 83,961 B |

648 格共 11,501,874 B，最大单格 240,769 B。空间包总存储比紧凑全球文件更大；收益是区域浏览实际传输更少，不要混淆这两个口径。

输入是已发布、按 1e-5 度量化的 Natural Earth 坐标；本轮不再次取整或简化。不能继续沿用旧文档“每个缩放都小于一个像素”的量化误差说法。

每格 `land ∩ cell` 与 `cell − land` 使用同一陆地并集。真实海岸来自**原陆地边线作为线裁剪**，不是裁后多边形闭合轮廓；世界截断边也剔除。河流、湖泊保留来源属性、源要素编号、片段及孔洞。

同一视野的五类几何进入一个 `physical-grid` GeoJSON source，以过滤器分图层，只调用一次 `setData`；source 就绪后整组显现，避免陆地／海罩两个异步 source 错帧。跨出覆盖、错误或换视野时先恢复完整概览；细海岸激活时隐藏旧海岸，不能叠出双线。

`Geography.landLayer` 与 `Geography.coastWaterLayer` 必须继续供区域覆盖和点击判定读取。失败清缓存、重试、销毁、快速平移、海岸对齐、远程现代参考与 HALC 历史地貌顺序都已有独立回归。`Geography.init()` 不等待本地物理层就启动 DEM／参考／湖泊；不要重新串行化。

独立几何审计读取实际 JS 解码结果，检查 648 包、17,241 闭环、1,454 非空河流、1,355 湖泊与 233 湖中孔；每格土地／水域无面积缺口或重叠，全球重组差集约 2.0e-13 平方度。12,028 分类点（含日期线两侧 28 点）一致；每格海岸等于原海岸裁线。故意使用裁后多边形轮廓的负例不能通过检查。源中一条 Loire 要素本来为空，没有补造。

阶段性检查：格网运行时 16 项、地理行为 31 项通过。主 agent 的浏览器欧洲 zoom 6 抽查中，6 格、178 要素、细分片 active，旧全局精细文件请求为 0，未观察到接缝。该局部抽查不替代最终多视野／设备测试。

## 5. OHM 请求顺序

文件：`public/historical-detail.js`、`scripts/validate-ohm-requests.mjs`。

冻结快照异步读取现在同时核对请求代次与年份／窗口身份。旧年份的迟到完成或失败不能清掉新年份已经准备好的视图；结构无效的缓存快照会清除，允许恢复。保留冻结来源原始年代和窗口，不以当前街道填补历史空档。

后续动此链时，至少覆盖：A 年慢请求 → B 年先完成 → A 年迟到；同年跨窗口；失效快照后重试；关闭图层／销毁后晚回调。源数据仍只有有限年份和窗口，不能把并发修复写成覆盖扩展。

## 6. 社会与制度资料：完整 canonical 工作表接入

入口：资料页 → 社会与制度资料。分期深链示例：

```text
#view=research&lang=bi&seshat=CnMing%2A
#view=research&lang=bi&seshat=%40all
```

源仓库为 `seshatdb/Equinox_Data`，工作簿 `Equinox_on_GitHub_June9_2022.xlsx` 的 `Equinox2020_CanonDat` 表；没有把插补、聚合工作表混入原观测。详见 [seshat/INTEGRATION.txt](verification-3.37/seshat/INTEGRATION.txt)。

| 口径 | 数量／含义 |
|---|---|
| 原编码行 | 47,477；含编码助理等元数据，不是独立历史事实总数 |
| 唯一 PolID | 373；与地图政体／QID 分离 |
| 政体元数据行 | 444；一个 PolID 可有重复抽样区、时期记录 |
| 不同变量 | 135；原优先变量仍是 26，不因栏目扩展悄悄增加 |
| 有 `Date.From` 或 `Date.To` | 1,446 行 |
| 未单列观测日期 | 46,031 行；只展示来源分期上下文，不自动套用当前地图年份 |
| 首次索引 | 31,947 gzip B |
| 单分期 | 1,124–3,239 gzip B；373 片共 949,966 B |
| 跨分期搜索 | 选择后才读取 555,186 gzip B |

135 个变量都有简体显示／搜索标签；原英文变量名、值、行号与字段保持原样。present、absent、inferred、unknown、suspected unknown、uncertain、disputed、range、list、缺字段均应区别显示。`Duration` 要按 Section/Subsection 区分编码日期与仪式小时数；单位只附在有效数值上。

来源 canonical 行重组前后 SHA-256 相同：

```text
b89f11c0648ad7bfa186926b5071a34f8e8a7ca5172f778c4005eb0f04963bdf
```

原工作簿、代码本、README 和 LICENSE 均随数据提供，按需下载。原 README 写 CC BY-NC-SA（未写版本），LICENSE 文件为 CC0 1.0；两者冲突如实保留，不擅自把数据重新标为 CC0。用户个人研究用途允许本轮采用非商业来源，来源与变换记录仍需保留。

工作簿没有每条编码的完整论证与参考书目。目前提供工作簿行号和代码本，不能编造逐条学术引文。NGA／World Region 是研究抽样上下文，不是国界、首都坐标或现代国家的确定归属。

### 显示译名

`public/research-polity-names.js` 有 308／373 个中文显示映射：307 完整、1 部分；东亚 40／40 有中文显示，其余 65 保留来源英文。搜索“明朝”“明代”和原英文、PolID、抽样区均可用。

映射只按**精确 ID＋原英文名**应用；特别歧义还校验源日期，发生变化就回退原文。没有新增 QID 绑定，没有改原始导出。两个易错例：

- `CnTangL` 原名 Later Tang Dynasty，源时期 763–907，显示“唐朝后期”，不能错译成五代后唐。
- `CnLrJin` 原名 Later Jin，源时期 1127–1234，显示“金朝（1127—1234）”，不能译成后晋或后金。
- `CnHChin` 1896–1941 的 Early Chinese 含义暂不擅断，中文显示保留该英文部分。

映射候选、复现脚本、逐条待译表：工作区 `work/seshat-phase-names-337/`。绳文六期术语核对使用日本世界遗产官方网站的英／日对应页；阶段日期仍用 Seshat 原值。

主要文件：`research-view.js`、`research-reader.js`、`research-definitions.js`、`research-vocabulary.js`、`research-polity-names.js`、`research-reader.css`、`public/data/seshat/`、`scripts/build-seshat-research.py`。

最终 reader 回归 33／33、路由回归 13／13、启动加载器 11／11、译名 9／9；数值显示样例及精度检查通过。从已随包 XLSX 独立重建的数据与生产数据逐字节相同。

## 7. 研究页独立启动、链接状态与数值显示

`#view=research` 已独立于 MapLibre、WebGL、疆域目录和事件文件启动。真实浏览器冷开明朝页仅取研究索引 31,947 B 和该阶段 3,056 B；地图脚本未下载，页面没有地图 canvas。这不是整个页面的总字节数。第一次转地图才创建 renderer/地图，正常地图入口仍并行预载；失败可重试，未就绪的地图控件暂不可用。

`research-view.js` 保存并校验研究阅读快照；链接字段为 `seshat`（源 PolID / @all）、`srDomain`、`srVariable`、`srQ`、`srFind`、`srPage`（零基页码，默认值省略）。刷新、返回来源页再进、语言切换均保留阅读状态。切走后的旧资料/地点异步响应不能把页面切回去；地图启动使用共享 promise。已建立双地图后，在研究页切换语言，返回时两图也更新语言。研究正文具有 main landmark；键盘跳转链接随视图切换，聚焦正文时保留完整分享地址。

`research-format.js` 只格式化显示：用字符串运算无损展开科学记数法、去无意义小数尾零、三位分组；年份不分组。大整数不经过 Number；异常文本、代码、过长指数/输出保留原文。原字段、上下端值、日期和 JSON 导出不变。

真实浏览器还检查了桌面布局、390px 手机无横向溢出、第二页刷新恢复、按变量筛选、下载原始行。左地图获得焦点后按右方向键，仅从 1492 前进至 1502；右图保持 1900，两图的中心、缩放、方向角均未改变。结果见 `verification-3.37/browser-checks.json` 和对应网络/键盘/HALC 报告。

源码版本戳：`3.37.0-153ba418f166`。最终全量测试和发布记录见第 1 节。

## 8. 政体叙述：新增 8 篇、修正 3 篇、保留来源范围

本轮新增：蒙古国、大韩帝国、彬牙王国、北山、朝鲜半岛辰国（Korean Jin）、前李朝、古朝鲜、曹魏。`Korean Jin` 与中国金朝不是一个对象，须保留已核对的 QID 和 sourceNames。

修正：夏威夷王国、丹吉尔国际区、贝宁共和国。重点包括：

- 叙述范围与疆域来源年份分开；不能把朝代后续事件套成仍处同一政体的经济／文化事实。
- 夏威夷去除王国之后菲律宾劳工的时代错置；区分 1875 年互惠条约签署与 1876 年实施，并用有来源的 Māhele 地方案例。
- 丹吉尔区分公约日期、制度成立与最终安排，替换缺乏来源的经济概括。
- 贝宁共和国不再拿尼日利亚贝宁王国文化遗产充数，改为达荷美／阿波美材料；磷矿说法改为有日期的世界银行经济说明。

900 = 新增 8 + 本轮修正 3 + 其余原有 889。**889 篇没有在本轮全面重审；整个 900 篇库不能被称为全部新核验的权威历史叙述。**

证据：`narratives-integration.json`、`narratives-evidence-and-bindings.json`、`narratives-fact-evidence.json`、`narrative-correction-evidence.json`、`narrative-corrections-final.json`。逐节／逐事实来源及各自访问日期已保留；不能把所有 checkedOn 自动改为本次装配日期。

### 后续叙述流水线规则

沿用十环链，并按实际批次打印每步结果：

```text
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

新增 `scripts/places/narrative-metadata.mjs` 统一来源和范围契约：

- 显式 `sourceIds` 必须非空、无重复且全部存在；未知／空／重复引用在写入前失败，绝不静默替换为全部来源。
- 旧数据未显式提供 `sourceIds` 时可以保持旧的全来源行为，不能据此宣称它已经具备逐段精确引文。
- 叙述 `scope` 和双语 `scope.note` 原样保留；不要用边界的起止年替换作者审核过的叙述范围。
- 识别当前 extract 的 `zhIdentityMatch`，但已有 `zhAccepted:false` 人工拒绝优先，不能自动翻转为通过。
- 访问日期按实际来源记录保留，装配日不是访问日。
- 用源名／QID／原文共同核对身份，不以模糊字符串匹配强行绑定；薄素材宁可保留缺口，也不要堆泛化套话。

此轮 metadata／装配 fixture 有 26 项通过。起笔前仍应先定位最薄弱栏目；事实材料只有 2–3 项时优先写清结构和机制，不靠空泛文字凑长度。质量闸门常量保持单一来源。

## 9. 续作优先级与真实缺口

1. 完成第 7 节和最终回归，再处理内容；不要在同时改启动、数据和样式时给旧测试盖最终章。
2. 对 889 篇未重审叙述分批做**来源—事实—日期—栏目**核验，优先人物／政体混淆、同名政体、王朝前后错置、殖民与现代继承关系、无根据的文化经济概括。3.36 的 `PAUSE-HANDOFF.md` 和 `authoring/part-05.json` 可以继续作为候选材料，执行前先扣除本轮新增并重新验证身份；不要照抄旧剩余数量。
3. 扩展 Seshat 编码理由与逐条参考书目；审查不同版本数据和编码变更。当前工作簿不是完整的各政体研究文本，也不能单凭一行 present/absent 就支撑历史解释。
4. 处理 65 个未译阶段名与少量含糊阶段，保持英文回退。新增显示翻译要核对精确 ID、来源名称与年代，不能顺手变成地图实体关联。
5. 世界各地区的资料覆盖仍不均衡。先用可复现查询提高候选上限，再说“资料不存在／池已用尽”。现代国家不能代替古代社会，文明／族群不能直接冒充国家。
6. 用户截图中 1500 年中欧国界粗折线仍主要受历史边界源的顶点与制图方式限制。物理底图分片更快、更连续，**没有神奇恢复缺失的历史边界细节**。应继续寻找有明确年代、来源和覆盖的第二套历史边界，逐地区核对重叠和差异；不能用现代精细国界替代古代国界，也不能把视觉平滑当成史料精度。
7. 城市、人口、贸易路线、科技传播、区域专题仍是分别有来源、有时间口径的增量工作，不因本轮新增编码表就算完整。地形通常是现代参考，HALC 等独立有日期的历史地貌应继续单独说明。
8. 继续测实际弱网、冷缓存、移动端、快速年份／视野切换与错误恢复。资源字节减少、缓存单元测试通过、局部截图好看都不能单独代表产品已完美。

## 10. 接手先看与推荐验证入口

先读本文，再读 `docs/verification-3.37/README.md`、`physical-spatial.md`、`seshat/INTEGRATION.txt`，最后按要改的模块读对应 JSON 证据。历史规则和候选池上下文在 `HANDOFF-3.36.md`，其中过时版本／端口／范围需以当前仓库和用户最新要求为准。

局部改动可先运行相关校验，收尾仍执行全量链：

```sh
node scripts/validate-native-bundles.mjs
node scripts/validate-native.mjs
node scripts/validate-physical-grid.mjs
node scripts/validate-geography.mjs
node scripts/validate-ohm-requests.mjs
node scripts/validate-seshat-research.mjs
node scripts/validate-research-polity-names.mjs
node scripts/validate-narrative-metadata.mjs
node scripts/validate-map-runtime.mjs
```

纯数据复现写到临时目录，先比对再决定替换生产：

```sh
python3 scripts/build-temporal-native.py --root . --output /tmp/atlas-native-337 --target-kib 256
python3 scripts/build-seshat-research.py public/data/seshat/sources /tmp/seshat-rebuild
python scripts/cartography/build-physical-spatial.py --root . --output /tmp/atlas-physical-spatial
node scripts/cartography/decode-published-physical.mjs . /tmp/atlas-physical-decoded
python scripts/cartography/audit-physical-spatial.py --source /tmp/atlas-physical-decoded --cells /tmp/atlas-physical-spatial
```

最后两条 Python 几何命令需要 Shapely。此次可用环境为 `/Users/zane/Documents/Codex/2026-10-02/new-chat/work/boundaries/.venv/bin/python`；换机器后按项目 cartography 依赖准备，不修改系统 Python 或全局网络设置。

地图调试句柄仍是 `window.__meridian.instances`；研究页按需启动后，**不存在地图实例是正常状态**，测试不得假设 `[0]` 永远存在。

## 后续资料候选（尚未并入当前版本）

正常取得了官方固定版本 Polaris-2026 工作簿：626 政体、173 变量、57,631 条观察。它仍没有逐条编码论证或书目，部分阶段边界和变量映射与 Equinox 不同。下一批先做独立版本管线与语义核对，不覆盖当前原值。研究包位于 `/Users/zane/Documents/Codex/2026-10-02/new-chat/work/seshat-evidence-next/FINDINGS.md`，包含下载哈希、完整 schema、697 条目标样本及无法访问接口的边界。官方 API 仓库中的 LLM 实验 CSV 已明确排除为历史来源。

## 发布体积与存储拆分补充

首次3.37完整静态包为356.63MiB，超过Sites的256MiB上传限制，未创建成功的线上版本。随后扩展既有私人R2分发：OHM年份快照、CShapes年代包和Seshat编码手册共40个文件、128,360,681字节使用逐文件SHA键；完整原件仍在`public/`，本地运行方式不变。湖泊原revision与存储键保持不变。

`scripts/upload-static.mjs`只从隐藏交互输入读取官方Sites服务凭据，先验证所有本地文件，上传后逐一下载全部40项核对字节与SHA。并发上限2，避免大型几何包导入占满Worker内存。临时导入版本使用有限时间窗口，最终`npm run build`默认为0并关闭两组导入路由。最终发布必须以成功部署及完整存储回读记录为准；本段不表示云端导入已经完成。详见`DATA-STORAGE-v3.37.md`。

最终前端版本`3.37.0-153ba418f166`另做了一次4Mbps冷启动抽查，原始记录见`verification-3.37/browser-native-finalstamp-4mbps.json`。1450原始坐标包的资源开始/结束约为3500.6/6948.4ms，没有旧概览或完整native索引请求；同期地点、物理遮罩和地形仍争用带宽。此数值只是该资源的到达时序，不能称为首屏绘制耗时或线上性能；下一轮应继续改善关键疆域与可选图层的下载顺序。
