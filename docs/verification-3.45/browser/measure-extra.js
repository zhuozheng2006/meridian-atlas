(()=>{
 const original=Response.prototype.json,parsed=[];
 Response.prototype.json=async function(...args){const t=performance.now(),result=await original.apply(this,args);if(result?.features?.some(f=>f.properties?.LANDSCAPE!==undefined))parsed.push({url:this.url,features:result.features.length,ms:performance.now()-t});return result;};
 window.__parseProbe345={parsed,stop(){Response.prototype.json=original;}};
 return 'JSON parse monitor installed';
})()
