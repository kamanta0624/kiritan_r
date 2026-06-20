# PROMPT: BUG-A — battleEnd の ws.bases が BATTLE_END reducer 反映前の値を参照する

## 症状
`base_conquered` トリガーのイベント（例: `ev_qa_fukushima_conquest`）が制圧直後に発火しない。
`baseOwned` 条件が常に false になる。

## 根本原因
`GameContext.jsx` の `battleEnd` 関数内で:

1. **L956** `dispatch({ type: 'BATTLE_END', payload: result })` — React に reducer 適用を要求
2. **L773** `stateRef.current = state` — レンダリング本体で更新（dispatch 後の再レンダリングまで実行されない）
3. **L959** `const ws = buildWsAdapter()` — `stateRef.current`（= 旧 state）を読む

結果: `ws.bases` は BATTLE_END reducer 適用前の値。制圧した拠点の `factionId` が敵のまま。
`EventEngine.js` L141-143 の `baseOwned` 条件が false を返す。

## 修正

### 対象ファイル
`src/context/GameContext.jsx`

### 修正箇所
`battleEnd` 関数内、`const ws = buildWsAdapter();` の直後にある既存の `eventFlags` パッチブロックに `bases` パッチを追加。

### 変更前（L959-965）
```js
    const ws = buildWsAdapter();
    if (result.conquered) {
      ws.eventFlags = {
        ...ws.eventFlags,
        [`conquered_${result.defenderBaseId}`]: true,
      };
    }
```

### 変更後
```js
    const ws = buildWsAdapter();
    if (result.conquered) {
      // dispatch 後 re-render 前のため stateRef は旧値。bases を手動パッチ。
      ws.bases = ws.bases.map(b =>
        b.id === result.defenderBaseId
          ? { ...b, factionId: result.winnerFactionId }
          : b
      );
      ws.eventFlags = {
        ...ws.eventFlags,
        [`conquered_${result.defenderBaseId}`]: true,
      };
    }
```

### 影響範囲
この `ws` は以下3トリガーで共有される。1箇所のパッチで全て修正される:
- `base_conquered`（L969）
- `battle_end`（L977）
- `char_defeated`（L985）

### 触らないもの
- `buildWsAdapter` 本体（汎用関数。局所パッチで対処）
- BATTLE_END reducer（正常動作）
- EventEngine.js（正常動作）

## 検証手順
1. `?qa=battlefull` で拠点制圧を実行
2. `base_conquered` トリガーかつ `baseOwned` 条件を持つイベントが発火することを確認
3. 制圧後の `battle_end` / `char_defeated` トリガーイベントの `baseOwned` 条件も正常評価されることを確認
