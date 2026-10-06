# 3.41 HALC 选择高亮：避免重解析整套可见瓦片

基线：`21c3e1c16261823ae089a319be96ee0d868103fd`，已阅读 `docs/HANDOFF-3.40.md`。本次未提交、未上传、未部署，未改版本、资源戳或package。生产改动仅 `public/halc-boundaries.js`；地区层原有操作只打开归属目录，并没有动态选择filter，所以未改 `halc-regions.js`。

## 实现

- HALC vector source 添加 `promoteId: {halc_localities: 'fid'}`。完整原始fid为各个MVT裁切片段提供共同、稳定身份。
- 保留原 `halc-selected` 图层ID、顺序、圆角、原色 `#a96926` 与线宽缩放节点。取消其动态fid过滤，建层时固定一条根据feature-state `halcSelected` 返回选中色/全透明色的表达式。
- 接管显隐仍沿用3.40的常量line-opacity，避免重新引入data-driven paint切换或layout变化导致的首次重解析。
- `openRecord`只对一个 `{source:'halc-boundaries', sourceLayer:'halc_localities', id:fid}` 设置 `halcSelected:true`。切换或清理仅删除旧目标的这个键，不擦除其他工具使用的feature state。
- `selectedId`、URL `halc:<id>`、restore队列、选择回调、popup与档案读取API保持。
- ID使用完整十进制串/安全整数，不截断或前缀匹配；拒绝浮点、布尔、对象、科学记数、十六进制、空白混入或越界等值。合法前导0十进制串仍映射到同一整数fid。
- 切年、切来源、隐藏边界、现代参照、离开范围或详细缩放、主来源错误、重建source、销毁都清理选择。视口仍符合资格时，平移与待补齐瓦片保留该ID状态和档案；新瓦片可按同一promoted ID继承选择。

无任何MVT/几何/日期/字段改动；没有新增依赖。

## 测试与结构性性能证据

新增 `scripts/validate-halc-selection.mjs` **22/22**：

- 真实HALC controller、捆绑MapLibre 5.6.2的真实Style状态API与paint表达式编译/求值；source-state缓存、DOM、worker/GPU由确定性接口替代。
- 相邻/前缀ID不高亮；1与11、14865与1/148/1486/14864互不混淆；未选中alpha0、选中alpha1。
- 切换只删除自有键，关闭原生popup同步清状态和外部选择token。
- 非法ID不清当前选择、不请求档案；快速切换后旧回包不复活旧高亮。
- 平移、离屏再返回、六种资格退出、主源错误、重建source、仅地区失败、restore等待render、销毁、两图隔离均覆盖。
- 正控制：真实捆绑Style中200次交替旧fid filter都触发source reload。
- 候选：200次实际controller openRecord切换**0次source reload、399次定向feature-state写入**。本机fixture中的两个计时包含不同工作，仅保留原始诊断值，不能相除当作浏览器加速比。

结果：`halc-selection.json` 与 `halc-selection.log`，报告有捆绑MapLibre SHA。

既有套件：lifecycle **29/29**、continuity **24/24**、regions **30/30**、cache **15/15**、render **18/18**、真实style reload **13/13**均退出0。continuity中旧“选中filter不变”断言替换为真正的选中feature state不变，避免undefined相等形成空验证。`git diff --check`通过。

总测试可加入：

```sh
HALC_SELECTION_REPORT=docs/verification-3.41/halc-selection.json node scripts/validate-halc-selection.mjs
```

## 浏览器验收与限制

选择层现在包含所有已载入地方单元的预建线bucket，只在GPU着色时让选中者有颜色。因此 `queryRenderedFeatures({layers:['halc-selected']})` 可以返回透明的非选中要素；不能再以该查询结果的总数当作选中数量。应核对controller.selectedId、地图getFeatureState和实际截图：

```js
map.getFeatureState({source:'halc-boundaries', sourceLayer:'halc_localities', id: selectedId}).halcSelected
```

应实测首次source-ready/边线frame（选中层预建全量bucket可能增加首载CPU/GPU与内存）、大视口点击高亮的后续render、同视口短时间切换两条地方记录、平移引入新瓦片、关闭档案、切年与双图独立。选择期间不应出现由filter引起的来源loaded下落/目录重扫。

这是用预建selection bucket换取稳定的单ID状态更新：它避免每次选择重解析整个source，但不是“零开销”。Node Style测试不能证明真实GPU状态更新、跨瓦片像素、首载成本或浏览器内存峰值；root仍需对最终stamp完成这些可行的浏览器检查。
