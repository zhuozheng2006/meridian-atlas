// Pixel styling only: no coordinates are moved, rounded or interpolated.
// Historical limits are drawn as a cased line: a soft light halo separates the
// territory from the modern relief underneath, and a crisper dark line carries
// the actual source geometry. Neither layer adds or invents vertices.
export function boundaryPaint(source='cliopatria'){
 const detailed=source==='cshapes';
 return {
  'line-color':'#352e23',
  'line-width':['interpolate',['linear'],['zoom'],0,.55,3,.82,6,detailed?1.15:.95,10,detailed?1.3:.85],
  'line-opacity':['interpolate',['linear'],['zoom'],0,.72,3,.86,6,detailed?.88:.72,10,detailed?.88:.6],
  'line-blur':detailed?.15:.2
 };
}
export function boundaryHaloPaint(source='cliopatria'){
 const detailed=source==='cshapes';
 return {
  'line-color':'#faf4e2',
  'line-width':['interpolate',['linear'],['zoom'],0,.95,3,1.5,6,detailed?2.1:1.85,10,detailed?2.3:1.7],
  'line-opacity':['interpolate',['linear'],['zoom'],0,.38,3,.48,6,detailed?.46:.54,10,detailed?.4:.45],
  'line-blur':.4
 };
}
export const territoryOpacity=['interpolate',['linear'],['zoom'],0,.58,4,.48,7,.36,10,.26];
