// Pixel styling only: no coordinates are moved, rounded or interpolated.
export function boundaryPaint(source='cliopatria'){
 const detailed=source==='cshapes';
 return {
  'line-color':'#655f4f',
  'line-width':['interpolate',['linear'],['zoom'],0,.3,3,.55,6,detailed?.85:.8,10,detailed?1:.8],
  'line-opacity':['interpolate',['linear'],['zoom'],0,.4,3,.56,6,detailed?.64:.62,10,detailed?.65:.5],
  'line-blur':detailed?.2:.25
 };
}
export const territoryOpacity=['interpolate',['linear'],['zoom'],0,.53,4,.4,7,.22,10,.15];
