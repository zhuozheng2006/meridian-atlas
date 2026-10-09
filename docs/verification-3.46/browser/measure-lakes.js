(()=>{
const a=window.__meridian.instances.find(a=>!a.destroyed&&a.container==='map'),m=a.map,l=a.geography.lakes,start=performance.now(),events=[];
const mark=(kind,e={})=>events.push({t:performance.now()-start,kind,type:e.sourceDataType,sourceLoaded:m.getSource('lake-detail')?.loaded(),tilesLoaded:m.isSourceLoaded('lake-detail'),ready:l.ready,status:l.status,count:l.count,opacity:m.getPaintProperty('lake-detail','fill-opacity')});
const data=e=>{if(e.sourceId==='lake-detail')mark('sourcedata',e);},idle=()=>mark('idle'),error=e=>{if(e.sourceId==='lake-detail')mark('error',e);};
let state='';const render=()=>{const s=[l.ready,l.status,l.count,m.isSourceLoaded('lake-detail')].join();if(s!==state){state=s;mark('render');}};
m.on('sourcedata',data);m.on('idle',idle);m.on('render',render);m.on('error',error);
window.__lake346={result:()=>({events,view:{center:m.getCenter(),zoom:m.getZoom(),width:m.getContainer().clientWidth,height:m.getContainer().clientHeight},count:l.count,ready:l.ready,status:l.status}),stop(){m.off('sourcedata',data);m.off('idle',idle);m.off('render',render);m.off('error',error);}};
mark('jump');m.jumpTo({center:[32,-1],zoom:6.3});return 'started';
})()
