// tools/editor-modules/tab-legions.js

import { state, v, n, esc, syncNum, syncRange, showToast, RETREAT_OPTIONS } from './shared.js';

export function renderLegionTab(main) {
  main.innerHTML    = '';
  main.style.padding  = '0';
  main.style.overflow = 'hidden';

  const legions  = state.data.legions?.legions ?? [];
  const factions = (state.data.factions?.factions ?? []).filter(f => !f.isPlayer);

  if (!state.legionFactionFilter && factions.length > 0) {
    state.legionFactionFilter = factions[0].id;
  }

  const filteredLegions = legions.filter(l => l.factionId === state.legionFactionFilter);
  const selLegion       = legions.find(l => l.id === state.selectedLegionId) ?? null;

  const layout = document.createElement('div');
  layout.className = 'legion-layout';

  // サイドバー
  const sidebar = document.createElement('div');
  sidebar.className = 'legion-sidebar';
  const factionTabsHTML = factions.map(f =>
    `<button class="legion-faction-tab${state.legionFactionFilter === f.id ? ' active' : ''}"
      style="${state.legionFactionFilter === f.id ? `border-color:${f.color};color:${f.color}` : ''}"
      onclick="window.EditorApp.setLegionFactionFilter('${f.id}')">${esc(f.name)}</button>`
  ).join('');

  sidebar.innerHTML = `
    <div class="legion-sidebar-header">
      <span class="legion-sidebar-title">軍団</span>
      <button class="btn-add" onclick="window.EditorApp.addLegion()">＋</button>
    </div>
    <div class="legion-faction-tabs">
      ${factionTabsHTML || '<span style="color:#484f58;font-size:11px">勢力なし</span>'}
    </div>
    <div class="legion-list" id="legionList"></div>`;
  layout.appendChild(sidebar);

  const list = sidebar.querySelector('#legionList');
  filteredLegions.forEach(legion => {
    const div = document.createElement('div');
    div.className = 'legion-item' + (legion.id === state.selectedLegionId ? ' active' : '');
    div.onclick   = () => { state.selectedLegionId = legion.id; window.EditorApp.renderAll(); };
    const isAttacker = legion.attackPriority?.length > 0;
    div.innerHTML = `
      <div class="legion-item-name">${esc(legion.name)}</div>
      <div class="legion-item-sub">
        ${isAttacker ? '⚔ 侵攻あり' : '🛡 防衛のみ'} /
        キャラ${legion.charIds.length} モブ枠${legion.maxMobSlots} /
        防衛${legion.defendBases?.length ?? 0}都市
      </div>`;
    list.appendChild(div);
  });

  // メインエリア
  const mainArea = document.createElement('div');
  mainArea.className = 'legion-main';
  if (!selLegion) {
    mainArea.innerHTML = '<div style="padding:20px;color:#484f58;font-size:13px">軍団を選択するか ＋ で追加してください</div>';
  } else {
    mainArea.appendChild(buildLegionForm(selLegion));
  }
  layout.appendChild(mainArea);
  main.appendChild(layout);
}

