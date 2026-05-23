# 内政実装 Phase A — GameContext基盤・TopBar・研究ターン制

> 完了後: このファイルを `docs/archive/` に移動し、KNOWLEDGE.md §6 と §18 を更新すること

---

## 前提確認

- デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止
- `KNOWLEDGE.md` のみ参照
- 5174のみ起動。作業前後に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認

---

## ファイル構造の注意点

- 研究データは `research.json` ではなく **`src/game/data/facilities.json`** の `research` 配列
- BuildingSystem は `facilities.json` を直接 import している
- EventEngine は `src/game/systems/` にある（正確なパスは `find` で確認すること）

---

## Step 1: GameContext 拡張

**ファイル:** `src/context/GameContext.jsx`

### 1-1. createInitialState() に追加

```js
actionPoints:    5,
maxActionPoints: 5,
researchQueue:   null,   // null | { id: string, turnsRemaining: number }
upgradeUnlocks:  ['sp_refill', 'sp_max_up'],
secretaryId:     null,   // null | charId string
```

### 1-2. NEXT_TURN reducer に追加

既存の return 直前に以下を追加:

```js
// 行動力全回復
actionPoints: state.maxActionPoints,

// 研究キュー消化
researchQueue: (() => {
  const q = state.researchQueue;
  if (!q) return null;
  const remaining = q.turnsRemaining - 1;
  if (remaining <= 0) return null;  // 完了処理は下記で別途実施
  return { ...q, turnsRemaining: remaining };
})(),

upgradeUnlocks: (() => {
  const q = state.researchQueue;
  if (!q || q.turnsRemaining - 1 > 0) return state.upgradeUnlocks;
  // 研究完了: facilities.json の unlocks.upgradeCommands を追加
  const def = /* facilities.json の research 配列から q.id で取得 */ ...;
  const newCmds = def?.unlocks?.upgradeCommands ?? [];
  return [...new Set([...state.upgradeUnlocks, ...newCmds])];
})(),

eventFlags: (() => {
  const q = state.researchQueue;
  if (!q || q.turnsRemaining - 1 > 0) return state.eventFlags;
  // 研究完了フラグをセット
  const def = /* facilities.json の research 配列から q.id で取得 */ ...;
  const newFlags = {};
  (def?.unlocks?.flags ?? [`${q.id}_done`]).forEach(f => { newFlags[f] = true; });
  return { ...state.eventFlags, ...newFlags };
})(),
```

**実装方針:** NEXT_TURN の switch case 内で `facilities.json` を直接 import して参照するか、
`createInitialState` と同じファイル内で `researchDefs` として定数化して参照すること。
BuildingSystem のインスタンスは reducer 内では使えない（副作用禁止）ため注意。

### 1-3. applyEffectToState に actionPointsBonus ケースを追加

```js
case 'actionPointsBonus': {
  return {
    ...state,
    maxActionPoints: (state.maxActionPoints ?? 5) + (eff.delta ?? 1),
  };
}
```

### 1-4. SET_SECRETARY アクション追加（reducer）

```js
case 'SET_SECRETARY':
  return { ...state, secretaryId: action.payload.secretaryId };
```

### 1-5. START_NEW_GAME / LOAD_SAVE 対応

`LOAD_SAVE` case: `createInitialState()` のデフォルトをスプレッドした後に payload を上書きしているため、
新フィールドは `action.payload` に存在しない場合にデフォルト値が適用される。
ただし `deserializeToState` の return に以下を追加すること:

```js
actionPoints:    data.actionPoints    ?? 5,
maxActionPoints: data.maxActionPoints ?? 5,
researchQueue:   data.researchQueue   ?? null,
upgradeUnlocks:  data.upgradeUnlocks  ?? ['sp_refill', 'sp_max_up'],
secretaryId:     data.secretaryId     ?? null,
```

### 1-6. serializeState に追加

```js
actionPoints:    state.actionPoints    ?? 5,
maxActionPoints: state.maxActionPoints ?? 5,
researchQueue:   state.researchQueue   ?? null,
upgradeUnlocks:  [...(state.upgradeUnlocks ?? [])],
secretaryId:     state.secretaryId     ?? null,
```

セーブバージョンを **8** に上げること（`SAVE_VERSION = 8`）。
旧 v7 セーブを読み込んだ場合は上記デフォルト値が自動適用されるため互換性あり。

### 1-7. GameProvider の actions に追加

