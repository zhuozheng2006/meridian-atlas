// Re-encode the shipped physical layers into the compact delta+quantised payload that
// public/geography.js decodes at load time (see the compact-geometry region there).
//
// Why: the fine 10 m set is 10.63 MB of gzipped GeoJSON whose coordinates are decimal
// text; text digits compress at ~2.9x, while quantised integer deltas compress at ~5.9x.
// Re-encoding changes no feature, no property and no vertex: only the coordinate digits
// are rounded to 1e-5 deg (<= 5e-6 deg ~ 0.55 m, far below the source's own accuracy and
// below one screen pixel at every zoom the atlas uses).
//
//   node scripts/build-compact-physical.mjs             # dry run: sizes + round-trip audit
//   node scripts/build-compact-physical.mjs --write     # rewrite payloads + inventories
//   node scripts/build-compact-physical.mjs --check     # audit the payloads already on disk
//   node scripts/build-compact-physical.mjs --audit-git # compare disk against git HEAD blobs
//
// The audit decodes every rewritten payload with the *runtime* decoder extracted from
// public/geography.js, so encoder and decoder cannot drift apart unnoticed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PHYS = path.join(ROOT, 'public', 'data', 'physical');
const GEOGRAPHY = path.join(ROOT, 'public', 'geography.js');
export const FORMAT = 'atlas-compact-geojson/1';
export const QUANT = 100000; // units per degree: 1e-5 deg ~ 1.1 m
export const TARGETS = [
  'rivers-10m.json.gz', 'lakes-10m.json.gz', 'land-10m.json.gz', 'modern-ocean-mask.json.gz',
  'physical-overview.json.gz', 'modern-ocean-mask-overview.json.gz'
];

export function runtimeDecoder() {
  const source = fs.readFileSync(GEOGRAPHY, 'utf8');
  const start = source.indexOf('// #region compact-geometry');
  const end = source.indexOf('// #endregion compact-geometry');
  if (start < 0 || end < start) throw Error('public/geography.js has no compact-geometry region');
  return new Function(source.slice(start, end) + '\nreturn compactGeometry;')();
}

const gunzip = file => zlib.gunzipSync(fs.readFileSync(file));
export const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const qr = (v, q) => Math.round(v * q);

export function encodeCompact(fc, q = QUANT) {
  let ox = Infinity, oy = Infinity, rings = 0, vertices = 0;
  const eachRing = fn => {
    for (const f of fc.features) {
      const g = f.geometry, c = g.coordinates;
      if (g.type === 'LineString') fn(c);
      else if (g.type === 'MultiLineString' || g.type === 'Polygon') c.forEach(fn);
      else c.forEach(poly => poly.forEach(fn));
    }
  };
  eachRing(r => { rings++; vertices += r.length; for (const p of r) { if (p[0] < ox) ox = p[0]; if (p[1] < oy) oy = p[1]; } });
  const oqx = qr(ox, q), oqy = qr(oy, q);
  const encRing = r => {
    const out = new Array(r.length * 2);
    let px = 0, py = 0;
    for (let i = 0; i < r.length; i++) {
      const x = qr(r[i][0], q) - oqx, y = qr(r[i][1], q) - oqy;
      if (i === 0) { out[0] = x; out[1] = y; } else { out[i * 2] = x - px; out[i * 2 + 1] = y - py; }
      px = x; py = y;
    }
    return out;
  };
  const features = fc.features.map(f => {
    const g = f.geometry, c = g.coordinates;
    const coords = g.type === 'LineString' ? encRing(c)
      : (g.type === 'MultiLineString' || g.type === 'Polygon') ? c.map(encRing)
        : c.map(poly => poly.map(encRing));
    return [f.properties === undefined ? null : f.properties, g.type, coords];
  });
  const payload = { v: 1, f: FORMAT, q, t: 'FeatureCollection', o: [oqx, oqy], c: features };
  if (Array.isArray(fc.bbox)) payload.b = fc.bbox;
  return { payload, rings, vertices };
}

