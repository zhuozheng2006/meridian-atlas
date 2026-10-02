// URL cameras are explicit finite values, independent of language and year.
export function decodeCamera(value){
 if(typeof value!=='string')return null;
 const fields=value.split(',');if(fields.length!==5||fields.some(v=>!v.trim()))return null;
 const [lon,lat,zoom,bearing,pitch]=fields.map(Number);
 if(![lon,lat,zoom,bearing,pitch].every(Number.isFinite)||Math.abs(lon)>180||Math.abs(lat)>85.051129||zoom<.2||zoom>18||Math.abs(bearing)>180||pitch<0||pitch>60)return null;
 return {center:[lon,lat],zoom,bearing,pitch};
}
export function encodeCamera(map){
 if(!map)return null;
 const center=map.getCenter();
 const values=[((center.lng+180)%360+360)%360-180,center.lat,map.getZoom(),((map.getBearing()+180)%360+360)%360-180,map.getPitch()];
 if(!values.every(Number.isFinite))return null;
 const result=values.map((v,i)=>Number(v.toFixed(i===0?5:i===1?6:3))).join(',');return decodeCamera(result)?result:null;
}

export const BOUNDARY_MODES=['auto','overview','regional'];
export const boundaryMode=value=>BOUNDARY_MODES.includes(value)?value:'auto';
