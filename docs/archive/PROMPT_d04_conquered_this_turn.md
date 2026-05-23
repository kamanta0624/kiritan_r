# PROMPT: D-04 conqueredThisTurn → canAttack 反映

> 作成: 2026-05-22
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

## 概要

1ターンに同じ勢力の複数拠点を連続制圧できるバグ。
`conqueredThisTurn` が `true` の間、追加の攻撃制圧を禁止する。

## 修正箇所

### 1. src/App.jsx — MapScene に conqueredThisTurn を渡す

```jsx
case 'map':
  return <MapScene
    ...
    conqueredThisTurn={game.conqueredThisTurn}  // ← 追加
    ...
  />;
```

`game.conqueredThisTurn` は GameContext の state から直接参照可能（value に展開済み）。

### 2. src/scenes/MapScene.jsx — props 追加 + canAttack 修正

props に追加：

```jsx
export default function MapScene({ ..., conqueredThisTurn }) {
```

`liveNodes` useMemo 内の `canAttack` 行を変更：

```js
// 変更前
canAttack: !isPlayer && isAtWar && attackableIds.has(b.id),

// 変更後
canAttack: !isPlayer && isAtWar && attackableIds.has(b.id) && !conqueredThisTurn,
```

`useMemo` の依存配列に `conqueredThisTurn` を追加：

```js
}, [basesData, factionsData, conqueredThisTurn]);
```

## 動作確認

1. 攻撃で拠点を制圧する
2. 同ターン中、別の拠点の `canAttack` が `false` になること（攻撃ボタンが出ない）
3. ターン終了後（NEXT_TURN dispatch で `conqueredThisTurn: false` にリセット）、攻撃可能に戻ること
