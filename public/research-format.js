// Display only: original observation values and exports must retain their source text.
// Numeric source strings use ASCII decimal syntax; labels, ranges and identifiers
// (including leading-zero strings) are returned unchanged. No mantissa uses Number.
const MAX_DISPLAY_LENGTH=512;
const DECIMAL=/^([+-]?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?)(\d+))?$/;

export function formatResearchValue(value,{group=true}={}){
 if(typeof value!=='string'||!value||value.length>MAX_DISPLAY_LENGTH)return value;
 const match=DECIMAL.exec(value);
 // JavaScript's $ can stop before a final newline; require an exact full match.
 if(!match||match[0]!==value)return value;
 const[,sign,whole,fraction='',exponentSign='',exponentDigits='0']=match;
 let exponent=0;
 for(const digit of exponentDigits){
  exponent=exponent*10+digit.charCodeAt(0)-48;
  if(exponent>MAX_DISPLAY_LENGTH)return value;
 }
 if(exponentSign==='-')exponent=-exponent;
 let digits=whole+fraction,point=whole.length+exponent;
 const leadingZeros=/^0*/.exec(digits)[0].length;
 digits=digits.slice(leadingZeros).replace(/0+$/,'');point-=leadingZeros;
 if(!digits)return sign+'0';

 const integerLength=Math.max(1,point),fractionLength=Math.max(0,digits.length-point);
 const length=sign.length+integerLength+(fractionLength?1+fractionLength:0)+(group?Math.floor((integerLength-1)/3):0);
 // Check before allocating an expanded run of zeros. Oversized source notation
 // remains readable as supplied, rather than creating a very long display value.
 if(length>MAX_DISPLAY_LENGTH)return value;
 let integer,decimal;
 if(point<=0){integer='0';decimal='0'.repeat(-point)+digits;}
 else if(point>=digits.length){integer=digits+'0'.repeat(point-digits.length);decimal='';}
 else {integer=digits.slice(0,point);decimal=digits.slice(point);}
 if(group)integer=integer.replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return sign+integer+(decimal?'.'+decimal:'');
}
