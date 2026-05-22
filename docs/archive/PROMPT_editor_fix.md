# エディタ バグ修正・機能補完

> KNOWLEDGE.md を読んでから作業すること
> このタスクは PROMPT_editor_impl.md の未実装残件 + 新規バグ修正を含む

---

## 前提確認

- エディタ起動: `node tools/editor.cjs` → localhost:3001
- ファイル: `tools/editor-modules/tab-events.js`, `tools/editor-modules/main.js`, `tools/editor.cjs`, `tools/editor-ui.html`

---

## Bug 1: イベントタブのスクロールが全く効かない【最優先】

### 根本原因

`main.js` の `renderAll()` が全タブで `main.style.overflow = ''` をセットしている。
`.main` のCSSは `overflow:hidden` だが、eventsタブ呼び出し時にこれが消える。
結果として `_render()` のgrid `height:100%` が効かず、center/rightペインの `overflow-y:auto` が機能しない。

### 修正箇所1: `tools/editor-modules/main.js`

`renderAll()` 内の `main.style.overflow = ''` の後、eventsタブのみ `overflow:hidden` を維持する:

```js
function renderAll() {
  if (!state.data) return;
  const main = document.getElementById('mainArea');
  main.style.padding  = '';
  main.style.overflow = '';
  try {
    if      (state.tab === 'characters') renderCharTab(main);
    else if (state.tab === 'items')      renderItemTab(main);
    else if (state.tab === 'factions')   renderFactionTab(main);
    else if (state.tab === 'map')        renderMapTab(main);
    else if (state.tab === 'legions')    renderLegionTab(main);
    else if (state.tab === 'events') {
      main.style.overflow = 'hidden';  // ← 追加
      main.style.padding  = '0';       // ← 追加
      initEventsTab(main, state.data);
    }
  } catch (err) { ... }
}
```

### 修正箇所2: `tools/editor-modules/tab-events.js` の `_render()`

containerに高さとoverflowを設定する:

```js
function _render() {
  _container.innerHTML = '';
  _container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden';  // ← 追加

  const layout = document.createElement('div');
  layout.style.cssText = 'display:grid;grid-template-columns:260px 1fr 300px;gap:12px;flex:1;min-height:0;padding:12px';  // height:100% → flex:1;min-height:0 に変更

  // ...以下変更なし
```

leftペインの `_buildList()` でリストが縮まないよう確認:
```js
// wrap の cssText に min-height:0 を追加済みか確認
wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;height:100%;min-height:0';
```

---

## Bug 2: 一括登録リンクが機能しない

`editor-ui.html` のヘッダに `<a href="/bulk-input.html">✦ 一括登録</a>` があるが:
- `bulk-input.html` が存在しない
- `editor.cjs` にルートがない

### 対応

`tools/bulk-input.html` を新規作成し、`editor.cjs` にルートを追加する。

#### `tools/bulk-input.html` の仕様

キャラクター一括登録画面。以下の機能を持つ:

**UIレイアウト（全画面、editor.cssを流用）:**
- ヘッダ: タイトル + 「← エディタに戻る」リンク（`href="/"`)
- 左カラム（400px）: JSONテキストエリア（入力）
- 右カラム（flex:1）: プレビューテーブル + 登録ボタン

**入力フォーマット（JSONテキストエリア）:**
```
以下のJSON配列を貼り付け:
[
  { "id": "char_xxx", "name": "名前", "soldiers": 100, "factionId": "faction_player", ... },
  ...
]
```

**プレビュー処理:**
- 「プレビュー」ボタンでJSONをパース
- テーブルに id / name / soldiers / factionId を表示
- パースエラーはエラーボックスで表示

**登録処理:**
- 「一括登録」ボタンで `/api/bulk-register/characters` にPOST
- 既存IDは上書き、新規IDは追加
- 成功/失敗をトースト表示

**必須フィールドのデフォルト値（未指定時に自動補完）:**
```js
{
  isTemplate: false,
  status: 'standby',
  maxSoldiers: soldiers ?? 100,
  charHp: 100, charMaxHp: 100,
  charAttack: 10, charSong: 5,
  soldierAtk: 8, soldierDef: 5,
  battleCapacity: 30,
  skills: [],
  nameVariants: [],
}
```

#### `tools/editor.cjs` への追加

