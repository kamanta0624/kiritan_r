/**
 * tools/editor-modules/tab-events.js
 * v5: UX大改修 - チャプターフィルタ/フラグ補完/キャラ勢力別/右ペイン拡大/依存グラフ
 */

import { showToast } from './shared.js';

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------

const CONDITION_TYPES = [
  { value: 'turn',             label: 'ターン数',                params: ['op:比較(gte/lte/eq)', 'value:値'] },
  { value: 'flag',             label: 'フラグ成立',              params: ['flag:フラグ名'] },
  { value: 'noFlag',           label: 'フラグ未成立',            params: ['flag:フラグ名'] },
  { value: 'hasChar',          label: 'キャラ配下',              params: ['charId:キャラID'] },
  { value: 'baseOwned',        label: '拠点所有',                params: ['baseId:拠点ID'] },
  { value: 'atWar',            label: '交戦中',                  params: ['factionId:勢力ID'] },
  { value: 'noOther',          label: '他イベント非成立',        params: ['eventIds:イベントID(カンマ区切り)'] },
  { value: 'attackerFaction',  label: '攻撃側勢力',              params: ['factionId:攻撃側勢力ID'] },
  { value: 'defenderFaction',  label: '防衛側勢力',              params: ['factionId:防衛側勢力ID'] },
  { value: 'baseConquered',    label: '拠点制圧済み',            params: ['baseId:拠点ID', 'factionId:制圧した勢力ID'] },
  { value: 'turnAfterFlag',    label: 'フラグ成立からNターン後', params: ['flag:フラグ名', 'value:ターン数'] },
  { value: 'defeatedChar',     label: '特定キャラを撃破済み',    params: ['charId:キャラID'] },
];

const EFFECT_TYPES = [
  { value: 'treasury',          label: 'ミーム増減' },
  { value: 'charJoin',          label: 'キャラ加入' },
  { value: 'charLeave',         label: 'キャラ離脱' },
  { value: 'charParam',         label: 'キャラパラメータ変更' },
  { value: 'charUsedThisTurn',  label: 'キャラ行動済みにする' },
  { value: 'baseIncome',        label: '拠点収入増減' },
  { value: 'battleCap',         label: '戦闘規模増減' },
  { value: 'dungeonUnlock',     label: '迷宮解放' },
  { value: 'warFlag',           label: '交戦フラグ変化' },
  { value: 'itemGain',          label: 'アイテム入手' },
  { value: 'itemLose',          label: 'アイテム喪失' },
  { value: 'setFlag',           label: 'フラグ設定' },
  { value: 'clearFlag',         label: 'フラグ解除' },
  { value: 'setFlagWithTurn',   label: 'フラグ設定（ターン記録）' },
  { value: 'legionUpdate',      label: '軍団設定変更' },
  { value: 'baseTransfer',      label: '拠点所有権移行（勢力一括）' },
  { value: 'attackUnlock',      label: '攻撃可能フラグ設定' },
  { value: 'legionForceAttack', label: '軍団全体に攻撃命令' },
  { value: 'actionPointsBonus', label: '行動力上限増加' },
];

const CHAR_PARAM_FIELDS = [
  { value: 'soldiers',    label: 'ミーム（兵士）数' },
  { value: 'maxSoldiers', label: 'ミーム（兵士）上限' },
  { value: 'charHp',      label: 'キャラHP' },
  { value: 'charMaxHp',   label: 'キャラHP上限' },
  { value: 'charAttack',  label: 'キャラ攻撃力' },
  { value: 'charSong',    label: 'キャラ歌唱力' },
  { value: 'soldierAtk',  label: 'ミーム攻撃力' },
  { value: 'soldierDef',  label: 'ミーム防御力' },
];

const TRIGGER_OPTIONS = [
  { value: 'game_start',          label: 'ゲーム開始' },
  { value: 'player_turn',         label: '自軍ターン開始' },
  { value: 'enemy_turn',          label: '敵軍ターン開始' },
  { value: 'base_visit',          label: '拠点訪問時' },
  { value: 'base_attack',         label: '拠点攻撃時' },
  { value: 'base_defense',        label: '拠点防衛時' },
  { value: 'before_faction_turn', label: '特定勢力ターン行動前' },
  { value: 'base_conquered',      label: '拠点制圧時' },
  { value: 'turn_start',          label: 'ターン冒頭（全勢力共通）' },
];

const SCRIPT_STEP_TYPES = [
  { value: 'text',         label: 'セリフ' },
  { value: 'narration',    label: '地の文' },
  { value: 'choice',       label: '選択肢' },
  { value: 'conversation', label: '会話（複数セリフ）' },
  { value: 'end',          label: '終了' },
];

const CHAPTER_LABELS = {
  system:       'システム',
  ch01_tohoku:  'CH01 東北',
  ch02_saitama: 'CH02 埼玉',
  defeated:     '敗北後',
  placeholder:  'プレースホルダー',
};
const CHAPTER_ORDER = ['system', 'ch01_tohoku', 'ch02_saitama', 'defeated', 'placeholder'];

// ----------------------------------------------------------------
// 状態
// ----------------------------------------------------------------

let _events        = [];
let _selIdx        = -1;
let _container     = null;
let _data          = null;
let _filterChapter = 'all';
let _filterTrigger = 'all';
let _showFlagPanel = false;
let _flagListEl    = null;

// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------

export async function initEventsTab(container, data) {
  _container = container;
  _data      = data;
  await _loadEvents();
  _render();
}

async function _loadEvents() {
  try {
    const res = await fetch('/api/events');
    const json = await res.json();
    _events = json.events ?? [];
  } catch {
    _events = [];
  }
}

// ----------------------------------------------------------------
// 保存
// ----------------------------------------------------------------

async function _save() {
  try {
    await fetch('/api/save/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: _events }),
    });
    showToast('イベントを保存しました');
  } catch {
    showToast('保存に失敗しました', 'error');
  }
}

// ----------------------------------------------------------------
// フラグ / チャプター ユーティリティ
// ----------------------------------------------------------------

function _guessChapter(ev) {
  if (ev._chapter) return ev._chapter;
  const id = ev.id ?? '';
  if (id.includes('saitama') || id.includes('ch02')) return 'ch02_saitama';
  if (id.includes('tohoku')  || id.includes('ch01')) return 'ch01_tohoku';
  if (id.includes('defeated'))                        return 'defeated';
  return 'system';
}

function _collectAllFlags() {
  const flags = new Set();
  const add = v => { if (v && typeof v === 'string') flags.add(v); };
  _events.forEach(ev => {
    (ev.conditions ?? []).forEach(c => add(c.flag));
    Object.values(ev.effects ?? {}).forEach(arr => (arr ?? []).forEach(e => add(e.flag)));
    (ev.script ?? []).forEach(step => {
      if (step.type === 'choice') {
        (step.choices ?? []).forEach(ch => (ch.effects ?? []).forEach(e => add(e.flag)));
      }
    });
  });
  return flags;
}

function _updateFlagDatalist() {
  if (!_flagListEl) return;
  const flags = _collectAllFlags();
  _flagListEl.innerHTML = '';
  [...flags].sort().forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    _flagListEl.appendChild(opt);
  });
}

function _flagInput(obj, key, placeholder = 'フラグ名') {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.setAttribute('list', 'ev-flag-list');
  inp.value       = obj[key] ?? '';
  inp.placeholder = placeholder;
  inp.style.cssText = 'flex:1;min-width:100px;padding:3px 5px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
  inp.oninput = () => { obj[key] = inp.value || undefined; _updateFlagDatalist(); };
  return inp;
}

// ----------------------------------------------------------------
// メインレンダリング (Task 4: 右ペイン 300px → 420px)
// ----------------------------------------------------------------

