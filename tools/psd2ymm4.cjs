#!/usr/bin/env node
'use strict';
// PSD -> YMM4形式 変換CLI（PROMPT_psd2ymm4.md 準拠）
// tools/psd_extract.cjs のヘッダ／レイヤーレコードパース・RLE展開・PNGエンコーダを流用。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

if (process.argv.length < 5) {
  console.error('Usage: node tools/psd2ymm4.cjs <psdFile> <charKey> <authorKey>');
  process.exit(1);
}
const psdPath = process.argv[2];
const charKey = process.argv[3];
const authorKey = process.argv[4];

const MAP_PATH = path.join(__dirname, 'psd2ymm4.map.json');
const authorMapAll = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const authorEntry = authorMapAll[authorKey];
if (!authorEntry) {
  console.error(`Unknown authorKey: ${authorKey} (known: ${Object.keys(authorMapAll).join(', ')})`);
  process.exit(1);
}
// map と loose を単一の辞書に統合する。§5-0 のもとでは両者の挙動は同一
// （名前一致のカテゴリ境界判定）なので区別する必要がない。
const rawMap = Object.assign({}, authorEntry.map, authorEntry.loose || {});

// キーを "/" 区切りのセグメント配列にしておく。1セグメント = 葉名一致（どの深さでも可）、
// 2セグメント以上 = 直近の祖先チェーンまで一致させる複合キー（§5-0）。
const mapEntries = Object.entries(rawMap).map(([key, category]) => ({
  segments: key.split('/'),
  category,
}));

function normalize(name) {
  return (name || '').replace(/^[*!＊]+/, '');
}

const CATEGORY_DIRS = ['後', '体', '口', '目', '眉', '顔色', '髪', '他'];

// ---- PSD parse (tools/psd_extract.cjs のロジックを流用。groupPath は使わず
// parentIdx ベースのツリーを構築する) ----
const buf = fs.readFileSync(psdPath);
let off = 0;

const sig = buf.toString('ascii', off, off + 4); off += 4;
if (sig !== '8BPS') { console.error('Not a PSD file'); process.exit(1); }
off += 2; // version
off += 6; // reserved
off += 2; // channels
const canvasH = buf.readUInt32BE(off); off += 4;
const canvasW = buf.readUInt32BE(off); off += 4;
const depth = buf.readUInt16BE(off); off += 2;
off += 2; // color mode
if (depth !== 8) { console.error(`Unsupported depth: ${depth}`); process.exit(1); }

const cmLen = buf.readUInt32BE(off); off += 4; off += cmLen;
const irLen = buf.readUInt32BE(off); off += 4; off += irLen;

const lmiLen = buf.readUInt32BE(off); off += 4;
const liLen = buf.readUInt32BE(off); off += 4;
let layerCount = buf.readInt16BE(off); off += 2;
if (layerCount < 0) layerCount = -layerCount;

