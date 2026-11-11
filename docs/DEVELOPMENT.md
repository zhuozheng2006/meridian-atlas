# 开发、数据与部署

## 运行与复现

本地使用 `python3 serve.py --port 8767`。`public/` 保留本地运行所需的已打包历史数据；浏览器通过HTTP读取压缩资料，不能用直接双击HTML代替本地服务器。

修改前端后执行 `npm run prepare:assets`，然后 `npm test`、`npm run test:http` 和 `npm run build`。数据重建依赖按 `scripts/boundaries/`、`scripts/places/`、`scripts/halc/`、`scripts/halc-hierarchy/`、`scripts/cartography/` 的 requirements 和说明安装；正常预览无需重跑采集流程。

`npm test` 会生成部分验证报告。历史报告应保留原样，将本次输出保存到对应版本目录，不把不同运行环境的计时混在一起。

## 数据保真

原始边界、名称、日期及资料包与显示校正分开。名称校正位于 `editorial/polity-display-names.json`，生成 `public/polity-display-names-data.js`，按原始记录五字段与年份核验。不要用现代国家边界补画历史空缺，不把来源验证等同于历史学正确性的证明。

原始数据、署名、变换说明和许可见根目录 ATTRIBUTIONS.md 及各数据目录。代码的 MIT 许可不覆盖第三方资料。

## 云端构建

`npm run build` 生成 Worker 和静态资源，并将清单中的大型对象从部署静态目录拆出，交由既有R2存储。完整本地数据仍在 `public/`；`dist/`、缓存、虚拟环境和临时发布包不提交。

现有 `.openai/hosting.json` 标识原有私人站点，不含认证凭据。它用于维护该站点；其他部署者应使用自己的项目和存储配置。首次部署需建立存储、按哈希导入清单对象，再关闭临时导入功能。正常构建保持 `importUntil=0`；操作机制见 DATA-STORAGE-v3.37.md，当前数量与revision见 HANDOFF-3.48.md。

GitHub仓库公开与网站共享范围独立。这次仅发布源码和研究成果，没有更改既有网站访问策略，也没有启用GitHub Pages。

## 本次归档

2026-11-11整理至GitHub，应用版本仍为3.48.0。保留开发历史、已打包资料、历次交接与验证记录；补充文档入口，并归档3.48未采用的后台几何实验。实验文件用于复核，未进入产品运行路径。历史性能数字是当时测量结果，本次文档整理没有重新进行性能试验。
