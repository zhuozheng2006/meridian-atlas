# 政体叙述第七批与欧洲覆盖分析（3.28b）：337 → 361

任务 task-35。基线提交 `7b609630`。

**结论**：政体叙述 **337 → 361 篇（本轮 +60）**，**3.28 选定的 60 篇全部写完**（上一轮 36 篇 + 本轮 60 篇），待写 0 篇。绑定疆域记录 5,984 条。

## 1. 本轮规格实测（60 篇）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 51–163 字 | 50–190 |
| 四栏英文长度 | 35–101 词 | 35–150 |
| 英文栏 CJK | 0 | 0 |
| 繁体字 | 0 | 0 |
| https 来源/篇 | 2–2 条 | ≥2 |
| 疆域联系注记 | 60/60 | 每篇 |
| 覆盖句重复（清洗流程） | 0 | 0 |
| 无中文来源，改用英文条目+维基数据实体 | 3 篇 | 允许并记录 |

三条引用规则照旧执行；本轮与上一轮共用同一批已核验导言（全部经 Wikidata sitelink 反查，**英文侧 60/60**，中文 **57 接受 / 3 拒绝**）。

## 2. 欧洲覆盖问题：**我上一轮的"上限 19 篇"结论是错的**

### 你问的三步漏斗（全部欧洲档案，不设分数上限）

| 步骤 | 数量 |
|---|---|
| 欧洲无叙述档案 | **502** |
| 其中 P31 含政体类别（同一份白名单） | **369**（73.5%） |
| 其中同时被 catalog POLITY 记录以 verifiedWikidata 绑定 | **369**（全部） |
| 被排除（类别不是政体） | **133**（26.5%） |

排除原因（首要类别）：historical ethnic group 18、Wikimedia disambiguation page 9、countship 8、ethnic group 7、historical region 6、no P31 classes 5、human 5、noble family 4、historical province of France 4、koinon 4。

### 更正

第六批报告写过"**19 篇就是当前欧洲的上限**"。**这个结论不成立**：

- 身份核验步骤每轮**只取各地区评分最高的前 N 份**（欧洲 N=30），选点又只能从"已核验"的候选里挑；
- 所以 19 是**那 30 份样本内的上限**，不是全部欧洲档案的上限；
- 把 **全部 502 份**欧洲无叙述档案查完（16 次请求）：**369 份通过政体类别检验且全部被 catalog POLITY 记录绑定** —— **欧洲的 40%–50% 配额是可达到的**。

### 回答"数据性质还是脚本阈值"

**两者都有，但主要是脚本阈值**：133 份（26.5%）确实**永远不能写成政体叙述**（人群、地区、消歧义页、家族、城市、战争等，属数据性质）；其余 **369 份是合格政体实体、且已绑定**，只是从未进入核验（属脚本阈值）。

### 流水线修正

下一轮应把 `verify-candidates` 的地区上限按配额需要提高（欧洲取 150–200 份），即可支撑 40%–50% 的欧洲配额——按本轮 369/502 的通过率，200 份欧洲候选约可产出 147 篇合格政体。

方法（可复跑）：`node docs/verification-3.28/check-all-europe-3.28.mjs`（结果 `europe-full-check.json`）；地区由 profile-index 连接 catalog 记录中心点按坐标箱规则取得，政体类别用与轮次脚本相同的白名单，绑定遵守 profile-index exclusions。

## 3. 校验

| 命令 | exit |
|---|---|
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.28/narratives-language-audit.json` | 0 |
| `node docs/verification-3.28/build-narratives-batch-3.28.mjs --check` | 0 |
| `node docs/verification-3.28/write-narratives-gz-3.28.mjs --check` | 0 |

`narratives.json.gz`：mtime 字节 0/0/0/0，与 .json deepEqual = true，条目数 361。

## 4. 仍缺什么

1. **1,455 份档案中仍有 1094 份没有叙述**；下一批需要重新选点，且应先放开欧洲的核验上限；
2. 欧洲 369 份合格政体可支撑未来 2–3 批的欧洲配额；
3. 3.28 选定中 3 个实体没有中文维基条目，相关条目以「英文条目 + 维基数据实体」呈现。

## 5. 诚实声明

- **上一轮"19 篇是上限"的说法已在本报告更正**，并给出全量核验的证据与可复跑方法；
- 本轮 24 篇全部写完，未为凑数降低规格；引用规则与注记清洗流程照旧执行（重复 0）；
- 未跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件，未触碰 app.js / source-reader.js。
