# 3.40 HALC 渲染就绪与本地传输优化

已实施，未提交、未发布、未改版本与资源戳。

## 生产变化

- `public/halc-boundaries.js`：添加独立 `sourcedata → render` 门。必须先见到 content 或 loaded tile，且当前来源完整、相机停止、资格有效；render 后记录 viewport+sourceEpoch，才允许查询并接管。metadata-only、idle-only不能接管。旧完整帧在同年平移中保留为 updating；变化/离开资格、错误、销毁仍按原有语义处理。moveend/resize/标签元数据到达安排需要的render，避免全图idle依赖。
- `public/halc-regions.js`：地区线独立监听自身完成与render；它可在地方区划之后准备好，无需等待不相关DEM/地貌。仍不替代未完成的主区划、不在主源失败后显示。viewport+epoch去重；旧已提交地区线在视口补齐时按原连续性保留。
- `serve.py`：对未压缩 `.pbf` 支持HTTP gzip，MIME `application/vnd.mapbox-vector-tile`；保留原始资产及SHA清单。通过 `send_head` 实现GET/HEAD同表示头；协商尊重gzip q=0/显式拒绝，Vary存在于压缩和identity响应；已压缩.gz不重复编码，Range继续使用Python基础服务器行为（当前完整identity 200，未新增206支持）。模块可导入供真实HTTP测试，正常启动方法不变。

`renderedKey` 是这个来源已经过一次可查询render的门，不声称后续visibility提交已经绘到屏幕；root的浏览器性能记录仍应在接管commit之后再观察一帧和实际像素。原件、MVT坐标、年代、来源分类都未改。

## 测试

新增：
- `scripts/validate-halc-render-readiness.mjs` **18/18**：事件独立，不用自动idle掩盖；自己的content-ready、metadata-only、先render后source、地区独立完成、重复消息去重、不相关来源、移动、epoch替换、切年/模式/边界/zoom、保持旧帧、错误、destroy、两图独立。
- `scripts/validate-local-http.py` **13/13**：真实临时127.0.0.1 HTTPServer；PBF压缩解码与原件SHA完全一致、GET/HEAD、q=0、identity、Range既有行为、小MVT、已有gzip、HTML与文件修改缓存失效。服务器在finally关闭，无外部连接。

旧套件：HALC lifecycle **29/29**、continuity **24/24**、regions **30/30**、cache **15/15**、landscape **19/19**，全部退出0。旧返回资格/视口/resize测试补上实际应有的render步骤，不再仅发idle即当完成。`git diff --check`通过。

共享测试替身 `HalcFakeMap.sourceReady` 现在依次显式发 content sourcedata、render、idle；新增 `sourceReadyWithoutIdle` 和 `renderFrame`，新的就绪门测试仅用独立步骤。render事件销毁监听也已核对。

结果在本目录各 halc-*.json/log 与 local-http.json。新增命令建议纳入总测试：

```sh
node scripts/validate-halc-render-readiness.mjs
python3 scripts/validate-local-http.py
```

HTTP测试需允许监听临时本机端口。浏览器预览旧进程必须重启才读取新的serve.py。

## 已量化的边界

真实HTTP最大HALC地方z6瓦片：2,274,292 B → **1,157,115 B**，减少49.122%；解码SHA `73f95a1f85f9c94f4e187921e57cef60b70bb91acc77b78f2a08b2c9114b0a77` 等于原件。

审计中该地方瓦片加相应地区瓦片的理论gzip总节约49.54%，但HTTP套件只对地方最大瓦片实测；不可混成一项实际整视口统计。线上ASSETS是否已有压缩尚未验证，本改动不能用于声称线上提速。尚需root正常/限速浏览器视觉与实际等待验证。
