// tools/editor-modules/tab-research.js

import { state, v, n, esc, showToast } from './shared.js';

// ----------------------------------------------------------------
// メイン描画
// ----------------------------------------------------------------
export function renderResearchTab(main) {
  const facilities = state.data.facilities ?? { research: [], upgradeCommands: [] };
  const research   = facilities.research ?? [];
  const upgCmds    = facilities.upgradeCommands ?? [];

  main.innerHTML = '';

  const root = document.createElement('div');
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;gap:0;';

  // ── ツールバー ──
  root.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #2a2a2a;flex-shrink:0;">
      <span style="font-weight:700;font-size:13px;color:#ccc;">研究ノード (${research.length})</span>
      <button onclick="window.EditorApp.addResearchNode()" class="btn-add">＋ ノード追加</button>
      <span style="margin-left:16px;font-weight:700;font-size:13px;color:#ccc;">強化コマンド (${upgCmds.length})</span>
      <button onclick="window.EditorApp.addUpgradeCmd()" class="btn-add">＋ コマンド追加</button>
      <button onclick="window.EditorApp.saveResearch()" class="btn-save" style="margin-left:auto;">💾 保存</button>
    </div>
    <div style="display:flex;flex:1;min-height:0;overflow:hidden;">

      <!-- 左: 研究ノード一覧 -->
      <div style="flex:1;overflow-y:auto;padding:12px 16px;border-right:1px solid #2a2a2a;">
        <div style="font-size:10px;color:#888;font-family:monospace;letter-spacing:.12em;margin-bottom:8px;">RESEARCH NODES</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;" id="researchTable">
          <thead>
            <tr style="color:#888;text-align:left;border-bottom:1px solid #333;">
              <th style="padding:5px 6px;">ID</th>
              <th style="padding:5px 6px;">名前</th>
              <th style="padding:5px 6px;">カテゴリ</th>
              <th style="padding:5px 6px;">コスト</th>
              <th style="padding:5px 6px;">T</th>
              <th style="padding:5px 6px;">前提</th>
              <th style="padding:5px 6px;"></th>
            </tr>
          </thead>
          <tbody id="researchTableBody"></tbody>
        </table>
      </div>

      <!-- 右: 強化コマンド一覧 -->
      <div style="flex:0 0 400px;overflow-y:auto;padding:12px 16px;">
        <div style="font-size:10px;color:#888;font-family:monospace;letter-spacing:.12em;margin-bottom:8px;">UPGRADE COMMANDS</div>
        <div id="upgradeCmdList"></div>
      </div>
    </div>
  `;
  main.appendChild(root);

  // 研究ノード行レンダリング
  const tbody = root.querySelector('#researchTableBody');
  research.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid #222;cursor:pointer;';
    tr.onmouseover = () => { tr.style.background = '#1e1e1e'; };
    tr.onmouseout  = () => { tr.style.background = ''; };
    const catColor = r.category === 'engine' ? '#1a8a96' : '#c07010';
    tr.innerHTML = `
      <td style="padding:6px 6px;font-family:monospace;color:#888;font-size:11px;">${esc(r.id)}</td>
      <td style="padding:6px 6px;font-weight:700;color:#e0e0e0;">${esc(r.name)}</td>
      <td style="padding:6px 6px;">
        <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${catColor}22;color:${catColor};">
          ${esc(r.category)}
        </span>
      </td>
      <td style="padding:6px 6px;font-family:monospace;color:#c07010;">${(r.cost ?? 0).toLocaleString()}</td>
      <td style="padding:6px 6px;font-family:monospace;color:#1a8a96;">${r.turns ?? 1}</td>
      <td style="padding:6px 6px;font-size:10px;color:#888;">${(r.prerequisites ?? []).join(', ') || '—'}</td>
      <td style="padding:6px 6px;text-align:right;">
        <button onclick="window.EditorApp.editResearchNode(${idx})"
          style="font-size:10px;padding:2px 8px;border-radius:4px;background:#2a2a2a;border:1px solid #444;color:#ccc;cursor:pointer;">編集</button>
        <button onclick="window.EditorApp.deleteResearchNode(${idx})"
          style="font-size:10px;padding:2px 8px;border-radius:4px;background:#3a1a1a;border:1px solid #6a3333;color:#f87171;cursor:pointer;margin-left:4px;">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 強化コマンド
  const cmdList = root.querySelector('#upgradeCmdList');
  upgCmds.forEach((cmd, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'border:1px solid #2a2a2a;border-radius:8px;padding:10px 12px;margin-bottom:8px;';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-weight:700;color:#e0e0e0;font-size:12px;">${esc(cmd.label)}</span>
        <span style="font-size:10px;color:#888;font-family:monospace;">${esc(cmd.id)}</span>
        <div style="margin-left:auto;display:flex;gap:4px;">
          <button onclick="window.EditorApp.editUpgradeCmd(${idx})"
            style="font-size:10px;padding:2px 8px;border-radius:4px;background:#2a2a2a;border:1px solid #444;color:#ccc;cursor:pointer;">編集</button>
          <button onclick="window.EditorApp.deleteUpgradeCmd(${idx})"
            style="font-size:10px;padding:2px 8px;border-radius:4px;background:#3a1a1a;border:1px solid #6a3333;color:#f87171;cursor:pointer;">削除</button>
        </div>
      </div>
      <div style="font-size:10px;color:#888;line-height:1.5;">
        <span style="color:#1a8a96;">charId:</span> ${esc(cmd.charId)} ·
        <span style="color:#1a8a96;">requires:</span> ${esc(cmd.requiredResearch)} ·
        <span style="color:#c07010;">コスト:</span> ${(cmd.cost ?? 0).toLocaleString()} ·
        <span style="color:#888;">max:</span> ${cmd.maxPurchase ?? '∞'}
      </div>
      <div style="font-size:10px;color:#666;margin-top:4px;">${esc(cmd.desc ?? '')}</div>
    `;
    cmdList.appendChild(div);
  });
}

// ----------------------------------------------------------------
// 研究ノード追加・削除・編集
// ----------------------------------------------------------------
export function addResearchNode() {
  const fac = state.data.facilities ?? { research: [], upgradeCommands: [] };
  fac.research = fac.research ?? [];
  fac.research.push({
    id: `node_${Date.now()}`, name: '新規ノード', category: 'engine',
    cost: 300, turns: 2, description: '',
    prerequisites: [], unlocks: { upgradeCommands: [], flags: [] },
  });
  state.data.facilities = fac;
  window.EditorApp.renderAll();
  window.EditorApp.editResearchNode(fac.research.length - 1);
}

export function deleteResearchNode(idx) {
  if (!confirm('このノードを削除しますか？')) return;
  const fac = state.data.facilities;
  fac.research.splice(idx, 1);
  window.EditorApp.renderAll();
}

export function editResearchNode(idx) {
  const fac      = state.data.facilities ?? { research: [], upgradeCommands: [] };
  const research = fac.research ?? [];
  const allIds   = research.map(r => r.id);
  const node     = research[idx];
  if (!node) return;

  const prereqOptions = allIds
    .filter(id => id !== node.id)
    .map(id => `<option value="${esc(id)}" ${(node.prerequisites ?? []).includes(id) ? 'selected' : ''}>${esc(id)}</option>`)
    .join('');

  const unlockCmdOptions = (fac.upgradeCommands ?? [])
    .map(c => `<option value="${esc(c.id)}" ${(node.unlocks?.upgradeCommands ?? []).includes(c.id) ? 'selected' : ''}>${esc(c.id)}</option>`)
    .join('');

  openModal(`
    <h3 style="margin:0 0 14px;color:#e0e0e0;">研究ノード編集</h3>
    <div class="form-group"><label>ID</label>
      <input id="rId" value="${esc(node.id)}" /></div>
    <div class="form-group"><label>名前</label>
      <input id="rName" value="${esc(node.name)}" /></div>
    <div class="form-group"><label>カテゴリ</label>
      <select id="rCat">
        <option value="engine" ${node.category==='engine'?'selected':''}>engine</option>
        <option value="produce" ${node.category==='produce'?'selected':''}>produce</option>
      </select></div>
    <div style="display:flex;gap:10px;">
      <div class="form-group" style="flex:1;"><label>コスト</label>
        <input id="rCost" type="number" value="${node.cost}" /></div>
      <div class="form-group" style="flex:1;"><label>ターン数</label>
        <input id="rTurns" type="number" value="${node.turns}" /></div>
    </div>
    <div class="form-group"><label>説明</label>
      <textarea id="rDesc" rows="2" style="resize:vertical;">${esc(node.description ?? '')}</textarea></div>
    <div class="form-group"><label>前提研究 (複数選択可)</label>
      <select id="rPrereqs" multiple size="5" style="height:auto;">
        ${prereqOptions}
      </select></div>
    <div class="form-group"><label>アンロックする強化コマンド (複数選択可)</label>
      <select id="rUnlockCmds" multiple size="4" style="height:auto;">
        ${unlockCmdOptions}
      </select></div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button onclick="window.EditorApp._saveResearchNodeModal(${idx})"
        style="flex:1;padding:9px;background:#1a7a50;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:700;">保存</button>
      <button onclick="window.EditorApp._closeModal()"
        style="padding:9px 16px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#ccc;cursor:pointer;">閉じる</button>
    </div>
  `);
}

export function _saveResearchNodeModal(idx) {
  const fac  = state.data.facilities;
  const node = fac.research[idx];
  node.id          = document.getElementById('rId').value.trim();
  node.name        = document.getElementById('rName').value.trim();
  node.category    = document.getElementById('rCat').value;
  node.cost        = parseInt(document.getElementById('rCost').value, 10) || 0;
  node.turns       = parseInt(document.getElementById('rTurns').value, 10) || 1;
  node.description = document.getElementById('rDesc').value.trim();
  node.prerequisites = Array.from(document.getElementById('rPrereqs').selectedOptions).map(o => o.value);
  node.unlocks = {
    upgradeCommands: Array.from(document.getElementById('rUnlockCmds').selectedOptions).map(o => o.value),
    flags: node.unlocks?.flags ?? [],
  };
  window.EditorApp._closeModal();
  window.EditorApp.renderAll();
}

// ----------------------------------------------------------------
// 強化コマンド追加・削除・編集
// ----------------------------------------------------------------
export function addUpgradeCmd() {
  const fac = state.data.facilities ?? { research: [], upgradeCommands: [] };
  fac.upgradeCommands = fac.upgradeCommands ?? [];
  fac.upgradeCommands.push({
    id: `cmd_${Date.now()}`, charId: '', requiredResearch: '',
    label: '新規コマンド', desc: '', cost: 300,
    repeatable: true, maxPurchase: 3, effects: [],
  });
  state.data.facilities = fac;
  window.EditorApp.renderAll();
  window.EditorApp.editUpgradeCmd(fac.upgradeCommands.length - 1);
}

export function deleteUpgradeCmd(idx) {
  if (!confirm('このコマンドを削除しますか？')) return;
  state.data.facilities.upgradeCommands.splice(idx, 1);
  window.EditorApp.renderAll();
}

export function editUpgradeCmd(idx) {
  const fac  = state.data.facilities ?? { research: [], upgradeCommands: [] };
  const cmd  = (fac.upgradeCommands ?? [])[idx];
  if (!cmd) return;

  const researchIds = (fac.research ?? []).map(r => r.id);
  const reqOptions  = researchIds.map(id =>
    `<option value="${esc(id)}" ${cmd.requiredResearch===id?'selected':''}>${esc(id)}</option>`).join('');

  const effectsJson = JSON.stringify(cmd.effects ?? [], null, 2);

  openModal(`
    <h3 style="margin:0 0 14px;color:#e0e0e0;">強化コマンド編集</h3>
    <div class="form-group"><label>ID</label>
      <input id="cId" value="${esc(cmd.id)}" /></div>
    <div class="form-group"><label>charId（対象キャラID）</label>
      <input id="cCharId" value="${esc(cmd.charId)}" /></div>
    <div class="form-group"><label>必要研究</label>
      <select id="cReqRes">${reqOptions}</select></div>
    <div class="form-group"><label>ラベル</label>
      <input id="cLabel" value="${esc(cmd.label)}" /></div>
    <div class="form-group"><label>説明</label>
      <input id="cDesc" value="${esc(cmd.desc ?? '')}" /></div>
    <div style="display:flex;gap:10px;">
      <div class="form-group" style="flex:1;"><label>コスト</label>
        <input id="cCost" type="number" value="${cmd.cost}" /></div>
      <div class="form-group" style="flex:1;"><label>最大購入回数</label>
        <input id="cMaxPurchase" type="number" value="${cmd.maxPurchase ?? ''}" placeholder="空欄=無制限" /></div>
    </div>
    <div class="form-group"><label>エフェクト (JSON配列)</label>
      <textarea id="cEffects" rows="5" style="font-family:monospace;font-size:11px;resize:vertical;">${esc(effectsJson)}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button onclick="window.EditorApp._saveUpgradeCmdModal(${idx})"
        style="flex:1;padding:9px;background:#1a7a50;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:700;">保存</button>
      <button onclick="window.EditorApp._closeModal()"
        style="padding:9px 16px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#ccc;cursor:pointer;">閉じる</button>
    </div>
  `);
}

export function _saveUpgradeCmdModal(idx) {
  const fac = state.data.facilities;
  const cmd = fac.upgradeCommands[idx];
  cmd.id               = document.getElementById('cId').value.trim();
  cmd.charId           = document.getElementById('cCharId').value.trim();
  cmd.requiredResearch = document.getElementById('cReqRes').value;
  cmd.label            = document.getElementById('cLabel').value.trim();
  cmd.desc             = document.getElementById('cDesc').value.trim();
  cmd.cost             = parseInt(document.getElementById('cCost').value, 10) || 0;
  const maxVal = document.getElementById('cMaxPurchase').value.trim();
  cmd.maxPurchase = maxVal === '' ? null : parseInt(maxVal, 10);
  try {
    cmd.effects = JSON.parse(document.getElementById('cEffects').value);
  } catch {
    showToast('エフェクトJSONが不正です', true);
    return;
  }
  window.EditorApp._closeModal();
  window.EditorApp.renderAll();
}

// ----------------------------------------------------------------
// 保存
// ----------------------------------------------------------------
export async function saveResearch() {
  try {
    const res = await fetch('/api/save/facilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.facilities),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('研究データを保存しました');
  } catch (err) {
    showToast(`保存失敗: ${err.message}`, true);
  }
}

// ----------------------------------------------------------------
// モーダルヘルパー
// ----------------------------------------------------------------
function openModal(html) {
  let overlay = document.getElementById('researchModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'researchModalOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.65);
      display:flex;align-items:center;justify-content:center;`;
    overlay.onclick = (e) => { if (e.target === overlay) window.EditorApp._closeModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="background:#181818;border:1px solid #333;border-radius:10px;
      padding:20px 24px;width:min(520px,92vw);max-height:85vh;overflow-y:auto;">
      ${html}
    </div>`;
  overlay.style.display = 'flex';
}

export function _closeModal() {
  const overlay = document.getElementById('researchModalOverlay');
  if (overlay) overlay.style.display = 'none';
}
