// Contract checks for display formatting. Raw archive and exported values are not edited.
import assert from 'node:assert/strict';
import {formatResearchValue} from '../public/research-format.js';

const examples=[
 ['6.05458E7','60,545,800'],
 ['3900000.0','3,900,000'],
 ['9007199254740993','9,007,199,254,740,993'],
 ['9.007199254740993E15','9,007,199,254,740,993'],
 ['12345678901234567890.12345678901234567890','12,345,678,901,234,567,890.1234567890123456789'],
 ['1.2001E+3','1,200.1'],
 ['1.230000e-5','0.0000123'],
 ['1000e-4','0.1'],
 ['1000.000e-3','1'],
 ['0.000001e3','0.001'],
 ['0.0001000','0.0001'],
 ['-1234567.89000','-1,234,567.89'],
 ['+1.2e+3','+1,200'],
 ['-0.000','-0'],
 ['0e200','0'],
 ['1e0','1'],
 ['1e0003','1,000']
];
for(const[input,expected]of examples)assert.equal(formatResearchValue(input),expected,input);

const unchanged=[null,undefined,'',1234,true,'present','inferred present','unknown','not applicable','资料不足',
 '1,000','1–2','-3400:-3200','1368 CE','约1000','1.2%','0x10','NaN','Infinity','01','-001',
 '.5','1.','1e','12 345',' 1000','1000 ','1e3\n','1e999999999999999999999','1e-999',
 '1e513','1e400','1e-511','9'.repeat(513)];
for(const value of unchanged)assert.equal(formatResearchValue(value),value,String(value));

assert.equal(formatResearchValue('1368.0',{group:false}),'1368','Phase years do not require grouping');
assert.equal(formatResearchValue('-1000.0',{group:false}),'-1000','No era or year-zero inference');
assert.equal(formatResearchValue('1e400',{group:false}),'1'+'0'.repeat(400),'Unchanged value when the ungrouped display fits');
assert.equal(formatResearchValue('1e-510'),'0.'+'0'.repeat(509)+'1','The exact output-length limit is supported');
assert.equal(formatResearchValue('1e-510').length,512);

// Independent exact arithmetic checks: rational values are compared using BigInt,
// so values beyond IEEE-754 precision cannot pass by agreeing on a rounded Number.
function rational(text){
 const [mantissa,expText='0']=text.replaceAll(',','').toLowerCase().split('e');
 const parts=mantissa.split('.'),scale=(parts[1]||'').length,exponent=BigInt(expText);
 const coefficient=BigInt(parts.join('')),power=exponent-BigInt(scale);
 return power>=0n?[coefficient*10n**power,1n]:[coefficient,10n**(-power)];
}
let exactComparisons=0;
for(const coefficient of ['9007199254740993123456789','-3141592653589793238462643383279','0.000000000123456789','123456789.987654321']){
 for(const exponent of ['-30','-1','0','7','30']){
  const raw=coefficient+'e'+exponent,display=formatResearchValue(raw),[a,b]=rational(raw),[c,d]=rational(display);
  assert.equal(a*d,c*b,raw);assert(!/[eE]/.test(display));exactComparisons++;
 }
}
const record=Object.freeze({'Value.From':'6.05458E7','Value.To':'3900000.0'}),rawExport=JSON.stringify(record);
Object.values(record).forEach(value=>formatResearchValue(value));
assert.equal(JSON.stringify(record),rawExport,'Display formatting must not alter exportable source values');
console.log(JSON.stringify({pass:true,displayExamples:examples.length,unchangedInputs:unchanged.length,exactBigIntComparisons:exactComparisons,maxExpandedDisplayLength:512,sourceValuesPreserved:true},null,2));
