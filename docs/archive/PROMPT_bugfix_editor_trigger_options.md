# PROMPT: BUG-B — エディタ TRIGGER_OPTIONS 欠落 + 未登録トリガー防御

## 症状
エディタで `char_defeated` トリガーのイベント（例: `ev_defeated_awamo`）を開くと、
タイミング欄に「ゲーム開始」と表示される。実データは `char_defeated` のまま保持されるが、
ユーザーがセレクトボックスに触れると意図せず上書きされるリスクがある。

## 根本原因
`tools/editor-modules/tab-events.js` の `TRIGGER_OPTIONS`（L61-71）に以下2値が未登録:

| 値 | 用途 |
|---|---|
| `char_defeated` | GameContext L984 `processTrigger` 経由の撃破トリガー |
| `theater` | TheaterScene 用分類マーカー（EventEngine 経由ではない） |

セレクトボックス生成時（L478-482）、`ev.trigger` と一致する option がないため
ブラウザが先頭 option（`game_start`）を表示。`onchange`（L483）でのみ上書きされるため
パッシブ保存では破壊されないが、誤タッチで破壊される。

リスト表示（L357）は `?? ev.trigger` フォールバックがあり安全。

## 修正

### 対象ファイル
`tools/editor-modules/tab-events.js`

### 修正1: TRIGGER_OPTIONS に欠落値を追加

#### 変更前（L61-71）
```js
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
```

#### 変更後
```js
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
  { value: 'char_defeated',       label: '敵キャラ撃破時' },
  { value: 'theater',             label: '劇場（手動再生）' },
];
```

### 修正2: 詳細ペインのセレクトボックスに未登録値の防御を追加

将来の trigger 追加漏れに備え、ev.trigger が TRIGGER_OPTIONS に存在しない場合でも
正しく表示・保持されるようにする。

#### 変更前（L478-483）
```js
  const trigSel = document.createElement('select');
  TRIGGER_OPTIONS.forEach(t => {
    const o = document.createElement('option'); o.value = t.value; o.textContent = t.label;
    if (ev.trigger === t.value) o.selected = true;
    trigSel.appendChild(o);
  });
  trigSel.onchange = () => { ev.trigger = trigSel.value; };
```

#### 変更後
```js
  const trigSel = document.createElement('select');
  let triggerFound = false;
  TRIGGER_OPTIONS.forEach(t => {
    const o = document.createElement('option'); o.value = t.value; o.textContent = t.label;
    if (ev.trigger === t.value) { o.selected = true; triggerFound = true; }
    trigSel.appendChild(o);
  });
  // 未登録 trigger の防御: 生値を option として追加し選択状態にする
  if (!triggerFound && ev.trigger) {
    const o = document.createElement('option');
    o.value = ev.trigger; o.textContent = `⚠ ${ev.trigger}`; o.selected = true;
    trigSel.appendChild(o);
  }
  trigSel.onchange = () => { ev.trigger = trigSel.value; };
```

## 触らないもの
- リスト表示のフォールバック（L357）— 既に安全
- フィルタ用セレクトボックス（L300-306）— 全件表示の `all` が先頭にあり影響なし
- EventEngine.js / GameContext.jsx — ランタイム側は正常

## 検証手順
1. `npm run editor` → イベントタブを開く
2. `ev_defeated_awamo` を選択 → タイミング欄が「敵キャラ撃破時」と表示されること
3. `theater` タイプのイベントを選択 → タイミング欄が「劇場（手動再生）」と表示されること
4. いずれかのイベントを保存 → JSON の trigger 値が変化していないこと