function _render() {
  _container.innerHTML = '';
  _container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden';

  // datalist（フラグ補完用）
  const dl = document.createElement('datalist');
  dl.id = 'ev-flag-list';
  _flagListEl = dl;
  _container.appendChild(dl);
  _updateFlagDatalist();

  const layout = document.createElement('div');
  layout.style.cssText = 'display:grid;grid-template-columns:260px 1fr 420px;gap:12px;flex:1;min-height:0;padding:12px';

  const left   = _buildList();
  const center = document.createElement('div');
  center.id = 'ev-editor-pane';
  center.style.cssText = 'overflow-y:auto;padding-right:4px';

  const right = document.createElement('div');
  right.id = 'ev-conv-pane';
  right.style.cssText = 'overflow-y:auto;border-left:1px solid var(--color-border-tertiary);padding-left:12px;min-width:0';

  if (_selIdx >= 0 && _events[_selIdx]) {
    _buildEditor(center, _events[_selIdx]);
    _buildConvPane(right, _events[_selIdx]);
  } else {
    center.innerHTML = '<p style="color:var(--color-text-secondary);margin-top:24px">左のリストからイベントを選択してください</p>';
  }

  layout.appendChild(left);
  layout.appendChild(center);
  layout.appendChild(right);
  _container.appendChild(layout);
}

// ----------------------------------------------------------------
// 左ペイン (Task 1: アコーディオン + フィルタ, Task 2: フラグパネル, Task 5: グラフボタン)
// ----------------------------------------------------------------

function _buildList() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;height:100%;min-height:0';

  // ---- ツールバー ----
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:4px';

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 新規';
  addBtn.style.cssText = 'flex:1;padding:5px 4px;background:var(--color-background-info);color:var(--color-text-info);border:1px solid var(--color-border-info);border-radius:6px;cursor:pointer;font-size:12px';
  addBtn.onclick = () => {
    const newId = `ev_${String(Date.now()).slice(-6)}`;
    _events.push({
      id: newId, name: '新規イベント', trigger: 'player_turn',
      conditions: [], probability: 1.0, priority: 50, maxOccurrences: 1,
      script: [
        { type: 'conversation', lines: [{ characterId: null, position: 'center', text: '' }] },
        { type: 'end' },
      ],
      effects: { default: [] },
      _chapter: _filterChapter !== 'all' ? _filterChapter : 'system',
    });
    _selIdx = _events.length - 1;
    _render();
  };

  const graphBtn = document.createElement('button');
  graphBtn.textContent = 'グラフ';
  graphBtn.title = 'イベント依存関係グラフ表示';
  graphBtn.style.cssText = 'padding:5px 8px;background:transparent;color:var(--color-text-secondary);border:1px solid var(--color-border-secondary);border-radius:6px;cursor:pointer;font-size:12px';
  graphBtn.onclick = () => _showGraph();

  const flagToggle = document.createElement('button');
  flagToggle.textContent = 'フラグ';
  flagToggle.title = 'フラグ管理パネル';
  flagToggle.style.cssText = `padding:5px 8px;border:1px solid var(--color-border-secondary);border-radius:6px;cursor:pointer;font-size:12px;background:${_showFlagPanel ? 'var(--color-background-secondary)' : 'transparent'};color:var(--color-text-secondary)`;
  flagToggle.onclick = () => { _showFlagPanel = !_showFlagPanel; _render(); };

  toolbar.append(addBtn, graphBtn, flagToggle);
  wrap.appendChild(toolbar);

  // ---- フラグ管理パネル ----
  if (_showFlagPanel) {
    wrap.appendChild(_buildFlagPanel());
  }

  // ---- フィルターバー ----
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;flex-direction:column;gap:3px';

  const chapSel = document.createElement('select');
  chapSel.style.cssText = 'width:100%;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px';
  [{ value: 'all', label: '全チャプター' }, ...CHAPTER_ORDER.map(c => ({ value: c, label: CHAPTER_LABELS[c] ?? c }))].forEach(({ value, label }) => {
    const o = document.createElement('option'); o.value = value; o.textContent = label;
    if (_filterChapter === value) o.selected = true;
    chapSel.appendChild(o);
  });
  chapSel.onchange = () => { _filterChapter = chapSel.value; _render(); };

  const trigSel = document.createElement('select');
  trigSel.style.cssText = chapSel.style.cssText;
  [{ value: 'all', label: '全タイミング' }, ...TRIGGER_OPTIONS].forEach(({ value, label }) => {
    const o = document.createElement('option'); o.value = value; o.textContent = label;
    if (_filterTrigger === value) o.selected = true;
    trigSel.appendChild(o);
  });
  trigSel.onchange = () => { _filterTrigger = trigSel.value; _render(); };

  filterBar.append(chapSel, trigSel);
  wrap.appendChild(filterBar);

  // ---- アコーディオンリスト ----
  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1';

  const filtered = _events
    .map((ev, i) => ({ ev, i }))
    .filter(({ ev }) => {
      if (_filterTrigger !== 'all' && ev.trigger !== _filterTrigger) return false;
      if (_filterChapter !== 'all' && _guessChapter(ev) !== _filterChapter) return false;
      return true;
    });

  const groups = {};
  filtered.forEach(({ ev, i }) => {
    const ch = _guessChapter(ev);
    if (!groups[ch]) groups[ch] = [];
    groups[ch].push({ ev, i });
  });

  const chapOrder = _filterChapter !== 'all'
    ? [_filterChapter]
    : [...CHAPTER_ORDER, ...Object.keys(groups).filter(k => !CHAPTER_ORDER.includes(k))];

  chapOrder.forEach(ch => {
    const items = groups[ch];
    if (!items || items.length === 0) return;

    const details = document.createElement('details');
    details.open = true;
    details.style.cssText = 'border:1px solid var(--color-border-tertiary);border-radius:6px;overflow:hidden';

    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:5px 8px;font-size:11px;font-weight:600;color:var(--color-text-secondary);background:var(--color-background-secondary);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center';
    summary.innerHTML = `<span>${CHAPTER_LABELS[ch] ?? ch}</span><span style="font-weight:400;opacity:0.7">${items.length}</span>`;

    const itemList = document.createElement('div');
    itemList.style.cssText = 'display:flex;flex-direction:column;gap:2px;padding:4px';

    items.forEach(({ ev, i }) => {
      const isSelected = i === _selIdx;
      const item = document.createElement('div');
      item.style.cssText = `padding:6px 8px;border-radius:5px;cursor:pointer;font-size:12px;border:1px solid ${isSelected ? 'var(--color-border-primary)' : 'transparent'};background:${isSelected ? 'var(--color-background-secondary)' : 'transparent'}`;

      const trigLabel = TRIGGER_OPTIONS.find(t => t.value === ev.trigger)?.label ?? ev.trigger;
      const typeLabel = ev.type ? `<span style="padding:1px 4px;border-radius:3px;background:#1a2a1a;color:#88ffaa;font-size:9px;margin-right:3px">[${ev.type}]</span>` : '';
      const trigBadge = `<span style="padding:1px 4px;border-radius:3px;background:var(--color-background-secondary);color:var(--color-text-secondary);font-size:9px;border:1px solid var(--color-border-tertiary)">${trigLabel}</span>`;

      item.innerHTML = `
        <div style="font-weight:500;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${typeLabel}${ev.name}</div>
        <div style="display:flex;gap:4px;align-items:center">${trigBadge}<span style="font-size:10px;color:var(--color-text-secondary)">p=${ev.probability} pri=${ev.priority}</span></div>
      `;
      item.onclick = () => { _selIdx = i; _render(); };

      const del = document.createElement('span');
      del.textContent = '✕';
      del.style.cssText = 'float:right;color:var(--color-text-danger);cursor:pointer;font-size:11px;margin-left:4px;padding:0 2px';
      del.onclick = async e => {
        e.stopPropagation();
        if (!confirm(`「${ev.name}」を削除しますか？`)) return;
        _events.splice(i, 1);
        if (_selIdx >= _events.length) _selIdx = _events.length - 1;
        _render();
      };
      item.prepend(del);
      itemList.appendChild(item);
    });

    details.append(summary, itemList);
    listWrap.appendChild(details);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'フィルター条件に一致するイベントがありません';
    empty.style.cssText = 'font-size:11px;color:var(--color-text-secondary);padding:12px;text-align:center';
    listWrap.appendChild(empty);
  }

  wrap.appendChild(listWrap);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px;background:var(--color-background-success);color:var(--color-text-success);border:1px solid var(--color-border-success);border-radius:6px;cursor:pointer;font-weight:500';
  saveBtn.onclick = _save;
  wrap.appendChild(saveBtn);

  return wrap;
}

