// tools/editor-modules/tab-map.js

import {
  state, v, n, esc, syncNum, syncRange, showToast,
  MAP_CANVAS_W, MAP_CANVAS_H, MAP_WORLD_W, MAP_WORLD_H,
  w2c, c2w, getFactionColor,
} from './shared.js';

let _mapDrag = null;

export function renderMapTab(main) {
  const bases    = state.data.bases?.bases ?? [];
  const factions = state.data.factions?.factions ?? [];
  const selBase  = bases.find(b => b.id === state.selectedBaseId) ?? null;

  main.innerHTML    = '';
  main.style.padding  = '0';
  main.style.overflow = 'hidden';

  const layout = document.createElement('div');
  layout.className = 'map-layout';

  // サイドバー
  const sidebar = document.createElement('div');
  sidebar.className = 'map-sidebar';
  sidebar.innerHTML = `
    <div class="map-sidebar-header">
      <span class="map-sidebar-title">拠点（${bases.length}件）</span>
      <button class="btn-add" onclick="window.EditorApp.addBase()">＋</button>
    </div>
    <div class="map-base-list" id="mapBaseList"></div>`;
  layout.appendChild(sidebar);

  const list = sidebar.querySelector('#mapBaseList');
  bases.forEach(base => {
    const color = getFactionColor(base.factionId);
    const item  = document.createElement('div');
    item.className = 'map-base-item' + (base.id === state.selectedBaseId ? ' active' : '');
    item.onclick   = () => { state.selectedBaseId = base.id; window.EditorApp.renderAll(); };
    item.innerHTML = `
      <div class="map-base-dot" style="background:${color}"></div>
      <div class="map-base-info">
        <div class="map-base-name">${esc(base.name)}${base.isCapital ? ' <span class="badge badge-capital">本拠地</span>' : ''}${base.dungeonId ? ' 🗝' : ''}</div>
        <div class="map-base-sub">${base.factionId}/収入${base.income}/枠${base.battleCapacity}</div>
      </div>`;
    list.appendChild(item);
  });

  // メインエリア
  const mapMain = document.createElement('div');
  mapMain.className = 'map-main';
  mapMain.innerHTML = `
    <div class="map-visualizer">
      <div class="map-visualizer-title">
        <span>🗺 マップビジュアライザ</span>
        <span style="font-size:10px;color:#484f58;font-weight:400">ドラッグで座標変更</span>
      </div>
      <div class="map-canvas-wrap">
        <canvas id="mapCanvas" width="${MAP_CANVAS_W}" height="${MAP_CANVAS_H}"></canvas>
      </div>
      <div class="map-canvas-hint">ワールド座標（最大 ${MAP_WORLD_W}×${MAP_WORLD_H}）</div>
    </div>`;

  const formArea = document.createElement('div');
  formArea.id = 'mapFormArea';
  if (selBase) {
    formArea.appendChild(buildBaseForm(selBase, bases, factions));
  } else {
    formArea.innerHTML = '<div style="padding:20px 0;color:#484f58;font-size:13px">拠点を選択してください</div>';
  }
  mapMain.appendChild(formArea);
  if (selBase) { _appendBgSection(formArea, selBase); }
  layout.appendChild(mapMain);
  main.appendChild(layout);

  requestAnimationFrame(() => initMapCanvas(bases));
}

