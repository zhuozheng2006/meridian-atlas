// Coverage matrix for the frozen OHM windows: how much of each window every year really covers,
// and which Cliopatria polities of that year have a dated OHM record behind them.
//   node scripts/ohm/coverage-matrix.mjs [--out /tmp/ohm-coverage.json] [--markdown docs/...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OHM_WINDOWS} from '../../public/regional-boundaries.js';
import {preparePiercing,covers,pointOnLand,landMask} from './coverage.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2);
const value=(name,fallback)=>{
 const inline=args.find(argument=>argument.startsWith('--'+name+'='));
 if(inline)return inline.slice(name.length+3);
 const index=args.indexOf('--'+name);
 return index<0?fallback:args[index+1];
};
const land=JSON.parse(fs.readFileSync(path.join(root,'public/data/land.geojson'),'utf8'));
const catalog=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public/data/fast/catalog.json.gz'))));
const inWindow=(window_,center)=>center&&center[0]>=window_.bounds[0]&&center[0]<=window_.bounds[2]&&center[1]>=window_.bounds[1]&&center[1]<=window_.bounds[3];
const normal=name=>String(name||'').toLowerCase().replaceAll(/[^a-z0-9 ]/g,' ').replaceAll(/\b(duchy|duche|county|comte|kingdom|principality|republic|free|imperial|city|of|the|state|electorate|margraviate|landgraviate|archduchy|prince|bishopric|abbey|house|empire|dynasty)\b/g,' ').replaceAll(/\s+/g,' ').trim();
const windows=[];

for(const declared of OHM_WINDOWS){
 const dataDir=path.resolve(root,'public',declared.root);
 const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));
 const mask=landMask(land,declared.bounds);
 const rows=[];
 for(const year of declared.years){
  const meta=manifest.years[year];
  const payload=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dataDir,meta.file))).toString());
  const prepared=preparePiercing(payload.features);
  const names=new Set();for(const feature of payload.features)names.add(normal(feature.properties.name_en||feature.properties.name));
  const active=catalog.records.filter(record=>record.type==='POLITY'&&record.start<=year&&year<=record.end&&inWindow(declared,record.center));
  let coveredCenters=0,matched=0;const unmatched=[];
  for(const record of active){
   const byName=names.has(normal(record.name));
   const onLand=pointOnLand(mask,record.center);
   const byGeometry=onLand&&covers(prepared,record.center);
   if(byGeometry)coveredCenters++;
   if(byName)matched++;else unmatched.push(record.name);
  }
  const coverage=payload.metadata.coverage;
  rows.push({year,records:meta.features,undrawable:meta.undrawable,points:meta.points,gzipBytes:meta.gzipBytes,levels:meta.levels,
   coverage:{ratio:Number(coverage.ratio.toFixed(4)),covered:coverage.covered,land:coverage.landSamples,verdict:coverage.verdict},
   gaps:payload.metadata.gaps.filter(gap=>!gap.overlap).map(gap=>gap.en),
   cliopatria:{active:active.length,centerCovered:coveredCenters,nameMatched:matched,unmatched:unmatched.slice(0,10)},
   top:payload.features.slice().sort((a,b)=>b.properties.area-a.properties.area).slice(0,4).map(feature=>feature.properties.name_en||feature.properties.name)});
 }
 windows.push({id:declared.id,zh:declared.zh,en:declared.en,bounds:declared.bounds,snapshot:manifest.source.timestamp,rows,
  totalGzipBytes:rows.reduce((sum,row)=>sum+row.gzipBytes,0),
  over8MB:rows.filter(row=>row.gzipBytes>8*1048576).map(row=>row.year)});
}

const report={checkedAt:new Date().toISOString(),method:'Land-sample coverage comes from each year file (24x24 grid over the window, holes excluded). Cliopatria comparison uses catalog POLITY records active that year whose centre falls inside the window; "centre covered" tests that centre against the year polygons; name matching only strips titles and common words.',windows};
if(value('out',null))fs.writeFileSync(value('out'),JSON.stringify(report,null,2)+'\n');

