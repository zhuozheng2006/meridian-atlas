// Only the Sources panel imports this module, after the reader opens the index.
import {readChinaIndex, chinaDisplayName, createChinaReviewDetails} from './china-prefectures.js?v=4.22.0-606c7d2f9c65';
import {reviewedChinaName} from './china-name-reviews.js?v=4.22.0-606c7d2f9c65';
import {mapDivisionHref, writeDivisionDirectoryFilters} from './view-state.js?v=4.22.0-606c7d2f9c65';

const pageSize = 20;
const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '').toLowerCase().trim();

export function divisionRows(index) {
  return index.records.map(record => {
    const review = reviewedChinaName(record);
    const {zh, en} = chinaDisplayName(record, review);
    const {PrefID, PrefNAM, ProvNAM} = record.sourceRecord;
    const names = [zh, en, PrefNAM, ProvNAM, review?.formerNameZh, record.id, ...(review?.sources || []).map(source => source.section)].map(normalize);
    return {record, review, zh, en, PrefID, names};
  }).sort((a, b) => a.record.year - b.record.year || a.PrefID - b.PrefID);
}

export function matchDivisions(rows, query, year, status) {
  const term = normalize(query);
  const number = /^(?:#|prefid\s+)?([1-9]\d{0,2})$/.exec(term);
  const qualified = /^(?:#|china-prefecture-)?((?:2|742)-[1-9]\d{0,2})$/.exec(term);
  return rows.filter(({record, review, PrefID, names}) => {
    if (year && record.year !== Number(year)) return false;
    if ((status === 'pending' && review) || (status === 'verified' && !review)) return false;
    if (number) return number[1] === String(PrefID);
    if (qualified) return record.id === 'china-prefecture-' + qualified[1];
    return names.some(name => name.includes(term));
  });
}

export function divisionMapLink(record, lang) {
  const [west, south, east, north] = record.bounds;
  return mapDivisionHref({id: record.id, year: record.year, center: [(west + east) / 2, (south + north) / 2]}, lang);
}

// PrefNAM is the published spelling. Keep punctuation, accents and suffixes
// intact here even though the directory search accepts approximate spellings.
export function groupSourceSpellings(rows) {
  const groups = new Map();
  for (const row of rows) {
    const spelling = row.record.sourceRecord.PrefNAM;
    if (!spelling) continue;
    if (!groups.has(spelling)) groups.set(spelling, []);
    groups.get(spelling).push(row);
  }
  return groups;
}

export async function mountDivisionLedger(host, lang, initialId = '', saved = null, route = null) {
  const rows = divisionRows(await readChinaIndex());
  if (!host.isConnected) return;
  const groups = groupSourceSpellings(rows);
  const t = (zh, en) => lang === 'en' ? en : zh;
  host.innerHTML = `<div class="quality-controls">
    <label>${t('名称、来源拼写或编号','Name, source spelling or ID')}<input type="search"></label>
    <label>${t('截面年份','Snapshot year')}<select name="year"><option value="">${t('全部年份','All years')}</option><option value="2">${t('公元 2 年','2 CE')}</option><option value="742">${t('公元 742 年','742 CE')}</option></select></label>
    <label>${t('核查状态','Review status')}<select name="status"><option value="">${t('全部状态','All statuses')}</option><option value="pending">${t('待考','Under review')}</option><option value="verified">${t('已核准','Verified')}</option></select></label>
  </div><div class="division-result-tools"><p role="status" class="division-count"></p><button type="button" data-copy-division hidden>${t('复制筛选链接','Copy filtered view')}</button><span data-copy-status role="status"></span></div><ul class="division-list"></ul><button type="button" data-more>${t('显示更多','Show more')}</button>`;
  const input = host.querySelector('input');
  const year = host.querySelector('[name="year"]');
  const status = host.querySelector('[name="status"]');
  const list = host.querySelector('ul');
  const copy = host.querySelector('[data-copy-division]');
  const copyStatus = host.querySelector('[data-copy-status]');
  const more = host.querySelector('[data-more]');
  let matches = [], shown = 0;
  const rendered = new Map();
  const expanded = new Set(Array.isArray(saved?.expanded) ? saved.expanded : []);
  const comparisons = new Set(Array.isArray(saved?.comparisons) ? saved.comparisons : []);

  function remember(focus, comparisonTarget = '', focusType = 'map') {
    const open = [...rendered].filter(([, row]) => row.evidence.open).map(([key]) => key);
    const comparisons = [...rendered].filter(([, row]) => row.comparison?.open).map(([key]) => key);
    history.replaceState({...history.state, atlasDivisionDirectory: {
      query: input.value, year: year.value, status: status.value, shown, expanded: open, comparisons, focus, comparisonTarget, focusType
    }}, '');
  }
  function refreshReturn() {
    const prior = history.state?.atlasDivisionDirectory;
    if (!prior || !host.isConnected) return;
    const row = rendered.get(prior.focus);
    remember(row ? prior.focus : '', row?.comparison?.open ? prior.comparisonTarget : '', prior.focusType);
  }

  function rowLinks(row, origin) {
    const {record, PrefID, en, zh} = row;
    const id = record.year + '-' + PrefID;
    const name = lang === 'en' ? en : zh || en;
    const links = {};
    for (const type of ['record', 'map']) {
      const link = document.createElement('a');
      const isMap = type === 'map';
      link.href = isMap ? divisionMapLink(record, lang) : './?division=' + id + '#view=sources&lang=' + lang;
      const action = isMap ? t('在地图定位', 'Locate on map') : t('这条考证的固定链接', 'Permalink to this review');
      link.textContent = isMap ? action : '#' + id;
      const label = origin ? name + ' · ' + id : isMap ? name + ' · ' + record.year : id;
      link.setAttribute('aria-label', action + ' · ' + label);
      link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        remember(origin || id, origin ? id : '', type);
      });
      links[type] = link;
    }
    return links;
  }

  function comparisonFor(group, origin, originName, rowState) {
    const details = document.createElement('details');
    details.className = 'division-comparison';
    const summary = document.createElement('summary');
    const spelling = group[0].record.sourceRecord.PrefNAM;
    summary.textContent = t('比较同拼写记录（' + group.length + '）', 'Compare matching spellings (' + group.length + ')');
    summary.setAttribute('aria-label', summary.textContent + ' · ' + spelling);
    details.append(summary);
    rowState.comparison = details;
    const draw = () => {
      if (!details.open || rowState.peers) return;
      rowState.peers = new Map();
      const wrap = document.createElement('div');
      wrap.className = 'division-comparison-table';
      const table = document.createElement('table');
      const caption = document.createElement('caption');
      caption.textContent = t('来源拼写', 'Source spelling') + ' · ' + spelling;
      const head = document.createElement('thead'), headers = document.createElement('tr');
      for (const label of [t('目录名称与编号', 'Directory name and ID'), t('来源上级区划', 'Parent division in source'), t('核查状态', 'Review status'), t('地图', 'Map')]) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; headers.append(th);
      }
      head.append(headers);
      const body = document.createElement('tbody');
      for (const peer of group) {
        const {record, review, zh, en, PrefID} = peer, id = record.year + '-' + PrefID;
        const tr = document.createElement('tr'), name = document.createElement('th');
        name.scope = 'row';
        if (id === origin) tr.setAttribute('aria-current', 'true');
        name.textContent = lang === 'zh' ? zh || en : [zh, en].filter(Boolean).join(' · ');
        const reference = document.createElement('small');
        const links = rowLinks(peer, origin);
        reference.append(t('公元 ' + record.year + ' 年', record.year + ' CE') + ' · ', links.record);
        name.append(reference);
        const parent = document.createElement('td'), status = document.createElement('td'), map = document.createElement('td');
        parent.textContent = record.sourceRecord.ProvNAM;
        status.textContent = review ? t('已核准','Verified') : t('待考','Under review');
        map.append(links.map); tr.append(name, parent, status, map); body.append(tr);
        rowState.peers.set(id, links);
      }
      table.append(caption, head, body); wrap.append(table);
      const back = document.createElement('button');
      back.type = 'button'; back.textContent = t('返回', 'Return to ') + originName;
      back.onclick = () => {details.open = false; summary.focus();};
      details.append(wrap, back);
    };
    details.addEventListener('toggle', draw);
    if (comparisons.has(origin)) {details.open = true; draw();}
    return details;
  }

  function addPage(amount = pageSize) {
    const end = Math.min(shown + amount, matches.length);
    const page = document.createDocumentFragment();
    for (const row of matches.slice(shown, end)) {
      const {record, review, zh, en, PrefID} = row;
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = lang === 'en' ? en : zh || en;
      const meta = document.createElement('span');
      const original = record.sourceRecord.PrefNAM;
      const id = record.year + '-' + PrefID;
      const group = groups.get(original);
      const {record: permalink, map: locate} = rowLinks(row);
      meta.textContent = [name.textContent !== original ? original : '', t('公元 ' + record.year + ' 年', record.year + ' CE'),
        group?.length > 1 ? record.sourceRecord.ProvNAM : '',
        review ? t('已核准','Verified') : t('待考','Under review')].filter(Boolean).join(' · ');
      meta.append(' · ', permalink);
      const evidence = createChinaReviewDetails(record, review, lang);
      evidence.open = saved ? expanded.has(id) : initialId === id;
      const rowState = {map: locate, record: permalink, evidence};
      rendered.set(id, rowState);
      item.append(name, meta, locate, evidence);
      if (group?.length > 1) item.append(comparisonFor(group, id, name.textContent, rowState));
      page.append(item);
    }
    list.append(page);
    shown = end;
    host.querySelector('[role="status"]').textContent = t(`找到 ${matches.length} 项，已显示 ${shown} 项`, `Showing ${shown} of ${matches.length} matches`);
    more.hidden = shown >= matches.length;
  }

  function filter(amount = pageSize) {
    copy.hidden = Boolean(initialId) || !(input.value.trim() || year.value || status.value);
    copyStatus.textContent = '';
    matches = matchDivisions(rows, input.value, year.value, status.value);
    shown = 0;
    rendered.clear();
    list.replaceChildren();
    addPage(amount);
  }

  const initial = saved || route;
  input.value = typeof initial?.query === 'string' ? initial.query : initialId;
  if (initial) {
    year.value = ['2', '742'].includes(initial.year) ? initial.year : '';
    status.value = ['pending', 'verified'].includes(initial.status) ? initial.status : '';
  }
  function changeFilters() {
    initialId = '';
    const url = new URL(location.href);
    writeDivisionDirectoryFilters(url.searchParams, {query: input.value, year: year.value, status: status.value});
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    filter();
    refreshReturn();
  }

  copy.onclick = async () => {
    const link = new URL('./', location.href);
    writeDivisionDirectoryFilters(link.searchParams, {query: input.value, year: year.value, status: status.value});
    link.hash = new URLSearchParams({view: 'sources', lang}).toString();
    try {
      await navigator.clipboard.writeText(link.href);
      copyStatus.textContent = t('已复制', 'Copied');
    } catch {
      copyStatus.textContent = t('请复制地址栏中的链接', 'Copy the link from the address bar');
    }
  };
  input.oninput = changeFilters;
  year.onchange = changeFilters;
  status.onchange = changeFilters;
  more.onclick = () => {addPage(); refreshReturn();};
  list.addEventListener('toggle', refreshReturn, true);
  filter(Number.isSafeInteger(saved?.shown) ? Math.max(pageSize, saved.shown) : pageSize);
  if (saved) {
    const row = rendered.get(saved.focus);
    const links = row?.peers?.get(saved.comparisonTarget) || row;
    const link = links?.[saved.focusType === 'record' ? 'record' : 'map'];
    link?.focus({preventScroll: true});
    link?.scrollIntoView({block: 'nearest'});
    expanded.clear();
    comparisons.clear();
    saved = null;
  }
}
