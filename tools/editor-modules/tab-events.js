/**
 * tools/editor-modules/tab-events.js
 * v4: 話者名入力廃止。話者はcharacterIdから自動解決。
 */

import { showToast } from './shared.js';

// ----------------------------------------------------------------
// 定義
// ----------------------------------------------------------------

const CONDITION_TYPES = [
  { value: 'turn',           label: 'ターン数', params: ['op:比較(gte/lte/eq)', 'value:値'] },
  { value: 'flag',           label: 'フラグ成立', params: ['flag:フラグ名'] },
  { value: 'noFlag',         label: 'フラグ未成立', params: ['flag:フラグ名'] },
  { value: 'hasChar',        label: 'キャラ配下', params: ['charId:キャラID'] },
  { value: 'baseOwned',      label: '拠点所有', params: ['baseId:拠点ID'] },
  { value: 'atWar',          label: '交戦中', params: ['factionId:勢力ID'] },
  { value: 'noOther',        label: '他イベント非成立', params: ['eventIds:イベントID(カンマ区切り)'] },
  { value: 'attackerFaction',label: '攻撃側勢力', params: ['factionId:攻撃側勢力ID'] },
  { value: 'defenderFaction',label: '防衛側勢力', params: ['factionId:防衛側勢力ID'] },
  { value: 'baseConquered',  label: '拠点制圧済み', params: ['baseId:拠点ID', 'factionId:制圧した勢力ID'] },
  { value: 'turnAfterFlag',  label: 'フラグ成立からNターン後', params: ['flag:フラグ名', 'value:ターン数'] },
];

const EFFECT_TYPES = [
  { value: 'treasury',         label: 'ミーム増減' },
  { value: 'charJoin',         label: 'キャラ加入' },
  { value: 'charLeave',        label: 'キャラ離脱' },
  { value: 'charParam',        label: 'キャラパラメータ変更' },
  { value: 'charUsedThisTurn', label: 'キャラ行動済みにする' },
  { value: 'baseIncome',       label: '拠点収入増減' },
  { value: 'battleCap',        label: '戦闘規模増減' },
  { value: 'dungeonUnlock',    label: '迷宮解放' },
  { value: 'warFlag',          label: '交戦フラグ変化' },
  { value: 'itemGain',         label: 'アイテム入手' },
  { value: 'itemLose',         label: 'アイテム喪失' },
  { value: 'setFlag',          label: 'フラグ設定' },
  { value: 'clearFlag',        label: 'フラグ解除' },
  { value: 'setFlagWithTurn',  label: 'フラグ設定（ターン記録）' },
  { value: 'legionUpdate',     label: '軍団設定変更' },
  { value: 'baseTransfer',     label: '拠点所有権移行（勢力一括）' },
  { value: 'attackUnlock',     label: '攻撃可能フラグ設定' },
  { value: 'legionForceAttack',label: '軍団全体に攻撃命令' },
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
  { value: 'game_start',        label: 'ゲーム開始' },
  { value: 'player_turn',       label: '自軍ターン開始' },
  { value: 'enemy_turn',        label: '敵軍ターン開始' },
  { value: 'base_visit',        label: '拠点訪問時' },
  { value: 'base_attack',       label: '拠点攻撃時' },
  { value: 'base_defense',      label: '拠点防衛時' },
  { value: 'before_faction_turn', label: '特定勢力ターン行動前' },
  { value: 'base_conquered',    label: '拠点制圧時' },
  { value: 'turn_start',        label: 'ターン冒頭（全勢力共通）' },
];

const SCRIPT_STEP_TYPES = [
  { value: 'text',         label: 'セリフ' },
  { value: 'narration',    label: '地の文' },
  { value: 'choice',       label: '選択肢' },
  { value: 'conversation', label: '会話（複数セリフ）' },
  { value: 'end',          label: '終了' },
];

// ----------------------------------------------------------------
// 状態
// ----------------------------------------------------------------

let _events    = [];
let _selIdx    = -1;
let _container = null;
let _data      = null;

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
  } catch (e) {
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
  } catch (e) {
    showToast('保存に失敗しました', 'error');
  }
}

// ----------------------------------------------------------------
// メインレンダリング（3カラム）
// ----------------------------------------------------------------

