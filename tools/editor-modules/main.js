// tools/editor-modules/main.js
// エントリポイント。全タブモジュールをまとめて window.EditorApp に公開する。

import {
  state, TRIGGER_META,
  v, n, esc, syncNum, syncRange, showToast,
  uploadImage, deleteImage, reloadImages,
  switchBonusTab, onBonusNumChange, onBonusRangeChange,
} from './shared.js';

import { renderCharTab, setFilter, addChar, saveChar, duplicateChar, deleteChar, addNameVariant, removeNameVariant } from './tab-characters.js';
import { renderItemTab, saveItem, addItem, deleteItem } from './tab-items.js';
import { renderFactionTab, syncColorPicker, saveFaction, addFaction, deleteFaction } from './tab-factions.js';
import { renderMapTab, onBaseCoordChange, saveBase, addBase, deleteBase } from './tab-map.js';
import {
  renderLegionTab, setLegionFactionFilter, onFreqTypeChange,
  addCharToLegion, removeCharFromLegion,
  updateMobSlotRows, removeMobSlot,
  addDefendBase, removeDefendBase,
  addAttackPriority, removeAttackPriority, movePriority,
  addRetreatOverride, removeRetreatOverride,
  saveLegion, addLegion, deleteLegion,
} from './tab-legions.js';
import { initEventsTab } from './tab-events.js';

// ----------------------------------------------------------------
// タブ切替
// ----------------------------------------------------------------
const TAB_ORDER = ['characters', 'items', 'factions', 'map', 'legions', 'events'];

function switchTab(tab) {
  state.tab        = tab;
  state.selectedId = null;
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', TAB_ORDER[i] === tab);
  });
  if (!state.data) return;
  renderAll();
}

function renderAll() {
  if (!state.data) return;
  const main = document.getElementById('mainArea');
  // マップタブ以外は padding をリセット
  main.style.padding  = '';
  main.style.overflow = '';
  try {
    if      (state.tab === 'characters') renderCharTab(main);
    else if (state.tab === 'items')      renderItemTab(main);
    else if (state.tab === 'factions')   renderFactionTab(main);
    else if (state.tab === 'map')        renderMapTab(main);
    else if (state.tab === 'legions')    renderLegionTab(main);
    else if (state.tab === 'events') {
      main.style.overflow = 'hidden';
      main.style.padding  = '0';
      initEventsTab(main, state.data);
    }
  } catch (err) {
    main.innerHTML = `<div class="error-box"><p style="color:#f85149">描画エラー</p><pre>${err.stack}</pre></div>`;
    console.error(err);
  }
}


// 初期化
// ----------------------------------------------------------------
async function init() {
  try {
    const [dataRes, imgRes] = await Promise.all([
      fetch('/api/data').then(r => { if (!r.ok) throw new Error(`/api/data: HTTP ${r.status}`); return r.json(); }),
      fetch('/api/images').then(r => { if (!r.ok) throw new Error(`/api/images: HTTP ${r.status}`); return r.json(); }),
    ]);
    state.data   = dataRes;
    state.images = imgRes;
    state.selectedTrigger = TRIGGER_META[0].key;

    const factions     = state.data.factions?.factions ?? [];
    const enemyFactions = factions.filter(f => !f.isPlayer);
    if (enemyFactions.length > 0) state.legionFactionFilter = enemyFactions[0].id;

    renderAll();
  } catch (err) {
    document.getElementById('mainArea').innerHTML = `
      <div class="error-box">
        <p style="color:#f85149;font-size:15px">⚠ データの読み込みに失敗しました</p>
        <pre>${err.message}\n\nエディタサーバーが起動しているか確認してください:\n  node tools/editor.js</pre>
      </div>`;
  }
}

// ----------------------------------------------------------------
// window.EditorApp — HTML の onclick から呼ばれるすべての関数
// ----------------------------------------------------------------
window.EditorApp = {
  renderAll,
  switchTab,
  // shared
  syncNum, syncRange, showToast,
  uploadImage, deleteImage,
  switchBonusTab, onBonusNumChange, onBonusRangeChange,
  // characters
  setFilter, addChar, saveChar, duplicateChar, deleteChar,
  addNameVariant, removeNameVariant,
  // items
  saveItem, addItem, deleteItem,
  // factions
  syncColorPicker, saveFaction, addFaction, deleteFaction,
  // map
  onBaseCoordChange, saveBase, addBase, deleteBase,
  // legions
  setLegionFactionFilter, onFreqTypeChange,
  addCharToLegion, removeCharFromLegion,
  updateMobSlotRows, removeMobSlot,
  addDefendBase, removeDefendBase,
  addAttackPriority, removeAttackPriority, movePriority,
  addRetreatOverride, removeRetreatOverride,
  saveLegion, addLegion, deleteLegion,
};

init();