1. `/bulk-input.html` のGETルート（`tools/bulk-input.html` を返す）
2. `/api/bulk-register/characters` のPOSTルート:
   - bodyを受け取り、`characters.json` を読み込む
   - 各エントリのデフォルト値を補完
   - 既存IDは上書き、新規は push
   - `characters.json` に書き出す
   - `{ ok: true, added: N, updated: M }` を返す

---

## Task B: `defeatedChar` 条件の追加（PROMPT_editor_impl.md Task B）

`tools/editor-modules/tab-events.js` の `CONDITION_TYPES` に追加:

```js
{ value: 'defeatedChar', label: '特定キャラを撃破済み', params: ['charId:キャラID'] },
```

確認: `charId` パラメータは `_charSelectRaw` で処理されるため追加のUI実装不要。

---

## Task C: `actionPointsBonus` エフェクトの追加（PROMPT_editor_impl.md Task C）

`EFFECT_TYPES` に追加:
```js
{ value: 'actionPointsBonus', label: '行動力上限増加' },
```

`_buildEffectParams` の switch に追加:
```js
case 'actionPointsBonus':
  wrap.append(lbl('増減:'), numInp(eff, 'delta', '増減値（+1 など）')); break;
```

---

## Task D: choice の `effectsKey` フィールド追加（PROMPT_editor_impl.md Task D）

`_buildChoicesInline()` 内、各選択肢カードの `labelRow` の下に `effectsKey` 入力フィールドを追加:

```js
// labelRow の直後に挿入
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
choiceCard.appendChild(keyRow);  // labelRow の直後
```

---

## Task F-1: イベントリストに `type` を表示（PROMPT_editor_impl.md Task F-1）

`_buildList()` の `item.innerHTML` を変更:

```js
// 変更前
item.innerHTML = `<div style="font-weight:500;color:var(--color-text-primary)">${ev.name}</div>
  <div style="font-size:11px;color:var(--color-text-secondary)">${trigLabel} / p=${ev.probability} / pri=${ev.priority}</div>`;

// 変更後
const typeLabel = ev.type ? `<span style="padding:1px 5px;border-radius:3px;background:#1a2a1a;color:#88ffaa;font-size:10px;margin-right:4px">[${ev.type}]</span>` : '';
item.innerHTML = `<div style="font-weight:500;color:var(--color-text-primary)">${typeLabel}${ev.name}</div>
  <div style="font-size:11px;color:var(--color-text-secondary)">${trigLabel} / p=${ev.probability} / pri=${ev.priority}</div>`;
```

---

## Task F-2: `_buildEditor()` に `type` フィールド追加（PROMPT_editor_impl.md Task F-2）

`_buildEditor()` の `_field(pane, 'ID', ...)` の前に追加:

```js
_field(pane, 'タイプ', _inp(ev, 'type', 'theater / (空=通常イベント)'));
```

theater type検出分岐と専用フォームについては **後回し**。
現状は type フィールドが編集できれば十分。theater専用フォームは次フェーズ。

---

## Task E: base_visit / base_defense 発火調査（PROMPT_editor_impl.md Task E）

`src/scenes/BaseMenuScene.jsx` と `src/App.jsx` を確認し、
`EventEngine.processTrigger('base_visit', ...)` / `'base_defense'` の呼び出し箇所を調査。

結果を `KNOWLEDGE.md §18 残タスク` に追記する（修正はしない）。

---

## 完了条件

- [ ] イベントタブでスクロールが機能する（center/rightペイン両方）
- [ ] 一括登録ページ（`/bulk-input.html`）が開き、キャラを登録できる
- [ ] `defeatedChar` 条件がドロップダウンに表示される
- [ ] `actionPointsBonus` エフェクトがドロップダウンに表示される
- [ ] choice の `effectsKey` フィールドが入力できる
- [ ] イベントリストに `type` が表示される
- [ ] `_buildEditor` に `type` 入力フィールドが追加されている
- [ ] `base_visit` / `base_defense` 調査結果が KNOWLEDGE.md に追記されている
- [ ] QA環境（`?qa=battlefull`）でゲーム本体の動作が壊れていない

---

## 完了後

このファイルを `docs/archive/` に移動する。
`PROMPT_editor_impl.md` も `docs/archive/` に移動する（統合・完了）。
`KNOWLEDGE.md §18 残タスク` を更新する。