function _render() {
  _container.innerHTML = '';

  const layout = document.createElement('div');
  layout.style.cssText = 'display:grid;grid-template-columns:260px 1fr 300px;gap:12px;height:100%';

  const left   = _buildList();
  const center = document.createElement('div');
  center.id = 'ev-editor-pane';
  center.style.cssText = 'overflow-y:auto;padding-right:4px';

  const right = document.createElement('div');
  right.id = 'ev-conv-pane';
  right.style.cssText = 'overflow-y:auto;border-left:1px solid var(--color-border-tertiary);padding-left:12px';

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
// 左ペイン
// ----------------------------------------------------------------

function _buildList() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;height:100%';

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ 新規イベント';
  addBtn.style.cssText = 'padding:6px;background:var(--color-background-info);color:var(--color-text-info);border:1px solid var(--color-border-info);border-radius:6px;cursor:pointer;font-size:13px';
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
    });
    _selIdx = _events.length - 1;
    _render();
  };
  wrap.appendChild(addBtn);

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1';
  _events.forEach((ev, i) => {
    const item = document.createElement('div');
    item.style.cssText = `padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid ${i === _selIdx ? 'var(--color-border-primary)' : 'var(--color-border-tertiary)'};background:${i === _selIdx ? 'var(--color-background-secondary)' : 'transparent'}`;
    const trigLabel = TRIGGER_OPTIONS.find(t => t.value === ev.trigger)?.label ?? ev.trigger;
    item.innerHTML = `<div style="font-weight:500;color:var(--color-text-primary)">${ev.name}</div><div style="font-size:11px;color:var(--color-text-secondary)">${trigLabel} / p=${ev.probability} / pri=${ev.priority}</div>`;
    item.onclick = () => { _selIdx = i; _render(); };
    const del = document.createElement('span');
    del.textContent = '✕';
    del.style.cssText = 'float:right;color:var(--color-text-danger);cursor:pointer;font-size:12px;margin-left:6px';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`「${ev.name}」を削除しますか？`)) return;
      _events.splice(i, 1);
      if (_selIdx >= _events.length) _selIdx = _events.length - 1;
      _render();
    };
    item.prepend(del);
    list.appendChild(item);
  });
  wrap.appendChild(list);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:8px;background:var(--color-background-success);color:var(--color-text-success);border:1px solid var(--color-border-success);border-radius:6px;cursor:pointer;font-weight:500';
  saveBtn.onclick = _save;
  wrap.appendChild(saveBtn);

  return wrap;
}

// ----------------------------------------------------------------
// 中央ペイン
// ----------------------------------------------------------------

