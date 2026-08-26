// tools/editor-modules/tab-promotion.js

import { state, esc, showToast } from './shared.js';

const EFFECT_KEYS = [
  { value: 'maxSoldiers',  label: '最大SP' },
  { value: 'soldiers',     label: 'SP' },
  { value: 'charMaxHp',    label: '最大HP' },
  { value: 'strategyRate', label: '戦略率' },
  { value: 'soldierAtk',   label: 'SP攻撃力' },
  { value: 'soldierDef',   label: 'SP防御力' },
  { value: 'charAttack',   label: '攻撃力' },
  { value: 'charDefense',  label: '防御力' },
  { value: 'charSong',     label: '歌唱力' },
  { value: 'attackCount',  label: '攻撃回数' },
  { value: 'recoveryRate', label: '回復率' },
];
const EFFECT_TYPES = ['add', 'mul', 'set'];
const VALID_KEYS = EFFECT_KEYS.map(k => k.value);

// ----------------------------------------------------------------
// メイン描画
// ----------------------------------------------------------------
export function renderPromotionTab(main) {
  const cmds = state.data.promotionCommands ?? [];

  main.innerHTML = '';
  const root = document.createElement('div');
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;gap:0;';

  root.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #2a2a2a;flex-shrink:0;">
      <span style="font-weight:700;font-size:13px;color:#ccc;">プロモーションコマンド (${cmds.length})</span>
      <button onclick="window.EditorApp.addPromotionCommand()" class="btn-add">＋ 追加</button>
      <button onclick="window.EditorApp.savePromotion()" class="btn-save" style="margin-left:auto;">💾 保存</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:12px 16px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;" id="promotionTable">
        <thead>
          <tr style="color:#888;text-align:left;border-bottom:1px solid #333;">
            <th style="padding:5px 6px;">ID</th>
            <th style="padding:5px 6px;">名前</th>
            <th style="padding:5px 6px;">種別</th>
            <th style="padding:5px 6px;">maxUses</th>
            <th style="padding:5px 6px;">効果数</th>
            <th style="padding:5px 6px;"></th>
          </tr>
        </thead>
        <tbody id="promotionTableBody"></tbody>
      </table>
    </div>
  `;
  main.appendChild(root);

  const tbody = root.querySelector('#promotionTableBody');
  cmds.forEach((cmd, idx) => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid #222;cursor:pointer;';
    tr.onmouseover = () => { tr.style.background = '#1e1e1e'; };
    tr.onmouseout  = () => { tr.style.background = ''; };
    const kindLabel = cmd.limited ? '限定' : '汎用';
    const kindColor = cmd.limited ? '#c07010' : '#1a8a96';
    tr.innerHTML = `
      <td style="padding:6px 6px;font-family:monospace;color:#888;font-size:11px;">${esc(cmd.id)}</td>
      <td style="padding:6px 6px;font-weight:700;color:#e0e0e0;">${esc(cmd.name)}</td>
      <td style="padding:6px 6px;">
        <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${kindColor}22;color:${kindColor};">
          ${kindLabel}
        </span>
      </td>
      <td style="padding:6px 6px;font-family:monospace;color:#c07010;">${cmd.limited ? cmd.maxUses : '—'}</td>
      <td style="padding:6px 6px;font-family:monospace;color:#1a8a96;">${cmd.limited ? (cmd.effects ?? []).length : '—'}</td>
      <td style="padding:6px 6px;text-align:right;">
        <button onclick="window.EditorApp.editPromotionCommand(${idx})"
          style="font-size:10px;padding:2px 8px;border-radius:4px;background:#2a2a2a;border:1px solid #444;color:#ccc;cursor:pointer;">編集</button>
        <button onclick="window.EditorApp.deletePromotionCommand(${idx})"
          style="font-size:10px;padding:2px 8px;border-radius:4px;background:#3a1a1a;border:1px solid #6a3333;color:#f87171;cursor:pointer;margin-left:4px;">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------------------
// 追加・削除
// ----------------------------------------------------------------
export function addPromotionCommand() {
  const cmds = state.data.promotionCommands ?? [];
  cmds.push({ id: `promo_${Date.now()}`, name: '新規コマンド', limited: false });
  state.data.promotionCommands = cmds;
  window.EditorApp.renderAll();
  window.EditorApp.editPromotionCommand(cmds.length - 1);
}

export function deletePromotionCommand(idx) {
  if (!confirm('このコマンドを削除しますか？')) return;
  state.data.promotionCommands.splice(idx, 1);
  window.EditorApp.renderAll();
}

// ----------------------------------------------------------------
// 編集モーダル
// ----------------------------------------------------------------
export function editPromotionCommand(idx) {
  const cmds = state.data.promotionCommands ?? [];
  const cmd  = cmds[idx];
  if (!cmd) return;

  const isLimited = cmd.limited === true;
  const effects   = isLimited ? (cmd.effects ?? []) : [];

  openPromoModal(`
    <h3 style="margin:0 0 14px;color:#e0e0e0;">プロモーションコマンド編集</h3>
    <div class="form-group"><label>ID</label>
      <input id="pId" value="${esc(cmd.id)}" /></div>
    <div class="form-group"><label>名前</label>
      <input id="pName" value="${esc(cmd.name)}" /></div>
    <div class="form-group">
      <label><input type="checkbox" id="pLimited" ${isLimited ? 'checked' : ''}
        onchange="window.EditorApp._toggleLimitedFields()" /> 限定コマンド</label>
    </div>
    <div id="pLimitedFields" style="display:${isLimited ? 'block' : 'none'};">
      <div class="form-group"><label>maxUses（最大使用回数）</label>
        <input id="pMaxUses" type="number" min="1" value="${cmd.maxUses ?? 1}" /></div>
      <div class="form-group"><label>効果</label>
        <div id="pEffectsList"></div>
        <button onclick="window.EditorApp._addEffect()"
          style="margin-top:6px;font-size:10px;padding:3px 10px;border-radius:4px;background:#2a2a2a;border:1px solid #444;color:#ccc;cursor:pointer;">＋ 効果追加</button>
      </div>
    </div>
    <div id="pError" style="color:#f85149;font-size:11px;margin-top:8px;display:none;"></div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button onclick="window.EditorApp._savePromotionModal(${idx})"
        style="flex:1;padding:9px;background:#1a7a50;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:700;">保存</button>
      <button onclick="window.EditorApp._closePromoModal()"
        style="padding:9px 16px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#ccc;cursor:pointer;">閉じる</button>
    </div>
  `);

  const list = document.getElementById('pEffectsList');
  effects.forEach(eff => appendEffectRow(list, eff));
}

function appendEffectRow(container, eff = { type: 'add', key: 'maxSoldiers', value: 0 }) {
  const row = document.createElement('div');
  row.className = 'promo-effect-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
  row.innerHTML = `
    <select class="pe-type" style="width:70px;font-size:11px;">
      ${EFFECT_TYPES.map(t => `<option value="${t}" ${eff.type === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
    <select class="pe-key" style="flex:1;font-size:11px;">
      ${EFFECT_KEYS.map(k => `<option value="${k.value}" ${eff.key === k.value ? 'selected' : ''}>${k.label} (${k.value})</option>`).join('')}
    </select>
    <input class="pe-value" type="number" value="${eff.value ?? 0}" style="width:70px;font-size:11px;" />
    <button onclick="this.parentElement.remove()"
      style="font-size:10px;padding:2px 6px;border-radius:4px;background:#3a1a1a;border:1px solid #6a3333;color:#f87171;cursor:pointer;">×</button>
  `;
  container.appendChild(row);
}

export function _addEffect() {
  const list = document.getElementById('pEffectsList');
  if (list) appendEffectRow(list);
}

export function _toggleLimitedFields() {
  const checked = document.getElementById('pLimited')?.checked;
  const fields  = document.getElementById('pLimitedFields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

// ----------------------------------------------------------------
// モーダル保存
// ----------------------------------------------------------------
export function _savePromotionModal(idx) {
  const cmds = state.data.promotionCommands;
  const cmd  = cmds[idx];
  const errEl = document.getElementById('pError');
  errEl.style.display = 'none';

  const id   = document.getElementById('pId').value.trim();
  const name = document.getElementById('pName').value.trim();
  const limited = document.getElementById('pLimited').checked;

  // 空欄チェック
  if (!id || !name) {
    errEl.textContent = 'ID と名前は必須です';
    errEl.style.display = 'block';
    return;
  }

  // ID 重複チェック
  const dup = cmds.find((c, i) => i !== idx && c.id === id);
  if (dup) {
    errEl.textContent = `ID "${id}" は既に使用されています`;
    errEl.style.display = 'block';
    return;
  }

  if (limited) {
    const maxUses = parseInt(document.getElementById('pMaxUses').value, 10);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      errEl.textContent = 'maxUses は 1 以上の整数が必要です';
      errEl.style.display = 'block';
      return;
    }

    const rows = document.querySelectorAll('.promo-effect-row');
    if (rows.length === 0) {
      errEl.textContent = '限定コマンドには効果が1件以上必要です';
      errEl.style.display = 'block';
      return;
    }

    const effects = [];
    for (const row of rows) {
      const type  = row.querySelector('.pe-type').value;
      const key   = row.querySelector('.pe-key').value;
      const value = parseFloat(row.querySelector('.pe-value').value);
      if (!EFFECT_TYPES.includes(type)) {
        errEl.textContent = `不正な type: ${type}`;
        errEl.style.display = 'block';
        return;
      }
      if (!VALID_KEYS.includes(key)) {
        errEl.textContent = `不正な key: ${key}`;
        errEl.style.display = 'block';
        return;
      }
      if (isNaN(value)) {
        errEl.textContent = 'value は数値が必要です';
        errEl.style.display = 'block';
        return;
      }
      effects.push({ type, key, value });
    }

    cmd.id      = id;
    cmd.name    = name;
    cmd.limited = true;
    cmd.maxUses = maxUses;
    cmd.effects = effects;
  } else {
    cmd.id      = id;
    cmd.name    = name;
    cmd.limited = false;
    delete cmd.maxUses;
    delete cmd.effects;
  }

  _closePromoModal();
  window.EditorApp.renderAll();
}

// ----------------------------------------------------------------
// 保存
// ----------------------------------------------------------------
export async function savePromotion() {
  const cmds = state.data.promotionCommands ?? [];

  // 保存前の全体バリデーション
  const ids = new Set();
  for (const cmd of cmds) {
    if (!cmd.id || !cmd.name) {
      showToast(`ID/名前が空のコマンドがあります`, true);
      return;
    }
    if (ids.has(cmd.id)) {
      showToast(`ID "${cmd.id}" が重複しています`, true);
      return;
    }
    ids.add(cmd.id);
    if (cmd.limited) {
      if (!Number.isInteger(cmd.maxUses) || cmd.maxUses < 1) {
        showToast(`"${cmd.name}" の maxUses が不正です`, true);
        return;
      }
      if (!Array.isArray(cmd.effects) || cmd.effects.length === 0) {
        showToast(`"${cmd.name}" に効果が必要です`, true);
        return;
      }
    }
  }

  try {
    const res = await fetch('/api/save/promotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('プロモーションデータを保存しました');
  } catch (err) {
    showToast(`保存失敗: ${err.message}`, true);
  }
}

// ----------------------------------------------------------------
// モーダルヘルパー
// ----------------------------------------------------------------
function openPromoModal(html) {
  let overlay = document.getElementById('promoModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'promoModalOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.65);
      display:flex;align-items:center;justify-content:center;`;
    overlay.onclick = (e) => { if (e.target === overlay) _closePromoModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="background:#181818;border:1px solid #333;border-radius:10px;
      padding:20px 24px;width:min(560px,92vw);max-height:85vh;overflow-y:auto;">
      ${html}
    </div>`;
  overlay.style.display = 'flex';
}

export function _closePromoModal() {
  const overlay = document.getElementById('promoModalOverlay');
  if (overlay) overlay.style.display = 'none';
}
