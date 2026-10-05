// Citation and narrative scope metadata shared by authoring and publication.
// Missing citation lists retain the legacy all-sources behavior; explicit lists
// are a contract and must never silently fall back after a validation error.
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
export function verifiedChineseTitle(extract){
 // Current extract files use zhIdentityMatch. Preserve an explicit older
 // editorial rejection instead of treating any matching title as approval.
 const accepted=typeof extract.zhAccepted==='boolean'?extract.zhAccepted:extract.zhIdentityMatch===true;
 return accepted&&extract.zhIntro&&extract.zhTitle?extract.zhTitle:null;
}
export function citationRegistry(sources,where='narrative'){
 if(!Array.isArray(sources)||!sources.length)throw Error(where+': at least one source required');
 const ids=sources.map(s=>s?.id);
 if(ids.some(id=>typeof id!=='string'||!id.trim()))throw Error(where+': invalid source declaration id');
 if(new Set(ids).size!==ids.length)throw Error(where+': duplicate source declaration id');
 return ids;
}
export function citationIds(holder,known,where='section'){
 if(!own(holder,'sourceIds'))return [...known];
 const ids=holder.sourceIds;
 if(!Array.isArray(ids)||!ids.length)throw Error(where+': explicit sourceIds must be a nonempty array');
 if(ids.some(id=>typeof id!=='string'||!known.includes(id)))throw Error(where+': unknown or invalid sourceIds');
 if(new Set(ids).size!==ids.length)throw Error(where+': duplicate sourceIds');
 return [...ids];
}
export function narrativeScope(authored,fallback,where='narrative'){
 const scope=own(authored,'scope')?authored.scope:fallback;
 if(!scope||!Number.isInteger(scope.start)||!Number.isInteger(scope.end)||scope.start>=scope.end)throw Error(where+': invalid narrative scope');
 if(own(scope,'note')&&(!scope.note||typeof scope.note!=='object'||Array.isArray(scope.note)||['zh','en'].some(lang=>typeof scope.note[lang]!=='string'||!scope.note[lang].trim())))throw Error(where+': scope.note must contain nonempty zh and en text');
 return structuredClone(scope);
}
