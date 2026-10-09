// MLK1 is a transport encoding; its decoded point deltas are the same audited
// millionth-degree integers. No vertices are simplified or removed here.
export function decodeLakeArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<5||String.fromCharCode(...bytes.subarray(0,4))!=='MLK1')throw Error('Invalid lake archive header');
 let cursor=4;
 function uint(){let n=0,scale=1;for(let i=0;i<8;i++){if(cursor>=bytes.length)throw Error('Truncated lake archive');const b=bytes[cursor++];n+=(b&127)*scale;if(!Number.isSafeInteger(n))throw Error('Invalid lake integer');if(b<128)return n;scale*=128;}throw Error('Invalid lake integer');}
 const sint=()=>{const n=uint();return n%2?-(n+1)/2:n/2;};
 const count=uint(),features=[];let lastId=0,totalPoints=0;
 if(count>2000)throw Error('Invalid lake feature count');
 for(let i=0;i<count;i++){
  const id=lastId+sint();lastId=id;const type=uint(),area=uint()/100,x=sint(),y=sint(),w=uint(),h=uint();
  if(id<=0||![1,3].includes(type)||x< -180e6||y< -90e6||x+w>180e6||y+h>90e6)throw Error('Invalid lake metadata');
  const bbox=[x/1e6,y/1e6,(x+w)/1e6,(y+h)/1e6],kind=uint();let geometry;
  if(kind===0){const size=uint();if(size>bytes.length-cursor)throw Error('Truncated exact lake');geometry=JSON.parse(new TextDecoder().decode(bytes.subarray(cursor,cursor+size)));cursor+=size;if(!['Polygon','MultiPolygon'].includes(geometry.type)||!Array.isArray(geometry.coordinates))throw Error('Invalid exact lake');}
  else{
   if(kind!==1&&kind!==2)throw Error('Invalid lake geometry');
   const polygons=[],polygonCount=uint();if(!polygonCount||polygonCount>100000||kind===1&&polygonCount!==1)throw Error('Invalid lake polygons');
   for(let p=0;p<polygonCount;p++){
    const polygon=[],ringCount=uint();if(!ringCount||ringCount>100000)throw Error('Invalid lake rings');
    for(let r=0;r<ringCount;r++){
     const count=uint();totalPoints+=count;if(count<4||count>bytes.length/2||totalPoints>2000000)throw Error('Invalid lake vertices');
     const deltas=new Array(count*2);for(let j=0;j<deltas.length;j++)deltas[j]=sint();deltas[0]+=x;deltas[1]+=y;polygon.push(deltas);
    }
    polygons.push(polygon);
   }
   geometry={type:kind===1?'Polygon':'MultiPolygon',deltas:polygons};
  }
  features.push({type:'Feature',id,bbox,properties:{id,type,area},geometry});
 }
 if(cursor!==bytes.length)throw Error('Unexpected lake archive bytes');
 return {encoding:'delta-1e6',features};
}
