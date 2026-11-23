// Five explicit editorial comparison links. No identity or observation merge.
const PAIRS = [{"equinox":{"id":"PeInca*","names":["Inca Empire"],"periods":[{"endRaw":"1531.0","samplingArea":"Cuzco","sourceRow":"440","startRaw":"1400.0"}],"recordCount":143},"polaris-2026":{"id":"pe_inca_emp","names":["Inca Empire"],"periods":[{"endRaw":"1532","sourceRow":"80","sourceSheet":"Polities","startRaw":"1375"}],"recordCount":145}},{"equinox":{"id":"ItRomER","names":["Roman Republic"],"periods":[{"endRaw":"-265.0","samplingArea":"Latium","sourceRow":"6","startRaw":"-509.0"}],"recordCount":146},"polaris-2026":{"id":"it_roman_rep_1","names":["Early Roman Republic"],"periods":[{"endRaw":"-264","sourceRow":"178","sourceSheet":"Polities","startRaw":"-509"}],"recordCount":146}},{"equinox":{"id":"ItRomMR","names":["Middle Roman Republic"],"periods":[{"endRaw":"-134.0","samplingArea":"Latium","sourceRow":"7","startRaw":"-264.0"}],"recordCount":133},"polaris-2026":{"id":"it_roman_rep_2","names":["Middle Roman Republic"],"periods":[{"endRaw":"-133","sourceRow":"179","sourceSheet":"Polities","startRaw":"-264"}],"recordCount":131}},{"equinox":{"id":"ItRomLR","names":["Late Roman Republic"],"periods":[{"endRaw":"-29.0","samplingArea":"Latium","sourceRow":"8","startRaw":"-133.0"}],"recordCount":132},"polaris-2026":{"id":"it_roman_rep_3","names":["Late Roman Republic"],"periods":[{"endRaw":"-31","sourceRow":"180","sourceSheet":"Polities","startRaw":"-133"}],"recordCount":132}},{"equinox":{"id":"CnMing*","names":["Ming Dynasty"],"periods":[{"endRaw":"1643.0","samplingArea":"Middle Yellow River Valley","sourceRow":"369","startRaw":"1368.0"}],"recordCount":153},"polaris-2026":{"id":"cn_ming_dyn","names":["Great Ming"],"periods":[{"endRaw":"1644","sourceRow":"249","sourceSheet":"Polities","startRaw":"1368"}],"recordCount":143}}];
export function phaseComparison(dataset,phase){
 if(!phase||!['equinox','polaris-2026'].includes(dataset))return null;
 const pair=PAIRS.find(p=>p[dataset].id===phase.id);if(!pair)return null;
 const expected=pair[dataset];
 if(JSON.stringify(phase.names)!==JSON.stringify(expected.names)||phase.recordCount!==expected.recordCount||JSON.stringify(phase.periods)!==JSON.stringify(expected.periods))return null;
 return structuredClone(pair);
}
export function mountPhaseComparison(doc,{dataset,phase,lang='bi',onVersionRequest}){
 const pair=phaseComparison(dataset,phase);if(!pair)return null;
 const t=(zh,en)=>lang==='en'?en:lang==='zh'?zh:zh+' · '+en;
 const el=(tag,content)=>{const n=doc.createElement(tag);if(content)n.textContent=content;return n;};
 const box=el('details');box.className='research-phase-compare';box.append(el('summary',t('相关阶段分期对读','Related phases across versions')));
 for(const key of ['equinox','polaris-2026']){
  const p=pair[key],title=key==='equinox'?'Equinox · 2022':'Polaris · 2026';
  const dates=p.periods.map(d=>[d.startRaw,d.endRaw].map(v=>String(v).replace(/\.0+$/,'')).join(' → ')).join('; ');
  box.append(el('p',title+' · '+dates+' · '+t(p.recordCount+'条记录',p.recordCount+' records')));
 }
 box.append(el('p',t('这里并列保留两个快照的研究分期与收录数量。','The two snapshots keep their own research periods and record counts.')));
 if(onVersionRequest){const other=dataset==='equinox'?'polaris-2026':'equinox',button=el('button',t('查阅另一版本的相关阶段','Read the related phase in the other version'));button.type='button';button.addEventListener('click',()=>onVersionRequest(other,pair[other].id));box.append(button);}
 return box;
}
