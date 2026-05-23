# PROMPT: TopBar 実数値接続

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 概要

TopBar の ターン・ミーム・収入・拠点表示が `tokens.js` の `GAME_STATE`
ハードコード値になっている。GameContext の実数値を渡すよう修正する。
あわせて意味のない「ROUND 1 / 5」表示を削除する。

---

## 修正

### MapScene.jsx — TopBar に gameState を展開して渡す

```jsx
// 変更前
<TopBar scene="map" currentArea={currentArea} rightSlot={...} />

// 変更後
<TopBar scene="map" currentArea={currentArea}
  turn={gameState?.turn}
  meme={gameState?.meme}
  income={gameState?.income}
  bases={gameState?.bases}
  rightSlot={...}
/>
```

### SharedUI.jsx — ROUND 表示を削除

```jsx
// 削除する
<div style={{marginLeft:'auto', paddingLeft:12, fontFamily:'Rajdhani',
  fontSize:15, fontWeight:700, letterSpacing:1, color:TX,
  whiteSpace:'nowrap', flexShrink:0}}>
  ROUND {GAME_STATE.round}
</div>
```

ClaudeDesign がデザインHTMLに入れた飾り文字列をベタ移植したもの。実装と無関係のため削除。

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/scenes/MapScene.jsx` | TopBar に `turn`/`meme`/`income`/`bases` を渡す（1箇所） |
| `src/shared/SharedUI.jsx` | ROUND表示ブロック削除（1箇所） |

---

## 確認

1. 新規ゲーム開始 → ターン 1、ミームが実際の treasury 値になること
2. ターン終了後 → ターンが 2 に増加、収入分ミームが増えていること
3. 拠点を制圧 → 拠点の分子が増加すること
4. 右上に「ROUND 1 / 5」が表示されないこと
