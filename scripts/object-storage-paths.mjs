// Pure routing inventory shared by release-budget checks and the Worker build.
// These paths come from the same audited manifests; arbitrary public files are
// never exempted from static hosting limits by their directory alone.
export function objectStoragePaths({lakes,ohm,regionalTransport,china,chgis,cshapes,seshat,native}){
 const paths=new Set();
 const add=(prefix,file,pattern)=>{
  if(typeof file!=='string'||!pattern.test(file))throw Error('Invalid object-storage path: '+prefix+String(file));
  const value=prefix+file;if(paths.has(value))throw Error('Duplicate object-storage path: '+value);paths.add(value);
 };
 for(const f of lakes.shards)add('data/lakes/',f.file,/^\d{4}\.bin\.gz$/);
 for(const area of ['ohm-eastasia','ohm-1500','ohm-britain'])for(const f of Object.values(ohm[area].years))add('data/'+area+'/',f.file,/^year--?\d+\.json\.gz$/);
 for(const f of regionalTransport.files)add('data/ohm-transport/',f.file,/^(?:central-europe|east-asia|british-isles)--?\d+\.json\.gz$/);
 if(!/^[a-f0-9]{64}$/.test(china.sourceArchiveSHA256))throw Error('Missing China source archive hash');
 add('data/china-prefectures/','ResearchArea-originals.zip',/^ResearchArea-originals\.zip$/);
 for(const f of china.files)if(/^year-\d+-band-\d+\.json\.gz$/.test(f.file))add('data/china-prefectures/',f.file,/^year-\d+-band-\d+\.json\.gz$/);
 for(const f of chgis.files)if(/^century--?\d+\.json\.gz$/.test(f.file))add('data/chgis/',f.file,/^century--?\d+\.json\.gz$/);
 for(const f of Object.values(cshapes.packs))add('data/cshapes/',f.file,/^decade-\d+\.json\.gz$/);
 if(!/^[a-f0-9]{64}$/.test(seshat.codebookSha256))throw Error('Missing Seshat codebook hash');
 add('data/seshat/sources/','code-book-4.20.2021.pdf',/^code-book-4\.20\.2021\.pdf$/);
 for(const f of native.temporalBundles)add('data/native/',f.file,/^temporal\/pack-\d{3}\.json\.gz$/);
 return paths;
}