```js
setSecretary: useCallback((charId) => {
  dispatch({ type: 'SET_SECRETARY', payload: { secretaryId: charId } });
}, [dispatch]),

startResearchQueue: useCallback((id) => {
  // ミーム消費 + researchQueue セット
  // facilities.json の def.cost を参照してミームを引き落とす
  // dispatch SET_TREASURY (player faction treasury - cost)
  // dispatch SET_RESEARCH_QUEUE
}, [dispatch, ...]),

consumeActionPoint: useCallback(() => {
  dispatch({ type: 'CONSUME_AP' });
}, [dispatch]),

upgradeChar: useCallback((char, commandId) => {
  // コマンドIDに応じてキャラを更新 + ミーム消費 + AP消費
  // 定義は下記 Step 4 参照
}, [...]),
```

`CONSUME_AP` reducer case:

```js
case 'CONSUME_AP':
  return { ...state, actionPoints: Math.max(0, state.actionPoints - 1) };
```

`SET_RESEARCH_QUEUE` reducer case:

```js
case 'SET_RESEARCH_QUEUE':
  return { ...state, researchQueue: action.payload.queue };
```

### 1-8. useGame() の return に公開

```js
actionPoints, maxActionPoints, researchQueue, upgradeUnlocks, secretaryId,
```

---

## Step 2: TopBar に行動力表示を追加

**ファイル:** `src/shared/SharedUI.jsx`

`TopBar` コンポーネントの props に `actionPoints` / `maxActionPoints` を追加。

表示: breadcrumb なし（マップ画面）の通常ステータス列の末尾に追加:

```js
{ label: '行動力', val: `${actionPoints ?? 5}/${maxActionPoints ?? 5}`, c: TEAL, prefix: '⚡' }
```

**呼び出し側（MapScene または App.jsx）** で `useGame()` から `actionPoints` / `maxActionPoints` を取得して TopBar に渡すこと。
MapScene が TopBar を直接レンダリングしているか App.jsx 経由かを確認して適切な方を修正する。

---

## Step 3: ResearchScene をターン制UIに変更

**ファイル:** `src/scenes/ResearchScene.jsx`

### 変更方針

現行の `doResearch(id)` は BuildingSystem 経由で即時完了する。
これを「研究キューに投入して数ターン後に完了」に変える。

### props 変更

```js
// 追加props
researchQueue,       // null | { id, turnsRemaining }
onStartResearch,     // (id) => void  ← 旧 onResearch の代替
```

旧 `onResearch` prop は削除（App.jsx 側の渡し方も変更すること）。

### facilities.json フィールド追加

**`src/game/data/facilities.json`** の各研究エントリに以下を追加:

```json
"turns": 3,
"prerequisites": { "research": [], "flags": [] },
"unlocks": { "upgradeCommands": [], "flags": [] }
```

既存5件に追記。`sp_refill` / `sp_max_up` アンロックが必要な研究については
`unlocks.upgradeCommands` に該当IDを入れること（ゲームデザイン未確定のため今は空配列でよい）。

完了フラグは `unlocks.flags` が空の場合 `${id}_done` をデフォルトとして GameContext 側で生成する（Step 1-2 参照）。

### UI変更内容

1. **研究中表示**: `researchQueue` が non-null の場合、リスト上部に
   「研究中: {name} あと{researchQueue.turnsRemaining}ターン」バナーを表示

2. **グレーアウト**: `researchQueue` が non-null の場合、他の全研究ボタンを `disabled` にする

3. **実行ボタン**: クリック時に `onStartResearch(sel.id)` を呼ぶ。
   ミーム消費は GameContext の `startResearchQueue` 内で処理するため Scene 側は呼ぶだけでよい

4. **完了済み**: 従来通り `buildings.includes(id)` でグレーアウト

### App.jsx 側の変更

```jsx
// 変更前
case 'research':
  return <ResearchScene
    onResearch={(id) => game.actions.doResearch(id)}
    ...
  />;

// 変更後
case 'research':
  return <ResearchScene
    researchQueue={game.researchQueue}
    onStartResearch={(id) => game.actions.startResearchQueue(id)}
    ...
  />;
```

---

## 完了条件（Phase A）

- [ ] `npm run dev` でコンパイルエラーなし
- [ ] QA環境（`?qa=battlefull`）で既存の戦闘フローが壊れていない
- [ ] マップ画面 TopBar に `⚡5/5` が表示される
- [ ] ターンエンド後に行動力が全回復する
- [ ] ResearchScene で研究を投入するとキューに入り、ターン経過で完了する
- [ ] 研究中は他の研究ボタンがグレーアウトされる
- [ ] セーブ→ロードで `researchQueue` / `secretaryId` / `maxActionPoints` が保持される
- [ ] 旧 v7 セーブを読み込んでもクラッシュしない（デフォルト値が入る）

---

## 完了後

1. このファイルを `docs/archive/` に移動
2. `KNOWLEDGE.md` §6 の ResearchScene 行に変更内容を追記
3. `KNOWLEDGE.md` §18 残タスクの該当項目を完了マーク
4. Phase B プロンプト（`PROMPT_domestic_phase_b.md`）の着手を報告
