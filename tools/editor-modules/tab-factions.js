// tools/editor-modules/tab-factions.js

import { state, v, n, esc, syncNum, syncRange, showToast, hslToHex } from './shared.js';

export function renderFactionTab(main) {
  const factions    = state.data.factions?.factions ?? [];
  const selFaction  = factions.find(f => f.id === state.selectedFactionId) ?? null;

  main.innerHTML    = '';
  main.style.padding  = '0';
  main.style.overflow = 'hidden';

  const layout = document.createElement('div');
  layout.style.cssText = 'display:flex;flex:1;overflow:hidden;';

  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-title">勢力（${factions.length}）</span>
      <button class="btn-add" onclick="window.EditorApp.addFaction()">＋</button>
    </div>
    <div class="char-list" id="factionList"></div>`;
  layout.appendChild(sidebar);

  const list = sidebar.querySelector('#factionList');
  factions.forEach(faction => {
    const div = document.createElement('div');
    div.className = 'char-item' + (faction.id === state.selectedFactionId ? ' active' : '');
    div.onclick   = () => { state.selectedFactionId = faction.id; window.EditorApp.renderAll(); };
    div.innerHTML = `
      <div class="char-thumb-ph"
        style="background:${faction.color}20;border-color:${faction.color};color:${faction.color};font-size:9px;font-weight:700">
        ${faction.isPlayer ? 'P' : 'E'}
      </div>
      <div class="char-item-info">
        <div class="char-item-name">${esc(faction.name)}</div>
        <div class="char-item-sub">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${faction.color};flex-shrink:0"></span>
          <span>${faction.color}</span>
          ${faction.isPlayer ? '<span class="badge badge-player">P</span>' : ''}
        </div>
      </div>`;
    list.appendChild(div);
  });

  const editorWrap = document.createElement('div');
  editorWrap.className = 'editor';
  if (!selFaction) {
    editorWrap.innerHTML = '<div class="editor-empty">勢力を選択してください</div>';
  } else {
    editorWrap.appendChild(buildFactionForm(selFaction, factions));
  }
  layout.appendChild(editorWrap);
  main.appendChild(layout);
}

// ----------------------------------------------------------------
// フォーム構築
// ----------------------------------------------------------------
function buildFactionForm(faction, allFactions) {
  const wrap       = document.createElement('div');
  wrap.className   = 'editor-left';
  const ownedChars = (state.data.characters?.characters ?? [])
    .filter(c => c.factionId === faction.id && !c.isTemplate);
  const ownedBases = (state.data.bases?.bases ?? [])
    .filter(b => b.factionId === faction.id);

  const playerWarning = faction.isPlayer
    ? `<div class="faction-warning">⚠ プレイヤー勢力です。isPlayer は true のまま保持してください。</div>`
    : '';

  wrap.innerHTML = `
    ${playerWarning}
    <div class="form-section"><div class="form-section-title">基本情報</div>
      <div class="form-row">
        <div class="form-group w-half"><label>ID</label>
          <input type="text" id="ff_id" value="${esc(faction.id)}" /></div>
        <div class="form-group w-half"><label>勢力名</label>
          <input type="text" id="ff_name" value="${esc(faction.name)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>カラー</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="color" id="ff_colorPicker" value="${faction.color}"
              style="width:40px;height:32px;padding:2px;border:1px solid #30363d;border-radius:4px;background:#0d1117;cursor:pointer"
              oninput="document.getElementById('ff_color').value=this.value" />
            <input type="text" id="ff_color" value="${esc(faction.color)}" style="flex:1"
              oninput="window.EditorApp.syncColorPicker(this)" />
          </div></div>
        <div class="form-group w-half"><label>プレイヤー</label>
          <select id="ff_isPlayer">
            <option value="false" ${!faction.isPlayer?'selected':''}>敵AI</option>
            <option value="true"  ${faction.isPlayer ?'selected':''}>プレイヤー</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>初期ミーム</label>
          <div class="num-wrap">
            <input type="range" min="0" max="2000" step="50" value="${faction.treasury}"
              oninput="window.EditorApp.syncNum(this,'ff_treasury')" />
            <input type="number" id="ff_treasury" value="${faction.treasury}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">所属キャラ（${ownedChars.length}体）</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${ownedChars.length > 0
          ? ownedChars.map(c => `<span style="padding:3px 10px;border-radius:10px;border:1px solid #30363d;background:#0d1117;font-size:11px">${esc(c.name||c.id)}</span>`).join('')
          : '<span style="color:#484f58;font-size:11px">なし</span>'}
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">所属拠点（${ownedBases.length}件）</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${ownedBases.length > 0
          ? ownedBases.map(b => `<span style="padding:3px 10px;border-radius:10px;border:1px solid #30363d;background:#0d1117;font-size:11px">${esc(b.name)}${b.isCapital?' ★':''}</span>`).join('')
          : '<span style="color:#484f58;font-size:11px">なし</span>'}
      </div>
    </div>
    <div class="btn-row">
      ${!faction.isPlayer ? `<button class="btn-danger" onclick="window.EditorApp.deleteFaction()">削除</button>` : ''}
      <button class="btn-primary" onclick="window.EditorApp.saveFaction()">保存</button>
    </div>`;
  return wrap;
}

// ----------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------
export function syncColorPicker(input) {
  const picker = document.getElementById('ff_colorPicker');
  if (picker && /^#[0-9a-fA-F]{6}$/.test(input.value)) picker.value = input.value;
}

export function saveFaction() {
  const factions = state.data.factions.factions;
  const idx = factions.findIndex(f => f.id === state.selectedFactionId); if (idx === -1) return;
  const faction    = factions[idx];
  const oldId      = faction.id;
  const newId      = v('ff_id');
  const newIsPlayer = v('ff_isPlayer') === 'true';

  if (newIsPlayer && factions.some(f => f.id !== oldId && f.isPlayer)) {
    showToast('他にプレイヤー勢力が存在します', true); return;
  }
  faction.id       = newId;
  faction.name     = v('ff_name');
  faction.color    = v('ff_color');
  faction.isPlayer = newIsPlayer;
  faction.treasury = n('ff_treasury');

  if (oldId !== newId) {
    (state.data.characters?.characters ?? []).forEach(c => { if (c.factionId === oldId) c.factionId = newId; });
    (state.data.bases?.bases ?? []).forEach(b => { if (b.factionId === oldId) b.factionId = newId; });
  }
  state.selectedFactionId = newId;
  saveFactionToServer();
}

export function addFaction() {
  const factions = state.data.factions.factions;
  const nums = factions.map(f => parseInt(f.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const newId = `faction_new${String(next).padStart(2, '0')}`;
  const hue   = Math.floor(Math.random() * 360);
  factions.push({ id: newId, name: '新規勢力', color: hslToHex(hue, 65, 55), isPlayer: false, treasury: 300, characters: [] });
  state.selectedFactionId = newId;
  saveFactionToServer();
}

export function deleteFaction() {
  const factions = state.data.factions.factions;
  const faction  = factions.find(f => f.id === state.selectedFactionId); if (!faction) return;
  if (faction.isPlayer) { showToast('プレイヤー勢力は削除できません', true); return; }
  if (!confirm(`「${faction.name}」を削除しますか？`)) return;
  const idx = factions.findIndex(f => f.id === state.selectedFactionId);
  factions.splice(idx, 1);
  state.selectedFactionId = null;
  saveFactionToServer();
}

async function saveFactionToServer() {
  try {
    const [resF, resC, resB] = await Promise.all([
      fetch('/api/save/factions',   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data.factions) }),
      fetch('/api/save/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data.characters) }),
      fetch('/api/save/bases',      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data.bases) }),
    ]);
    const [jF, jC, jB] = await Promise.all([resF.json(), resC.json(), resB.json()]);
    if (jF.ok && jC.ok && jB.ok) showToast('保存しました ✓'); else showToast('保存失敗', true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  window.EditorApp.renderAll();
}
