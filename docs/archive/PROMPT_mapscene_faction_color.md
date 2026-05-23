# PROMPT: App.jsx onNodeClick の owner 参照バグ修正

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 背景

MapScene の liveNodes から `owner` フィールドが廃止され `factionColor`/`factionName` ベースに変更済み。
しかし App.jsx の onNodeClick が旧フィールド `node.owner` を参照したまま残っており、
BaseMenuScene に渡る `isOwned` が常に `false`、`canAttack` が常に `true` になっている。

---

## 対象ファイル

`src/App.jsx`

---

## 修正内容

**場所**: `case 'map':` の `onNodeClick` prop（約150行目）

```jsx
// 変更前（バグ）
onNodeClick={(node) => navigate('base_menu', {
  node,
  isOwned:    node.owner === 'player',
  canAttack:  node.canAttack ?? node.owner !== 'player',
  hasDungeon: !!node.dungeonId,
})}

// 変更後
onNodeClick={(node) => navigate('base_menu', {
  node,
  isOwned:    node.factionId === playerFaction?.id,
  canAttack:  node.canAttack ?? false,
  hasDungeon: !!node.dungeonId,
})}
```

`playerFaction` は既に App.jsx のスコープ内で定義済み（game から分割代入）。

---

## 動作確認

1. `npm run dev` 起動
2. 新規ゲーム → マップで自軍拠点をクリック → BaseMenuScene が `isOwned:true` で開くこと
3. 交戦中勢力の隣接拠点をクリック → `canAttack:true` で開くこと
4. 交戦していない勢力の拠点をクリック → `canAttack:false` で開くこと
