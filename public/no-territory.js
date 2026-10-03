// Polities that the pinned boundary source does not contain.
//
// The module is deliberately free of DOM access and of any import from app.js, so
// scripts/validate-v2.mjs can render exactly the markup the polities view uses and assert that
// every enrichment profile is reachable: either through a catalogue record binding or through
// this clearly labelled no-territory section. A profile that is reachable through neither is a
// silent gap, which is what this contract exists to prevent.
export const NO_TERRITORY_ATTR='data-open-no-territory';
export const NO_TERRITORY_VIEW='no-territory';

// The catalogue-bound set and the profiles that have no record binding.
export function reachability(index){
 const bound=new Set(Object.values(index&&index.records||{}).map(binding=>binding.qid));
 const profiles=Object.keys(index&&index.profiles||{});
 return {bound,unbound:profiles.filter(qid=>!bound.has(qid)).sort()};
}

// The list the profile index declares as having no territory data.
export function declaredQids(index){
 return ((index&&index.coverage&&index.coverage.boundaryCoverage&&index.coverage.boundaryCoverage.noTerritoryQids)||[]).slice().sort();
}

export function renderedQids(html){
 const out=[];const pattern=new RegExp(NO_TERRITORY_ATTR+'="(Q[0-9]+)"','g');let match;
 while((match=pattern.exec(String(html||''))))out.push(match[1]);
 return out.sort();
}

export function countEntries(html){return renderedQids(html).length;}

// The section that is appended to the polities view. t(zh,en) is the app language helper and
// escape() is the app HTML escaper; both are injected so the module stays dependency-free.
export function section(index,{t,escape,lang}){
 const qids=declaredQids(index);
 if(!qids.length)return '';
 const phrase=(zh,en)=>lang==='en'?escape(en):escape(zh)+(lang==='bi'&&en!==zh?' <span class="secondary">'+escape(en)+'</span>':'');
 const cards=qids.map(qid=>{
  const entry=(index.profiles||{})[qid]||{};
  const zh=(entry.labels&&entry.labels.zh)||qid,en=(entry.labels&&entry.labels.en)||qid;
  const title=lang==='en'?en:escape(zh)+(lang==='bi'&&en!==zh?'<span class="secondary">'+escape(en)+'</span>':'');
  const heading=lang==='en'?escape(en):title;
  return '<button class="polity-card no-territory-card" '+NO_TERRITORY_ATTR+'="'+qid+'"><h3>'+heading+'</h3>'
   +'<div class="polity-years">'+t('本站疆域数据未收录','No mapped territory')+'</div>'
   +'<div class="polity-count">'+t('打开说明，地图不绘制其疆域','Open the note; no boundary is drawn')+'</div></button>';
 }).join('');
 return '<section class="no-territory" aria-labelledby="noTerritoryHeading">'
  +'<h2 id="noTerritoryHeading" class="no-territory-title">'+t('本站疆域数据未收录的政体','Polities with no mapped territory')+'</h2>'
  +'<p class="section-caption">'+phrase('以下政体在钉住的边界数据集中没有对应记录，因此地图上不会显示它们的疆域；没有边界数据是事实，不代表这些政体在历史上不存在。','The pinned boundary dataset holds no record for these polities, so the map never draws their territory. Missing boundary data is a fact, not evidence that they did not exist.')+'</p>'
  +'<div class="polity-grid no-territory-grid">'+cards+'</div>'
  +'<p class="section-caption no-territory-count">'+qids.length+' '+t('个政体 · 只展示说明，不绘制疆域','polities · notes only, no geometry drawn')+'</p>'
  +'</section>';
}

// The dossier shown when a no-territory card is opened. It renders the profile note in both
// languages, states plainly that no boundary is drawn, and lists the coverage sources. It never
// produces geometry and never moves the map.
export function dossier(profile,{t,escape,lang}){
 const evidence=(profile&&profile.boundaryCoverageEvidence)||{};
 const zh=(profile&&profile.labels&&profile.labels.zh)||(profile&&profile.qid)||'',en=(profile&&profile.labels&&profile.labels.en)||(profile&&profile.qid)||'';
 const noteZh=(evidence.note&&evidence.note.zh)||'',noteEn=(evidence.note&&evidence.note.en)||'';
 const lead=lang==='en'?noteEn:noteZh;
 const secondary=lang==='bi'&&noteEn?'<p class="secondary">'+escape(noteEn)+'</p>':'';
 const sources=((evidence.sources)||[]).map(source=>'<li><a href="'+escape(source.url)+'" target="_blank" rel="noopener">'+escape(source.title||source.url)+'</a> <span class="source-meta"> · '+escape(source.publisher||'')+(source.checkedOn?' · '+escape(source.checkedOn):'')+'</span></li>').join('');
 const dataset=evidence.dataset||{};
 const phrase=(zh,en)=>lang==='en'?escape(en):escape(zh)+(lang==='bi'&&en!==zh?' <span class="secondary">'+escape(en)+'</span>':'');
 const heading=lang==='en'?escape(en):escape(zh)+(lang==='bi'&&en!==zh?'<span class="secondary">'+escape(en)+'</span>':'');
 return '<button class="detail-close" aria-label="'+t('关闭详情','Close details')+'">×</button>'
  +'<div class="reader-header"><span class="eyebrow">CIVILIZATIONS &amp; STATES</span><h2>'+heading+'</h2>'
  +'<div class="tags"><span class="tag">'+t('本站疆域数据未收录','No mapped territory')+'</span></div></div>'
  +'<div class="reader-content" id="noTerritoryBody">'
  +'<p class="reader-lead">'+escape(lead)+'</p>'+secondary
  +'<h3>'+t('对地图的含义','What this means on the map')+'</h3>'
  +'<p>'+phrase('本站地图不会显示该政体的疆域，也没有用相邻政体或其它年份的几何代替。','This atlas never draws a boundary for this polity and never substitutes a neighbouring or later geometry.')+'</p>'
  +'<h3>'+t('来源','Sources')+'</h3><ul class="no-territory-sources">'+sources+'</ul>'
  +'<p class="section-caption">'+t('核对数据集','Checked against')+'：Cliopatria '+escape(String(dataset.commit||'').slice(0,12))+' · '+escape(String(dataset.features||''))+' features · '+escape(evidence.checkedOn||'')+'</p>'
  +'</div>'
  +'<div class="reader-footer"><span>'+t('疆域覆盖状态','Boundary coverage')+' · '+escape(profile&&profile.boundaryCoverage||'not-in-source')+'</span>'
  +'<button id="noTerritoryClose">'+t('返回','Back')+'</button></div>';
}