function _buildEditor(pane, ev) {
  pane.innerHTML = '';

  _section(pane, '基本情報');
  _field(pane, 'ID', _text(ev, 'id', true));
  _field(pane, '名前', _text(ev, 'name'));

  const trigSel = document.createElement('select');
  trigSel.style.cssText = 'width:100%;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:13px';
  TRIGGER_OPTIONS.forEach(t => {
    const o = document.createElement('option');
    o.value = t.value; o.textContent = t.label;
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

// ---- 条件 ----

function _buildConditions(pane, ev) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:8px';

  ev.conditions.forEach((cond, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;padding:6px;background:var(--color-background-secondary);border-radius:6px';

    const typeSel = document.createElement('select');
    typeSel.style.cssText = 'flex:0 0 130px;padding:4px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
    CONDITION_TYPES.forEach(ct => {
      const o = document.createElement('option');
      o.value = ct.value; o.textContent = ct.label;
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
      if (key === 'charId') { paramsWrap.appendChild(_charSelectRaw(cond, key)); return; }
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

// ---- スクリプト ----

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
      const o = document.createElement('option');
      o.value = st.value; o.textContent = st.label;
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
      // 話者名入力なし。キャラID選択のみ
      card.append(
        _row('キャラ', _charSelect(step, 'characterId')),
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
      // 話者名入力なし。キャラID選択のみ
      card.append(
        _row('キャラ', _charSelect(step, 'characterId')),
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

// ---- 選択肢インラインエフェクト ----

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
// 右ペイン: 会話一括入力
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

  const chars = (_data?.characters?.characters ?? []).filter(c => !c.isTemplate);

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

      // ヘッダ行（キャラ / テキスト / 位置 / 削除）
      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:grid;grid-template-columns:110px 1fr 58px 22px;gap:3px;margin-bottom:3px';
      ['キャラ', 'テキスト', '位置', ''].forEach(h => {
        const cell = document.createElement('div');
        cell.textContent = h;
        cell.style.cssText = 'font-size:10px;color:var(--color-text-secondary);padding:0 2px';
        headerRow.appendChild(cell);
      });
      tableContainer.appendChild(headerRow);

      step.lines.forEach((line, li) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:110px 1fr 58px 22px;gap:3px;margin-bottom:3px;align-items:start';

        // キャラセレクト（話者名は自動解決）
        const charSel = document.createElement('select');
        charSel.style.cssText = 'width:100%;padding:3px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px';
        const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '（なし）'; charSel.appendChild(noneOpt);
        chars.forEach(c => {
          const o = document.createElement('option'); o.value = c.id; o.textContent = c.name;
          if (line.characterId === c.id) o.selected = true;
          charSel.appendChild(o);
        });
        charSel.onchange = () => { line.characterId = charSel.value || null; };

        // テキスト
        const textArea = document.createElement('textarea');
        textArea.value = line.text ?? ''; textArea.placeholder = 'セリフ'; textArea.rows = 2;
        textArea.style.cssText = 'width:100%;padding:3px 4px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px;resize:vertical';
        textArea.oninput = () => { line.text = textArea.value; };

        // 位置
        const posSel = document.createElement('select');
        posSel.style.cssText = 'width:100%;padding:3px 2px;border-radius:3px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:11px';
        ['left','center','right'].forEach(pos => {
          const o = document.createElement('option'); o.value = pos; o.textContent = pos;
          if ((line.position ?? 'center') === pos) o.selected = true;
          posSel.appendChild(o);
        });
        posSel.onchange = () => { line.position = posSel.value; };

        // 削除
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
      addRowBtn.onclick = () => {
        step.lines.push({ characterId: null, position: 'center', text: '' });
        buildTable();
      };
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
  const txtInp = (obj, key, placeholder) => {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = placeholder; inp.value = obj[key] ?? '';
    inp.style.cssText = 'flex:1;min-width:100px;padding:3px 5px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
    inp.oninput = () => { obj[key] = inp.value || undefined; };
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
    case 'setFlagWithTurn':
      wrap.append(lbl('フラグ名:'), txtInp(eff, 'flag', 'フラグ名')); break;
    case 'baseTransfer': {
      wrap.append(
        lbl('移行元勢力:'), sel(eff, 'fromFactionId', factions.map(f => ({ value: f.id, label: f.name }))),
        lbl('移行先勢力:'), sel(eff, 'toFactionId', factions.map(f => ({ value: f.id, label: f.name })), true)
      ); break;
    }
    case 'attackUnlock': {
      wrap.append(lbl('対象勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })))); break;
    }
    case 'legionForceAttack': {
      wrap.append(lbl('攻撃元勢力:'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name }))),
        lbl('攻撃対象勢力:'), sel(eff, 'targetFactionId', factions.map(f => ({ value: f.id, label: f.name })), true)
      ); break;
    }
    case 'setFlag':
    case 'clearFlag':
      wrap.append(lbl('フラグ名:'), txtInp(eff, 'flag', 'フラグ名')); break;
    case 'legionUpdate': {
      const freqInp = numInp(eff, 'attackFrequency', '頻度(省略可)', 0); freqInp.style.width = '90px';
      wrap.append(lbl('軍団:'), sel(eff, 'legionId', legions.map(l => ({ value: l.id, label: `${l.name ?? l.id}` }))), lbl('勢力(省略可):'), sel(eff, 'factionId', factions.map(f => ({ value: f.id, label: f.name })), true), lbl('頻度:'), freqInp); break;
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

function _charSelect(obj, key) {
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
  const none = document.createElement('option'); none.value = ''; none.textContent = '（指定なし）'; sel.appendChild(none);
  const chars = _data?.characters?.characters ?? [];
  chars.filter(c => !c.isTemplate).forEach(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.name} (${c.id})`;
    if (obj[key] === c.id) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { obj[key] = sel.value || null; };
  return sel;
}

function _charSelectRaw(obj, key) {
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;min-width:120px;padding:3px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px';
  const chars = _data?.characters?.characters ?? [];
  chars.filter(c => !c.isTemplate).forEach(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.name} (${c.id})`;
    if (obj[key] === c.id) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { obj[key] = sel.value; };
  return sel;
}