// Full-value audit: the decoded payload must reproduce every feature, property, ring and
// vertex; coordinates may differ by at most half a quantisation step.
export function audit(original, decoded, q = QUANT) {
  const problems = [];
  if (decoded?.type !== 'FeatureCollection') problems.push('decoded payload is not a FeatureCollection');
  const a = original.features || [], b = decoded.features || [];
  if (a.length !== b.length) problems.push('feature count ' + a.length + ' -> ' + b.length);
  const limit = 1 / (2 * q) + 1e-9;
  let maxDeviation = 0, vertices = 0, rings = 0, properties = 0;
  const eachRing = (f, fn) => {
    const g = f.geometry, c = g.coordinates;
    if (g.type === 'LineString') fn(c);
    else if (g.type === 'MultiLineString' || g.type === 'Polygon') c.forEach(fn);
    else c.forEach(poly => poly.forEach(fn));
  };
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const fa = a[i], fb = b[i];
    if (JSON.stringify(fa.properties) !== JSON.stringify(fb.properties)) problems.push('properties differ at feature ' + i);
    else properties++;
    if (fa.geometry.type !== fb.geometry.type) { problems.push('geometry type differs at feature ' + i); continue; }
    const ra = [], rb = [];
    eachRing(fa, r => ra.push(r)); eachRing(fb, r => rb.push(r));
    if (ra.length !== rb.length) { problems.push('ring count differs at feature ' + i + ': ' + ra.length + ' -> ' + rb.length); continue; }
    for (let k = 0; k < ra.length; k++) {
      rings++;
      if (ra[k].length !== rb[k].length) { problems.push('ring ' + i + '/' + k + ' vertex count ' + ra[k].length + ' -> ' + rb[k].length); continue; }
      for (let j = 0; j < ra[k].length; j++) {
        vertices++;
        const dx = Math.abs(ra[k][j][0] - rb[k][j][0]), dy = Math.abs(ra[k][j][1] - rb[k][j][1]);
        if (dx > maxDeviation) maxDeviation = dx;
        if (dy > maxDeviation) maxDeviation = dy;
        if (dx > limit || dy > limit) problems.push('coordinate ' + i + '/' + k + '/' + j + ' moved ' + Math.max(dx, dy));
      }
    }
  }
  return { problems: problems.slice(0, 6), problemCount: problems.length, maxDeviation, vertices, rings, properties };
}

const read = f => JSON.parse(fs.readFileSync(path.join(PHYS, f), 'utf8'));

function refreshInventories(entries, write) {
  const report = [];
  const oldSha = new Map(), oldGz = new Map(), oldJson = new Map();
  for (const e of entries) {
    oldSha.set(e.oldSha, e.sha256);
    oldGz.set(e.oldBytes, e.bytes);
    oldJson.set(e.oldJsonBytes, e.jsonBytes);
  }
  // files.json inventories every other physical file, the rewritten manifests included,
  // so the manifests are written first and the inventory is refreshed from their new bytes.
  const rewritten = new Map();
  const manifests = ['physical-manifest.json', 'release-manifest.json', 'modern-ocean-mask.manifest.json', 'physical-overview.manifest.json'];
  for (const name of manifests) {
    const target = path.join(PHYS, name);
    const before = fs.readFileSync(target, 'utf8');
    const data = JSON.parse(before);
    let touched = 0;
    const walk = node => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && ['sha256', 'output_sha256', 'input_sha256', 'gzip_sha256', 'sha256_gzip'].includes(key) && oldSha.has(value)) { node[key] = oldSha.get(value); touched++; continue; }
        if (typeof value === 'number' && ['bytes', 'gzip_bytes'].includes(key) && oldGz.has(value)) { node[key] = oldGz.get(value); touched++; continue; }
        if (typeof value === 'number' && ['json_bytes', 'raw_bytes'].includes(key) && oldJson.has(value)) { node[key] = oldJson.get(value); touched++; continue; }
        walk(value);
      }
    };
    walk(data);
    if (name === 'release-manifest.json') {
      const meta = read('files.json');
      data.payload_file_count = Object.keys(meta).length;
      data.payload_bytes = Object.values(meta).reduce((n, m) => n + m.bytes, 0);
      const geometry = data.verification?.geometry;
      if (geometry) {
        geometry.file_count = Object.keys(meta).length;
        geometry.total_bytes = data.payload_bytes;
        for (const e of entries) if (geometry.geometry?.[e.file]) {
          geometry.geometry[e.file].json_bytes = e.jsonBytes;
          geometry.geometry[e.file].bytes = e.bytes;
          geometry.geometry[e.file].encoding = FORMAT + ' q=' + QUANT;
        }
      }
      touched++;
    }
    if (name === 'physical-manifest.json') {
      for (const e of entries) {
        const hit = data.find(x => x.output === e.file);
        if (!hit) continue;
        hit.encoding = FORMAT + ' q=' + QUANT + '; re-encoded in place, no simplification, vertices and properties unchanged';
        touched++;
      }
    }
    const after = JSON.stringify(data, null, 2) + '\n';
    const buffer = Buffer.from(after, 'utf8');
    // The manifest's own bytes/sha256 are inventoried in files.json, so they are recorded
    // whether or not this run changed the file.
    rewritten.set(name, { bytes: buffer.length, sha256: sha(buffer) });
    if (after !== before) {
      if (write) fs.writeFileSync(target, buffer);
      report.push({ file: name, changed: true, replacements: touched });
    } else report.push({ file: name, changed: false, replacements: touched });
  }
  const target = path.join(PHYS, 'files.json');
  const before = fs.readFileSync(target, 'utf8');
  const data = JSON.parse(before);
  for (const e of entries) data[e.file] = { bytes: e.bytes, sha256: e.sha256, json_bytes: e.jsonBytes, encoding: FORMAT + ' q=' + QUANT };
  for (const [name, meta] of rewritten) {
    if (!data[name] || data[name].bytes !== meta.bytes || data[name].sha256 !== meta.sha256) data[name] = { ...data[name], bytes: meta.bytes, sha256: meta.sha256 };
  }
  const after = JSON.stringify(data, null, 2) + '\n';
  if (after !== before) { if (write) fs.writeFileSync(target, after); report.push({ file: 'files.json', changed: true, replacements: entries.length + rewritten.size }); }
  else report.push({ file: 'files.json', changed: false, replacements: 0 });
  return report;
}