// ---- フラグ管理パネル (Task 2) ----

function _buildFlagPanel() {
  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--color-background-secondary);border:1px solid var(--color-border-secondary);border-radius:6px;padding:8px;max-height:160px;overflow-y:auto;flex-shrink:0';

  const title = document.createElement('div');
  title.textContent = 'フラグ一覧（クリックでコピー）';
  title.style.cssText = 'font-size:10px;font-weight:600;color:var(--color-text-secondary);margin-bottom:5px';
  panel.appendChild(title);

  const flagUsage = {};
  _events.forEach(ev => {
    const addUsage = (flag) => {
      if (!flag || typeof flag !== 'string') return;
      if (!flagUsage[flag]) flagUsage[flag] = new Set();
      flagUsage[flag].add(ev.id);
    };
    (ev.conditions ?? []).forEach(c => addUsage(c.flag));
    Object.values(ev.effects ?? {}).forEach(arr => (arr ?? []).forEach(e => addUsage(e.flag)));
    (ev.script ?? []).forEach(step => {
      if (step.type === 'choice') {
        (step.choices ?? []).forEach(ch => (ch.effects ?? []).forEach(e => addUsage(e.flag)));
      }
    });
  });

  const flags = Object.keys(flagUsage).sort();
  if (flags.length === 0) {
    panel.innerHTML += '<div style="font-size:11px;color:var(--color-text-secondary)">フラグなし</div>';
    return panel;
  }

  flags.forEach(flag => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 0;cursor:pointer';
    row.title = 'クリックでコピー';
    row.onclick = () => { navigator.clipboard?.writeText(flag); showToast(`コピー: ${flag}`); };

    const name = document.createElement('span');
    name.textContent = flag;
    name.style.cssText = 'flex:1;font-size:10px;color:var(--color-text-primary);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

    const count = document.createElement('span');
    count.textContent = `${flagUsage[flag].size}`;
    count.style.cssText = 'font-size:10px;color:var(--color-text-secondary);min-width:20px;text-align:right';

    row.append(name, count);
    panel.appendChild(row);
  });

  return panel;
}

// ----------------------------------------------------------------
// 中央ペイン
// ----------------------------------------------------------------

function _buildEditor(pane, ev) {
  pane.innerHTML = '';

  _section(pane, '基本情報');
  _field(pane, 'タイプ', _inp(ev, 'type', 'theater / (空=通常イベント)'));
  _field(pane, 'ID', _text(ev, 'id', true));
  _field(pane, '名前', _text(ev, 'name'));

  const trigSel = document.createElement('select');
  trigSel.style.cssText = 'width:100%;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:13px';
  TRIGGER_OPTIONS.forEach(t => {
    const o = document.createElement('option'); o.value = t.value; o.textContent = t.label;
    if (ev.trigger === t.value) o.selected = true;
    trigSel.appendChild(o);
  });
  trigSel.onchange = () => { ev.trigger = trigSel.value; };
  _field(pane, 'タイミング', trigSel);

  _field(pane, '発生確率 (0〜1)', _num(ev, 'probability', 0, 1, 0.1));
  _field(pane, '優先度', _num(ev, 'priority', 0, 999, 1));
  _field(pane, '最大発生回数 (-1=無制限)', _num(ev, 'maxOccurrences', -1, 999, 1));

  _section(pane, '発生条件 (AND結合)');
  _buildConditions(pane, ev);

  _section(pane, 'スクリプト');
  _buildScript(pane, ev);

  const hasLegacyEffects = Object.keys(ev.effects ?? {}).some(
    k => k !== 'default' || (ev.effects[k] && ev.effects[k].length > 0)
  );
  if (hasLegacyEffects) {
    _section(pane, 'エフェクト（旧方式キー）');
    _buildEffects(pane, ev);
  }
}

// ---- 条件 (Task 2: flag → _flagInput, Task 3: charId → _charSelectWithGroup) ----

