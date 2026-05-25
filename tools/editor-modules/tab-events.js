/**
 * tools/editor-modules/tab-events.js
 * v5: UX大改修 - チャプターフィルタ/フラグ補完/キャラ勢力別/右ペイン拡大/依存グラフ
 * v6: UI refresh - DOM構築のスタイル指定をCSSクラスに集約（ロジック変更なし）
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
  inp.oninput = () => { obj[key] = inp.value || undefined; _updateFlagDatalist(); };
  return inp;
}

// ----------------------------------------------------------------
// メインレンダリング
// ----------------------------------------------------------------

function _render() {
  _container.innerHTML = '';
  _container.className = 'ev-tab';

  // datalist（フラグ補完用）
  const dl = document.createElement('datalist');
  dl.id = 'ev-flag-list';
  _flagListEl = dl;
  _container.appendChild(dl);
  _updateFlagDatalist();

  const layout = document.createElement('div');
  layout.className = 'ev-layout';

  // ---- left pane ----
  const left = document.createElement('div');
  left.className = 'ev-pane ev-pane-list';
  _buildList(left);

  // ---- center pane ----
  const center = document.createElement('div');
  center.className = 'ev-pane ev-pane-center';
  const centerScroll = document.createElement('div');
  centerScroll.className = 'ev-pane-scroll ev-pad';
  centerScroll.id = 'ev-editor-pane';
  center.appendChild(centerScroll);

  // ---- right pane ----
  const right = document.createElement('div');
  right.className = 'ev-pane ev-pane-right';
  right.id = 'ev-conv-pane';

  if (_selIdx >= 0 && _events[_selIdx]) {
    _buildEditor(centerScroll, _events[_selIdx]);
    _buildConvPane(right, _events[_selIdx]);
  } else {
    const empty = document.createElement('div');
    empty.className = 'ev-empty-center';
    empty.textContent = '← 左のリストからイベントを選択してください';
    centerScroll.appendChild(empty);

    const emptyR = document.createElement('div');
    emptyR.className = 'ev-conv-header';
    emptyR.innerHTML = '<div class="ev-conv-header-title">会話一括入力</div><div class="ev-conv-header-sub">イベントを選択すると、会話ステップをまとめて編集できます</div>';
    right.appendChild(emptyR);
  }

  layout.append(left, center, right);
  _container.appendChild(layout);
}

// ----------------------------------------------------------------
// 左ペイン
// ----------------------------------------------------------------

function _buildList(wrap) {
  // ---- ツールバー ----
  const toolbar = document.createElement('div');
  toolbar.className = 'ev-toolbar';

  const addBtn = document.createElement('button');
  addBtn.className = 'ev-btn ev-btn-primary';
  addBtn.textContent = '+ 新規';
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
  graphBtn.className = 'ev-btn ev-btn-ghost';
  graphBtn.textContent = 'グラフ';
  graphBtn.title = 'イベント依存関係グラフ表示';
  graphBtn.onclick = () => _showGraph();

  const flagToggle = document.createElement('button');
  flagToggle.className = `ev-btn ev-btn-ghost${_showFlagPanel ? ' active' : ''}`;
  flagToggle.textContent = 'フラグ';
  flagToggle.title = 'フラグ管理パネル';
  flagToggle.onclick = () => { _showFlagPanel = !_showFlagPanel; _render(); };

  toolbar.append(addBtn, graphBtn, flagToggle);
  wrap.appendChild(toolbar);

  // ---- フィルターバー ----
  const filterBar = document.createElement('div');
  filterBar.className = 'ev-filter';

  const chapSel = document.createElement('select');
  [{ value: 'all', label: '全チャプター' }, ...CHAPTER_ORDER.map(c => ({ value: c, label: CHAPTER_LABELS[c] ?? c }))].forEach(({ value, label }) => {
    const o = document.createElement('option'); o.value = value; o.textContent = label;
    if (_filterChapter === value) o.selected = true;
    chapSel.appendChild(o);
  });
  chapSel.onchange = () => { _filterChapter = chapSel.value; _render(); };

  const trigSel = document.createElement('select');
  [{ value: 'all', label: '全タイミング' }, ...TRIGGER_OPTIONS].forEach(({ value, label }) => {
    const o = document.createElement('option'); o.value = value; o.textContent = label;
    if (_filterTrigger === value) o.selected = true;
    trigSel.appendChild(o);
  });
  trigSel.onchange = () => { _filterTrigger = trigSel.value; _render(); };

  filterBar.append(chapSel, trigSel);
  wrap.appendChild(filterBar);

  // ---- フラグ管理パネル ----
  if (_showFlagPanel) {
    wrap.appendChild(_buildFlagPanel());
  }

  // ---- アコーディオンリスト ----
  const listWrap = document.createElement('div');
  listWrap.className = 'ev-list';

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
    details.className = 'ev-group';
    details.open = true;

    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="ev-group-title">${CHAPTER_LABELS[ch] ?? ch}</span><span class="ev-group-count">${items.length}</span>`;

    const itemList = document.createElement('div');
    itemList.className = 'ev-group-body';

    items.forEach(({ ev, i }) => {
      const isSelected = i === _selIdx;
      const item = document.createElement('div');
      item.className = `ev-item${isSelected ? ' active' : ''}`;

      const trigLabel = TRIGGER_OPTIONS.find(t => t.value === ev.trigger)?.label ?? ev.trigger;
      const typeBadge = ev.type ? `<span class="ev-item-type">${ev.type}</span>` : '';

      item.innerHTML = `
        <div class="ev-item-title-row">
          <span class="ev-item-title">${ev.name}</span>
          <button class="ev-item-del" title="削除">✕</button>
        </div>
        <div class="ev-item-meta">
          ${typeBadge}
          <span class="ev-item-trigger">${trigLabel}</span>
          <span class="ev-item-num"><em>p</em>${ev.probability} <em>pri</em>${ev.priority}</span>
        </div>
      `;
      item.onclick = (e) => { if (!e.target.closest('.ev-item-del')) { _selIdx = i; _render(); } };

      item.querySelector('.ev-item-del').onclick = (e) => {
        e.stopPropagation();
        if (!confirm(`「${ev.name}」を削除しますか？`)) return;
        _events.splice(i, 1);
        if (_selIdx >= _events.length) _selIdx = _events.length - 1;
        _render();
      };

      itemList.appendChild(item);
    });

    details.append(summary, itemList);
    listWrap.appendChild(details);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ev-empty-list';
    empty.textContent = 'フィルター条件に一致するイベントがありません';
    listWrap.appendChild(empty);
  }

  wrap.appendChild(listWrap);

  // ---- フッター（保存ボタン） ----
  const footer = document.createElement('div');
  footer.className = 'ev-list-footer';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'ev-btn ev-btn-success';
  saveBtn.textContent = '保存';
  saveBtn.onclick = _save;
  footer.appendChild(saveBtn);
  wrap.appendChild(footer);
}

// ---- フラグ管理パネル ----

function _buildFlagPanel() {
  const panel = document.createElement('div');
  panel.className = 'ev-flag-panel';

  const title = document.createElement('div');
  title.className = 'ev-flag-panel-title';
  title.textContent = 'フラグ一覧（クリックでコピー）';
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
    const empty = document.createElement('div');
    empty.className = 'ev-empty-list';
    empty.textContent = 'フラグなし';
    panel.appendChild(empty);
    return panel;
  }

  flags.forEach(flag => {
    const row = document.createElement('div');
    row.className = 'ev-flag-row';
    row.title = 'クリックでコピー';
    row.onclick = () => { navigator.clipboard?.writeText(flag); showToast(`コピー: ${flag}`); };

    const name = document.createElement('span');
    name.className = 'ev-flag-name';
    name.textContent = flag;

    const count = document.createElement('span');
    count.className = 'ev-flag-count';
    count.textContent = `${flagUsage[flag].size}`;

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

  _section(pane, '発生条件', 'AND結合');
  _buildConditions(pane, ev);

  _section(pane, 'スクリプト');
  _buildScript(pane, ev);

  const hasLegacyEffects = Object.keys(ev.effects ?? {}).some(
    k => k !== 'default' || (ev.effects[k] && ev.effects[k].length > 0)
  );
  if (hasLegacyEffects) {
    _section(pane, 'エフェクト', '旧方式キー');
    _buildEffects(pane, ev);
  }
}

// ---- 条件 ----

function _buildConditions(pane, ev) {
  const wrap = document.createElement('div');
  wrap.className = 'ev-cond-list';

  ev.conditions.forEach((cond, i) => {
    const row = document.createElement('div');
    row.className = 'ev-cond-row';

    const typeSel = document.createElement('select');
    typeSel.className = 'ev-cond-type';
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
    paramsWrap.className = 'ev-cond-params';
    const ctDef = CONDITION_TYPES.find(ct => ct.value === cond.type);
    (ctDef?.params ?? []).forEach(paramStr => {
      const [key, hint] = paramStr.split(':');
      if (key === 'charId') { paramsWrap.appendChild(_charSelectWithGroup(cond, key)); return; }
      if (key === 'flag')   { paramsWrap.appendChild(_flagInput(cond, key, hint ?? key)); return; }
      const inp = document.createElement('input');
      inp.placeholder = hint ?? key; inp.value = cond[key] ?? '';
      inp.oninput = () => {
        const v = inp.value.trim();
        if (key === 'value' || key === 'delta') cond[key] = isNaN(v) ? v : Number(v);
        else if (key === 'eventIds') cond[key] = v.split(',').map(s => s.trim()).filter(Boolean);
        else cond[key] = v || undefined;
      };
      paramsWrap.appendChild(inp);
    });

    const del = document.createElement('button');
    del.className = 'ev-btn ev-btn-icon ev-btn-danger';
    del.textContent = '✕';
    del.title = 'この条件を削除';
    del.onclick = () => { ev.conditions.splice(i, 1); _buildConditions(pane, ev); wrap.remove(); };

    row.append(typeSel, paramsWrap, del);
    wrap.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'ev-btn ev-btn-add';
  addBtn.textContent = '+ 条件追加';
  addBtn.onclick = () => {
    ev.conditions.push({ type: 'turn', op: 'gte', value: 1 });
    _buildConditions(pane, ev); wrap.remove();
  };
  wrap.appendChild(addBtn);
  pane.appendChild(wrap);
}

// ---- スクリプト ----

function _buildScript(pane, ev) {
  const wrap = document.createElement('div');
  wrap.className = 'ev-step-list';

  ev.script.forEach((step, i) => {
    const card = document.createElement('div');
    card.className = `ev-step-card${step.type === 'conversation' ? ' is-conv' : ''}`;

    const header = document.createElement('div');
    header.className = 'ev-step-header';

    const idxLabel = document.createElement('span');
    idxLabel.className = 'ev-step-idx';
    idxLabel.textContent = `#${i}`;

    const typeSel = document.createElement('select');
    typeSel.className = 'ev-step-type';
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

    const actions = document.createElement('div');
    actions.className = 'ev-step-actions';

    const up = document.createElement('button');
    up.className = 'ev-btn ev-btn-icon';
    up.textContent = '↑'; up.disabled = i === 0;
    up.title = '上へ移動';
    up.onclick = () => { [ev.script[i-1], ev.script[i]] = [ev.script[i], ev.script[i-1]]; _buildScript(pane, ev); wrap.remove(); };

    const dn = document.createElement('button');
    dn.className = 'ev-btn ev-btn-icon';
    dn.textContent = '↓'; dn.disabled = i === ev.script.length - 1;
    dn.title = '下へ移動';
    dn.onclick = () => { [ev.script[i], ev.script[i+1]] = [ev.script[i+1], ev.script[i]]; _buildScript(pane, ev); wrap.remove(); };

    const del = document.createElement('button');
    del.className = 'ev-btn ev-btn-icon ev-btn-danger';
    del.textContent = '✕';
    del.title = 'このステップを削除';
    del.onclick = () => {
      ev.script.splice(i, 1); _buildScript(pane, ev); wrap.remove();
      const rightPane = document.getElementById('ev-conv-pane');
      if (rightPane && _events[_selIdx]) _buildConvPane(rightPane, _events[_selIdx]);
    };

    actions.append(up, dn, del);
    header.append(idxLabel, typeSel, actions);
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
      summary.className = 'ev-step-summary';
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
  addBtn.className = 'ev-btn ev-btn-add';
  addBtn.textContent = '+ ステップ追加';
  addBtn.onclick = () => {
    ev.script.push({ type: 'conversation', lines: [{ characterId: null, position: 'center', text: '' }] });
    _buildScript(pane, ev); wrap.remove();
    const rightPane = document.getElementById('ev-conv-pane');
    if (rightPane && _events[_selIdx]) _buildConvPane(rightPane, _events[_selIdx]);
  };
  wrap.appendChild(addBtn);
  pane.appendChild(wrap);
}

// ---- 選択肢インラインエフェクト ----

function _buildChoicesInline(card, step, stepIdx) {
  if (!step.choices) step.choices = [];
  const choiceWrap = document.createElement('div');
  choiceWrap.className = 'ev-choice-block';

  step.choices.forEach((choice, ci) => {
    const choiceCard = document.createElement('div');
    choiceCard.className = 'ev-choice-card';

    const labelRow = document.createElement('div');
    labelRow.className = 'ev-choice-header';

    const badge = document.createElement('span');
    badge.className = 'ev-choice-badge';
    badge.textContent = `選択肢${ci + 1}`;

    const labelInp = document.createElement('input');
    labelInp.type = 'text';
    labelInp.value = choice.label ?? ''; labelInp.placeholder = '選択肢ラベル';
    labelInp.oninput = () => { choice.label = labelInp.value; };

    const arrow = document.createElement('span');
    arrow.className = 'ev-choice-arrow';
    arrow.textContent = '→ #';

    const nextInp = document.createElement('input');
    nextInp.type = 'number'; nextInp.className = 'ev-choice-next';
    nextInp.value = choice.next ?? 0; nextInp.placeholder = 'next#';
    nextInp.oninput = () => { choice.next = parseInt(nextInp.value) || 0; };

    const delChoice = document.createElement('button');
    delChoice.className = 'ev-btn ev-btn-icon ev-btn-danger';
    delChoice.textContent = '✕';
    delChoice.title = 'この選択肢を削除';
    delChoice.onclick = () => { step.choices.splice(ci, 1); _buildChoicesInline(card, step, stepIdx); choiceWrap.remove(); };

    labelRow.append(badge, labelInp, arrow, nextInp, delChoice);
    choiceCard.appendChild(labelRow);

    const keyRow = document.createElement('div');
    keyRow.className = 'ev-choice-key-row';
    const keyLbl = document.createElement('span');
    keyLbl.textContent = 'effectsKey（上級）';
    const keyInp = document.createElement('input');
    keyInp.type = 'text'; keyInp.value = choice.effectsKey ?? ''; keyInp.placeholder = 'effectsKeyを使う場合のみ';
    keyInp.oninput = () => { choice.effectsKey = keyInp.value || undefined; };
    keyRow.append(keyLbl, keyInp);
    choiceCard.appendChild(keyRow);

    const effSection = document.createElement('div');
    effSection.className = 'ev-choice-effects';
    const effTitle = document.createElement('div');
    effTitle.className = 'ev-choice-effects-title';
    effTitle.textContent = 'この選択肢のエフェクト';
    effSection.appendChild(effTitle);

    if (!choice.effects) choice.effects = [];
    const effList = document.createElement('div');
    effList.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const rebuildEffects = () => {
      effList.innerHTML = '';
      choice.effects.forEach((eff, ei) => {
        const erow = _buildEffectRow(eff, () => { choice.effects.splice(ei, 1); rebuildEffects(); }, rebuildEffects);
        effList.appendChild(erow);
      });
    };
    rebuildEffects();

    const addEffBtn = document.createElement('button');
    addEffBtn.className = 'ev-btn ev-btn-add ev-btn-sm';
    addEffBtn.textContent = '+ エフェクト追加';
    addEffBtn.onclick = () => { choice.effects.push({ type: 'setFlag', flag: '' }); rebuildEffects(); };
    effSection.append(effList, addEffBtn);
    choiceCard.appendChild(effSection);
    choiceWrap.appendChild(choiceCard);
  });

  const addChoiceBtn = document.createElement('button');
  addChoiceBtn.className = 'ev-btn ev-btn-add';
  addChoiceBtn.textContent = '+ 選択肢追加';
  addChoiceBtn.onclick = () => { step.choices.push({ label: '', next: 0, effects: [] }); _buildChoicesInline(card, step, stepIdx); choiceWrap.remove(); };
  choiceWrap.appendChild(addChoiceBtn);
  card.appendChild(choiceWrap);
}

// ----------------------------------------------------------------
// 右ペイン: 会話一括入力
// ----------------------------------------------------------------

function _buildConvPane(pane, ev) {
  pane.innerHTML = '';

  // ---- ヘッダ ----
  const header = document.createElement('div');
  header.className = 'ev-conv-header';
  const ht = document.createElement('div');
  ht.className = 'ev-conv-header-title';
  ht.textContent = '会話一括入力';
  const hs = document.createElement('div');
  hs.className = 'ev-conv-header-sub';
  hs.textContent = `${ev.name ?? ev.id} — conversation ステップをまとめて編集`;
  header.append(ht, hs);
  pane.appendChild(header);

  // ---- ボディ ----
  const body = document.createElement('div');
  body.className = 'ev-conv-body';
  pane.appendChild(body);

  const convSteps = ev.script
    .map((s, i) => ({ step: s, idx: i }))
    .filter(({ step }) => step.type === 'conversation');

  if (convSteps.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ev-conv-empty';
    empty.textContent = 'conversation ステップがありません。スクリプトに「会話（複数セリフ）」ステップを追加してください。';
    body.appendChild(empty);
    return;
  }

  convSteps.forEach(({ step, idx }, blockI) => {
    const block = document.createElement('div');
    block.className = 'ev-conv-block';

    const blockTitle = document.createElement('div');
    blockTitle.className = 'ev-conv-block-title';
    blockTitle.innerHTML = `<span class="ev-conv-block-idx">#${idx}</span><span>会話ブロック</span>`;
    block.appendChild(blockTitle);

    if (!step.lines) step.lines = [];
    const tableContainer = document.createElement('div');
    block.appendChild(tableContainer);

    const buildTable = () => {
      tableContainer.innerHTML = '';

      const table = document.createElement('div');
      table.className = 'ev-conv-table';

      const headerRow = document.createElement('div');
      headerRow.className = 'ev-conv-table-header';
      ['キャラ', 'テキスト', '位置', ''].forEach(h => {
        const cell = document.createElement('div');
        cell.textContent = h;
        headerRow.appendChild(cell);
      });
      table.appendChild(headerRow);

      step.lines.forEach((line, li) => {
        const row = document.createElement('div');
        row.className = 'ev-conv-row';

        const charSel = _charSelectWithGroupRaw(line, 'characterId', true);

        const textArea = document.createElement('textarea');
        textArea.value = line.text ?? ''; textArea.placeholder = 'セリフ'; textArea.rows = 3;
        textArea.oninput = () => { line.text = textArea.value; };

        const posSel = document.createElement('select');
        ['left','center','right'].forEach(pos => {
          const o = document.createElement('option'); o.value = pos; o.textContent = pos;
          if ((line.position ?? 'center') === pos) o.selected = true;
          posSel.appendChild(o);
        });
        posSel.onchange = () => { line.position = posSel.value; };

        const delBtn = document.createElement('button');
        delBtn.className = 'ev-btn ev-btn-icon ev-btn-danger';
        delBtn.textContent = '✕';
        delBtn.onclick = () => { step.lines.splice(li, 1); buildTable(); };

        row.append(charSel, textArea, posSel, delBtn);
        table.appendChild(row);
      });

      tableContainer.appendChild(table);

      const addRowBtn = document.createElement('button');
      addRowBtn.className = 'ev-btn ev-btn-add ev-btn-sm';
      addRowBtn.style.marginTop = '6px';
      addRowBtn.textContent = '+ セリフ追加';
      addRowBtn.onclick = () => { step.lines.push({ characterId: null, position: 'center', text: '' }); buildTable(); };
      tableContainer.appendChild(addRowBtn);
    };

    buildTable();

    const applyBtn = document.createElement('button');
    applyBtn.className = 'ev-btn ev-btn-info ev-conv-apply';
    applyBtn.textContent = 'スクリプトに反映';
    applyBtn.onclick = () => {
      const centerPane = document.getElementById('ev-editor-pane');
      if (centerPane && _events[_selIdx]) _buildEditor(centerPane, _events[_selIdx]);
      showToast('スクリプトに反映しました');
    };
    block.appendChild(applyBtn);

    body.appendChild(block);
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
    groupDiv.className = 'ev-eff-group';
    const groupLabel = document.createElement('div');
    groupLabel.className = 'ev-eff-group-title';
    groupLabel.textContent = `エフェクトキー: ${key}`;
    groupDiv.appendChild(groupLabel);
    const effList = document.createElement('div');
    effList.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    ev.effects[key].forEach((eff, ei) => {
      const erow = _buildEffectRow(eff, () => { ev.effects[key].splice(ei, 1); _buildEffects(pane, ev); wrap.remove(); }, () => { _buildEffects(pane, ev); wrap.remove(); });
      effList.appendChild(erow);
    });
    const addEff = document.createElement('button');
    addEff.className = 'ev-btn ev-btn-add ev-btn-sm';
    addEff.textContent = '+ エフェクト追加';
    addEff.onclick = () => { ev.effects[key].push({ type: 'setFlag', flag: '' }); _buildEffects(pane, ev); wrap.remove(); };
    effList.appendChild(addEff);
    groupDiv.appendChild(effList);
    wrap.appendChild(groupDiv);
  });

  pane.appendChild(wrap);
}

function _buildEffectRow(eff, onDelete, onTypeChange) {
  const erow = document.createElement('div');
  erow.className = 'ev-eff-row';
  const typeSel = document.createElement('select');
  typeSel.className = 'ev-eff-type';
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
  paramsWrap.className = 'ev-eff-params';
  const del = document.createElement('button');
  del.className = 'ev-btn ev-btn-icon ev-btn-danger';
  del.textContent = '✕';
  del.onclick = onDelete;
  erow.append(typeSel, paramsWrap, del);
  return erow;
}

function _buildEffectParams(eff) {
  const wrap = document.createElement('div');

  const factions = _data?.factions?.factions ?? [];
  const bases    = _data?.bases?.bases ?? [];
  const chars    = (_data?.characters?.characters ?? []).filter(c => !c.isTemplate);
  const items    = _data?.items?.items ?? [];
  const legions  = _data?.legions?.legions ?? [];

  const sel = (obj, key, options, allowEmpty = false) => {
    const s = document.createElement('select');
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
    inp.oninput = () => { const v = parseFloat(inp.value); obj[key] = isNaN(v) ? undefined : v; };
    return inp;
  };
  const lbl = (text) => {
    const s = document.createElement('span');
    s.textContent = text;
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
      const freqInp = numInp(eff, 'attackFrequency', '頻度(省略可)', 0);
      wrap.append(lbl('軍団:'), sel(eff, 'legionId', legions.map(l => ({ value: l.id, label: l.name ?? l.id }))), lbl('勢力(省略可):'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })), true), lbl('頻度:'), freqInp); break;
    }
    default: {
      const ta = document.createElement('textarea');
      ta.rows = 2;
      try { ta.value = JSON.stringify(eff, null, 2); } catch { ta.value = '{}'; }
      ta.oninput = () => { try { const parsed = JSON.parse(ta.value); Object.assign(eff, parsed); } catch {} };
      wrap.appendChild(ta);
    }
  }
  return wrap;
}

// ----------------------------------------------------------------
// キャラセレクト 勢力別 optgroup
// ----------------------------------------------------------------

function _charSelectWithGroup(obj, key, allowNone = true) {
  return _charSelectWithGroupRaw(obj, key, allowNone);
}

function _charSelectWithGroupRaw(obj, key, allowNone = true) {
  const sel = document.createElement('select');

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
// 依存関係グラフ
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

  const setters   = {};
  const requirers = {};
  const blockers  = {};

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
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0d1117;display:flex;flex-direction:column';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #30363d;flex-shrink:0;background:#161b22';

  const headerTitle = document.createElement('div');
  headerTitle.textContent = 'イベント依存関係グラフ';
  headerTitle.style.cssText = 'font-size:14px;font-weight:600;color:#c9d1d9;flex:1';

  const flagFilterLbl = document.createElement('span');
  flagFilterLbl.textContent = 'フラグ絞り込み:';
  flagFilterLbl.style.cssText = 'font-size:12px;color:#8b949e';

  const flagFilterInp = document.createElement('input');
  flagFilterInp.type = 'text';
  flagFilterInp.setAttribute('list', 'ev-flag-list');
  flagFilterInp.placeholder = 'フラグ名を入力...';
  flagFilterInp.style.cssText = 'padding:5px 9px;border-radius:5px;border:1px solid #30363d;background:#0d1117;color:#c9d1d9;font-size:12px;width:220px;font-family:inherit';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ev-btn';
  closeBtn.textContent = '✕ 閉じる';
  closeBtn.onclick = () => overlay.remove();

  header.append(headerTitle, flagFilterLbl, flagFilterInp, closeBtn);
  overlay.appendChild(header);

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
      msg.style.cssText = 'padding:48px;text-align:center;color:#8b949e;font-size:13px';
      svgContainer.appendChild(msg);
      return;
    }

    const NODE_W = 170; const NODE_H = 48;
    const GAP_X = 50;   const GAP_Y = 16;

    const chapCols = {};
    CHAPTER_ORDER.forEach((ch, ci) => { chapCols[ch] = ci; });

    const triggerOrder = TRIGGER_OPTIONS.map(t => t.value);
    const sorted = [...visibleNodes].sort((a, b) => {
      const ca = chapCols[a.chapter] ?? 99;
      const cb = chapCols[b.chapter] ?? 99;
      if (ca !== cb) return ca - cb;
      return (triggerOrder.indexOf(a.trigger) ?? 99) - (triggerOrder.indexOf(b.trigger) ?? 99);
    });

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

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mkMarker = (id, color) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id); marker.setAttribute('markerWidth', '8'); marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '6'); marker.setAttribute('refY', '3'); marker.setAttribute('orient', 'auto');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0,0 L0,6 L8,3 z'); path.setAttribute('fill', color);
      marker.appendChild(path); return marker;
    };
    defs.appendChild(mkMarker('arrow-requires', '#58a6ff'));
    defs.appendChild(mkMarker('arrow-blocks',   '#f85149'));
    svg.appendChild(defs);

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
      path.setAttribute('stroke', isRequires ? '#58a6ff' : '#f85149');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-dasharray', isRequires ? 'none' : '5,3');
      path.setAttribute('marker-end', `url(#${isRequires ? 'arrow-requires' : 'arrow-blocks'})`);
      path.setAttribute('opacity', '0.6');

      const lx = (x1 + x2) / 2; const ly = (y1 + y2) / 2 - 5;
      const flagText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      flagText.setAttribute('x', String(lx)); flagText.setAttribute('y', String(ly));
      flagText.setAttribute('text-anchor', 'middle'); flagText.setAttribute('font-size', '9');
      flagText.setAttribute('fill', isRequires ? '#58a6ff' : '#f85149');
      flagText.setAttribute('font-family', 'monospace'); flagText.setAttribute('opacity', '0.8');
      flagText.textContent = edge.flag ?? '';

      svg.appendChild(path);
      svg.appendChild(flagText);
    });

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
      rect.setAttribute('fill', n.idx === _selIdx ? 'rgba(88,166,255,0.2)' : 'rgba(255,255,255,0.07)');
      rect.setAttribute('stroke', n.idx === _selIdx ? '#58a6ff' : 'rgba(255,255,255,0.2)');
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
  posRow.className = 'ev-pos-row';
  ['left','center','right'].forEach(pos => {
    const lbl = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = `pos_${stepIdx}`; radio.value = pos;
    if ((step.position ?? 'center') === pos) radio.checked = true;
    radio.onchange = () => { step.position = pos; };
    lbl.append(radio, document.createTextNode(pos));
    posRow.appendChild(lbl);
  });
  return posRow;
}

function _section(pane, title, hint = '') {
  const h = document.createElement('div');
  h.className = 'ev-section-head';
  h.innerHTML = `<span>${title}</span>${hint ? `<span class="ev-section-hint">${hint}</span>` : ''}`;
  pane.appendChild(h);
}

function _field(pane, label, input) {
  const row = document.createElement('div');
  row.className = 'ev-field-row';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  row.append(lbl, input);
  pane.appendChild(row);
}

function _row(label, input) {
  const row = document.createElement('div');
  row.className = 'ev-sub-row';
  const lbl = document.createElement('span');
  lbl.className = 'ev-sub-label';
  lbl.textContent = label;
  row.append(lbl, input);
  return row;
}

function _text(obj, key, readonly = false) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = obj[key] ?? ''; inp.readOnly = readonly;
  if (!readonly) inp.oninput = () => { obj[key] = inp.value; };
  return inp;
}

function _inp(obj, key, placeholder = '') {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = obj[key] ?? ''; inp.placeholder = placeholder;
  inp.oninput = () => {
    if (['label','text','flag','effectsKey'].includes(key)) obj[key] = inp.value;
    else obj[key] = inp.value || undefined;
  };
  return inp;
}

function _area(obj, key, placeholder = '') {
  const ta = document.createElement('textarea');
  ta.value = obj[key] ?? ''; ta.placeholder = placeholder; ta.rows = 2;
  ta.oninput = () => { obj[key] = ta.value; };
  return ta;
}

function _num(obj, key, min, max, step) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.value = obj[key] ?? 0; inp.min = min; inp.max = max; inp.step = step;
  inp.oninput = () => { obj[key] = parseFloat(inp.value); };
  return inp;
}