function decodeBuffer(decoder, buffer) { return decoder(JSON.parse(zlib.gunzipSync(buffer))); }

async function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  const auditGit = process.argv.includes('--audit-git');
  if ([check, write, auditGit].filter(Boolean).length > 1) throw Error('pick one of --check / --write / --audit-git');
  const decoder = runtimeDecoder();
  const inventory = read('files.json');
  const entries = [];
  const rows = [];
  for (const file of TARGETS) {
    const target = path.join(PHYS, file);
    const compressed = fs.readFileSync(target);
    const record = { file, oldBytes: compressed.length, oldSha: sha(compressed), oldJsonBytes: 0 };
    if (check || auditGit) {
      const decoded = decodeBuffer(decoder, compressed);
      record.jsonBytes = zlib.gunzipSync(compressed).length;
      record.bytes = compressed.length;
      record.sha256 = record.oldSha;
      record.features = decoded?.features?.length ?? null;
      record.problems = [];
      if (check) {
        const meta = inventory[file];
        if (!meta) record.problems.push('missing from files.json');
        else {
          if (meta.bytes !== compressed.length) record.problems.push('bytes ' + meta.bytes + ' != ' + compressed.length);
          if (meta.sha256 !== record.oldSha) record.problems.push('sha256 mismatch');
        }
        if (decoded?.type !== 'FeatureCollection') record.problems.push('payload does not decode to a FeatureCollection');
      }
      if (auditGit) {
        const original = JSON.parse(zlib.gunzipSync(execFileSync('git', ['show', 'HEAD:public/data/physical/' + file], { cwd: ROOT, maxBuffer: 1 << 28 })));
        const result = audit(original, decoded);
        record.problems = result.problems;
        record.problemCount = result.problemCount;
        record.maxDeviation = result.maxDeviation;
        record.vertices = result.vertices;
        record.rings = result.rings;
        record.features = decoded.features.length;
        record.oldJsonBytes = JSON.stringify(original).length;
      }
      rows.push(record);
      continue;
    }
    const parsed = JSON.parse(gunzip(target));
    if (parsed && parsed.v === 1 && Array.isArray(parsed.c)) {
      // Already compact: never re-encode a compact payload (git checkout restores the source).
      record.bytes = compressed.length;
      record.sha256 = record.oldSha;
      record.jsonBytes = zlib.gunzipSync(compressed).length;
      record.oldJsonBytes = record.jsonBytes;
      record.features = parsed.c.length;
      record.alreadyCompact = true;
      entries.push(record);
      rows.push(record);
      continue;
    }
    const original = parsed;
    record.oldJsonBytes = JSON.stringify(original).length;
    const started = Date.now();
    const { payload, rings, vertices } = encodeCompact(original);
    const json = Buffer.from(JSON.stringify(payload), 'utf8');
    const packed = zlib.gzipSync(json, { level: 9 });
    const decoded = decodeBuffer(decoder, packed);
    record.decodeMs = Date.now() - started;
    const result = audit(original, decoded);
    record.bytes = packed.length;
    record.jsonBytes = json.length;
    record.sha256 = sha(packed);
    record.features = original.features.length;
    record.rings = rings;
    record.vertices = vertices;
    record.maxDeviation = result.maxDeviation;
    record.problems = result.problems;
    record.problemCount = result.problemCount;
    if (write && !result.problemCount) fs.writeFileSync(target, packed);
    entries.push(record);
    rows.push(record);
  }
  if (!check && !auditGit) {
    const inventories = refreshInventories(entries, write);
    for (const row of rows) console.log([row.file.padEnd(34), String(row.oldBytes).padStart(9), String(row.bytes).padStart(9), (row.oldBytes / row.bytes).toFixed(2) + 'x', 'json ' + row.oldJsonBytes + '->' + row.jsonBytes, row.alreadyCompact ? 'already compact (inventory refresh only)' : 'dev ' + (row.maxDeviation ?? 0).toExponential(1), (row.problemCount ? 'FAIL ' + row.problems.join('; ') : 'round-trip ok')].join('  '));
    for (const inv of inventories) console.log('inventory', inv.file, inv.changed ? (write ? 'updated' : 'needs update') : 'unchanged', '(' + inv.replacements + ' replacements)');
    if (!write) console.log('dry run: pass --write to rewrite payloads and inventories');
  }
  if (check || auditGit) {
    let bad = 0;
    for (const row of rows) { if (row.problems?.length) { bad++; console.log('FAIL', row.file, row.problems.join('; ')); } }
    console.log(JSON.stringify({ mode: check ? 'check' : 'audit-git', checked: rows.length, failed: bad, files: rows.map(r => ({ file: r.file, bytes: r.bytes, features: r.features, jsonBytes: r.jsonBytes, maxDeviation: r.maxDeviation, vertices: r.vertices })) }, null, 1));
    if (bad) process.exitCode = 1;
  }
  if (rows.some(r => r.problemCount)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
