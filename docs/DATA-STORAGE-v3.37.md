# 3.37 大型资料分发

Sites 上传包限制为256MiB。首次3.37静态包为356.63MiB，在创建版本前被拒绝。项目继续使用同一私人网站及其既有R2存储，不改变访问范围。

## 本地与线上布局

- `public/` 保留所有文件，`python3 serve.py --port 8767` 的独立本地运行方式不变。
- 既有2,551个湖泊分片及`hydrolakes/9c6c5ea6ce8ae32936efbe41/`键完全保留。
- 新增分发清单包含40个文件、128,360,681字节：OHM年份快照、CShapes年代包和Seshat官方编码手册。索引、目录和来源说明仍为静态资源。
- 新文件采用`atlas-static/sha256/<文件完整SHA-256>`对象键，浏览器地址仍为原来的`/data/...`。同一内容可跨后续版本复用。
- `npm run build`生成`build/static-storage-manifest.json`，依据各数据来源清单核对字节与SHA后才从`dist/client/`排除这些原件；仅过滤构建输出中的`.DS_Store`。
- 清单revision为`2e585c28468d61e271eb4a63656c2d84eaa87b024478d6bd3015ec3ba6840b30`。首次拆分后的实测压缩包为246,688,959字节（235.261MiB），最终发布包精确尺寸记录在发行记录。

## 读取与恢复

Worker根据精确文件清单读取对象，核对存储长度与记录的SHA。缺失或元数据不符返回503，客户端原有恢复流程继续有效。gzip文件按原始压缩字节返回`application/octet-stream`，不添加`Content-Encoding`；PDF使用`application/pdf`。稳定URL用`private, no-cache`和SHA ETag重新验证，支持HEAD和条件读取。

## 首次导入流程

1. 仅针对已经确认属于用户、访问范围为owner-private的既有网站，构建不超过24小时的临时导入窗口：`node scripts/build-worker.mjs --import-until <UTC截止时间>`。
2. 使用正式Sites发布工作流发布该构建；源码提交与构建包必须一致。
3. 运行`scripts/upload-static.mjs`，通过隐藏的交互标准输入传入官方Sites服务凭据，禁止将凭据写入脚本、命令行参数、日志或文件。
4. 上传器先检查所有本地SHA，通过独立`/__atlas-static-import/`接口核对清单，再导入未匹配对象。最大并发为2；每个对象必须通过服务端长度和SHA核验。瞬态错误可重试，已经正确导入的对象可复用。
5. 导入后经原始应用URL逐项下载全部40个文件，核对完整字节与SHA，保存不含凭据的`build/static-storage-audit.json`。
6. 正常`npm run build`将`importUntil`恢复为0，重新发布最终只读构建；两组导入接口均应返回404。保留最终部署和存储回读证据。

临时接口仍受私人网站的认证边界保护；清单哈希不是认证凭据。接口只接受当前清单中的精确字节，跨Origin导入、过期窗口、未知路径、尺寸及哈希错误均被拒绝。湖泊原导入命名空间与清单不变。

## 已完成的本地验证

`node scripts/validate-worker.mjs`的16项检查通过，覆盖原湖泊契约、两组导入关闭、稳定URL、内容类型、HEAD/ETag、精确清单、尺寸/哈希、失败恢复及上传器重试和全部文件回读。前端资产戳仍为`3.37.0-153ba418f166`；此次只调整分发，不修改地图几何。

本文记录实现与操作契约，云端导入和最终发布结果以`outputs/meridian-3.37/release.json`及对应audit为准。