const layers = [];
for (let i = 0; i < layerCount; i++) {
  const top = buf.readInt32BE(off); off += 4;
  const left = buf.readInt32BE(off); off += 4;
  const bottom = buf.readInt32BE(off); off += 4;
  const right = buf.readInt32BE(off); off += 4;
  const numCh = buf.readUInt16BE(off); off += 2;
  const channelInfos = [];
  for (let c = 0; c < numCh; c++) {
    const chId = buf.readInt16BE(off); off += 2;
    const chLen = buf.readUInt32BE(off); off += 4;
    channelInfos.push({ id: chId, len: chLen });
  }
  off += 4; // blend sig
  const blendKey = buf.toString('ascii', off, off + 4); off += 4;
  const opacity = buf.readUInt8(off); off += 1;
  off += 1; // clipping
  const flags = buf.readUInt8(off); off += 1;
  off += 1; // filler

  const extraLen = buf.readUInt32BE(off); off += 4;
  const extraEnd = off + extraLen;

  const lmLen = buf.readUInt32BE(off); off += 4; off += lmLen;
  const brLen = buf.readUInt32BE(off); off += 4; off += brLen;

  const nameLen = buf.readUInt8(off); off += 1;
  const rawName = buf.subarray(off, off + nameLen);
  off += nameLen;
  off += (4 - ((1 + nameLen) % 4)) % 4;

  let name;
  try { name = new TextDecoder('shift-jis').decode(rawName); } catch { name = rawName.toString('latin1'); }

  let unicodeName = null;
  let sectionType = null;
  while (off + 12 <= extraEnd) {
    const s = buf.toString('ascii', off, off + 4);
    if (s !== '8BIM' && s !== '8B64') { off = extraEnd; break; }
    off += 4;
    const key = buf.toString('ascii', off, off + 4); off += 4;
    const len = buf.readUInt32BE(off); off += 4;
    const end = off + len + (len % 2);
    if (key === 'luni' && off + 4 <= end) {
      const uniLen = buf.readUInt32BE(off);
      const chars = [];
      for (let u = 0; u < uniLen && off + 4 + (u + 1) * 2 <= end; u++) {
        chars.push(String.fromCharCode(buf.readUInt16BE(off + 4 + u * 2)));
      }
      unicodeName = chars.join('');
    }
    if (key === 'lsct' && off + 4 <= end) {
      sectionType = buf.readUInt32BE(off);
    }
    off = end;
  }
  off = extraEnd;

  const w = right - left;
  const h = bottom - top;
  const visible = !(flags & 2);
  const isGroup = sectionType !== null && sectionType !== 0;
  const isGroupEnd = sectionType === 3;

  layers.push({
    idx: i,
    displayName: unicodeName || name,
    left, top, w, h, opacity, visible,
    blend: blendKey, channelInfos,
    isGroup, isGroupEnd,
    parentIdx: null,
    rgba: null,
  });
}

// §2 の注記どおり、配列を逆順に走査して parentIdx を組む。
{
  const stack = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    if (L.isGroupEnd) {
      stack.pop();
    } else if (L.isGroup) {
      L.parentIdx = stack.length ? stack[stack.length - 1] : null;
      stack.push(i);
    } else {
      L.parentIdx = stack.length ? stack[stack.length - 1] : null;
    }
  }
}
const childrenOf = new Map();
for (const L of layers) {
  if (L.isGroupEnd) continue;
  const key = L.parentIdx === null ? -1 : L.parentIdx;
  if (!childrenOf.has(key)) childrenOf.set(key, []);
  childrenOf.get(key).push(L.idx);
}

// ---- pixel channel decode (psd_extract.cjs と同一ロジック) ----
function decodeChannelData(chInfo, w, h, psdBase) {
  const chunkStart = off;
  const chunkEnd = chunkStart + chInfo.len;
  if (chInfo.len < 2) { off = chunkEnd; return new Uint8Array(0); }
  if (w === 0 || h === 0) { off = chunkEnd; return new Uint8Array(0); }
  const comp = buf.readUInt16BE(off); off += 2;
  const pixelCount = w * h;

  let result;
  if (comp === 0) {
    const raw = buf.subarray(off, off + pixelCount);
    result = Uint8Array.from(raw);
  } else if (comp === 1) {
    const scanlineCounts = [];
    for (let r = 0; r < h; r++) {
      scanlineCounts.push(buf.readUInt16BE(off)); off += 2;
    }
    result = new Uint8Array(pixelCount);
    let destOff = 0;
    for (let r = 0; r < h; r++) {
      const rowEnd = off + scanlineCounts[r];
      while (off < rowEnd && off < chunkEnd && destOff < (r + 1) * w) {
        const n = buf.readInt8(off); off += 1;
        if (n >= 0) {
          const count = n + 1;
          buf.copy(Buffer.from(result.buffer), destOff, off, Math.min(off + count, chunkEnd));
          off += count;
          destOff += count;
        } else if (n > -128) {
          const count = 1 - n;
          const val = buf.readUInt8(off); off += 1;
          result.fill(val, destOff, Math.min(destOff + count, pixelCount));
          destOff += count;
        }
      }
      off = rowEnd;
    }
  } else {
    // 未対応の圧縮方式（ZIP等）。エラー終了せず、警告を出して空チャンネル
    // として扱う（該当レイヤーの当該チャンネルは透明/黒になる）。
    console.error(`[WARN] ${psdBase}: unsupported channel compression (${comp}), treated as blank`);
    result = new Uint8Array(pixelCount);
  }
  // このチャンネルのバイト長は chInfo.len で確定している。内部のRLE計算に
  // ズレがあっても、次のレイヤーの読み出し位置がずれないよう常にここで補正する。
  off = chunkEnd;
  return result;
}

