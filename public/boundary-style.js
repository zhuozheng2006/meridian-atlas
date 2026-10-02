// Pixel styling only: no coordinates are moved, rounded or interpolated.
// Historical limits are drawn as a cased line: a soft light halo separates the
// territory from the modern relief underneath, and a crisper dark line carries
// the actual source geometry. Neither layer adds or invents vertices.
export function boundaryPaint(source='cliopatria'){
 const detailed=source==='cshapes';
 return {
  'line-color':'#4b4436',
  'line-width':['interpolate',['linear'],['zoom'],0,.4,3,.68,6,detailed?1.05:1.25,10,detailed?1.2:1.3],
  'line-opacity':['interpolate',['linear'],['zoom'],0,.66,3,.82,6,detailed?.86:.92,10,detailed?.86:.9],
  'line-blur':detailed?.2:.1
 };
}
export function boundaryHaloPaint(source='cliopatria'){
 const detailed=source==='cshapes';
 return {
  'line-color':'#f8f1de',
  'line-width':['interpolate',['linear'],['zoom'],0,.7,3,1.25,6,detailed?1.9:2.15,10,detailed?2.1:2.4],
  'line-opacity':['interpolate',['linear'],['zoom'],0,.3,3,.4,6,detailed?.4:.48,10,detailed?.34:.4],
  'line-blur':.45
 };
}
export const territoryOpacity=['interpolate',['linear'],['zoom'],0,.5,4,.42,7,.3,10,.2];
