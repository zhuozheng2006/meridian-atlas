// Pinned record notes from docs/alps-1500-source-audit.json. These describe the
// reviewed source version, and attach only to its exact identity and dates.
export function boundaryNote(p) {
 if(p.osm_id!==-2815329||p.start_date!=='1480'||p.end_date!=='1661-02-28')return null;
 return {
  checkedOn:'2026-10-02',url:'https://www.openhistoricalmap.org/relation/2815329',
  zh:'本次核查的记录将1480年设为与巴尔合并相对应的制图起点，编辑注记说明这是人为选定的年份。边线仍标有待补来源；部分地段参考18—19世纪地图与现代区划。此详图适合对照其地方轮廓，精确变界年代请结合原始注记阅读。',
  en:'In the reviewed record, 1480 is an editorial start chosen to coincide with union with Bar. The boundary carries a request for sources; some segments refer to eighteenth- or nineteenth-century maps and modern administrative limits. Explore the local outline alongside these source notes when assessing the date of a boundary change.'
 };
}