function _buildConditions(pane, ev) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:8px';

  ev.conditions.forEach((cond, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;padding:6px;background:var(--color-background-secondary);border-radius:6px';

    const typeSel = document.createElement('select');
    typeSel.style.cssText = 'flex:0 0 130px;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
    CONDITION_TYPES.forEach(ct => {
      const o = document.createElement('option'); o.value = ct.value; o.textContent = ct.label;
      if (cond.type === ct.value) o.selected = true;
      typeSel.appendChild(o);
    });
    typeSel.onchange = () => {
      cond.type = typeSel.value;
      Object.keys(cond).filter(k => k !== 'type').forEach(k => delete cond[k]);
      _buildConditions(pane, ev); wrap.remove();
    };

    const paramsWrap = document.createElement('div');
    paramsWrap.style.cssText = 'flex:1;display:flex;gap:4px;flex-wrap:wrap';
    const ctDef = CONDITION_TYPES.find(ct => ct.value === cond.type);
    (ctDef?.params ?? []).forEach(paramStr => {
      const [key, hint] = paramStr.split(':');
      if (key === 'charId') { paramsWrap.appendChild(_charSelectWithGroup(cond, key)); return; }
      if (key === 'flag')   { paramsWrap.appendChild(_flagInput(cond, key, hint ?? key)); return; }
      const inp = document.createElement('input');
      inp.placeholder = hint ?? key; inp.value = cond[key] ?? '';
      inp.style.cssText = 'flex:1;min-width:80px;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
      inp.oninput = () => {
        const v = inp.value.trim();
        if (key === 'value' || key === 'delta') cond[key] = isNaN(v) ? v : Number(v);
        else if (key === 'eventIds') cond[key] = v.split(',').map(s => s.trim()).filter(Boolean);
        else cond[key] = v || undefined;
      };
      paramsWrap.appendChild(inp);
    });

    const del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText = 'flex:0 0 24px;height:24px;border:none;background:transparent;color:var(--color-text-danger);cursor:pointer;font-size:14px';
    del.onclick = () => { ev.conditions.splice(i, 1); _buildConditions(pane, ev); wrap.remove(); };

    row.append(typeSel, paramsWrap, del);
    wrap.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 条件追加';
  addBtn.style.cssText = 'align-self:flex-start;padding:4px 10px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:12px';
  addBtn.onclick = () => {
    ev.conditions.push({ type: 'turn', op: 'gte', value: 1 });
    _buildConditions(pane, ev); wrap.remove();
  };
  wrap.appendChild(addBtn);
  pane.appendChild(wrap);
}

// ---- スクリプト (Task 3: _charSelect → _charSelectWithGroup) ----

function _buildScript(pane, ev) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px';

  ev.script.forEach((step, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:8px;background:var(--color-background-secondary);border-radius:6px;border:1px solid var(--color-border-tertiary)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';

    const idxLabel = document.createElement('span');
    idxLabel.textContent = `#${i}`;
    idxLabel.style.cssText = 'min-width:28px;font-size:11px;color:var(--color-text-secondary)';

    const typeSel = document.createElement('select');
    typeSel.style.cssText = 'padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
    SCRIPT_STEP_TYPES.forEach(st => {
      const o = document.createElement('option'); o.value = st.value; o.textContent = st.label;
      if (step.type === st.value) o.selected = true;
      typeSel.appendChild(o);
    });
    typeSel.onchange = () => {
      const newType = typeSel.value;
      Object.keys(step).filter(k => k !== 'type').forEach(k => delete step[k]);
      step.type = newType;
      if (newType === 'text')         { step.characterId = null; step.position = 'center'; step.text = ''; }
      if (newType === 'narration')    { step.text = ''; }
      if (newType === 'conversation') { step.lines = [{ characterId: null, position: 'center', text: '' }]; }
      if (newType === 'choice')       { step.characterId = null; step.position = 'center'; step.text = ''; step.choices = []; }
      _buildScript(pane, ev); wrap.remove();
      const rightPane = document.getElementById('ev-conv-pane');
      if (rightPane && _events[_selIdx]) _buildConvPane(rightPane, _events[_selIdx]);
    };

    const up = document.createElement('button');
    up.textContent = '↑'; up.disabled = i === 0;
    up.style.cssText = 'padding:2px 5px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;cursor:pointer;font-size:11px;color:var(--color-text-secondary)';
    up.onclick = () => { [ev.script[i-1], ev.script[i]] = [ev.script[i], ev.script[i-1]]; _buildScript(pane, ev); wrap.remove(); };

    const dn = document.createElement('button');
    dn.textContent = '↓'; dn.disabled = i === ev.script.length - 1;
    dn.style.cssText = up.style.cssText;
    dn.onclick = () => { [ev.script[i], ev.script[i+1]] = [ev.script[i+1], ev.script[i]]; _buildScript(pane, ev); wrap.remove(); };

    const del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText = 'margin-left:auto;padding:2px 6px;border:none;background:transparent;color:var(--color-text-danger);cursor:pointer;font-size:13px';
    del.onclick = () => {
      ev.script.splice(i, 1); _buildScript(pane, ev); wrap.remove();
      const rightPane = document.getElementById('ev-conv-pane');
      if (rightPane && _events[_selIdx]) _buildConvPane(rightPane, _events[_selIdx]);
    };

    header.append(idxLabel, typeSel, up, dn, del);
    card.appendChild(header);

    if (step.type === 'text') {
      card.append(
        _row('キャラ', _charSelectWithGroup(step, 'characterId')),
        _row('位置', _posRow(step, i)),
        _row('テキスト', _area(step, 'text', 'セリフ・テキスト')),
      );
    }
    if (step.type === 'narration') {
      card.appendChild(_row('地の文', _area(step, 'text', 'ナレーション')));
    }
    if (step.type === 'conversation') {
      const summary = document.createElement('div');
      summary.style.cssText = 'font-size:11px;color:var(--color-text-secondary);padding:4px 0';
      summary.textContent = `${step.lines?.length ?? 0} 件のセリフ — 詳細は右パネルで編集`;
      card.appendChild(summary);
    }
    if (step.type === 'choice') {
      card.append(
        _row('キャラ', _charSelectWithGroup(step, 'characterId')),
        _row('位置', _posRow(step, i)),
        _row('テキスト', _area(step, 'text', 'セリフ・テキスト')),
      );
      _buildChoicesInline(card, step, i);
    }
    if (step.type === 'end') {
      card.appendChild(_row('effectsKey', _inp(step, 'effectsKey', 'effectsKey（旧方式。通常は空）')));
    }

    wrap.appendChild(card);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ ステップ追加';
  addBtn.style.cssText = 'align-self:flex-start;padding:4px 10px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:12px';
  addBtn.onclick = () => {
    ev.script.push({ type: 'conversation', lines: [{ characterId: null, position: 'center', text: '' }] });
    _buildScript(pane, ev); wrap.remove();
    const rightPane = document.getElementById('ev-conv-pane');
    if (rightPane && _events[_selIdx]) _buildConvPane(rightPane, _events[_selIdx]);
  };
  wrap.appendChild(addBtn);
  pane.appendChild(wrap);
}

// ---- 選択肢インラインエフェクト (Task 2: flag effects → _flagInput) ----

function _buildChoicesInline(card, step, stepIdx) {
  if (!step.choices) step.choices = [];
  const choiceWrap = document.createElement('div');
  choiceWrap.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:6px';

  step.choices.forEach((choice, ci) => {
    const choiceCard = document.createElement('div');
    choiceCard.style.cssText = 'padding:8px;background:var(--color-background-primary);border-radius:5px;border:1px solid var(--color-border-secondary)';

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
    const badge = document.createElement('span');
    badge.textContent = `選択肢${ci + 1}`;
    badge.style.cssText = 'font-size:10px;padding:1px 6px;border-radius:3px;background:var(--color-background-info);color:var(--color-text-info);white-space:nowrap';
    const labelInp = document.createElement('input');
    labelInp.value = choice.label ?? ''; labelInp.placeholder = '選択肢ラベル';
    labelInp.style.cssText = 'flex:1;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    labelInp.oninput = () => { choice.label = labelInp.value; };
    const nextInp = document.createElement('input');
    nextInp.type = 'number'; nextInp.value = choice.next ?? 0; nextInp.placeholder = 'next#';
    nextInp.style.cssText = 'width:54px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    nextInp.oninput = () => { choice.next = parseInt(nextInp.value) || 0; };
    const delChoice = document.createElement('button');
    delChoice.textContent = '✕';
    delChoice.style.cssText = 'border:none;background:transparent;color:var(--color-text-danger);cursor:pointer;font-size:13px';
    delChoice.onclick = () => { step.choices.splice(ci, 1); _buildChoicesInline(card, step, stepIdx); choiceWrap.remove(); };
    labelRow.append(badge, labelInp, document.createTextNode('→#'), nextInp, delChoice);
    choiceCard.appendChild(labelRow);

    const keyRow = document.createElement('div');
    keyRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
    const keyLbl = document.createElement('span');
    keyLbl.textContent = 'effectsKey（上級）:';
    keyLbl.style.cssText = 'font-size:11px;color:var(--color-text-secondary);white-space:nowrap';
    const keyInp = document.createElement('input');
    keyInp.type = 'text'; keyInp.value = choice.effectsKey ?? ''; keyInp.placeholder = 'effectsKeyを使う場合のみ';
    keyInp.style.cssText = 'flex:1;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    keyInp.oninput = () => { choice.effectsKey = keyInp.value || undefined; };
    keyRow.append(keyLbl, keyInp);
    choiceCard.appendChild(keyRow);

    const effSection = document.createElement('div');
    effSection.style.cssText = 'padding:6px;background:var(--color-background-secondary);border-radius:4px;border:1px solid var(--color-border-tertiary)';
    const effTitle = document.createElement('div');
    effTitle.textContent = 'この選択肢のエフェクト';
    effTitle.style.cssText = 'font-size:10px;color:var(--color-text-secondary);margin-bottom:4px;font-weight:500';
    effSection.appendChild(effTitle);
    if (!choice.effects) choice.effects = [];
    const effList = document.createElement('div');
    effList.style.cssText = 'display:flex;flex-direction:column;gap:3px';
    const rebuildEffects = () => {
      effList.innerHTML = '';
      choice.effects.forEach((eff, ei) => {
        const erow = _buildEffectRow(eff, () => { choice.effects.splice(ei, 1); rebuildEffects(); }, rebuildEffects);
        effList.appendChild(erow);
      });
    };
    rebuildEffects();
    const addEffBtn = document.createElement('button');
    addEffBtn.textContent = '+ エフェクト追加';
    addEffBtn.style.cssText = 'align-self:flex-start;margin-top:4px;padding:2px 8px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:11px';
    addEffBtn.onclick = () => { choice.effects.push({ type: 'setFlag', flag: '' }); rebuildEffects(); };
    effSection.append(effList, addEffBtn);
    choiceCard.appendChild(effSection);
    choiceWrap.appendChild(choiceCard);
  });

  const addChoiceBtn = document.createElement('button');
  addChoiceBtn.textContent = '+ 選択肢追加';
  addChoiceBtn.style.cssText = 'align-self:flex-start;padding:3px 10px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:11px';
  addChoiceBtn.onclick = () => { step.choices.push({ label: '', next: 0, effects: [] }); _buildChoicesInline(card, step, stepIdx); choiceWrap.remove(); };
  choiceWrap.appendChild(addChoiceBtn);
  card.appendChild(choiceWrap);
}

// ----------------------------------------------------------------
// 右ペイン: 会話一括入力 (Task 3: optgroup, Task 4: rows=3)
// ----------------------------------------------------------------

function _buildConvPane(pane, ev) {
  pane.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = '会話一括入力';
  title.style.cssText = 'font-size:12px;font-weight:500;color:var(--color-text-secondary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--color-border-tertiary)';
  pane.appendChild(title);

  const convSteps = ev.script
    .map((s, i) => ({ step: s, idx: i }))
    .filter(({ step }) => step.type === 'conversation');

  if (convSteps.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'conversation ステップがありません。スクリプトに「会話（複数セリフ）」ステップを追加してください。';
    empty.style.cssText = 'font-size:11px;color:var(--color-text-secondary);padding:12px;background:var(--color-background-secondary);border-radius:6px';
    pane.appendChild(empty);
    return;
  }

  convSteps.forEach(({ step, idx }) => {
    const groupLabel = document.createElement('div');
    groupLabel.textContent = `#${idx} 会話ブロック`;
    groupLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-primary);margin:10px 0 6px';
    pane.appendChild(groupLabel);

    if (!step.lines) step.lines = [];
    const tableContainer = document.createElement('div');
    pane.appendChild(tableContainer);

    const buildTable = () => {
      tableContainer.innerHTML = '';

      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:grid;grid-template-columns:130px 1fr 58px 22px;gap:3px;margin-bottom:3px';
      ['キャラ', 'テキスト', '位置', ''].forEach(h => {
        const cell = document.createElement('div');
        cell.textContent = h;
        cell.style.cssText = 'font-size:10px;color:var(--color-text-secondary);padding:0 2px';
        headerRow.appendChild(cell);
      });
      tableContainer.appendChild(headerRow);

      step.lines.forEach((line, li) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:130px 1fr 58px 22px;gap:3px;margin-bottom:3px;align-items:start';

        // Task 3: optgroup キャラセレクト
        const charSel = _charSelectWithGroupRaw(line, 'characterId', true);
        charSel.style.cssText = 'width:100%;padding:3px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px';

        // Task 4: rows=3
        const textArea = document.createElement('textarea');
        textArea.value = line.text ?? ''; textArea.placeholder = 'セリフ'; textArea.rows = 3;
        textArea.style.cssText = 'width:100%;padding:3px 4px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px;resize:vertical';
        textArea.oninput = () => { line.text = textArea.value; };

        const posSel = document.createElement('select');
        posSel.style.cssText = 'width:100%;padding:3px 2px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px';
        ['left','center','right'].forEach(pos => {
          const o = document.createElement('option'); o.value = pos; o.textContent = pos;
          if ((line.position ?? 'center') === pos) o.selected = true;
          posSel.appendChild(o);
        });
        posSel.onchange = () => { line.position = posSel.value; };

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.style.cssText = 'border:none;background:transparent;color:var(--color-text-danger);cursor:pointer;font-size:12px;padding:0;margin-top:4px';
        delBtn.onclick = () => { step.lines.splice(li, 1); buildTable(); };

        row.append(charSel, textArea, posSel, delBtn);
        tableContainer.appendChild(row);
      });

      const addRowBtn = document.createElement('button');
      addRowBtn.textContent = '+ セリフ追加';
      addRowBtn.style.cssText = 'width:100%;padding:4px;border-radius:3px;border:1px dashed var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:11px;margin-top:2px';
      addRowBtn.onclick = () => { step.lines.push({ characterId: null, position: 'center', text: '' }); buildTable(); };
      tableContainer.appendChild(addRowBtn);
    };

    buildTable();

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'スクリプトに反映';
    applyBtn.style.cssText = 'width:100%;margin-top:8px;padding:5px;border-radius:4px;border:1px solid var(--color-border-info);background:var(--color-background-info);color:var(--color-text-info);cursor:pointer;font-size:12px;font-weight:500';
    applyBtn.onclick = () => {
      const centerPane = document.getElementById('ev-editor-pane');
      if (centerPane && _events[_selIdx]) _buildEditor(centerPane, _events[_selIdx]);
      showToast('スクリプトに反映しました');
    };
    pane.appendChild(applyBtn);

    const divider = document.createElement('hr');
    divider.style.cssText = 'border:none;border-top:1px solid var(--color-border-tertiary);margin:12px 0';
    pane.appendChild(divider);
  });
}

