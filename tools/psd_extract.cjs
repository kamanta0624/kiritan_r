#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

if (process.argv.length < 4) {
  console.error('Usage: node tools/psd_extract.cjs <psdFile> <charKey>');
  process.exit(1);
}
const psdPath = process.argv[2];
const charKey = process.argv[3];

const outDir = path.join('public', 'characters', 'parts', charKey);
fs.mkdirSync(outDir, { recursive: true });

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

  let groupPath = '';
  if (layers.length > 0) {
    const stack = [];
    for (const prev of layers) {
      if (prev.isGroup) stack.push(prev.displayName);
      if (prev.isGroupEnd) stack.pop();
    }
    groupPath = stack.join('/');
  }

  layers.push({
    idx: i,
    displayName: unicodeName || name,
    left, top, w, h, opacity, visible,
    blend: blendKey, numCh, channelInfos,
    sectionType, isGroup, isGroupEnd, groupPath,
  });
}

function decodeChannelData(chInfo, w, h) {
  if (chInfo.len < 2) { off += chInfo.len; return new Uint8Array(0); }
  if (w === 0 || h === 0) { off += chInfo.len; return new Uint8Array(0); }
  const comp = buf.readUInt16BE(off); off += 2;
  const pixelCount = w * h;

  if (comp === 0) {
    const raw = buf.subarray(off, off + pixelCount);
    off += pixelCount;
    return Uint8Array.from(raw);
  }
  if (comp === 1) {
    const scanlineCounts = [];
    for (let r = 0; r < h; r++) {
      scanlineCounts.push(buf.readUInt16BE(off)); off += 2;
    }
    const result = new Uint8Array(pixelCount);
    let destOff = 0;
    for (let r = 0; r < h; r++) {
      const rowEnd = off + scanlineCounts[r];
      while (off < rowEnd && destOff < (r + 1) * w) {
        const n = buf.readInt8(off); off += 1;
        if (n >= 0) {
          const count = n + 1;
          buf.copy(Buffer.from(result.buffer), destOff, off, off + count);
          off += count;
          destOff += count;
        } else if (n > -128) {
          const count = 1 - n;
          const val = buf.readUInt8(off); off += 1;
          result.fill(val, destOff, destOff + count);
          destOff += count;
        }
      }
      off = rowEnd;
    }
    return result;
  }
  if (comp === 2 || comp === 3) {
    console.error(`ZIP compression encountered at layer offset. Stopping.`);
    process.exit(1);
  }
  console.error(`Unknown compression: ${comp}`);
  process.exit(1);
}

const partsJson = [];
let fileIdx = 0;

for (let i = 0; i < layerCount; i++) {
  const L = layers[i];
  const channels = {};
  for (const ch of L.channelInfos) {
    channels[ch.id] = decodeChannelData(ch, L.w, L.h);
  }

  if (L.isGroup || L.isGroupEnd || L.w === 0 || L.h === 0) {
    partsJson.push({
      id: L.idx,
      name: L.displayName,
      group: L.groupPath,
      left: L.left,
      top: L.top,
      w: L.w,
      h: L.h,
      opacity: L.opacity,
      visible: L.visible,
      file: null,
    });
    continue;
  }

  const sanitized = L.displayName
    .replace(/[*＊]/g, '')
    .replace(/[/\\:?<>|"\s　]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || `layer_${L.idx}`;
  const filename = String(fileIdx).padStart(3, '0') + '_' + sanitized + '.png';
  fileIdx++;

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

  const pngBuf = encodePng(rgba, L.w, L.h);
  fs.writeFileSync(path.join(outDir, filename), pngBuf);

  partsJson.push({
    id: L.idx,
    name: L.displayName,
    group: L.groupPath,
    left: L.left,
    top: L.top,
    w: L.w,
    h: L.h,
    opacity: L.opacity,
    visible: L.visible,
    file: filename,
  });
}

const manifest = {
  canvas: { w: canvasW, h: canvasH },
  layers: partsJson,
};
fs.writeFileSync(path.join(outDir, 'parts.json'), JSON.stringify(manifest, null, 2));
console.log(`Extracted ${fileIdx} layer PNGs + parts.json → ${outDir}`);

function encodePng(rgba, w, h) {
  const rawData = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowOff = y * (1 + w * 4);
    rawData[rowOff] = 0; // filter: None
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk('IHDR', ihdr);
  writeChunk('IDAT', compressed);
  writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat(chunks);
}

function crc32(buf) {
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
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
