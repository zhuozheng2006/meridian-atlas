/** Independent contract tests; does not implement the classifier.
 * Contract: classifyStatement(statement, selectedYear, field?) returns a group
 * string, or {group}. Groups: selected, other, context, excluded.
 */
import assert from 'node:assert/strict';

const date=(year,extra={})=>({civilYear:year,precision:9,before:0,after:0,
 time:(year<0?'-':'+')+String(Math.abs(year)).padStart(4,'0')+'-00-00T00:00:00Z',
 calendarmodel:'http://www.wikidata.org/entity/Q1985786',...extra});
const dates=years=>(years||[]).map(y=>typeof y==='number'?date(y):y);
const statement=(options={})=>{
 const temporal={start:dates(options.start),end:dates(options.end),point:dates(options.point),earliest:dates(options.earliest),latest:dates(options.latest)};
 const scope=options.point?.length?'point':options.start?.length&&options.end?.length?'bounded':options.start?.length?'start_only':options.end?.length?'end_only':'unscoped';
 return {statementId:'Qfixture$temporal-evidence',property:'P36',rank:'normal',snakType:'value',
  value:{type:'wikibase-entityid',id:'Qfixture-capital',label:{zh:'某城',en:'A city'}},
  temporal,temporalScope:scope,displayGroup:scope==='unscoped'?'unscoped':'qualified',
  referencePresence:'cited_source',sourceUrl:'https://example.org/source-statement',references:[{links:['https://example.org/history']}],
  qualifiers:[],qualifiersRaw:{},...(options.override||{})};
};
const event=(property,year,extra={})=>statement({override:{property,value:{type:'time',time:date(year,extra)},displayGroup:'dated_entity_fact'}});
const uncertainQualifier={property:'P1480',snakType:'value',value:{type:'wikibase-entityid',id:'Q5727902',label:{en:'circa',zh:'约'}}};
const frozen=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(frozen);}return value;};
const cases=[];
const add=(name,s,year,expected,field='capital')=>cases.push({name,s,year,expected,field});

