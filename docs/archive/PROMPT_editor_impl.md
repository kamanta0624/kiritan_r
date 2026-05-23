# エディタ改修

> 作業前に `KNOWLEDGE.md` を読むこと
> 内政実装（PROMPT_domestic_impl.md）の前に本タスクを完了させること

---

## 前提確認

- エディタ起動: `node tools/editor.cjs` → localhost:3001
- データパス: `src/game/data/`
- 画像パス: `public/`
- イベント保存方式: `_index.json` + 個別JSONファイル（`/api/save/events` で実装済み）

---

## 調査事項（作業前にエディタを開いて確認せよ）

```
lsof -i :3001 | grep LISTEN
# 起動していなければ: node tools/editor.cjs
# ブラウザで http://localhost:3001 を開く
```

`HANDOVER_20260522.md` に記載の未対応項目を実際に確認してから実装に入ること。
エディタUIで操作不能または表示されないものが対応必須。

---

## タスク一覧

### Task A: 未実装トリガーの追加

**ファイル:** `tools/editor-modules/tab-events.js`

`TRIGGER_OPTIONS` に以下を追加:

```js
{ value: 'before_faction_turn', label: '特定勢力ターン行動前' },
```

確認: 既に `TRIGGER_OPTIONS` に含まれているため追加不要の可能性あり。
実際のコードを確認してから判断すること。

---

### Task B: 未実装条件の追加

**ファイル:** `tools/editor-modules/tab-events.js`

`CONDITION_TYPES` に以下を追加:

```js
{ value: 'defeatedChar', label: '特定キャラを撃破済み', params: ['charId:キャラID'] },
```

確認: `noOther` / `turnAfterFlag` は既にCONDITION_TYPESに含まれているため追加不要。
`defeatedChar` のみ確認・追加。

EventEngine の `_evalCondition` には `defeatedChar` の実装がある（`ctx.defeatedCharId === cond.charId`）。
条件パラメータ入力UIの `charId` キーは既存の `_charSelectRaw` ヘルパーが処理するため問題なし。

---

### Task C: 未実装エフェクトの追加

**ファイル:** `tools/editor-modules/tab-events.js`

`EFFECT_TYPES` および `_buildEffectParams` の switch 文に以下を追加:

#### C-1: `actionPointsBonus`（内政実装で追加される新エフェクト）

```js
// EFFECT_TYPES に追加
{ value: 'actionPointsBonus', label: '行動力上限増加' },
```

```js
// _buildEffectParams の switch に追加
case 'actionPointsBonus':
  wrap.append(lbl('増減:'), numInp(eff, 'delta', '増減値（+1 など）')); break;
```

確認: EventEngine に `actionPointsBonus` は内政実装（Step 1）で追加される。
エディタ側は先行して対応しておく。

#### C-2: 既存エフェクトで `_buildEffectParams` にパラメータUIがないもの

以下を確認し、UIが `default` の fallback（JSON textarea）になっていないか検証する:
- `dungeonUnlock` → 拠点セレクトがあるはず ✅（コードに記載あり）
- `itemGain` / `itemLose` → アイテムセレクトがあるはず ✅
- `charUsedThisTurn` → キャラセレクトがあるはず ✅
- `legionForceAttack` → 勢力セレクト×2があるはず ✅
- `legionUpdate` → 軍団セレクトがあるはず ✅

上記はすべて実装済みと見られるが、実際に動作確認すること。

---

### Task D: choice の `effectsKey` 分岐対応

**ファイル:** `tools/editor-modules/tab-events.js`

現状の choice エディタを確認する。各選択肢に `effects`（配列）の入力UIはあるが、
`effectsKey`（文字列）の入力フィールドがあるかを確認する。

EventEngine の処理:
```js
if (c.effects && c.effects.length > 0) {
  EventEngine.applyEffects(ws, c.effects);   // 直接エフェクト
} else if (c.effectsKey) {
  pendingEffectsKey = c.effectsKey;           // キーで後処理
}
```

`effectsKey` フィールドの入力欄が選択肢カード内にない場合、以下を追加する:

```js
// 選択肢カード内（labelRow の下、effSection の上）に追加
const keyRow = document.createElement('div');
keyRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
const keyLbl = document.createElement('span');
keyLbl.textContent = 'effectsKey（上級）:';
keyLbl.style.cssText = 'font-size:11px;color:var(--color-text-secondary);white-space:nowrap';
const keyInp = document.createElement('input');
keyInp.type = 'text'; keyInp.value = choice.effectsKey ?? '';
keyInp.placeholder = 'effectsKeyを使う場合のみ';
keyInp.style.cssText = 'flex:1;padding:3px 6px;border-radius:4px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:12px';
keyInp.oninput = () => { choice.effectsKey = keyInp.value || undefined; };
keyRow.append(keyLbl, keyInp);
choiceCard.appendChild(keyRow);
```