// ----------------------------------------------------------------
// エフェクト編集（旧方式キー用）
// ----------------------------------------------------------------

function _buildEffects(pane, ev) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:8px';

  const keys = new Set(['default']);
  ev.script.forEach(s => {
    if (s.type === 'end' && s.effectsKey) keys.add(s.effectsKey);
    if (s.type === 'choice') (s.choices ?? []).forEach(c => { if (c.effectsKey) keys.add(c.effectsKey); });
  });

  keys.forEach(key => {
    if (!ev.effects[key]) ev.effects[key] = [];
    const groupDiv = document.createElement('div');
    groupDiv.style.cssText = 'padding:8px;background:var(--color-background-secondary);border-radius:6px;border:1px solid var(--color-border-tertiary)';
    const groupLabel = document.createElement('div');
    groupLabel.textContent = `エフェクトキー: ${key}`;
    groupLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-primary);margin-bottom:6px';
    groupDiv.appendChild(groupLabel);
    const effList = document.createElement('div');
    effList.style.cssText = 'display:flex;flex-direction:column;gap:4px';
    ev.effects[key].forEach((eff, ei) => {
      const erow = _buildEffectRow(eff, () => { ev.effects[key].splice(ei, 1); _buildEffects(pane, ev); wrap.remove(); }, () => { _buildEffects(pane, ev); wrap.remove(); });
      effList.appendChild(erow);
    });
    const addEff = document.createElement('button');
    addEff.textContent = '+ エフェクト追加';
    addEff.style.cssText = 'align-self:flex-start;margin-top:4px;padding:3px 10px;border-radius:4px;border:1px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:12px';
    addEff.onclick = () => { ev.effects[key].push({ type: 'setFlag', flag: '' }); _buildEffects(pane, ev); wrap.remove(); };
    effList.appendChild(addEff);
    groupDiv.appendChild(effList);
    wrap.appendChild(groupDiv);
  });

  pane.appendChild(wrap);
}

