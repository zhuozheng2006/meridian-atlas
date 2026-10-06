# 3.39 最近查询分页与研究入口失败恢复

状态：**生产文件冻结，待主代理统一资产盖章和浏览器验证**。仅本地编辑，没有提交、上传或部署。真实项目 `/Users/zane/meridian_atlas/world-history-atlas`。

## 已完成

### 最近查询分页

`public/polaris-store.js:96` 起维护单一最近规范查询索引。键由领域、变量、去除首尾空白并按现有匹配规则小写化的查询组成，不含页码与每页条数；返回的 filters 仍保留调用者规范化后的原查询文字。

索引只保存命中行的 `Uint32Array` 位置、至多六个来源表的累计区间，以及总数/已扫描数。容量不超过 57,631 × 4 = **230,524 B**；来源行对象仍由原来的默认两表 LRU 管理。无原始记录副本、逐行字符串键或无限多查询缓存。

只有整个计划完成并通过所有取消、代次及生命周期检查，才把索引设为可用。下一页使用行位置定位，只读取实际包含该页记录的来源表；原表双 SHA-256、结构校验、源行顺序和冻结规则照旧。`collectSearch` 明确绕过分页复用并扫描完整来源，因此全量导出没有截断。

换查询、retry、直接重读 index / source sheet、clearCaches、dispose 和扫描/分页取消会使缓存失效。更新的检索会使旧检索失效，迟到结果不能覆盖新索引。零命中、空计划、超过命中数但处于允许范围的页数均保留完整查询语义。

### 研究入口失败恢复

接手时 `research-shell.js` 的独立 handoffFailed 页面及初步异常测试已落盘，已复核保留；本次补齐明确 failed 状态，以及独立 throw / rejected ready / 迟到错误测试。detach 后同步 startApplication 抛错或 ready 拒绝会显示 role=alert 和“重新打开页面”“返回研究资料”。两种操作均整页重新载入，不把已销毁的轻量 shell 重新挂到部分启动的 app 上。

失败重试保留完整 hash；返回研究仅调整 view 并写回准确研究状态。测试覆盖 year、camera、双图年份、boundary/boundaries、event、side、语言、版本、政体、筛选及页码。若 app 已进入更新的 route，旧 ready 拒绝不得覆盖该页面。

## 验证

- **分页专项 18/18**：`scripts/validate-polaris-pagination.mjs`。直接执行生产 `PolarisStore` 与 `readPolarisJSON`，输入为实际固定快照 gzip 字节，两种校验和、结构检查和完整源行均实跑。第二页只新增目标表 1 次请求；跨表页只新增相应 2 表；全量收集逐对象核对全部 **57,631 行**。覆盖规范查询复用、换查询、零命中、空计划、末页、retry、传输失败、扫描取消、分页取消、clearCaches、被较新查询取代、直接重读失效、dispose、损坏校验和及进度回调抛错。
- **入口 18/18**：`scripts/validate-research-entry.mjs`。执行实际 entry / shell / app 函数；两个接管异常分别独立验证，另覆盖迟到失败不能覆盖更新页面。
- **原 Store 27/27**：`scripts/validate-polaris-store.mjs`。
- **真实 Worker 集成 19/19**：`scripts/validate-polaris-worker.mjs`，含全量序列化原始行与类型、取消导出、错误分类连续请求。
- **Reader 集成 25/25**：`scripts/validate-polaris-reader.mjs`。
- 所拥有四文件 `git diff --check` 通过。全仓检查另发现 `public/app.js:531` EOF 新增空行；该文件不在本次所有权范围，交由主代理一并整理。

以上是程序和真实压缩数据的结果，不代表浏览器翻页耗时或手机性能已测。主代理仍需在统一 stamp 后测浏览器分页、冷研究页、地图接管及最终资源请求。

机器报告都在本目录：

- `polaris-pagination-verification.json`
- `research-entry-verification.json`
- `store-pagination-integration.json`
- `worker-pagination-integration.json`
- `reader-pagination-integration.json`

## 本次拥有的文件与冻结校验值（盖章前）

| 文件 | SHA-256 |
| --- | --- |
| public/polaris-store.js | 460a40a1040ca2e874e809a8f1fac5a17d2a7b0acceb755096cb430c61dac065 |
| public/research-shell.js | 5862af72db534536df385c169ee55879fd321446e9ddc9faac245ad04746fc6f |
| scripts/validate-polaris-pagination.mjs | 307c418eef6ecf4c0ef373269739ad93635a6390a513fd84b33f66482a9e1651 |
| scripts/validate-research-entry.mjs | 02d773d7a27882983392e8ea6b2c4e1011ee209c7947f77b7df973d59a88c65e |

主代理需把 `node scripts/validate-polaris-pagination.mjs` 与入口验证纳入 npm test；本代理未改 package 或 stamp。
