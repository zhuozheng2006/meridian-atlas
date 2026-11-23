import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

const root = new URL('../../', import.meta.url);
const snapshots = [
  "3.61/old-tang-38",
  "3.62/old-tang-39",
  "3.62/old-tang-40",
  "3.62/old-tang-41",
  "3.63/new-tang-37",
  "3.63/new-tang-38",
  "3.63/new-tang-39",
  "3.63/new-tang-40",
  "3.63/new-tang-41",
  "3.63/new-tang-42",
  "3.63/new-tang-43a",
  "3.62/han-28"
];

function buildTargets(archives) {
  const headingsByPage = {};
  const hanPassages = {};
  const stripMarkup = text => text.replace(/<[^>]+>/g, '').trim();
  for (const html of Object.values(archives)) {
    const canonical = decodeURIComponent(html.match(/<link rel="canonical" href="([^"]+)"/)[1]);
    const page = canonical.replace('https://zh.wikisource.org/zh-hans/', '');
    if (page === '漢書/卷028') {
      let heading = '';
      const paragraphs = [];
      for (const block of html.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>|<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
        if (block[1]) heading = block[1];
        else paragraphs.push({heading, text: stripMarkup(block[2])});
      }
      for (const {heading, text} of paragraphs) {
        if (!['各郡上', '各郡下', '各國'].includes(heading)) continue;
        const start = text.match(/^([^，]+)，(?:元始二年)?户[^，。]+[，。]/);
        if (!start) continue;
        const quote = start[0];
        // A short second transcription of Guangyang also begins with its name.
        const occurrences = paragraphs.reduce((n, row) => n + row.text.split(quote).length - 1, 0);
        if (occurrences === 1) {
          if (Object.hasOwn(hanPassages, start[1])) throw Error('Ambiguous passage for ' + start[1]);
          hanPassages[start[1]] = [heading, quote];
        }
      }
      continue;
    }
    const headings = [...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h[1-6]>/g)]
      .map(match => ({id: match[1], label: stripMarkup(match[2])}));
    const fragmentIDs = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    const targets = {};
    for (const {id, label} of headings) {
      if (fragmentIDs.has(label) || headings.filter(h => h.label === label).length !== 1) continue;
      targets[label] = id;
    }
    // The cited section records the change from Tingzhou to Beiting within this paragraph.
    if (page === '舊唐書/卷40') {
      if (!headings.some(h => h.id === '北庭都護府' && h.label === '北庭都护府') ||
          !stripMarkup(html).includes('乃置庭州，处叶护部落。长安二年，改为北庭都护府。')) {
        throw Error('Beiting section no longer matches the archived text');
      }
      targets['庭州'] = '北庭都護府';
    }
    headingsByPage[page] = targets;
  }
  return {headingsByPage, hanPassages};
}

const resolver = `export function reviewSourceURL(source) {
  const prefix = 'https://zh.wikisource.org/zh-hans/';
  if (!source.url.startsWith(prefix)) return source.url;
  const [page, fragment] = source.url.slice(prefix.length).split('#');
  if (page === '漢書/卷028' && !fragment) {
    const name = source.section?.split(' · ').at(-1);
    if (!Object.hasOwn(hanPassages, name)) return source.url;
    const [section, quote] = hanPassages[name];
    return source.url + '#' + section + ':~:text=' + encodeURIComponent(quote);
  }
  const targets = headingsByPage[page];
  return targets && Object.hasOwn(targets, fragment) ? prefix + page + '#' + targets[fragment] : source.url;
}`;

function renderModule(tables) {
  return '// Generated from archived chapter HTML by scripts/china-prefectures/build-source-targets.mjs.\n' +
    'const headingsByPage = ' + JSON.stringify(tables.headingsByPage, null, 2) + ';\n\n' +
    'const hanPassages = ' + JSON.stringify(tables.hanPassages, null, 2) + ';\n\n' + resolver + '\n';
}

const archives = {};
for (const snapshot of snapshots) {
  const [version, book] = snapshot.split('/');
  const path = `docs/verification-${version}/sources/${book}.html.gz`;
  archives[snapshot] = gunzipSync(readFileSync(new URL(path, root))).toString('utf8');
}
const tables = buildTargets(archives);
assert.equal(Object.keys(tables.hanPassages).length, 103);
const generated = renderModule(tables);
const target = new URL('public/china-source-targets.js', root);
if (process.argv.includes('--check')) assert.equal(readFileSync(target, 'utf8'), generated, 'Rebuild the chapter links');
else writeFileSync(target, generated);