---

### Task E: `base_visit` / `base_defense` トリガーの発火確認

**これはコード修正ではなく調査タスク。**

`KNOWLEDGE.md` に「`base_visit` / `base_defense` はGameContextからも未発火」と記載されている。

`src/scenes/BaseMenuScene.jsx` と `src/App.jsx` を確認し、以下を調べる:
1. `base_visit` トリガーで `EventEngine.processTrigger` を呼んでいる箇所があるか
2. `base_defense` トリガーで同様の呼び出しがあるか
3. ない場合、どこで呼べばよいか（呼び出し候補）を `KNOWLEDGE.md §18 残タスク` に追記する

**修正はしない。調査結果をKNOWLEDGE.mdに記録するだけ。**
発火実装は別タスクで切り出す。

---

### Task F: 内政実装で追加されるデータへの対応

内政実装（PROMPT_domestic_impl.md）では以下のJSONファイルが新規作成・変更される。
エディタがこれらを読み込まないと、保存時に新フィールドを消してしまうリスクがある。

#### F-1: `events.json` に `type:'theater'` イベントが追加される

現在のエディタのイベント一覧では `type` フィールドを表示していない。
`_buildList` 関数内のリスト項目に `type` を表示する:

```js
// 変更前
const trigLabel = TRIGGER_OPTIONS.find(t => t.value === ev.trigger)?.label ?? ev.trigger;
item.innerHTML = `...<div ...>${trigLabel} / p=${ev.probability} / pri=${ev.priority}</div>`;

// 変更後（type が 'theater' の場合に視覚的に区別）
const trigLabel = ...;
const typeLabel = ev.type ? `[${ev.type}] ` : '';
item.innerHTML = `...<div ...>${typeLabel}${trigLabel} / p=${ev.probability} / pri=${ev.priority}</div>`;
```

`_buildEditor` の基本情報セクションに `type` フィールドの入力を追加する（`trigger` セレクトの上）:

```js
_field(pane, 'タイプ', _inp(ev, 'type', 'theater / (空=通常イベント)'));
```

#### F-2: `theater` typeイベント固有フィールド

内政実装で追加されるイベントのフォーマット:
```json
{
  "type": "theater",
  "category": "recurring",
  "title": "...",
  "description": "...",
  "conditions": { "chars": [], "flags": [], "ownedBase": null, "minTurn": null },
  "cost": { "actionPoints": 1 },
  "script": "event_sample_001",
  "onComplete": [],
  "repeatable": true
}
```

既存イベントの `conditions` は配列（`[]`）だが、theaterイベントは**オブジェクト形式**（`{}`）で異なる。
エディタの `_buildConditions` は配列前提のため、theater typeイベントを選択すると表示が壊れる。

対応:
- `_buildEditor` の冒頭で `ev.type === 'theater'` を検出し、theater専用セクションを表示する分岐を追加する
- theater専用セクション: `category` セレクト、`title`/`description` 入力、`repeatable` チェックボックス、`onComplete` エフェクトリスト（既存の `_buildEffectRow` を流用）
- theater typeの場合、通常の `_buildConditions`（配列前提）を呼ばず、theater conditions（オブジェクト）を編集するシンプルなフォームを表示する

theater conditions フォーム（最小限）:
```
chars:      テキスト入力（カンマ区切りのcharId）
flags:      テキスト入力（カンマ区切りのフラグ名）
notFlags:   テキスト入力（カンマ区切りのフラグ名）
ownedBase:  拠点セレクト（nullable）
minTurn:    数値入力（nullable）
```

#### F-3: `secretary_lines.json` はエディタ対応不要

`src/game/data/secretary_lines.json` は `/api/data` エンドポイントで読み込まれない。
今回は対応しない。台詞編集は直接JSONファイルを編集する運用とする。

---

## 完了条件

- [ ] `defeatedChar` 条件がドロップダウンに追加されている
- [ ] `actionPointsBonus` エフェクトがドロップダウンに追加されている
- [ ] choice の `effectsKey` フィールドが入力できる
- [ ] イベントリストに `type` が表示される
- [ ] theater typeイベントを選択しても表示が壊れない（専用フォームが出る）
- [ ] `base_visit` / `base_defense` の発火状況調査結果が `KNOWLEDGE.md §18` に追記されている
- [ ] QA環境（`?qa=battlefull`）でゲーム本体の動作が壊れていない

---

## 完了後

このファイルを `docs/archive/` に移動する。
`KNOWLEDGE.md §18 残タスク` を更新する（エディタ移植を完了としてチェック）。
内政実装（`PROMPT_domestic_impl.md`）に進む。
