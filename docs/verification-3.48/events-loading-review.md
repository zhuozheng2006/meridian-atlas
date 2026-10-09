# 3.48 事件数据解耦候选

基线：`9a9ded84f1a89dde4544ecaf93fd8458180775f4`。未改主仓，未操作浏览器或 Sites。

地图启动现在只等待疆域目录和 MapLibre；事件同时独立加载。事件尚未就绪时，浏览与相关年表显示加载状态；失败提供独立重试。事件到达只填充侧栏、双图事件标记、时间密度和当前阅读器相关事件区域，不重新调用地图年份提交。

事件分享链接在后台等待期间保留在 URL；成功后按原年份恢复事件。用户已切年份、换详情/视图或关闭右图时，晚到事件不再接管导航。事件失败重试仍能恢复有效的原分享入口。地点阅读器仅替换相关事件区域；政体阅读器只有当前正在看事件栏目时才更新，该类原有 render 已保留阅读位置和焦点。

## 整合文件

只整合以下产品文件，不复制整个 `public/`。候选中的其他 public 项是指向主仓的只读测试依赖软链接。

- `public/app.js`
- `public/polity-reader.js`

新增验证：`scripts/validate-events-loading.mjs`。
既有取消验证需要补两处测试夹具变量/无关 UI 函数：`scripts/validate-boundary-app-races.mjs`，精确 diff 位于 `patches/validate-boundary-app-races.mjs.patch`。

`patches/app.js.patch` 和 `patches/polity-reader.js.patch` 相对于固定 3.47 基线；不要用完整文件覆盖已整合的名称资料改动。

## 与名称候选合并

`prepare.py` 使用逐个唯一锚点断言来应用事件改动，所有输入只读，输出到另外的候选目录：

```sh
python3 work/release-348/events-candidate/prepare.py \
  --input-root /absolute/path/to/names-or-merged-preview \
  --output-root /absolute/path/to/new-events-merged-preview
```

已以 `names-candidate/modified` 实演，生成 `names-compatibility/public/app.js` 与 `names-compatibility/public/polity-reader.js`。两个文件语法通过；名称修订的政体搜索分支与 relatedEvents 方法逐字保持。证据在 `verification/names-merge.json`。这证明文本整合相容；完整混合版运行时仍由根代理整合后复核。

输入不可已经带事件补丁，否则唯一锚点断言会拒绝。输出目录只放生成的修改文件，依赖资源由预览 overlay 提供。最终发布时沿项目现有流程统一资源戳。

## 验证

共 57/57：新增实际 app 异步行为与 UI 状态 15；既有边界对照取消 5、研究懒入口 18、渲染器装载 11、真实点图层初始化门限 8。新测试直接执行实际 app 函数、真实 sidebar 渲染和 PolityReader.events，替换的是资源 promise、地图与 DOM 边界，不是另写同一业务实现。新测试涵盖事件未完成/失败不挡地图，晚到不重复 setYear，独立重试/聚合等待，深链失败重试与用户操作覆盖守卫，左右图/关闭对照，相关事件局部更新，搜索工具等待实际数据，以及加载中/失败不显示虚假零条。

测试命令：

```sh
node scripts/validate-events-loading.mjs
node scripts/validate-boundary-app-races.mjs
node scripts/validate-research-entry.mjs
node scripts/validate-map-runtime.mjs
node scripts/validate-point-layer-gate.mjs
```

所有这些都是功能/机制检查，不是浏览器速度结论。本候选等待根代理真实 4 Mbit/s / 80 ms / cold cache 同版本交替 A/B 决定是否发表。埋点应观察 `ensureCatalogData` 与 `ensureEventsData`，不要继续把旧 `ensureCoreData` 当地图 gate；后者仍给依赖完整资料的页面聚合等待。

真实浏览器还应检查：事件延迟/失败时地图可交互；重试按钮；分享 event 链接在等待与失败间保持；等待中切年/打开另一资料不被覆盖；左右地图事件；语言/搜索；政体事件 tab 与地点记录 tab 的晚到填充；资料页等待与 research 直达懒加载。

## 实际边界

政体/专题/年表/资料页面仍沿原 ensureCoreData 聚合路径，需要其依赖的数据再渲染。本批只解除地图 gate，不扩展所有资料页的分阶段构建。Atlas 模型工具的 eventCount 在未就绪时为 null，并提供 eventsStatus；事件搜索工具等待实际数据，而不返回虚假的空结果。

未采用后台整幅疆域 Worker/dataURL 候选；真实 Chrome 的有效版本测量显示首屏退步。其审计与反例保留于 independent-review，不混入这份发布候选。

## 独立复核

landscape_345 对当前两个产品文件、readJSON 成功/失败缓存路径做了只读审查，未发现阻碍发布的竞态。确认晚到事件按当前年份/语言更新且不触发 setYear；分享入口在 restoreInitialMapView 之前或之后完成均只恢复一次；详情、视图、左右年份和右图销毁均使旧入口失效。网络、解压、JSON 解析错误会删除 readJSON 缓存项，可以重新请求。

未纳入本批的一项边界：如果静态包本身是合法 JSON，但根值不是数组，应用的后置结构校验会失败；readJSON 已缓存成功解析值，因此单击重试仍会收到该坏值。当前真实发布包通过数据校验，此路径不构成已知发布故障；以后如需支持在线替换坏包，可给 readJSON 加明确缓存失效接口。本次独立复核没有运行浏览器，也没有修改产品文件。
