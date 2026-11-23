// Only the Sources panel imports this module, after the reader opens the index.
import {readChinaIndex, chinaDisplayName, createChinaReviewDetails} from './china-prefectures.js?v=4.18.0-0acb4e1361f6';
import {reviewedChinaName} from './china-name-reviews.js?v=4.18.0-0acb4e1361f6';

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
  return rows.filter(({record, review, PrefID, names}) => {
    if (year && record.year !== Number(year)) return false;
    if ((status === 'pending' && review) || (status === 'verified' && !review)) return false;
    if (/^#?\d+$/.test(term)) return term.replace('#', '') === String(PrefID);
    if (/^(?:china-prefecture-)?\d+-\d+$/.test(term)) return record.id === (term.startsWith('china-') ? term : 'china-prefecture-' + term);
    return names.some(name => name.includes(term));
  });
}

export function divisionMapLink(record, lang) {
  const [west, south, east, north] = record.bounds;
  const camera = [((west + east) / 2).toFixed(5), ((south + north) / 2).toFixed(5), 6.5, 0, 0];
  return './#' + new URLSearchParams({
    year: record.year, lang, boundaries: 'regional', browse: '0', camera: camera.join(',')
  });
}

export async function mountDivisionLedger(host, lang, initialId = '') {
  const rows = divisionRows(await readChinaIndex());
  if (!host.isConnected) return;
  const t = (zh, en) => lang === 'en' ? en : zh;
  host.innerHTML = `<div class="quality-controls">
    <label>${t('名称、来源拼写或编号','Name, source spelling or ID')}<input type="search"></label>
    <label>${t('截面年份','Snapshot year')}<select name="year"><option value="">${t('全部年份','All years')}</option><option value="2">${t('公元 2 年','2 CE')}</option><option value="742">${t('公元 742 年','742 CE')}</option></select></label>
    <label>${t('核查状态','Review status')}<select name="status"><option value="">${t('全部状态','All statuses')}</option><option value="pending">${t('待考','Under review')}</option><option value="verified">${t('已核准','Verified')}</option></select></label>
  </div><p role="status" class="division-count"></p><ul class="division-list"></ul><button type="button" data-more>${t('显示更多','Show more')}</button>`;
  const input = host.querySelector('input');
  const year = host.querySelector('[name="year"]');
  const status = host.querySelector('[name="status"]');
  const list = host.querySelector('ul');
  const more = host.querySelector('[data-more]');
  let matches = [], shown = 0;

  function addPage() {
    const end = Math.min(shown + pageSize, matches.length);
    const page = document.createDocumentFragment();
    for (const {record, review, zh, en, PrefID} of matches.slice(shown, end)) {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = lang === 'en' ? en : zh || en;
      const meta = document.createElement('span');
      const original = record.sourceRecord.PrefNAM;
      const id = record.year + '-' + PrefID;
      const permalink = document.createElement('a');
      permalink.href = './?division=' + id + '#view=sources&lang=' + lang;
      permalink.textContent = '#' + id;
      permalink.setAttribute('aria-label', t('这条考证的固定链接','Permalink to this review') + ' · ' + id);
      meta.textContent = [name.textContent !== original ? original : '', t('公元 ' + record.year + ' 年', record.year + ' CE'),
        review ? t('已核准','Verified') : t('待考','Under review')].filter(Boolean).join(' · ');
      const locate = document.createElement('a');
      locate.href = divisionMapLink(record, lang);
      locate.textContent = t('在地图定位', 'Locate on map');
      locate.setAttribute('aria-label', t('在地图定位', 'Locate on map') + ' · ' + name.textContent + ' · ' + record.year);
      meta.append(' · ', permalink);
      const evidence = createChinaReviewDetails(record, review, lang);
      if (initialId === id) evidence.open = true;
      item.append(name, meta, locate, evidence);
      page.append(item);
    }
    list.append(page);
    shown = end;
    host.querySelector('[role="status"]').textContent = t(`找到 ${matches.length} 项，已显示 ${shown} 项`, `Showing ${shown} of ${matches.length} matches`);
    more.hidden = shown >= matches.length;
  }

  function filter() {
    matches = matchDivisions(rows, input.value, year.value, status.value);
    shown = 0;
    list.replaceChildren();
    addPage();
  }

  input.value = initialId;
  function changeFilters() {
    if (initialId) {
      initialId = '';
      const url = new URL(location.href);
      url.searchParams.delete('division');
      history.replaceState(history.state, '', url);
    }
    filter();
  }

  input.oninput = changeFilters;
  year.onchange = changeFilters;
  status.onchange = changeFilters;
  more.onclick = addPage;
  filter();
}