const psdBase = path.basename(psdPath);
for (let i = 0; i < layerCount; i++) {
  const L = layers[i];
  const channels = {};
  for (const ch of L.channelInfos) {
    channels[ch.id] = decodeChannelData(ch, L.w, L.h, psdBase);
  }
  if (L.isGroup || L.isGroupEnd || L.w === 0 || L.h === 0) continue;
  const pixelCount = L.w * L.h;
  const rgba = new Uint8Array(pixelCount * 4);
  const r = channels[0] || new Uint8Array(pixelCount);
  const g = channels[1] || new Uint8Array(pixelCount);
  const b = channels[2] || new Uint8Array(pixelCount);
  const a = channels[-1] || (() => { const arr = new Uint8Array(pixelCount); arr.fill(255); return arr; })();
  for (let p = 0; p < pixelCount; p++) {
    rgba[p * 4] = r[p];
    rgba[p * 4 + 1] = g[p];
    rgba[p * 4 + 2] = b[p];
    rgba[p * 4 + 3] = a[p];
  }
  L.rgba = rgba;
}

// ---- §5-0 マッチング: カテゴリ境界の探索 ----
function matchKey(nodeIdx) {
  const L = layers[nodeIdx];
  const ownName = normalize(L.displayName);
  let best = null; // 最もセグメント数が多い(=具体的な)一致を優先
  for (const entry of mapEntries) {
    const segs = entry.segments;
    if (segs.length === 1) {
      if (ownName === segs[0]) {
        if (!best || segs.length > best.segments.length) best = entry;
      }
      continue;
    }
    // 複合キー: 末尾セグメントから遡って祖先チェーンと一致するか
    let cur = nodeIdx;
    let ok = true;
    for (let s = segs.length - 1; s >= 0; s--) {
      if (cur === null || cur === undefined) { ok = false; break; }
      const curName = normalize(layers[cur].displayName);
      if (curName !== segs[s]) { ok = false; break; }
      cur = layers[cur].parentIdx;
    }
    if (ok) {
      if (!best || segs.length > best.segments.length) best = entry;
    }
  }
  return best ? best.category : null;
}

const diffsByCategory = {}; // category -> [{ name, leafIdxs: [idx...] }]
for (const c of CATEGORY_DIRS) diffsByCategory[c] = [];
const unmatchedWarnings = [];