function _buildEffectRow(eff, onDelete, onTypeChange) {
  const erow = document.createElement('div');
  erow.style.cssText = 'display:flex;gap:6px;align-items:flex-start;padding:6px;background:var(--color-background-primary);border-radius:4px;border:1px solid var(--color-border-secondary)';
  const typeSel = document.createElement('select');
  typeSel.style.cssText = 'flex:0 0 140px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
  EFFECT_TYPES.forEach(et => {
    const o = document.createElement('option'); o.value = et.value; o.textContent = et.label;
    if (eff.type === et.value) o.selected = true;
    typeSel.appendChild(o);
  });
  typeSel.onchange = () => {
    const newType = typeSel.value;
    Object.keys(eff).filter(k => k !== 'type').forEach(k => delete eff[k]);
    eff.type = newType;
    onTypeChange();
  };
  const paramsWrap = _buildEffectParams(eff);
  const del = document.createElement('button');
  del.textContent = '✕';
  del.style.cssText = 'flex:0 0 22px;border:none;background:transparent;color:var(--color-text-danger);cursor:pointer;font-size:13px;padding:0';
  del.onclick = onDelete;
  erow.append(typeSel, paramsWrap, del);
  return erow;
}

// Task 2: setFlag/clearFlag/setFlagWithTurn → _flagInput
function _buildEffectParams(eff) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;display:flex;gap:6px;flex-wrap:wrap;align-items:center';

  const factions = _data?.factions?.factions ?? [];
  const bases    = _data?.bases?.bases ?? [];
  const chars    = (_data?.characters?.characters ?? []).filter(c => !c.isTemplate);
  const items    = _data?.items?.items ?? [];
  const legions  = _data?.legions?.legions ?? [];

  const sel = (obj, key, options, allowEmpty = false) => {
    const s = document.createElement('select');
    s.style.cssText = 'flex:1;min-width:120px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    if (allowEmpty) { const o = document.createElement('option'); o.value = ''; o.textContent = '（自軍）'; s.appendChild(o); }
    options.forEach(({ value, label }) => {
      const o = document.createElement('option'); o.value = value; o.textContent = label;
      if (obj[key] === value) o.selected = true;
      s.appendChild(o);
    });
    s.onchange = () => { obj[key] = s.value || undefined; };
    return s;
  };
  const numInp = (obj, key, placeholder, min = null) => {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.placeholder = placeholder; inp.value = obj[key] !== undefined ? obj[key] : '';
    if (min !== null) inp.min = min;
    inp.style.cssText = 'width:80px;padding:3px 5px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    inp.oninput = () => { const v = parseFloat(inp.value); obj[key] = isNaN(v) ? undefined : v; };
    return inp;
  };
  const lbl = (text) => {
    const s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = 'font-size:11px;color:var(--color-text-secondary);white-space:nowrap';
    return s;
  };

  switch (eff.type) {
    case 'treasury':
      wrap.append(lbl('勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })), true), lbl('増減:'), numInp(eff, 'delta', '増減値')); break;
    case 'charJoin':
      wrap.append(lbl('キャラ:'), sel(eff, 'charId', chars.map(c => ({ value: c.id, label: `${c.name}(${c.id})` }))), lbl('勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })), true)); break;
    case 'charLeave':
      wrap.append(lbl('キャラ:'), sel(eff, 'charId', chars.map(c => ({ value: c.id, label: `${c.name}(${c.id})` })))); break;
    case 'charParam': {
      const fieldSel = document.createElement('select');
      fieldSel.style.cssText = 'flex:0 0 130px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
      CHAR_PARAM_FIELDS.forEach(f => {
        const o = document.createElement('option'); o.value = f.value; o.textContent = f.label;
        if (eff.field === f.value) o.selected = true;
        fieldSel.appendChild(o);
      });
      fieldSel.onchange = () => { eff.field = fieldSel.value; };
      wrap.append(lbl('キャラ:'), sel(eff, 'charId', chars.map(c => ({ value: c.id, label: `${c.name}(${c.id})` }))), lbl('フィールド:'), fieldSel, lbl('増減:'), numInp(eff, 'delta', '増減値')); break;
    }
    case 'baseIncome':
      wrap.append(lbl('拠点:'), sel(eff, 'baseId', bases.map(b => ({ value: b.id, label: `${b.name}(${b.id})` }))), lbl('収入増減:'), numInp(eff, 'delta', '増減値')); break;
    case 'battleCap':
      wrap.append(lbl('拠点:'), sel(eff, 'baseId', bases.map(b => ({ value: b.id, label: `${b.name}(${b.id})` }))), lbl('規模増減:'), numInp(eff, 'delta', '増減値')); break;
    case 'dungeonUnlock':
      wrap.append(lbl('拠点:'), sel(eff, 'baseId', bases.map(b => ({ value: b.id, label: `${b.name}(${b.id})` })))); break;
    case 'warFlag': {
      const atWarSel = document.createElement('select');
      atWarSel.style.cssText = 'flex:0 0 80px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
      [{ value: 'true', label: '交戦' }, { value: 'false', label: '停戦' }].forEach(opt => {
        const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label;
        if (String(eff.atWar) === opt.value) o.selected = true;
        atWarSel.appendChild(o);
      });
      atWarSel.onchange = () => { eff.atWar = atWarSel.value === 'true'; };
      wrap.append(lbl('勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name }))), lbl('状態:'), atWarSel); break;
    }
    case 'itemGain':
      wrap.append(lbl('アイテム:'), sel(eff, 'itemId', items.map(it => ({ value: it.id, label: `${it.name}(${it.id})` })))); break;
    case 'itemLose':
      wrap.append(lbl('アイテム:'), sel(eff, 'itemId', items.map(it => ({ value: it.id, label: `${it.name}(${it.id})` })))); break;
    case 'charUsedThisTurn':
      wrap.append(lbl('キャラ:'), sel(eff, 'charId', chars.map(c => ({ value: c.id, label: `${c.name}(${c.id})` })))); break;
    case 'setFlag':
    case 'clearFlag':
    case 'setFlagWithTurn':
      wrap.append(lbl('フラグ名:'), _flagInput(eff, 'flag')); break;
    case 'baseTransfer':
      wrap.append(
        lbl('移行元勢力:'), sel(eff, 'fromFactionId', factions.map(f => ({ value: f.id, label: f.name }))),
        lbl('移行先勢力:'), sel(eff, 'toFactionId',   factions.map(f => ({ value: f.id, label: f.name })), true)
      ); break;
    case 'attackUnlock':
      wrap.append(lbl('対象勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })))); break;
    case 'legionForceAttack':
      wrap.append(
        lbl('攻撃元勢力:'),    sel(eff, 'factionId',       factions.map(f => ({ value: f.id, label: f.name }))),
        lbl('攻撃対象勢力:'),  sel(eff, 'targetFactionId', factions.map(f => ({ value: f.id, label: f.name })), true)
      ); break;
    case 'actionPointsBonus':
      wrap.append(lbl('増減:'), numInp(eff, 'delta', '増減値（+1 など）')); break;
    case 'legionUpdate': {
      const freqInp = numInp(eff, 'attackFrequency', '頻度(省略可)', 0); freqInp.style.width = '90px';
      wrap.append(lbl('軍団:'), sel(eff, 'legionId', legions.map(l => ({ value: l.id, label: l.name ?? l.id }))), lbl('勢力(省略可):'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })), true), lbl('頻度:'), freqInp); break;
    }
    default: {
      const ta = document.createElement('textarea');
      ta.rows = 2; ta.style.cssText = 'flex:1;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px;font-family:monospace';
      try { ta.value = JSON.stringify(eff, null, 2); } catch { ta.value = '{}'; }
      ta.oninput = () => { try { const parsed = JSON.parse(ta.value); Object.assign(eff, parsed); } catch {} };
      wrap.appendChild(ta);
    }
  }
  return wrap;
}

// ----------------------------------------------------------------
// Task 3: キャラセレクト 勢力別 optgroup
// ----------------------------------------------------------------

function _charSelectWithGroup(obj, key, allowNone = true) {
  const sel = _charSelectWithGroupRaw(obj, key, allowNone);
  sel.style.cssText = 'flex:1;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
  return sel;
}

function _charSelectWithGroupRaw(obj, key, allowNone = true) {
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;min-width:120px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';

  if (allowNone) {
    const noneOpt = document.createElement('option');
    noneOpt.value = ''; noneOpt.textContent = '（指定なし）';
    sel.appendChild(noneOpt);
  }

  const factions   = _data?.factions?.factions ?? [];
  const allChars   = (_data?.characters?.characters ?? []).filter(c => !c.isTemplate);
  const currentVal = obj[key] ?? null;

  // 勢力別グループ
  factions.forEach(faction => {
    const factionChars = allChars.filter(c => c.factionId === faction.id);
    if (factionChars.length === 0) return;
    const grp = document.createElement('optgroup');
    grp.label = faction.name ?? faction.id;
    factionChars.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.name} (${c.id})`;
      if (currentVal === c.id) o.selected = true;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  });

  // 勢力未設定キャラ
  const noFactionChars = allChars.filter(c => !c.factionId || !factions.some(f => f.id === c.factionId));
  if (noFactionChars.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'その他';
    noFactionChars.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.name} (${c.id})`;
      if (currentVal === c.id) o.selected = true;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  }

  sel.onchange = () => { obj[key] = sel.value || null; };
  return sel;
}

// ----------------------------------------------------------------
// Task 5: 依存関係グラフ
// ----------------------------------------------------------------

function _buildDependencyGraph() {
  const nodes = _events.map((ev, idx) => ({
    id:      ev.id,
    name:    ev.name ?? ev.id,
    trigger: ev.trigger ?? '',
    chapter: _guessChapter(ev),
    idx,
  }));

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // フラグ別に setter / requirer / blocker を収集
  const setters   = {}; // flag → Set<evId>
  const requirers = {}; // flag → Set<evId>
  const blockers  = {}; // flag → Set<evId>

  const addToMap = (map, flag, evId) => {
    if (!flag || typeof flag !== 'string') return;
    if (!map[flag]) map[flag] = new Set();
    map[flag].add(evId);
  };

  _events.forEach(ev => {
    (ev.conditions ?? []).forEach(c => {
      if (c.type === 'flag')   addToMap(requirers, c.flag, ev.id);
      if (c.type === 'noFlag') addToMap(blockers,  c.flag, ev.id);
    });
    const collectEffects = effArr => (effArr ?? []).forEach(eff => {
      if (eff.type === 'setFlag' || eff.type === 'setFlagWithTurn') addToMap(setters, eff.flag, ev.id);
    });
    Object.values(ev.effects ?? {}).forEach(collectEffects);
    (ev.script ?? []).forEach(step => {
      if (step.type === 'choice') {
        (step.choices ?? []).forEach(ch => collectEffects(ch.effects));
      }
    });
  });

  const edges = [];
  Object.keys(requirers).forEach(flag => {
    (setters[flag] ?? new Set()).forEach(fromId => {
      (requirers[flag] ?? new Set()).forEach(toId => {
        if (fromId !== toId) edges.push({ from: fromId, to: toId, flag, type: 'requires' });
      });
    });
  });
  Object.keys(blockers).forEach(flag => {
    (setters[flag] ?? new Set()).forEach(fromId => {
      (blockers[flag] ?? new Set()).forEach(toId => {
        if (fromId !== toId) edges.push({ from: fromId, to: toId, flag, type: 'blocks' });
      });
    });
  });

  return { nodes, edges, nodeMap };
}

function _showGraph() {
  const overlay = document.createElement('div');
  // CSS変数が未定義の場合のフォールバックとして editor.css の body 背景色を使用
  const bgColor = getComputedStyle(document.body).backgroundColor || '#0d1117';
  overlay.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${bgColor || '#0d1117'};display:flex;flex-direction:column`;

  // ヘッダ
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--color-border-tertiary);flex-shrink:0';

  const headerTitle = document.createElement('div');
  headerTitle.textContent = 'イベント依存関係グラフ';
  headerTitle.style.cssText = 'font-size:14px;font-weight:600;color:var(--color-text-primary);flex:1';

  const flagFilterLbl = document.createElement('span');
  flagFilterLbl.textContent = 'フラグ絞り込み:';
  flagFilterLbl.style.cssText = 'font-size:12px;color:var(--color-text-secondary)';

  const flagFilterInp = document.createElement('input');
  flagFilterInp.type = 'text';
  flagFilterInp.setAttribute('list', 'ev-flag-list');
  flagFilterInp.placeholder = 'フラグ名を入力...';
  flagFilterInp.style.cssText = 'padding:4px 8px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px;width:220px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 閉じる';
  closeBtn.style.cssText = 'padding:5px 12px;border:1px solid var(--color-border-secondary);border-radius:6px;background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:12px';
  closeBtn.onclick = () => overlay.remove();

  header.append(headerTitle, flagFilterLbl, flagFilterInp, closeBtn);
  overlay.appendChild(header);

  // SVGコンテナ
  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = 'flex:1;overflow:auto;position:relative';
  overlay.appendChild(svgContainer);

  const { nodes, edges, nodeMap } = _buildDependencyGraph();

  const renderGraph = (filterFlag) => {
    svgContainer.innerHTML = '';

    let visibleNodes = nodes;
    let visibleEdges = edges;

    if (filterFlag) {
      const relevantIds = new Set();
      edges.filter(e => e.flag === filterFlag).forEach(e => { relevantIds.add(e.from); relevantIds.add(e.to); });
      visibleNodes = nodes.filter(n => relevantIds.has(n.id));
      visibleEdges = edges.filter(e => e.flag === filterFlag);
    }

    if (visibleNodes.length === 0) {
      const msg = document.createElement('div');
      msg.textContent = filterFlag ? `フラグ "${filterFlag}" に関係するイベントが見つかりません` : 'イベントがありません';
      msg.style.cssText = 'padding:48px;text-align:center;color:var(--color-text-secondary);font-size:13px';
      svgContainer.appendChild(msg);
      return;
    }

    // レイアウト: チャプター列 × triggerグループ行
    const NODE_W = 170; const NODE_H = 48;
    const GAP_X = 50;   const GAP_Y = 16;

    const chapCols = {};
    CHAPTER_ORDER.forEach((ch, ci) => { chapCols[ch] = ci; });

    // 各チャプター内でtrigger順にソート
    const triggerOrder = TRIGGER_OPTIONS.map(t => t.value);
    const sorted = [...visibleNodes].sort((a, b) => {
      const ca = chapCols[a.chapter] ?? 99;
      const cb = chapCols[b.chapter] ?? 99;
      if (ca !== cb) return ca - cb;
      return (triggerOrder.indexOf(a.trigger) ?? 99) - (triggerOrder.indexOf(b.trigger) ?? 99);
    });

    // チャプター内のY位置を計算
    const chapCount = {};
    const nodePos = {};
    sorted.forEach(n => {
      const col = chapCols[n.chapter] ?? CHAPTER_ORDER.length;
      const row = chapCount[col] ?? 0;
      chapCount[col] = row + 1;
      const x = col * (NODE_W + GAP_X) + 20;
      const y = row * (NODE_H + GAP_Y) + 40;
      nodePos[n.id] = { x, y };
    });

    const maxX = Math.max(...Object.values(nodePos).map(p => p.x)) + NODE_W + 40;
    const maxY = Math.max(...Object.values(nodePos).map(p => p.y)) + NODE_H + 40;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(maxX));
    svg.setAttribute('height', String(maxY));
    svg.style.cssText = 'display:block;min-width:100%';

    // arrowhead markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mkMarker = (id, color) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id); marker.setAttribute('markerWidth', '8'); marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '6'); marker.setAttribute('refY', '3'); marker.setAttribute('orient', 'auto');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0,0 L0,6 L8,3 z'); path.setAttribute('fill', color);
      marker.appendChild(path); return marker;
    };
    defs.appendChild(mkMarker('arrow-requires', '#4a9eff'));
    defs.appendChild(mkMarker('arrow-blocks',   '#ff6b6b'));
    svg.appendChild(defs);

    // チャプターラベル背景列
    const chapXSet = {};
    sorted.forEach(n => {
      const col = chapCols[n.chapter] ?? CHAPTER_ORDER.length;
      if (!chapXSet[col]) chapXSet[col] = { x: col * (NODE_W + GAP_X) + 20, ch: n.chapter };
    });
    Object.values(chapXSet).forEach(({ x, ch }) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x - 5)); rect.setAttribute('y', '0');
      rect.setAttribute('width', String(NODE_W + 10)); rect.setAttribute('height', String(maxY));
      rect.setAttribute('fill', 'rgba(255,255,255,0.03)'); rect.setAttribute('rx', '4');
      svg.appendChild(rect);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x + NODE_W / 2)); text.setAttribute('y', '20');
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'rgba(255,255,255,0.3)'); text.setAttribute('font-family', 'sans-serif');
      text.textContent = CHAPTER_LABELS[ch] ?? ch;
      svg.appendChild(text);
    });

    // エッジ
    visibleEdges.forEach(edge => {
      const fp = nodePos[edge.from]; const tp = nodePos[edge.to];
      if (!fp || !tp) return;
      const isRequires = edge.type === 'requires';
      const x1 = fp.x + NODE_W; const y1 = fp.y + NODE_H / 2;
      const x2 = tp.x;          const y2 = tp.y + NODE_H / 2;
      const cx1 = x1 + Math.max(40, Math.abs(x2 - x1) * 0.4);
      const cx2 = x2 - Math.max(40, Math.abs(x2 - x1) * 0.4);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isRequires ? '#4a9eff' : '#ff6b6b');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', isRequires ? 'none' : '5,3');
      path.setAttribute('marker-end', `url(#${isRequires ? 'arrow-requires' : 'arrow-blocks'})`);
      path.setAttribute('opacity', '0.6');

      // フラグラベル（エッジ中央）
      const lx = (x1 + x2) / 2; const ly = (y1 + y2) / 2 - 5;
      const flagText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      flagText.setAttribute('x', String(lx)); flagText.setAttribute('y', String(ly));
      flagText.setAttribute('text-anchor', 'middle'); flagText.setAttribute('font-size', '9');
      flagText.setAttribute('fill', isRequires ? '#4a9eff' : '#ff6b6b');
      flagText.setAttribute('font-family', 'monospace'); flagText.setAttribute('opacity', '0.8');
      flagText.textContent = edge.flag ?? '';

      svg.appendChild(path);
      svg.appendChild(flagText);
    });

    // ノード
    sorted.forEach(n => {
      const p = nodePos[n.id];
      if (!p) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'pointer';
      g.onclick = () => {
        const idx = _events.findIndex(ev => ev.id === n.id);
        if (idx >= 0) { _selIdx = idx; overlay.remove(); _render(); }
      };

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(p.x)); rect.setAttribute('y', String(p.y));
      rect.setAttribute('width', String(NODE_W)); rect.setAttribute('height', String(NODE_H));
      rect.setAttribute('rx', '6'); rect.setAttribute('ry', '6');
      rect.setAttribute('fill', n.idx === _selIdx ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.07)');
      rect.setAttribute('stroke', n.idx === _selIdx ? '#4a9eff' : 'rgba(255,255,255,0.2)');
      rect.setAttribute('stroke-width', n.idx === _selIdx ? '2' : '1');

      const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameText.setAttribute('x', String(p.x + 8)); nameText.setAttribute('y', String(p.y + 18));
      nameText.setAttribute('font-size', '11'); nameText.setAttribute('fill', 'rgba(255,255,255,0.9)');
      nameText.setAttribute('font-family', 'sans-serif');
      const displayName = n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name;
      nameText.textContent = displayName;

      const trigText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      trigText.setAttribute('x', String(p.x + 8)); trigText.setAttribute('y', String(p.y + 34));
      trigText.setAttribute('font-size', '9'); trigText.setAttribute('fill', 'rgba(255,255,255,0.45)');
      trigText.setAttribute('font-family', 'sans-serif');
      trigText.textContent = TRIGGER_OPTIONS.find(t => t.value === n.trigger)?.label ?? n.trigger;

      g.append(rect, nameText, trigText);
      svg.appendChild(g);
    });

    svgContainer.appendChild(svg);
  };

  renderGraph('');
  flagFilterInp.addEventListener('input', () => renderGraph(flagFilterInp.value.trim()));

  document.body.appendChild(overlay);
}

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------

function _posRow(step, stepIdx) {
  const posRow = document.createElement('div');
  posRow.style.cssText = 'display:flex;gap:6px';
  ['left','center','right'].forEach(pos => {
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;gap:3px;align-items:center;font-size:12px;cursor:pointer;color:var(--color-text-primary)';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = `pos_${stepIdx}`; radio.value = pos;
    if ((step.position ?? 'center') === pos) radio.checked = true;
    radio.onchange = () => { step.position = pos; };
    lbl.append(radio, pos);
    posRow.appendChild(lbl);
  });
  return posRow;
}

function _section(pane, title) {
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-size:13px;font-weight:500;color:var(--color-text-secondary);border-bottom:1px solid var(--color-border-tertiary);padding-bottom:4px;margin:12px 0 6px';
  pane.appendChild(h);
}

function _field(pane, label, input) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.style.cssText = 'min-width:130px;font-size:12px;color:var(--color-text-secondary)';
  row.append(lbl, input);
  pane.appendChild(row);
}