// ----------------------------------------------------------------
// フォーム構築
// ----------------------------------------------------------------
function buildBaseForm(base, allBases, factions) {
  const wrap        = document.createElement('div');
  const factionOpts = factions.map(f =>
    `<option value="${f.id}" ${base.factionId === f.id ? 'selected' : ''}>${f.name}</option>`
  ).join('');
  const adjChecks   = allBases.filter(b => b.id !== base.id).map(b => {
    const checked = (base.adjacentBases || []).includes(b.id) ? 'checked' : '';
    const color   = getFactionColor(b.factionId);
    return `<label class="adj-check">
      <input type="checkbox" class="adj-cb" value="${b.id}" ${checked} />
      <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
      ${esc(b.name)}</label>`;
  }).join('');

  const dungeons    = state.data?.dungeons?.dungeons ?? [];
  const dungeonOpts = `<option value="" ${!base.dungeonId ? 'selected' : ''}>なし</option>`
    + dungeons.map(d =>
      `<option value="${esc(d.id)}" ${base.dungeonId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`
    ).join('');

  wrap.innerHTML = `
    <div class="form-section"><div class="form-section-title">基本情報</div>
      <div class="form-row">
        <div class="form-group w-half"><label>ID</label>
          <input type="text" id="fb_id" value="${esc(base.id)}" /></div>
        <div class="form-group w-half"><label>拠点名</label>
          <input type="text" id="fb_name" value="${esc(base.name)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>所属勢力</label>
          <select id="fb_factionId">${factionOpts}</select></div>
        <div class="form-group w-half"><label>本拠地</label>
          <select id="fb_isCapital">
            <option value="false" ${!base.isCapital?'selected':''}>通常</option>
            <option value="true"  ${base.isCapital ?'selected':''}>本拠地</option>
          </select></div>
      </div>
      <div class="form-row"><div class="form-group">
        <label style="color:#c084fc">🗝 紐づく迷宮</label>
        <select id="fb_dungeonId">${dungeonOpts}</select>
      </div></div>
    </div>
    <div class="form-section"><div class="form-section-title">座標・パラメータ</div>
      <div class="form-row">
        <div class="form-group w-half"><label>X</label>
          <input type="number" id="fb_x" value="${base.x}" oninput="window.EditorApp.onBaseCoordChange()" /></div>
        <div class="form-group w-half"><label>Y</label>
          <input type="number" id="fb_y" value="${base.y}" oninput="window.EditorApp.onBaseCoordChange()" /></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>収入</label>
          <div class="num-wrap">
            <input type="range" min="10" max="300" step="5" value="${base.income}"
              oninput="window.EditorApp.syncNum(this,'fb_income')" />
            <input type="number" id="fb_income" value="${base.income}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group w-half"><label>戦闘枠</label>
          <div class="num-wrap">
            <input type="range" min="100" max="2000" step="100" value="${base.battleCapacity}"
              oninput="window.EditorApp.syncNum(this,'fb_battleCapacity')" />
            <input type="number" id="fb_battleCapacity" value="${base.battleCapacity}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">隣接拠点</div>
      <div class="adj-list">${adjChecks || '<span style="color:#484f58;font-size:11px">なし</span>'}</div>
    </div>
    <div class="btn-row">
      <button class="btn-danger"  onclick="window.EditorApp.deleteBase()">削除</button>
      <button class="btn-primary" onclick="window.EditorApp.saveBase()">保存</button>
    </div>`;
  return wrap;
}

// ----------------------------------------------------------------
// Canvas
// ----------------------------------------------------------------
function initMapCanvas(bases) {
  const canvas = document.getElementById('mapCanvas'); if (!canvas) return;
  drawMapCanvas(bases);

  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const hit  = bases.find(b => {
      const { cx: bx, cy: by } = w2c(b.x, b.y);
      return Math.hypot(cx - bx, cy - by) <= 12;
    });
    if (hit) {
      const { cx: bx, cy: by } = w2c(hit.x, hit.y);
      _mapDrag = { baseId: hit.id, offsetX: cx - bx, offsetY: cy - by };
      state.selectedBaseId = hit.id;
      window.EditorApp.renderAll();
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (!_mapDrag) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = Math.max(0, Math.min(MAP_CANVAS_W, e.clientX - rect.left - _mapDrag.offsetX));
    const cy   = Math.max(0, Math.min(MAP_CANVAS_H, e.clientY - rect.top  - _mapDrag.offsetY));
    const { wx, wy } = c2w(cx, cy);
    const base = (state.data.bases?.bases ?? []).find(b => b.id === _mapDrag.baseId);
    if (base) { base.x = wx; base.y = wy; }
    const xEl = document.getElementById('fb_x'); if (xEl) xEl.value = wx;
    const yEl = document.getElementById('fb_y'); if (yEl) yEl.value = wy;
    drawMapCanvas(state.data.bases?.bases ?? []);
  });

  canvas.addEventListener('mouseup',    () => { _mapDrag = null; });
  canvas.addEventListener('mouseleave', () => { _mapDrag = null; });
}