const markdown=value('markdown',null);
if(markdown){
 const quote=String.fromCharCode(96);
 const lines=['# 固化 OHM 快照的覆盖矩阵（中欧 + 东亚）','',
  '生成时间 '+report.checkedAt+'；脚本 '+quote+'node scripts/ohm/coverage-matrix.mjs --markdown docs/verification-3.13/ohm-frozen-coverage.md'+quote+'（可复现）。','',
  report.method,''];
 for(const window_ of windows){
  lines.push('## 窗口 '+window_.en+'（'+window_.zh+'） bbox '+window_.bounds.join('/')+' · 快照 '+window_.snapshot,'',
   '| 年份 | 记录 | L2/L3/L4 | 顶点 | gz | 陆地采样覆盖 | 判定 | 未绘制 | Cliopatria 窗口内 | 中心点被覆盖 | 名称匹配 | 来源未收录(探针) |',
   '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for(const row of window_.rows)lines.push('| '+[row.year,row.records,row.levels['2']+'/'+row.levels['3']+'/'+row.levels['4'],row.points,(row.gzipBytes/1048576).toFixed(2)+' MB',(row.coverage.ratio*100).toFixed(1)+'%',row.coverage.verdict,row.undrawable,row.cliopatria.active,row.cliopatria.centerCovered,row.cliopatria.nameMatched,(row.gaps.join('、')||'—')].join(' | ')+' |');
  lines.push('','合计 '+(window_.totalGzipBytes/1048576).toFixed(1)+' MB；超过 8 MB 的年份：'+(window_.over8MB.join('、')||'无')+'。','',
   '每年最大的记录：');
  for(const row of window_.rows)lines.push('- '+row.year+'：'+row.top.join('、'));
  lines.push('');
 }
 const all=windows.flatMap(window_=>window_.rows.map(row=>({window:window_.id,...row})));
 const good=all.filter(row=>row.coverage.verdict==='good'),partial=all.filter(row=>row.coverage.verdict==='partial'),sparse=all.filter(row=>row.coverage.verdict==='sparse');
 lines.push('## 结论：哪些年份值得切详图','',
  '- **good**（自动模式可在覆盖足够时切换详图）：'+good.map(row=>row.window+' '+row.year).join('、'),
  '- **partial**（只有用户显式选择地区详图才展示，自动模式保留概览并提示空白）：'+partial.map(row=>row.window+' '+row.year).join('、'),
  '- **sparse**（自动模式一律保留概览，档案目录写明该年固化详图偏少）：'+sparse.map(row=>row.window+' '+row.year).join('、'),'',
  '## 已知边界','',
  '1. 两个窗口不重叠；窗口内是行政 2–4 级，窗口外的年份与级别仍依赖在线瓦片。',
  '2. 记录数少不等于覆盖差（东亚 1000–1300 只有 12–15 条，陆地采样仅 2–4%：源数据本身稀疏）。',
  '3. 东亚窗口 1930/1950 等年份单文件超过 8 MB：窗口内包含苏联、英属印度、美国（菲律宾）等巨型多边形，而几何不做裁剪也不简化。',
  '4. “中心点被覆盖”是保守指标：Cliopatria 的中心点可能落在同年的帝国级大面内，而非其自身多边形内。','');
 fs.mkdirSync(path.dirname(markdown),{recursive:true});
 fs.writeFileSync(markdown,lines.join('\n'));
}
console.log(JSON.stringify(windows.map(window_=>({id:window_.id,years:window_.rows.length,gzipMB:Number((window_.totalGzipBytes/1048576).toFixed(1)),over8MB:window_.over8MB,good:window_.rows.filter(r=>r.coverage.verdict==='good').length,partial:window_.rows.filter(r=>r.coverage.verdict==='partial').length,sparse:window_.rows.filter(r=>r.coverage.verdict==='sparse').length})),null,1));