function _row(label, input) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-bottom:4px';
  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.cssText = 'min-width:60px;font-size:11px;color:var(--color-text-secondary);padding-top:4px';
  row.append(lbl, input);
  return row;
}

function _text(obj, key, readonly = false) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = obj[key] ?? ''; inp.readOnly = readonly;
  inp.style.cssText = `flex:1;padding:4px 8px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-${readonly ? 'tertiary' : 'primary'});color:var(--color-text-${readonly ? 'secondary' : 'primary'});font-size:13px`;
  if (!readonly) inp.oninput = () => { obj[key] = inp.value; };
  return inp;
}

function _inp(obj, key, placeholder = '') {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = obj[key] ?? ''; inp.placeholder = placeholder;
  inp.style.cssText = 'flex:1;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
  inp.oninput = () => {
    if (['label','text','flag','effectsKey'].includes(key)) obj[key] = inp.value;
    else obj[key] = inp.value || undefined;
  };
  return inp;
}

function _area(obj, key, placeholder = '') {
  const ta = document.createElement('textarea');
  ta.value = obj[key] ?? ''; ta.placeholder = placeholder; ta.rows = 2;
  ta.style.cssText = 'flex:1;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px;resize:vertical;width:100%';
  ta.oninput = () => { obj[key] = ta.value; };
  return ta;
}

function _num(obj, key, min, max, step) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.value = obj[key] ?? 0; inp.min = min; inp.max = max; inp.step = step;
  inp.style.cssText = 'width:90px;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:13px';
  inp.oninput = () => { obj[key] = parseFloat(inp.value); };
  return inp;
}
