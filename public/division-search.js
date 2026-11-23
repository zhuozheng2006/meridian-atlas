import {readJSON, forgetJSON} from './map-engine.js?v=4.21.1-46c343f2e328';
export {mapDivisionHref} from './view-state.js?v=4.21.1-46c343f2e328';

const indexURL = 'data/fast/division-search.json.gz';
const literal = name => name.trim().toLowerCase().normalize('NFC');
const fold = name => name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '');
let pendingIndex;

function loadIndex() {
  if (!pendingIndex) {
    pendingIndex = readJSON(indexURL).then(index => {
      if (index.version !== 1 || !Array.isArray(index.rows)) throw Error('Invalid division search index');
      return index.rows.map(row => {
        const names = [...new Set([row.zh, row.en, row.formerZh, row.sourceName].filter(Boolean).map(literal))];
        return {row: {...row, id: 'china-prefecture-' + row.year + '-' + row.prefId}, names, folded: names.map(fold)};
      });
    }).catch(error => {
      pendingIndex = undefined;
      forgetJSON(indexURL);
      throw error;
    });
  }
  return pendingIndex;
}

export async function findMapDivisions(query, year) {
  const text = literal(query);
  const term = fold(text);
  if (!term) return [];
  const qualified = /^(?:#|china-prefecture-)?(2|742)-([1-9]\d{0,2})$/.exec(text);
  const numeric = /^(?:#|prefid\s+)?([1-9]\d{0,2})$/.exec(text);
  const matches = [];
  for (const {row, names, folded} of await loadIndex()) {
    let rank;
    if (qualified || numeric) {
      if (qualified && row.year !== Number(qualified[1])) continue;
      if (row.prefId !== Number((qualified || numeric).at(-1))) continue;
      rank = 0;
    } else if (names.includes(text)) rank = 0;
    else if (folded.includes(term)) rank = 1;
    else if (folded.some(name => name.startsWith(term))) rank = 2;
    else if (folded.some(name => name.includes(term))) rank = 3;
    else continue;
    matches.push({row, rank});
  }
  matches.sort((a, b) => a.rank - b.rank || Math.abs(a.row.year - year) - Math.abs(b.row.year - year)
    || a.row.year - b.row.year || a.row.prefId - b.row.prefId);
  return matches.map(({row, rank}) => ({...row, exact: rank === 0}));
}