export function drawMapCanvas(bases) {
  const canvas = document.getElementById('mapCanvas'); if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, MAP_CANVAS_W, MAP_CANVAS_H);
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, MAP_CANVAS_W, MAP_CANVAS_H);

  // グリッド
  ctx.strokeStyle = '#1a1f28'; ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const gx = Math.round(MAP_CANVAS_W * i / 10);
    const gy = Math.round(MAP_CANVAS_H * i / 10);
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, MAP_CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(MAP_CANVAS_W, gy); ctx.stroke();
  }

  // 隣接線
  const drawn = new Set();
  bases.forEach(base => {
    const { cx: ax, cy: ay } = w2c(base.x, base.y);
    (base.adjacentBases || []).forEach(adjId => {
      const key = [base.id, adjId].sort().join('|');
      if (drawn.has(key)) return; drawn.add(key);
      const adj = bases.find(b => b.id === adjId); if (!adj) return;
      const { cx: bx, cy: by } = w2c(adj.x, adj.y);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
    });
  });

  // 拠点
  bases.forEach(base => {
    const { cx, cy } = w2c(base.x, base.y);
    const color = getFactionColor(base.factionId);
    const isSel = base.id === state.selectedBaseId;
    const r     = base.isCapital ? 9 : 6;
    if (isSel) {
      ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = color + '40'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = isSel ? '#ffffff' : '#000000'; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
    if (base.isCapital) {
      ctx.fillStyle = '#ffffff'; ctx.font = '9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, cy);
    }
    ctx.fillStyle = '#c9d1d9'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(base.name, cx, cy + r + 3);
    if (base.dungeonId) {
      ctx.fillStyle = '#c084fc'; ctx.font = '8px sans-serif';
      ctx.fillText('🗝', cx + r + 2, cy - r - 2);
    }
  });
}

// ----------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------
export function onBaseCoordChange() {
  const base = (state.data.bases?.bases ?? []).find(b => b.id === state.selectedBaseId); if (!base) return;
  const xVal = parseInt(document.getElementById('fb_x')?.value ?? base.x, 10);
  const yVal = parseInt(document.getElementById('fb_y')?.value ?? base.y, 10);
  if (!isNaN(xVal)) base.x = xVal;
  if (!isNaN(yVal)) base.y = yVal;
  drawMapCanvas(state.data.bases?.bases ?? []);
}

export function saveBase() {
  const bases = state.data.bases.bases;
  const idx   = bases.findIndex(b => b.id === state.selectedBaseId); if (idx === -1) return;
  const base  = bases[idx];
  const oldId = base.id;
  const newId = v('fb_id');

  base.id            = newId;
  base.name          = v('fb_name');
  base.factionId     = v('fb_factionId');
  base.isCapital     = v('fb_isCapital') === 'true';
  base.x             = parseInt(v('fb_x'), 10) || base.x;
  base.y             = parseInt(v('fb_y'), 10) || base.y;
  base.income        = n('fb_income');
  base.battleCapacity = n('fb_battleCapacity');
  base.dungeonId     = v('fb_dungeonId') || null;
  base.bgField  = document.getElementById('fb_bgField')?.value  || null;
  base.bgCastle = document.getElementById('fb_bgCastle')?.value || null;
  delete base.battleBgId;

  const checkedAdj   = [...document.querySelectorAll('.adj-cb:checked')].map(cb => cb.value);
  const uncheckedAdj = [...document.querySelectorAll('.adj-cb:not(:checked)')].map(cb => cb.value);
  base.adjacentBases = checkedAdj;
  checkedAdj.forEach(adjId => {
    const adj = bases.find(b => b.id === adjId);
    if (adj && !adj.adjacentBases.includes(newId)) adj.adjacentBases.push(newId);
  });
  uncheckedAdj.forEach(adjId => {
    const adj = bases.find(b => b.id === adjId);
    if (adj) adj.adjacentBases = adj.adjacentBases.filter(id => id !== oldId && id !== newId);
  });
  if (oldId !== newId) {
    bases.forEach(b => {
      if (b.id !== newId) b.adjacentBases = b.adjacentBases.map(id => id === oldId ? newId : id);
    });
    state.selectedBaseId = newId;
  }
  saveBasesToServer();
}