add('Bounded period includes its interior year',statement({start:[1490],end:[1510]}),1500,'selected');
add('Bounded period includes its first year',statement({start:[1490],end:[1510]}),1490,'selected');
add('Bounded period includes its last year',statement({start:[1490],end:[1510]}),1510,'selected');
add('Bounded period before selected year belongs to other periods',statement({start:[1490],end:[1510]}),1511,'other');
add('Bounded period after selected year belongs to other periods',statement({start:[1490],end:[1510]}),1489,'other');
add('Inverted source interval is not repaired',statement({start:[1510],end:[1490]}),1500,'context');
add('Swiss Bern source begins 1848, so it is not a capital fact for 1500',statement({start:[1848]}),1500,'other');
add('Start-only source does not prove continued tenure in 1900',statement({start:[1848]}),1900,'context');
add('Start-only source in its starting year remains incomplete tenure evidence',statement({start:[1848]}),1848,'context');
add('End-only source can exclude a later year',statement({end:[1255]}),1500,'other');
add('End-only source does not prove an earlier tenure',statement({end:[1255]}),1200,'context');
add('End-only source in its ending year remains incomplete tenure evidence',statement({end:[1255]}),1255,'context');
add('Point-dated statement belongs to that year',statement({point:[1500]}),1500,'selected');
add('Point-dated statement is not spread over later years',statement({point:[1500]}),1501,'other');
add('Point date plus period qualifiers is conservatively retained as mixed scope',statement({point:[1500],start:[1490],end:[1510]}),1500,'context');
add('A source period crossing BCE/CE includes 1 BCE',statement({start:[-2],end:[2]}),-1,'selected');
add('A source period crossing BCE/CE includes 1 CE',statement({start:[-2],end:[2]}),1,'selected');
add('The selected civil calendar has no year zero',statement({start:[-2],end:[2]}),0,'context');
add('A source endpoint at year zero is not silently interpreted',statement({start:[0],end:[2]}),1,'context');
add('A point in 1 BCE does not become a point in 1 CE',statement({point:[-1]}),1,'other');
add('Sub-year input is not an accepted selected calendar year',statement({point:[1500]}),1500.5,'context');
add('Missing selected year does not accidentally match',statement({point:[1500]}),undefined,'context');
add('Nonfinite selected year does not accidentally match',statement({start:[1490],end:[1510]}),Infinity,'context');
add('Decade precision is not expanded into confirmed year-level evidence',statement({start:[date(1490,{precision:8})],end:[1510]}),1500,'context');
add('Century-precision point does not confirm its nominal year',statement({point:[date(1500,{precision:7})]}),1500,'context');
add('Month-precision point belongs to its source year',statement({point:[date(1500,{precision:10,time:'+1500-06-00T00:00:00Z'})]}),1500,'selected');
add('Day-precision bounded record intersects a selected year',statement({start:[date(1500,{precision:11,time:'+1500-12-20T00:00:00Z'})],end:[date(1501,{precision:11,time:'+1501-01-10T00:00:00Z'})]}),1500,'selected');
add('Day-precision bound is not converted into a July 1 snapshot',statement({start:[date(1500,{precision:11,time:'+1500-12-20T00:00:00Z'})],end:[date(1501,{precision:11,time:'+1501-01-10T00:00:00Z'})]}),1501,'selected');
add('Uncertainty before a date prevents a confirmed-year claim',statement({point:[date(1500,{before:1})]}),1500,'context');
add('Uncertainty after a date prevents a confirmed-year claim',statement({point:[date(1500,{after:1})]}),1500,'context');
add('Uncertainty on an interval endpoint is preserved',statement({start:[date(1490,{before:1,after:1})],end:[1510]}),1500,'context');
add('Malformed uncertainty is not assumed to mean zero',statement({point:[date(1500,{before:-1})]}),1500,'context');
add('P1480 qualification prevents silent certainty promotion',statement({start:[1490],end:[1510],override:{qualifiers:[uncertainQualifier]}}),1500,'context');
add('P1480 without a translated label remains a qualification',statement({point:[1500],override:{qualifiers:[{...uncertainQualifier,value:{type:'wikibase-entityid',id:'Q5727902'}}]}}),1500,'context');
add('A raw retained P1480 is not lost if normalized qualifiers are absent',statement({point:[1500],override:{qualifiersRaw:{P1480:[{snaktype:'value',datavalue:{value:{id:'Q5727902'},type:'wikibase-entityid'}}]}}}),1500,'context');
add('Earliest possible date is not a confirmed start',statement({earliest:[1490],end:[1510]}),1500,'context');
add('Latest possible date is not a confirmed end',statement({start:[1490],latest:[1510]}),1500,'context');
add('Extra uncertainty bounds remain visible even beside a nominal full interval',statement({start:[1490],end:[1510],earliest:[1480],latest:[1520]}),1500,'context');
add('Two starts and ends must not be bridged using min/max',statement({start:[1400,1600],end:[1450,1650]}),1500,'context');
add('One start with several unpaired ends remains ambiguous',statement({start:[1490],end:[1510,1530]}),1500,'context');
add('Several point qualifiers preserve alternatives rather than infer a period',statement({point:[1490,1510]}),1500,'context');
add('Even a matching point among several qualifiers remains conservative',statement({point:[1500,1510]}),1500,'context');
add('Undated official languages remain entity background',statement(),1500,'context','officialLanguages');
add('Undated currency remains entity background',statement(),1500,'context','currencies');
add('Undated heads of government remain entity background',statement(),1500,'context','headsOfGovernment');
add('Undated succession is not projected into a selected historical year',statement(),1500,'context','successors');
add('A dated predecessor statement is still governed by its own date qualifiers',statement({point:[1499]}),1500,'other','predecessors');
add('Entity inception is a dated event only in that year',event('P571',1291),1291,'selected','inception');
add('Entity inception does not establish all later years as selected facts',event('P571',1291),1500,'other','inception');
add('Entity dissolution is a dated event only in that year',event('P576',1766),1766,'selected','dissolution');
add('Entity dissolution does not establish the preceding lifetime',event('P576',1766),1500,'other','dissolution');
add('Uncertain inception remains uncertain even in its nominal year',event('P571',1291,{after:1}),1291,'context','inception');
add('Low-precision dissolution is not a confirmed year event',event('P576',1766,{precision:8}),1766,'context','dissolution');
add('Unqualified non-event time values are not mistaken for inception',statement({override:{value:{type:'time',time:date(1500)}}}),1500,'context','government');
add('Unknown-value statement is not a concrete selected-year fact',statement({start:[1490],end:[1510],override:{snakType:'somevalue'}}),1500,'excluded');
add('No-value statement is not a concrete selected-year fact',statement({start:[1490],end:[1510],override:{snakType:'novalue'}}),1500,'excluded');
add('Deprecated statement stays outside emphasized facts',statement({start:[1490],end:[1510],override:{rank:'deprecated'}}),1500,'excluded');

export async function validateFactTime(classify){
 const results=[];
 for(const {name,s,year,expected,field} of cases){
  try{
   const input=frozen(structuredClone(s)),before=JSON.stringify(input),result=await classify(input,year,field),group=typeof result==='string'?result:result?.group;
   assert.equal(group,expected);assert.equal(JSON.stringify(input),before,'Original source statement was mutated');
   results.push({name,passed:true});
  }catch(error){results.push({name,passed:false,error:error.message});}
 }
 return {passed:results.filter(r=>r.passed).length,total:results.length,results};
}

const {classifyStatement}=await import('../public/fact-period.js');
add('Exact inception date remains an event',event('P571',700),700,'selected','inception');
const circa=event('P571',700);circa.qualifiers=[{...uncertainQualifier,property:'P5102'}];
add('P5102 circa qualifies the event value',circa,700,'context','inception');
const rawCirca=event('P571',700);rawCirca.qualifiersRaw={P5102:[{datavalue:{value:{id:'Q5727902'}}}]};
add('Raw P5102 circa is preserved',rawCirca,700,'context','inception');
const report=await validateFactTime(classifyStatement);
console.log(`PASS ${report.passed}/${report.total} independent date-evidence cases`);
for(const failure of report.results.filter(r=>!r.passed))console.error(failure);
assert.equal(report.passed,report.total);
