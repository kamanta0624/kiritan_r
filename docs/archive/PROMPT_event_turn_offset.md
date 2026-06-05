# PROMPT: イベントターン判定ずれ修正

## 問題

`startPlayerTurn` にてターン1→2のイベントが1ターン遅延して発火する。

## 真因

`GameContext.jsx` の `startPlayerTurn` 内処理順：

```js
dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } }); // currentTurn += 1
const wsAdapter = buildWsAdapter(); // stateRef.current を参照 ← まだ古い値
await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
```

`dispatch` は React の非同期 state 更新であり、同一コールバック内では `stateRef.current` にすぐ反映されない。
`buildWsAdapter()` 呼び出し時点で `stateRef.current.currentTurn` は dispatch 前の値のまま。
結果、`player_turn` イベントの条件 `{ type: 'turn', op: 'eq', value: 2 }` 等が1ターン遅れて評価される。

## 修正箇所

**`src/context/GameContext.jsx`** の `startPlayerTurn` コールバック内。

### 修正前

```js
dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } });

const wsAdapter = buildWsAdapter();
await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
```

### 修正後

```js
dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } });

const wsAdapter = buildWsAdapter();
wsAdapter.currentTurn = s.currentTurn + 1; // NEXT_TURN後の実ターン値に補正
await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
```

`s` は `startPlayerTurn` 冒頭の `const s = stateRef.current;` で取得済み。

## 確認

- 修正後、ターン1終了→ターン2開始時に `{ type: 'turn', op: 'eq', value: 2 }` 条件のイベントが正しく発火すること
- 既存の `startNewGame` の `game_start` イベント（ターン1）には影響しないこと（別コールバック）
