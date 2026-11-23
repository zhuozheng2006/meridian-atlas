import {label} from './polaris-adapter.js?v=4.18.0-0acb4e1361f6';

export function readingLink(doc, title, source) {
 const url = new URL(source, import.meta.url);
 if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw Error('Invalid reading source URL');
 const link = doc.createElement('a');
 link.textContent = title;
 link.href = url.href;
 link.target = '_blank';
 link.rel = 'noopener noreferrer';
 return link;
}

// PDF locators refer to the original file's pages, even when a publisher also
// supplies a separate project page with bibliographic details.
export function openReadingSource(doc, item, lang) {
 const t = (zh, en) => label({zh, en}, lang);
 const page = item.locator.pdfPages?.[0];
 if (Number.isInteger(page) && page > 0) {
  const url = new URL(item.localURL || item.url, import.meta.url);
  url.hash = 'page=' + page;
  const title = item.localURL
   ? t(`站内 PDF · 第 ${page} 页`, `Saved PDF · page ${page}`)
   : t(`来源 PDF · 第 ${page} 页`, `Source PDF · page ${page}`);
  return readingLink(doc, title, url);
 }
 const source = item.landingURL || item.url;
 const title = /\.csv$/i.test(new URL(source).pathname)
  ? t('查看来源数据（CSV）', 'Open source data (CSV)')
  : t('在来源网站阅读', 'Read on source website');
 return readingLink(doc, title, source);
}