function sanitizeName(name, fallback) {
  const s = (name || '')
    .replace(/[*＊!]/g, '')
    .replace(/[/\\:?<>|"\s　]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s || fallback;
}

// 有効な可視性: 対象ノードから diffルート(exclusive)までの祖先グループが
// すべて visible=true であること（Photoshopのグループ非表示はカスケードする）。
function collectVisibleLeaves(rootIdx, out) {
  const kids = childrenOf.get(rootIdx) || [];
  for (const cIdx of kids) {
    const C = layers[cIdx];
    if (!C.visible) continue;
    if (C.isGroup) {
      collectVisibleLeaves(cIdx, out);
    } else if (C.w > 0 && C.h > 0) {
      out.push(cIdx);
    }
  }
}

const blendWarnedFor = new Set();
function checkBlendWarnings(leafIdxs, psdBase) {
  for (const idx of leafIdxs) {
    const L = layers[idx];
    if (L.blend !== 'norm' && !blendWarnedFor.has(idx)) {
      blendWarnedFor.add(idx);
      console.error(`[WARN] ${psdBase}: non-norm blend "${L.blend}" on layer "${L.displayName}" (idx ${idx}) -> processed as norm`);
    }
  }
}

function makeDiffFromNode(nodeIdx, psdBase, boundaryName) {
  const L = layers[nodeIdx];
  if (L.isGroup) {
    const leafIdxs = [];
    collectVisibleLeaves(nodeIdx, leafIdxs);
    leafIdxs.sort((a, b) => a - b); // PSDレイヤーID昇順=背面->前面
    checkBlendWarnings(leafIdxs, psdBase);
    return { name: L.displayName, boundaryName, leafIdxs, ownVisible: L.visible };
  }
  if (L.w === 0 || L.h === 0) return null; // 空レイヤーは無視
  checkBlendWarnings([nodeIdx], psdBase);
  return { name: L.displayName, boundaryName, leafIdxs: [nodeIdx], ownVisible: L.visible };
}

function walk(parentKey, psdBase) {
  const kids = childrenOf.get(parentKey) || [];
  for (const idx of kids) {
    const L = layers[idx];
    const category = matchKey(idx);
    if (category) {
      // このノードがカテゴリ境界。直下の各要素が1差分。
      const boundaryChildren = L.isGroup ? (childrenOf.get(idx) || []) : null;
      if (boundaryChildren) {
        for (const childIdx of boundaryChildren) {
          const diff = makeDiffFromNode(childIdx, psdBase, L.displayName);
          if (diff) diffsByCategory[category].push(diff);
        }
      } else {
        // 境界自体が葉レイヤー（例: しのびぃ〜の "前髪"）。それ自体が1差分。
        const diff = makeDiffFromNode(idx, psdBase, null);
        if (diff) diffsByCategory[category].push(diff);
      }
      // 規約4: 境界より深い階層は再探索しない。
      continue;
    }
    if (L.isGroup) {
      walk(idx, psdBase);
    } else if (L.w > 0 && L.h > 0) {
      unmatchedWarnings.push({ psd: psdBase, name: L.displayName, idx });
    }
  }
}

walk(-1, psdBase);

for (const w of unmatchedWarnings) {
  console.error(`[WARN] ${w.psd}: unclassified layer "${w.name}" (idx ${w.idx}) -> excluded`);
}

// ---- PNG合成・出力 ----
function compositeRgba(leafIdxs) {
  const out = new Uint8Array(canvasW * canvasH * 4);
  for (const idx of leafIdxs) {
    const L = layers[idx];
    if (!L.rgba) continue;
    const ox = L.left, oy = L.top;
    for (let y = 0; y < L.h; y++) {
      const cy = oy + y;
      if (cy < 0 || cy >= canvasH) continue;
      for (let x = 0; x < L.w; x++) {
        const cx = ox + x;
        if (cx < 0 || cx >= canvasW) continue;
        const sIdx = (y * L.w + x) * 4;
        const sa = L.rgba[sIdx + 3] / 255;
        if (sa <= 0) continue;
        const dIdx = (cy * canvasW + cx) * 4;
        const da = out[dIdx + 3] / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) continue;
        out[dIdx] = (L.rgba[sIdx] * sa + out[dIdx] * da * (1 - sa)) / outA;
        out[dIdx + 1] = (L.rgba[sIdx + 1] * sa + out[dIdx + 1] * da * (1 - sa)) / outA;
        out[dIdx + 2] = (L.rgba[sIdx + 2] * sa + out[dIdx + 2] * da * (1 - sa)) / outA;
        out[dIdx + 3] = Math.round(outA * 255);
      }
    }
  }
  return out;
}

function encodePng(rgba, w, h) {
  const rawData = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowOff = y * (1 + w * 4);
    rawData[rowOff] = 0;
    rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => {
      rawData[rowOff + 1 + i] = v;
    });
  }
  const compressed = zlib.deflateSync(rawData, { level: 6 });
  const chunks = [];
  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crc = crc32(Buffer.concat([typeB, data]));
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc >>> 0);
    chunks.push(len, typeB, data, crcB);
  }
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeChunk('IHDR', ihdr);
  writeChunk('IDAT', compressed);
  writeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat(chunks);
}
function crc32(b) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) crc = table[(crc ^ b[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const outDir = path.join('public', 'characters', 'ymm4', charKey);
fs.mkdirSync(outDir, { recursive: true });
for (const cat of CATEGORY_DIRS) {
  if (diffsByCategory[cat].length === 0) continue;
  fs.mkdirSync(path.join(outDir, cat), { recursive: true });
}

const usedNames = {};
for (const cat of CATEGORY_DIRS) {
  usedNames[cat] = new Set();
}
const bodyRgbaByFilename = {}; // 体カテゴリのみ、portrait.json の bodyCandidates 測定用に保持
for (const cat of CATEGORY_DIRS) {
  for (const diff of diffsByCategory[cat]) {
    const base = sanitizeName(diff.name, `layer_${diff.leafIdxs[0]}`);
    let filename = base + '.png';
    if (usedNames[cat].has(filename)) {
      // 衝突: 親グループ名を前置して退避する（後勝ち・エラー終了は禁止）。
      const prefixed = diff.boundaryName ? sanitizeName(diff.boundaryName + '_' + diff.name, base) : base;
      filename = prefixed + '.png';
      let n = 2;
      while (usedNames[cat].has(filename)) {
        filename = `${prefixed}_${n}.png`;
        n++;
      }
      console.error(`[WARN] ${psdBase}: filename collision in category "${cat}" for "${diff.name}" -> renamed to ${filename}`);
    }
    usedNames[cat].add(filename);
    diff.filename = filename;
    const rgba = compositeRgba(diff.leafIdxs);
    const png = encodePng(rgba, canvasW, canvasH);
    fs.writeFileSync(path.join(outDir, cat, filename), png);
    if (cat === '体') bodyRgbaByFilename[filename] = rgba;
  }
}

// ---- preset.ini 生成 ----
function pickDefault(diffs, cat) {
  const visibleOnes = diffs.filter((d) => d.ownVisible);
  if (visibleOnes.length >= 1) return visibleOnes[0];
  if (diffs.length > 0) {
    console.error(`[WARN] ${psdBase}: no visible=true diff found in category "${cat}" -> omitted from [デフォルト]`);
  }
  return null;
}

const defaults = {};
for (const cat of CATEGORY_DIRS) {
  defaults[cat] = pickDefault(diffsByCategory[cat], cat);
}

// charKey単位のデフォルト上書き（PSD保存時のvisible状態のブレを補正する）。
// map.json に無いキャラの挙動は変えない。
const override = (authorMapAll.defaultOverride || {})[charKey];
if (override) {
  for (const [cat, filename] of Object.entries(override)) {
    const found = (diffsByCategory[cat] || []).find((d) => d.filename === filename);
    if (found) {
      defaults[cat] = found;
    } else {
      console.error(`[WARN] ${psdBase}: defaultOverride "${cat}=${filename}" not found among converted diffs, ignored`);
    }
  }
}

const lines = [];
lines.push('[デフォルト]');
for (const cat of CATEGORY_DIRS) {
  if (defaults[cat]) lines.push(`${cat}=${defaults[cat].filename}`);
}
lines.push('');

for (const cat of ['目', '口', '眉']) {
  for (const diff of diffsByCategory[cat]) {
    if (defaults[cat] && diff.filename === defaults[cat].filename) continue;
    const sectionName = sanitizeName(diff.name, diff.filename.replace(/\.png$/, ''));
    lines.push(`[${cat}_${sectionName}]`);
    lines.push(`${cat}=${diff.filename}`);
    lines.push('');
  }
}

const iniBody = lines.join('\r\n');
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync(path.join(outDir, 'preset.ini'), Buffer.concat([bom, Buffer.from(iniBody, 'utf8')]));

// ---- portrait.json 生成（PROMPT_portrait_json.md 準拠） ----
// アルファ値1以上のピクセルの外接矩形。right/bottom は半開区間（exclusive）。
function computeAlphaBBox(rgba, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const rowBase = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (rgba[rowBase + x * 4 + 3] >= 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { top: minY, bottom: maxY + 1, left: minX, right: maxX + 1, height: maxY + 1 - minY, width: maxX + 1 - minX };
}

// body は default.体 を使わない（2026-08-19 修正）。体カテゴリ内には
// 素体以外に腕・下着・小物パーツも混在し、default.体 がそれらを指す個体が
// 実在するため。体カテゴリの全PNGを個別に測り、height最大のものを採用する
// （素体は頭頂〜足元を含むため体カテゴリ内で必ず最大高になる）。
const bodyCandidates = [];
for (const diff of diffsByCategory['体']) {
  const rgba = bodyRgbaByFilename[diff.filename];
  const cbox = computeAlphaBBox(rgba, canvasW, canvasH);
  if (cbox) bodyCandidates.push({ file: diff.filename, top: cbox.top, bottom: cbox.bottom, left: cbox.left, right: cbox.right, height: cbox.height, width: cbox.width });
}
if (bodyCandidates.length === 0) {
  console.error(`[ERROR] ${psdBase}: no non-transparent "体" candidate found, cannot compute portrait.json body bbox`);
  process.exit(1);
}
let bbox = bodyCandidates[0];
for (const c of bodyCandidates) {
  if (c.height > bbox.height) bbox = c;
}

const portraitCategories = {};
for (const cat of CATEGORY_DIRS) {
  if (diffsByCategory[cat].length > 0) {
    portraitCategories[cat] = diffsByCategory[cat].map((d) => d.filename);
  }
}
const portraitDefault = {};
for (const cat of CATEGORY_DIRS) {
  if (defaults[cat]) portraitDefault[cat] = defaults[cat].filename;
}

const portrait = {
  charKey,
  author: authorKey,
  canvas: { w: canvasW, h: canvasH },
  body: {
    top: bbox.top,
    bottom: bbox.bottom,
    left: bbox.left,
    right: bbox.right,
    height: bbox.height,
    width: bbox.width,
    touchesTop: bbox.top === 0,
    touchesBottom: bbox.bottom === canvasH,
  },
  drawOrder: CATEGORY_DIRS.slice(),
  categories: portraitCategories,
  default: portraitDefault,
  presets: {},
  bodyCandidates: bodyCandidates.map((c) => ({ file: c.file, top: c.top, bottom: c.bottom, height: c.height })),
};
fs.writeFileSync(path.join(outDir, 'portrait.json'), JSON.stringify(portrait, null, 2));

let totalDiffs = 0;
for (const cat of CATEGORY_DIRS) totalDiffs += diffsByCategory[cat].length;
console.log(`${psdBase} -> ${outDir} : ${totalDiffs} diffs, ${unmatchedWarnings.length} unclassified`);
for (const cat of CATEGORY_DIRS) {
  if (diffsByCategory[cat].length > 0) console.log(`  ${cat}: ${diffsByCategory[cat].length}`);
}
console.log(`  portrait.json: body=${bbox.file} ${bbox.width}x${bbox.height} (canvas ${canvasW}x${canvasH}), touchesBottom=${portrait.body.touchesBottom}, bodyCandidates=${bodyCandidates.length}`);
if (defaults['体'] && defaults['体'].filename !== bbox.file) {
  console.error(`[WARN] ${psdBase}: default "体" (${defaults['体'].filename}) != body file (${bbox.file}) — see PROMPT_portrait_json.md §3-1`);
}
