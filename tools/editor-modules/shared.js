// tools/editor-modules/shared.js

export const state = {
  tab: 'characters',
  data: null,
  images: null,
  selectedId: null,
  charFilter: 'all',
  selectedTrigger: null,
  bonusTab: 'attack',
  selectedBaseId: null,
  selectedFactionId: null,
  legionFactionFilter: null,
  selectedLegionId: null,
};

export const TRIGGER_META = [
  { key: 'turn_start',        label: 'ターン開始',    desc: '各ターン開始時（汎用）' },
  { key: 'low_treasury',      label: 'ミーム不足',    desc: 'ミーム 300 以下' },
  { key: 'high_treasury',     label: 'ミーム潤沢',    desc: 'ミーム 1000 以上' },
  { key: 'few_bases',         label: '拠点少ない',    desc: '拠点数 3 以下' },
  { key: 'many_bases',        label: '拠点多い',      desc: '拠点数 7 以上' },
  { key: 'after_conquest',    label: '拠点制圧後',    desc: '制圧成功直後' },
  { key: 'enemy_approaching', label: '敵が近い',      desc: '隣接拠点に敵あり' },
  { key: 'idle',              label: '待機（汎用）',  desc: '上記に該当しない通常時' },
];

export const RETREAT_OPTIONS = [
  { value: 'loss_25',   label: '損耗25%超で撤退' },
  { value: 'loss_50',   label: '損耗50%超で撤退' },
  { value: 'hp_any',    label: 'HP減少で即撤退' },
  { value: 'char_dead', label: 'キャラ倒れたら撤退' },
  { value: 'never',     label: '撤退しない' },
];

// ----------------------------------------------------------------
// DOM ユーティリティ
// ----------------------------------------------------------------
export function v(id)  { return document.getElementById(id)?.value ?? ''; }
export function n(id)  { return Number(document.getElementById(id)?.value ?? 0); }
export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
export function syncNum(rangeEl, numId) {
  const el = document.getElementById(numId);
  if (el) el.value = rangeEl.value;
}
export function syncRange(numEl) {
  const r = numEl.previousElementSibling;
  if (r?.type === 'range') r.value = numEl.value;
}

// ----------------------------------------------------------------
// Toast
// ----------------------------------------------------------------
let _toastTimer = null;
export function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.className = '', 2800);
}

// ----------------------------------------------------------------
// 画像
// ----------------------------------------------------------------
export function imgPreviewHTML(img, type) {
  return `<div class="img-preview ${type}"><img src="${img.url}?t=${Date.now()}" />
    <button class="img-del" onclick="window.EditorApp.deleteImage('${img.url}','${img.filename}')">✕</button></div>`;
}

export async function uploadImage(input, dest, baseName) {
  const file = input.files[0]; if (!file) return;
  const ext  = file.name.split('.').pop();
  const fd   = new FormData();
  fd.append('dest', dest);
  fd.append('file', new File([file], `${baseName}.${ext}`, { type: file.type }));
  await fetch('/api/upload', { method: 'POST', body: fd });
  await reloadImages();
  showToast('アップロードしました ✓');
  window.EditorApp.renderAll();
}

// 立ち絵専用アップロード: クライアント側 Canvas で長辺 ≤ maxEdge へ縮小・png 化し、
// 正準パス characters/portraits/<charId>.png として保存する（拡大はしない）。
export async function uploadPortrait(input, charId, maxEdge = 1536) {
  const file = input.files[0]; if (!file) return;
  try {
    const blob = await resizeToPngBlob(file, maxEdge);
    const fd   = new FormData();
    fd.append('dest', 'characters/portraits');
    fd.append('file', new File([blob], `${charId}.png`, { type: 'image/png' }));
    await fetch('/api/upload', { method: 'POST', body: fd });
    await reloadImages();
    showToast('アップロードしました ✓');
    window.EditorApp.renderAll();
  } catch (e) {
    console.error('立ち絵アップロード失敗', e);
    showToast('画像の処理に失敗しました: ' + e.message, true);
  }
}

async function resizeToPngBlob(file, maxEdge) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale  = Math.min(1, maxEdge / Math.max(width, height)); // 縮小のみ。拡大しない
  const w = Math.max(1, Math.round(width  * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png'));
}

export async function deleteImage(imgUrl, filename) {
  if (!confirm(`${filename} を削除しますか？`)) return;
  await fetch('/api/delete-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: imgUrl }),
  });
  await reloadImages();
  showToast('削除しました');
  window.EditorApp.renderAll();
}

export async function reloadImages() {
  try {
    state.images = await fetch('/api/images').then(r => r.json());
  } catch (e) {
    console.warn('画像リスト取得失敗', e);
  }
}

