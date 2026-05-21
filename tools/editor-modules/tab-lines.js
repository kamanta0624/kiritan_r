// tools/editor-modules/tab-lines.js

import { state, TRIGGER_META, esc, showToast } from './shared.js';

export function renderLinesTab(main) {
  main.innerHTML = '';
  main.style.padding  = '0';
  main.style.overflow = 'hidden';

  const cl = state.data.companionLines;
  if (!cl) {
    main.innerHTML = '<div class="editor-empty">companion_lines.json が読み込めません</div>';
    return;
  }

  const playerChars = (state.data.characters?.characters ?? [])
    .filter(c => c.factionId === 'player' && !c.isTemplate);

  const layout = document.createElement('div');
  layout.className = 'lines-layout';

  // サイドバー（トリガー一覧）
  const sidebar = document.createElement('div');
  sidebar.className = 'lines-sidebar';
  sidebar.innerHTML = '<div style="padding:10px 14px;border-bottom:1px solid #30363d;font-size:11px;color:#8b949e;font-weight:600">トリガー</div>';
  TRIGGER_META.forEach(meta => {
    const item = document.createElement('div');
    item.className = 'trigger-item' + (state.selectedTrigger === meta.key ? ' active' : '');
    item.innerHTML = `<div class="trigger-label">${meta.label}</div><div class="trigger-key">${meta.key}</div>`;
    item.onclick   = () => { state.selectedTrigger = meta.key; window.EditorApp.renderAll(); };
    sidebar.appendChild(item);
  });
  layout.appendChild(sidebar);

  // メインエリア
  const mainArea    = document.createElement('div');
  mainArea.className = 'lines-main';
  const triggerKey  = state.selectedTrigger;
  const meta        = TRIGGER_META.find(m => m.key === triggerKey);
  const triggerData = cl.triggers?.[triggerKey] ?? {};

  mainArea.innerHTML = `
    <div style="margin-bottom:18px">
      <div style="font-size:15px;color:#c9d1d9;font-weight:500;margin-bottom:4px">${meta?.label ?? triggerKey}</div>
      <div style="font-size:12px;color:#484f58">${meta?.desc ?? ''}</div>
    </div>`;

  playerChars.forEach(char => {
    const lines   = triggerData[char.id] ?? [];
    const section = document.createElement('div');
    section.className = 'char-section';
    const hue = [...char.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    section.innerHTML = `
      <div class="char-section-header">
        <div class="char-avatar" style="background:hsl(${hue},45%,25%);color:hsl(${hue},70%,70%)">${char.name.charAt(0)}</div>
        <span class="char-section-name">${esc(char.name)}</span>
        <span class="char-section-role">${char.role}/${char.attackType}</span>
      </div>
      <div class="line-rows" id="lines_${char.id}">
        ${lines.map((line, i) => lineRowHTML(char.id, i, line)).join('')}
      </div>
      <button class="btn-add-line" onclick="window.EditorApp.addLineRow('${char.id}')">＋ セリフを追加</button>`;
    mainArea.appendChild(section);
  });

  const saveRow = document.createElement('div');
  saveRow.className  = 'lines-save-row';
  saveRow.innerHTML  = `<button class="btn-primary" onclick="window.EditorApp.saveLines()">保存</button>`;
  mainArea.appendChild(saveRow);

  layout.appendChild(mainArea);
  main.appendChild(layout);
}

// ----------------------------------------------------------------
// 行ヘルパー
// ----------------------------------------------------------------
function lineRowHTML(charId, idx, text) {
  return `<div class="line-row" id="lr_${charId}_${idx}">
    <span class="line-num">${idx + 1}</span>
    <textarea class="line-input" data-char="${charId}" data-idx="${idx}" rows="2">${esc(text)}</textarea>
    <button class="btn-icon" onclick="window.EditorApp.removeLineRow('${charId}',${idx})" style="margin-top:6px">✕</button>
  </div>`;
}

function renumberLines(charId) {
  const wrap = document.getElementById(`lines_${charId}`); if (!wrap) return;
  [...wrap.querySelectorAll('.line-row')].forEach((row, i) => {
    row.id = `lr_${charId}_${i}`;
    const num = row.querySelector('.line-num'); if (num) num.textContent = i + 1;
    const ta  = row.querySelector('.line-input'); if (ta) ta.dataset.idx = i;
    const btn = row.querySelector('.btn-icon');
    if (btn) btn.setAttribute('onclick', `window.EditorApp.removeLineRow('${charId}',${i})`);
  });
}

export function addLineRow(charId) {
  const wrap = document.getElementById(`lines_${charId}`); if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', lineRowHTML(charId, wrap.children.length, ''));
  renumberLines(charId);
}

export function removeLineRow(charId, idx) {
  document.getElementById(`lr_${charId}_${idx}`)?.remove();
  renumberLines(charId);
}

export function saveLines() {
  const triggerKey = state.selectedTrigger;
  const cl = state.data.companionLines;
  if (!cl.triggers) cl.triggers = {};

  const newData = {};
  document.querySelectorAll('.line-input').forEach(ta => {
    const charId = ta.dataset.char;
    if (!newData[charId]) newData[charId] = [];
    const text = ta.value.trim();
    if (text) newData[charId].push(text);
  });
  cl.triggers[triggerKey] = { ...(cl.triggers[triggerKey] ?? {}), ...newData };
  saveLinesCompanionToServer();
}

async function saveLinesCompanionToServer() {
  try {
    const res  = await fetch('/api/save/companion-lines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.companionLines),
    });
    const json = await res.json();
    if (json.ok) showToast('保存しました ✓'); else showToast('保存失敗', true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  window.EditorApp.renderAll();
}
