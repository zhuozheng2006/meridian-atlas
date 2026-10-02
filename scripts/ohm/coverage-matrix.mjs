// Coverage matrix for the frozen OHM extract: how much of the window each year really covers, and
// which Cliopatria polities of that year have a dated OHM record behind them.
//   node scripts/ohm/coverage-matrix.mjs [--out /tmp/ohm-1500/coverage-matrix.json] [--markdown docs/...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OHM_YEARS,OHM_BOUNDS} from '../../public/regional-boundaries.js';
import {preparePiercing,covers,pointOnLand,landMask} from './coverage.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2),value=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
const dataDir=path.resolve(value('data',path.join(root,'public/data/ohm-1500')));
const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));
const land=JSON.parse(fs.readFileSync(path.join(root,'public/data/land.geojson'),'utf8'));
const catalog=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public/data/fast/catalog.json.gz'))));
const window=[OHM_BOUNDS[0],OHM_BOUNDS[1],OHM_BOUNDS[2],OHM_BOUNDS[3]];
const mask=landMask(land,window);
const inWindow=center=>center&&center[0]>=window[0]&&center[0]<=window[2]&&center[1]>=window[1]&&center[1]<=window[3];
const normal=name=>String(name||'').toLowerCase().replaceAll(/[^a-z0-9 ]/g,' ').replaceAll(/\b(duchy|duche|county|comte|kingdom|principality|republic|free|imperial|city|of|the|state|electorate|margraviate|landgraviate|archduchy|prince|bishopric|abbey|house)\b/g,' ').replaceAll(/\s+/g,' ').trim();
const rows=[];

for(const year of OHM_YEARS){
 const meta=manifest.years[year];
 const payload=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dataDir,meta.file))).toString());
 const prepared=preparePiercing(payload.features);
 const names=new Set();for(const feature of payload.features)names.add(normal(feature.properties.name_en||feature.properties.name));
 const active=catalog.records.filter(record=>record.type==='POLITY'&&record.start<=year&&year<=record.end&&inWindow(record.center));
 const matched=[],coveredCenters=[],unmatched=[];
 for(const record of active){
  const byName=names.has(normal(record.name));
  const point=record.center;
  const onLand=pointOnLand(mask,point);
  const byGeometry=onLand&&covers(prepared,point);
  const entry={id:record.id,name:record.name,start:record.start,end:record.end,areaKm2:Math.round(record.area||0),center:[Number(point[0].toFixed(3)),Number(point[1].toFixed(3))],nameMatch:byName,centerCovered:byGeometry};
  if(byGeometry)coveredCenters.push(entry);
  if(byName)matched.push(entry);else unmatched.push(entry);
 }
 const coverage=payload.metadata.coverage;
 rows.push({year,records:meta.features,undrawable:meta.undrawable,points:meta.points,areaKm2:meta.areaKm2,gzipBytes:meta.gzipBytes,
  levels:meta.levels,coverage:{ratio:Number(coverage.ratio.toFixed(4)),covered:coverage.covered,land:coverage.landSamples,verdict:coverage.verdict},
  gaps:payload.metadata.gaps.filter(gap=>!gap.overlap).map(gap=>gap.en),
  cliopatria:{active:active.length,areaKm2:Math.round(active.reduce((sum,record)=>sum+(record.area||0),0)),centerCovered:coveredCenters.length,nameMatched:matched.length,unmatched:unmatched.map(entry=>entry.name)},
  top:payload.features.slice().sort((a,b)=>b.properties.area-a.properties.area).slice(0,5).map(feature=>feature.properties.name_en||feature.properties.name)});
}

const report={checkedAt:new Date().toISOString(),snapshot:manifest.source.timestamp,generated:manifest.generated,window:OHM_BOUNDS,rows};
if(value('out',null))fs.writeFileSync(value('out'),JSON.stringify(report,null,2)+'\n');