// ----------------------------------------------------------------
// マップ座標変換
// ----------------------------------------------------------------
export const MAP_CANVAS_W = 640, MAP_CANVAS_H = 480;
export const MAP_WORLD_W  = 4000, MAP_WORLD_H  = 3000;
const MAP_SX = MAP_CANVAS_W / MAP_WORLD_W;
const MAP_SY = MAP_CANVAS_H / MAP_WORLD_H;
export function w2c(wx, wy) { return { cx: Math.round(wx * MAP_SX), cy: Math.round(wy * MAP_SY) }; }
export function c2w(cx, cy) { return { wx: Math.round(cx / MAP_SX), wy: Math.round(cy / MAP_SY) }; }

export function getFactionColor(factionId) {
  return (state.data?.factions?.factions ?? []).find(f => f.id === factionId)?.color ?? '#555566';
}

// ----------------------------------------------------------------
// battleBonus 共通
// ----------------------------------------------------------------
const BONUS_FIELDS = [
  { id: 'soldierAtk', label: 'SP攻撃力 (soldierAtk)', min: -20, max: 20, isSong: false },
  { id: 'soldierDef', label: 'SP防御力 (soldierDef)', min: -20, max: 20, isSong: false },
  { id: 'charAttack', label: 'キャラ攻撃力 (charAttack)', min: -50, max: 50, isSong: false },
  { id: 'charSong',   label: '歌パラメータ (charSong)',   min: -30, max: 30, isSong: true  },
];

function bonusPanelHTML(type, vals, isDungeon) {
  const empty = { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 };
  vals = { ...empty, ...vals };
  const rows = [];
  for (let i = 0; i < BONUS_FIELDS.length; i += 2) {
    const cells = BONUS_FIELDS.slice(i, i + 2).map(f => {
      const val    = vals[f.id] ?? 0;
      const negCls = val < 0 ? ' negative' : '';
      const sCls   = f.isSong ? ' song-field' : '';
      return `<div class="bonus-field${sCls}"><label>${f.label}</label>
        <div class="bonus-num-wrap">
          <input type="range" min="${f.min}" max="${f.max}" value="${val}"
            oninput="window.EditorApp.onBonusRangeChange(this,'bb_${type}_${f.id}')" />
          <input type="number" id="bb_${type}_${f.id}" value="${val}" min="${f.min}" max="${f.max}"
            class="${negCls}" oninput="window.EditorApp.onBonusNumChange(this)" />
        </div></div>`;
    }).join('');
    rows.push(`<div class="bonus-field-row">${cells}</div>`);
  }
  return (isDungeon ? `<div class="bonus-dungeon-note">⚠ 迷宮戦ボーナス</div>` : '') + rows.join('');
}

export function buildBonusSectionHTML(bonus) {
  const atk = bonus?.attack  ?? {};
  const def = bonus?.defense ?? {};
  const dun = bonus?.dungeon ?? {};
  const tabs = [
    { key: 'attack',  label: '⚔ 攻撃戦', vals: atk, cls: '' },
    { key: 'defense', label: '🛡 防衛戦', vals: def, cls: '' },
    { key: 'dungeon', label: '🗝 迷宮戦', vals: dun, cls: 'dungeon' },
  ];
  return `<div class="bonus-section">
    <div class="form-section-title">戦況別能力補正 (battleBonus)</div>
    <div class="bonus-tabs">${tabs.map(t =>
      `<button class="bonus-tab ${t.cls}${state.bonusTab === t.key ? ' active' : ''}"
        data-btab="${t.key}" onclick="window.EditorApp.switchBonusTab('${t.key}')">${t.label}</button>`
    ).join('')}</div>
    ${tabs.map(t =>
      `<div class="bonus-panel${state.bonusTab === t.key ? ' active' : ''}" data-bpanel="${t.key}">
        ${bonusPanelHTML(t.key, t.vals, t.key === 'dungeon')}
      </div>`
    ).join('')}
  </div>`;
}

export function collectBonusFromForm() {
  const types  = ['attack', 'defense', 'dungeon'];
  const fields = ['soldierAtk', 'soldierDef', 'charAttack', 'charSong'];
  const result = {};
  types.forEach(t => {
    result[t] = {};
    fields.forEach(f => {
      const el = document.getElementById(`bb_${t}_${f}`);
      result[t][f] = el ? Number(el.value) : 0;
    });
  });
  return result;
}

export function switchBonusTab(tab) {
  state.bonusTab = tab;
  document.querySelectorAll('.bonus-tab').forEach(el =>
    el.classList.toggle('active', el.dataset.btab === tab));
  document.querySelectorAll('.bonus-panel').forEach(el =>
    el.classList.toggle('active', el.dataset.bpanel === tab));
}

export function onBonusNumChange(el) {
  el.classList.toggle('negative', Number(el.value) < 0);
  const r = el.previousElementSibling;
  if (r?.type === 'range') r.value = el.value;
}

export function onBonusRangeChange(el, numId) {
  const numEl = document.getElementById(numId); if (!numEl) return;
  numEl.value = el.value;
  numEl.classList.toggle('negative', Number(el.value) < 0);
}

// ----------------------------------------------------------------
// HSL → HEX
// ----------------------------------------------------------------
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k     = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