export function addBase() {
  const bases = state.data.bases.bases;
  const nums  = bases.map(b => parseInt(b.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const next  = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const newId = `base_${String(next).padStart(3, '0')}`;
  bases.push({
    id: newId, name: '新規拠点',
    x: Math.floor(MAP_WORLD_W / 2), y: Math.floor(MAP_WORLD_H / 2),
    factionId: state.data.factions?.factions[0]?.id ?? 'player',
    income: 50, isCapital: false, adjacentBases: [], battleCapacity: 400, dungeonId: null,
  });
  state.selectedBaseId = newId;
  saveBasesToServer();
}

export function deleteBase() {
  if (!confirm('削除しますか？')) return;
  const bases = state.data.bases.bases;
  const idx   = bases.findIndex(b => b.id === state.selectedBaseId); if (idx === -1) return;
  const delId = state.selectedBaseId;
  bases.splice(idx, 1);
  bases.forEach(b => { b.adjacentBases = b.adjacentBases.filter(id => id !== delId); });
  state.selectedBaseId = null;
  saveBasesToServer();
}

async function _appendBgSection(container, base) {
  let images = [];
  try {
    const res = await fetch('/api/battle-backgrounds');
    const json = await res.json();
    images = json.images ?? [];
  } catch {}

  const section = document.createElement('div');
  section.className = 'form-section';
  section.innerHTML = '<div class="form-section-title">🎨 戦闘背景画像</div>';

  // プレビューURLはエディタサーバ経由なので /assets/ プレフィックスで表示
  function toPreviewUrl(saveUrl) {
    if (!saveUrl) return null;
    // saveUrl は /battle_backgrounds/bg_001.jpg 形式
    return saveUrl.startsWith('/assets/') ? saveUrl : `/assets${saveUrl}`;
  }

  function makeImgPreview(saveUrl, id) {
    const previewUrl = toPreviewUrl(saveUrl);
    if (previewUrl) {
      return `<img src="${previewUrl}" style="width:120px;height:68px;object-fit:cover;border-radius:5px;border:1px solid #30363d;display:block;margin-bottom:4px"/>
        <div style="font-size:10px;color:#8b949e">設定中: ${id}</div>`;
    }
    return '<div style="width:120px;height:68px;border:2px dashed #30363d;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#484f58;font-size:11px;margin-bottom:4px">未設定</div>';
  }

  // 野戦・籠城の2フィールドをループで生成
  const fields = [
    { label: '野戦', key: 'bgField',  selId: 'fb_bgField'  },
    { label: '籠城', key: 'bgCastle', selId: 'fb_bgCastle' },
  ];

  for (const field of fields) {
    const subTitle = document.createElement('div');
    subTitle.style.cssText = 'font-size:11px;color:#8b949e;font-weight:700;margin:8px 0 4px;letter-spacing:.06em';
    subTitle.textContent = `[${field.label}]`;
    section.appendChild(subTitle);

    const previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'margin-bottom:8px';
    const currentImg = images.find(img => img.url === base[field.key]);
    previewWrap.innerHTML = makeImgPreview(base[field.key], currentImg?.id ?? '');
    section.appendChild(previewWrap);

    const selRow = document.createElement('div');
    selRow.className = 'form-row';
    const selGroup = document.createElement('div');
    selGroup.className = 'form-group';
    selGroup.innerHTML = '<label>登録済み画像から選択</label>';
    const sel = document.createElement('select');
    sel.id = field.selId;
    sel.innerHTML = '<option value="">（背景なし）</option>' +
      images.map(img =>
        `<option value="${img.url}" ${base[field.key] === img.url ? 'selected' : ''}>${img.id}</option>`
      ).join('');
    sel.onchange = () => {
      base[field.key] = sel.value || null;
      const selected = images.find(i => i.url === sel.value);
      previewWrap.innerHTML = makeImgPreview(sel.value || null, selected?.id ?? '');
    };
    selGroup.appendChild(sel);
    selRow.appendChild(selGroup);
    section.appendChild(selRow);

    const upRow = document.createElement('div');
    upRow.className = 'form-row';
    const upGroup = document.createElement('div');
    upGroup.className = 'form-group';
    upGroup.innerHTML = '<label>新規アップロード（自動採番）</label>';
    const upInput = document.createElement('input');
    upInput.type = 'file'; upInput.accept = 'image/*';
    upInput.style.cssText = 'margin-top:4px;font-size:12px;color:#8b949e';
    upInput.onchange = async () => {
      const file = upInput.files[0]; if (!file) return;
      const fd = new FormData();
      fd.append('file', file, file.name);
      try {
        const r = await fetch('/api/upload/battle-bg', { method: 'POST', body: fd });
        const json = await r.json();
        if (json.ok) {
          const opt = document.createElement('option');
          opt.value = json.url; opt.textContent = json.id; opt.selected = true;
          sel.appendChild(opt);
          images.push({ id: json.id, url: json.url });
          base[field.key] = json.url;
          previewWrap.innerHTML = makeImgPreview(json.url, json.id);
          showToast(`${json.id} をアップロードしました`);
        }
      } catch (e) { showToast('アップロードエラー: ' + e.message, true); }
    };
    upGroup.appendChild(upInput);
    upRow.appendChild(upGroup);
    section.appendChild(upRow);
  }

  const wrap = container.querySelector('div');
  wrap.appendChild(section);
}

async function saveBasesToServer() {
  try {
    const res  = await fetch('/api/save/bases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.bases),
    });
    const json = await res.json();
    if (json.ok) showToast('保存しました ✓'); else showToast('保存失敗', true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  window.EditorApp.renderAll();
}