const markdown=value('markdown',null);
if(markdown){
 const quote=String.fromCharCode(96);
 const lines=['# 固化 OHM 快照的年度覆盖矩阵','',
  '生成脚本：'+quote+'node scripts/ohm/coverage-matrix.mjs --markdown docs/verification-3.11/ohm-frozen-coverage.md'+quote+'（可复现）','',
  '数据快照：OpenHistoricalMap '+manifest.source.timestamp+'；窗口 bbox '+OHM_BOUNDS.join('/')+'（西/南/东/北）；级别 2–4。','',
  '“陆地采样覆盖”＝在窗口内 24×24 网格上取落在 '+quote+'public/data/land.geojson'+quote+' 陆地上的点，再用该年固化多边形（扣洞）做点面判定得到的比值；判定阈值：≥45% good，≥12% partial，否则 sparse（记录数 <8 一律 sparse）。','',
  '“Cliopatria 当年窗口内政体”＝catalog 中该年活动、中心点落在窗口内的 POLITY 记录；“中心点被覆盖”指该中心点落在当年的某个固化多边形内；“名称匹配”为去掉爵衔与通用词后的名称比对，仅作参考。','',
  '| 年份 | 固化记录 | 级别 2/3/4 | 顶点 | 陆地采样覆盖 | 判定 | 未绘制(源残缺) | Cliopatria 窗口内政体 | 中心点被覆盖 | 名称匹配 | 未匹配政体 | 来源未收录(探针) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
 for(const row of rows){
  lines.push('| '+[row.year,row.records,row.levels['2']+'/'+row.levels['3']+'/'+row.levels['4'],row.points,(row.coverage.ratio*100).toFixed(1)+'%',row.coverage.verdict,row.undrawable,row.cliopatria.active,row.cliopatria.centerCovered,row.cliopatria.nameMatched,(row.cliopatria.unmatched.join('、')||'—'),(row.gaps.join('、')||'—')].join(' | ')+' |');
 }
 lines.push('','## 每年最大的几条记录','');
 for(const row of rows)lines.push('- **'+row.year+'**：'+row.top.join('、'));
 const good=rows.filter(row=>row.coverage.verdict==='good').map(row=>row.year),partial=rows.filter(row=>row.coverage.verdict==='partial').map(row=>row.year),sparse=rows.filter(row=>row.coverage.verdict==='sparse').map(row=>row.year);
 lines.push('','## 结论：哪些年份适合切换详图','',
  '- **good**（'+(good.join('、')||'无')+'）：自动模式可以在覆盖足够时切换详图。',
  '- **partial**（'+(partial.join('、')||'无')+'）：只有用户明确选择“地区详图”才展示；自动模式保留全球概览并提示“局部详图 · 空白处未收录”。',
  '- **sparse**（'+(sparse.join('、')||'无')+'）：自动模式一律保留概览，档案目录写明“该年固化详图偏少”。','',
  '## 已知边界','',
  '1. 只覆盖上述窗口与行政 2–4 级；窗口外、级别外仍依赖在线瓦片。',
  '2. 只覆盖这 10 个年份；verify 脚本断言“某年没有记录的 relation 不会在别的年份出现”，不做邻近年份顶替。',
  '3. “中心点被覆盖”是保守指标：Cliopatria 的中心点可能落在同年的帝国圈或王国大面内，而非其自身多边形内；名称匹配也无法处理古今异名（例如 Duchy of Bavaria 与 Herzogthum Baiern）。',
  '4. 记录数少不等于覆盖差：1000/1200 年只有 21/34 条，但都是帝国级大面，陆地采样覆盖反而最高。','',
  '## 原始数据（JSON）','',
  quote+quote+quote+'json',JSON.stringify(rows.map(row=>({year:row.year,coverage:row.coverage,cliopatria:row.cliopatria})),null,1),quote+quote+quote,'');
 fs.mkdirSync(path.dirname(markdown),{recursive:true});
 fs.writeFileSync(markdown,lines.join('\n'));
}
console.log(JSON.stringify(rows.map(row=>({year:row.year,records:row.records,ratio:row.coverage.ratio,verdict:row.coverage.verdict,cliopatriaActive:row.cliopatria.active,centerCovered:row.cliopatria.centerCovered,nameMatched:row.cliopatria.nameMatched,unmatched:row.cliopatria.unmatched})),null,1));
