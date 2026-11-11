# 3.48后台几何实验归档

这些文件没有用于线上3.48产品。真实Chrome对照中，后台Worker减轻主线程长任务，但首次疆域呈现变慢，因此未采用。

保留候选源码、独立审查、实验说明及本次复制文件的SHA-256。候选原manifest记录当时阶段，后续实验可能改变其中部分文件；本归档的实际字节以snapshot.json为准。候选依赖主项目模块，不是独立运行包，不能直接覆盖产品。个别追加验证尚未执行，其状态按EXPERIMENT.md和原审查记录保留。

实际浏览器测量见 ../../verification-3.48/browser/ 中的 valid-*、clone-input-ab-summary.json 和 json-input-warmup.json。主产品的已发布名称修订和事件解耦不在此实验目录。