// ----------------------------------------------------------------
// フォーム構築
// ----------------------------------------------------------------
function retreatOpts(val) {
  return RETREAT_OPTIONS.map(o =>
    `<option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
}

export function mobSlotRowHTML(slot, i, templates) {
  const templateOpts = templates.map(t =>
    `<option value="${t.id}" ${slot.templateId === t.id ? 'selected' : ''}>${esc(t.displayName || t.id)}</option>`
  ).join('');
  return `<div class="mob-slot-row" id="ms_${i}">
    <span class="mob-slot-id">スロット${i + 1}</span>
    <select id="ms_tmpl_${i}">${templateOpts}</select>
    <button class="btn-icon" onclick="window.EditorApp.removeMobSlot(${i})">✕</button>
  </div>`;
}

export function attackPriorityRowHTML(bid, i, total, bases) {
  const base = bases.find(b => b.id === bid);
  return `<div class="priority-item" id="pr_${i}">
    <span class="priority-item-num">${i + 1}</span>
    <span class="priority-item-name">${esc(base?.name ?? bid)}</span>
    <span style="font-size:10px;color:#484f58">${base?.factionId ?? ''}</span>
    <button class="priority-btn" onclick="window.EditorApp.movePriority(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
    <button class="priority-btn" onclick="window.EditorApp.movePriority(${i},1)"  ${i === total - 1 ? 'disabled' : ''}>↓</button>
    <button class="btn-icon"     onclick="window.EditorApp.removeAttackPriority(${i})">✕</button>
  </div>`;
}

function buildLegionForm(legion) {
  const wrap         = document.createElement('div');
  const factions     = state.data.factions?.factions ?? [];
  const allChars     = (state.data.characters?.characters ?? []).filter(c => !c.isTemplate);
  const bases        = state.data.bases?.bases ?? [];
  const mobTemplates = (state.data.characters?.characters ?? []).filter(c => c.isTemplate);

  const factionOpts = factions.filter(f => !f.isPlayer).map(f =>
    `<option value="${f.id}" ${legion.factionId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`
  ).join('');

  const freq     = legion.attackFrequency;
  const freqType = freq?.type ?? 'none';

  const defendBaseOverrideHTML = () => {
    const overrides = legion.retreatRule?.onDefendBase ?? {};
    return Object.entries(overrides).map(([baseId, rule], i) => {
      const base = bases.find(b => b.id === baseId);
      return `<div class="retreat-override-row" id="ro_${i}">
        <span style="font-size:11px;color:#c9d1d9;flex:0 0 80px">${esc(base?.name ?? baseId)}</span>
        <span style="font-size:10px;color:#484f58;flex:0 0 56px">${baseId}</span>
        <select id="ro_rule_${i}" style="flex:1">${retreatOpts(rule)}</select>
        <button class="btn-icon" onclick="window.EditorApp.removeRetreatOverride('${baseId}')">✕</button>
      </div>`;
    }).join('');
  };

  const defendedBasesOpts = (legion.defendBases ?? []).map(bid => {
    const b = bases.find(x => x.id === bid);
    return `<option value="${bid}">${esc(b?.name ?? bid)}</option>`;
  }).join('');

  wrap.innerHTML = `
    <!-- 基本情報 -->
    <div class="legion-section">
      <div class="legion-section-title">基本情報</div>
      <div class="form-row">
        <div class="form-group w-half"><label>軍団ID（変更注意）</label>
          <input type="text" id="fl_id" value="${esc(legion.id)}" /></div>
        <div class="form-group w-half"><label>軍団名</label>
          <input type="text" id="fl_name" value="${esc(legion.name)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>所属勢力</label>
          <select id="fl_factionId">${factionOpts}</select></div>
      </div>
    </div>

    <!-- 所属キャラクター -->
    <div class="legion-section">
      <div class="legion-section-title">所属キャラクター（ネームド）</div>
      <div class="tag-list" id="fl_charTags">
        ${legion.charIds.map(id => {
          const c = allChars.find(ch => ch.id === id);
          return `<span class="tag">${esc(c?.name ?? id)}
            <button class="tag-del" onclick="window.EditorApp.removeCharFromLegion('${id}')">✕</button></span>`;
        }).join('')}
      </div>
      <div class="tag-add-row">
        <select id="fl_charAdd">
          <option value="">── キャラクターを選択 ──</option>
          ${allChars
            .filter(c => c.factionId === legion.factionId && !legion.charIds.includes(c.id))
            .map(c => `<option value="${c.id}">${esc(c.name)} (${c.factionId})</option>`).join('')}
        </select>
        <button onclick="window.EditorApp.addCharToLegion()">追加</button>
      </div>
    </div>

    <!-- モブスロット -->
    <div class="legion-section">
      <div class="legion-section-title">モブスロット</div>
      <div class="form-row">
        <div class="form-group w-half"><label>定員（最大モブ数）</label>
          <div class="num-wrap">
            <input type="range" min="0" max="5" value="${legion.maxMobSlots}"
              oninput="window.EditorApp.syncNum(this,'fl_maxMobSlots');window.EditorApp.updateMobSlotRows()" />
            <input type="number" id="fl_maxMobSlots" value="${legion.maxMobSlots}" min="0" max="5"
              oninput="window.EditorApp.syncRange(this);window.EditorApp.updateMobSlotRows()" />
          </div>
        </div>
      </div>
      <div class="mob-slot-list" id="fl_mobSlots">
        ${legion.mobSlots.map((slot, i) => mobSlotRowHTML(slot, i, mobTemplates)).join('')}
      </div>
    </div>

    <!-- 防衛都市 -->
    <div class="legion-section">
      <div class="legion-section-title">防衛都市</div>
      <div class="tag-list" id="fl_defendTags">
        ${(legion.defendBases ?? []).map(bid => {
          const b = bases.find(x => x.id === bid);
          return `<span class="tag">${esc(b?.name ?? bid)}
            <button class="tag-del" onclick="window.EditorApp.removeDefendBase('${bid}')">✕</button></span>`;
        }).join('')}
      </div>
      <div class="tag-add-row">
        <select id="fl_defendAdd">
          <option value="">── 都市を選択 ──</option>
          ${bases
            .filter(b => b.factionId === legion.factionId && !(legion.defendBases ?? []).includes(b.id))
            .map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}
        </select>
        <button onclick="window.EditorApp.addDefendBase()">追加</button>
      </div>
    </div>

    <!-- 侵攻ルート -->
    <div class="legion-section">
      <div class="legion-section-title">侵攻ルート（優先順）</div>
      <div style="font-size:10px;color:#484f58;margin-bottom:8px">↑↓で優先順変更。侵攻しない場合は空のまま。</div>
      <div class="priority-list" id="fl_attackPriority">
        ${(legion.attackPriority ?? []).map((bid, i) =>
          attackPriorityRowHTML(bid, i, legion.attackPriority.length, bases)
        ).join('')}
      </div>
      <div class="tag-add-row">
        <select id="fl_attackAdd">
          <option value="">── 都市を選択 ──</option>
          ${bases
            .filter(b => !(legion.attackPriority ?? []).includes(b.id))
            .map(b => `<option value="${b.id}">${esc(b.name)} (${b.factionId})</option>`).join('')}
        </select>
        <button onclick="window.EditorApp.addAttackPriority()">追加</button>
      </div>
    </div>

    <!-- 侵攻頻度 -->
    <div class="legion-section">
      <div class="legion-section-title">侵攻頻度</div>
      <div class="freq-radio-group" id="fl_freqGroup">
        ${[
          { val: 'none',                    label: '侵攻しない（防衛のみ）' },
          { val: 'every_turn',              label: '毎ターン攻撃' },
          { val: 'interval',                label: 'Nターンおき' },
          { val: 'interval_with_strength',  label: 'Nターンおき＋兵力条件' },
          { val: 'strength_only',           label: '兵力条件のみ' },
        ].map(opt => `
          <div>
            <div class="freq-radio-row">
              <input type="radio" name="fl_freqType" value="${opt.val}" ${freqType === opt.val ? 'checked' : ''}
                onchange="window.EditorApp.onFreqTypeChange()" id="fr_${opt.val}" />
              <label for="fr_${opt.val}" style="color:#c9d1d9;font-size:12px;cursor:pointer">${opt.label}</label>
            </div>
            ${opt.val === 'interval' && freqType === 'interval'
              ? `<div class="freq-params"><label>ターン間隔</label>
                  <input type="number" id="fl_freqTurns" value="${freq?.turns ?? 3}" min="1" max="10" /></div>` : ''}
            ${opt.val === 'interval_with_strength' && freqType === 'interval_with_strength'
              ? `<div class="freq-params">
                  <label>ターン間隔</label><input type="number" id="fl_freqTurns" value="${freq?.turns ?? 2}" min="1" max="10" />
                  <label>最低兵力</label><input type="number" id="fl_freqMinSoldiers" value="${freq?.minSoldiers ?? 500}" min="1" />
                </div>` : ''}
            ${opt.val === 'strength_only' && freqType === 'strength_only'
              ? `<div class="freq-params"><label>最低兵力</label>
                  <input type="number" id="fl_freqMinSoldiers" value="${freq?.minSoldiers ?? 500}" min="1" /></div>` : ''}
          </div>`).join('')}
      </div>
    </div>

    <!-- 撤退ルール -->
    <div class="legion-section">
      <div class="legion-section-title">撤退ルール</div>
      <div class="retreat-grid">
        <label>攻撃時</label>
        <select id="fl_retreatAttack">${retreatOpts(legion.retreatRule?.onAttack ?? 'hp_any')}</select>
        <label>防衛時（デフォルト）</label>
        <select id="fl_retreatDefend">${retreatOpts(legion.retreatRule?.onDefend ?? 'char_dead')}</select>
      </div>
      <div style="margin-top:12px">
        <div style="font-size:10px;color:#8b949e;margin-bottom:6px">都市別上書き（防衛時）</div>
        <div class="retreat-override-list" id="fl_retreatOverrides">${defendBaseOverrideHTML()}</div>
        <div class="tag-add-row" style="margin-top:8px">
          <select id="fl_overrideBaseAdd">
            <option value="">── 都市を選択 ──</option>
            ${defendedBasesOpts}
          </select>
          <button onclick="window.EditorApp.addRetreatOverride()">上書き追加</button>
        </div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn-danger"  onclick="window.EditorApp.deleteLegion()">削除</button>
      <button class="btn-primary" onclick="window.EditorApp.saveLegion()">保存</button>
    </div>`;

  return wrap;
}

// ----------------------------------------------------------------
// 操作系
// ----------------------------------------------------------------
export function setLegionFactionFilter(factionId) {
  state.legionFactionFilter = factionId;
  state.selectedLegionId    = null;
  window.EditorApp.renderAll();
}

function getLegionEditing() {
  return (state.data.legions?.legions ?? []).find(l => l.id === state.selectedLegionId) ?? null;
}

export function buildFrequencyFromForm() {
  const type = document.querySelector('input[name="fl_freqType"]:checked')?.value ?? 'none';
  if (type === 'none')       return null;
  if (type === 'every_turn') return { type };
  if (type === 'interval')   return { type, turns: parseInt(document.getElementById('fl_freqTurns')?.value ?? 3) };
  if (type === 'interval_with_strength') return {
    type,
    turns:       parseInt(document.getElementById('fl_freqTurns')?.value ?? 2),
    minSoldiers: parseInt(document.getElementById('fl_freqMinSoldiers')?.value ?? 500),
  };
  if (type === 'strength_only') return { type, minSoldiers: parseInt(document.getElementById('fl_freqMinSoldiers')?.value ?? 500) };
  return null;
}

export function onFreqTypeChange() {
  const legion = getLegionEditing(); if (!legion) return;
  legion.attackFrequency = buildFrequencyFromForm();
  const mainEl = document.querySelector('.legion-main');
  if (mainEl) { mainEl.innerHTML = ''; mainEl.appendChild(buildLegionForm(legion)); }
}

export function addCharToLegion() {
  const id = document.getElementById('fl_charAdd')?.value; if (!id) return;
  const legion = getLegionEditing(); if (!legion) return;
  if (!legion.charIds.includes(id)) legion.charIds.push(id);
  window.EditorApp.renderAll();
}
export function removeCharFromLegion(id) {
  const legion = getLegionEditing(); if (!legion) return;
  legion.charIds = legion.charIds.filter(x => x !== id);
  window.EditorApp.renderAll();
}

export function updateMobSlotRows() {
  const maxSlots = parseInt(document.getElementById('fl_maxMobSlots')?.value ?? 0);
  const legion   = getLegionEditing(); if (!legion) return;
  legion.maxMobSlots = maxSlots;
  const templates = (state.data.characters?.characters ?? []).filter(c => c.isTemplate);
  while (legion.mobSlots.length < maxSlots) {
    const defaultTmpl = templates[0]?.id ?? 'mob_001';
    legion.mobSlots.push({ slotId: `slot_${legion.mobSlots.length + 1}`, templateId: defaultTmpl, charId: null, respawnIn: null });
  }
  while (legion.mobSlots.length > maxSlots) legion.mobSlots.pop();
  const listEl = document.getElementById('fl_mobSlots');
  if (listEl) listEl.innerHTML = legion.mobSlots.map((s, i) => mobSlotRowHTML(s, i, templates)).join('');
}
export function removeMobSlot(i) {
  const legion = getLegionEditing(); if (!legion) return;
  legion.mobSlots.splice(i, 1);
  legion.maxMobSlots = legion.mobSlots.length;
  window.EditorApp.renderAll();
}

export function addDefendBase() {
  const id = document.getElementById('fl_defendAdd')?.value; if (!id) return;
  const legion = getLegionEditing(); if (!legion) return;
  if (!legion.defendBases) legion.defendBases = [];
  if (!legion.defendBases.includes(id)) legion.defendBases.push(id);
  window.EditorApp.renderAll();
}
export function removeDefendBase(id) {
  const legion = getLegionEditing(); if (!legion) return;
  legion.defendBases = (legion.defendBases ?? []).filter(x => x !== id);
  if (legion.retreatRule?.onDefendBase) delete legion.retreatRule.onDefendBase[id];
  window.EditorApp.renderAll();
}

export function addAttackPriority() {
  const id = document.getElementById('fl_attackAdd')?.value; if (!id) return;
  const legion = getLegionEditing(); if (!legion) return;
  if (!legion.attackPriority) legion.attackPriority = [];
  if (!legion.attackPriority.includes(id)) legion.attackPriority.push(id);
  window.EditorApp.renderAll();
}
export function removeAttackPriority(i) {
  const legion = getLegionEditing(); if (!legion) return;
  legion.attackPriority.splice(i, 1);
  window.EditorApp.renderAll();
}
export function movePriority(i, dir) {
  const legion = getLegionEditing(); if (!legion) return;
  const arr    = legion.attackPriority;
  const j      = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  window.EditorApp.renderAll();
}

export function addRetreatOverride() {
  const baseId = document.getElementById('fl_overrideBaseAdd')?.value; if (!baseId) return;
  const legion = getLegionEditing(); if (!legion) return;
  if (!legion.retreatRule.onDefendBase) legion.retreatRule.onDefendBase = {};
  if (!legion.retreatRule.onDefendBase[baseId]) legion.retreatRule.onDefendBase[baseId] = 'never';
  window.EditorApp.renderAll();
}
export function removeRetreatOverride(baseId) {
  const legion = getLegionEditing(); if (!legion) return;
  delete legion.retreatRule.onDefendBase[baseId];
  window.EditorApp.renderAll();
}

export function saveLegion() {
  const legions = state.data.legions?.legions ?? [];
  const idx     = legions.findIndex(l => l.id === state.selectedLegionId); if (idx === -1) return;
  const legion  = legions[idx];

  legion.id        = v('fl_id');
  legion.name      = v('fl_name');
  legion.factionId = v('fl_factionId');

  const templates = (state.data.characters?.characters ?? []).filter(c => c.isTemplate);
  const maxSlots  = parseInt(v('fl_maxMobSlots') || '0');
  legion.maxMobSlots = maxSlots;
  const newSlots  = [];
  for (let i = 0; i < maxSlots; i++) {
    const tmplId   = document.getElementById(`ms_tmpl_${i}`)?.value ?? (templates[0]?.id ?? 'mob_001');
    const existing = legion.mobSlots[i] ?? { slotId: `slot_${i + 1}`, charId: null, respawnIn: null };
    newSlots.push({ slotId: existing.slotId, templateId: tmplId, charId: existing.charId, respawnIn: existing.respawnIn });
  }
  legion.mobSlots = newSlots;

  legion.attackFrequency    = buildFrequencyFromForm();
  legion.retreatRule.onAttack = v('fl_retreatAttack') || 'hp_any';
  legion.retreatRule.onDefend = v('fl_retreatDefend') || 'char_dead';

  document.querySelectorAll('.retreat-override-row').forEach(row => {
    const baseIdCell = row.querySelector('span:nth-child(2)');
    const ruleSel    = row.querySelector('select');
    if (baseIdCell && ruleSel) {
      const bid = baseIdCell.textContent.trim();
      legion.retreatRule.onDefendBase[bid] = ruleSel.value;
    }
  });

  state.selectedLegionId = legion.id;
  saveLegionsToServer();
}

export function addLegion() {
  const legions    = state.data.legions?.legions ?? [];
  const factionId  = state.legionFactionFilter ?? 'faction_red';
  const nums       = legions.filter(l => l.factionId === factionId)
    .map(l => parseInt(l.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const next  = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const newId = `legion_${factionId}_${String(next).padStart(2, '0')}`;
  legions.push({
    id: newId, name: '新規軍団', factionId,
    charIds: [], mobSlots: [], maxMobSlots: 0,
    attackPriority: [], defendBases: [],
    attackFrequency: null,
    retreatRule: { onAttack: 'hp_any', onDefend: 'char_dead', onDefendBase: {} },
  });
  state.selectedLegionId = newId;
  saveLegionsToServer();
}

export function deleteLegion() {
  if (!confirm('この軍団を削除しますか？')) return;
  const legions = state.data.legions?.legions ?? [];
  const idx     = legions.findIndex(l => l.id === state.selectedLegionId); if (idx === -1) return;
  legions.splice(idx, 1);
  state.selectedLegionId = null;
  saveLegionsToServer();
}

async function saveLegionsToServer() {
  try {
    const res  = await fetch('/api/save/legions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.legions),
    });
    const json = await res.json();
    if (json.ok) showToast('軍団データを保存しました ✓'); else showToast('保存失敗: ' + (json.error || '不明'), true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  window.EditorApp.renderAll();
}
