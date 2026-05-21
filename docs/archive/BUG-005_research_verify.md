# BUG-005: ResearchScene BuildingSystem 接続 — 確認タスク

## 状況

コード確認済みの結果、**BUG-005 はすでに修正済み**。

### 確認済み内容

`ResearchScene.jsx`:
```js
export default function ResearchScene({ onNavigate, buildingSystem, buildings=[], treasury=0, onResearch }) {
  const allDefs = buildingSystem ? buildingSystem.getAllDefs() : [];
```

`App.jsx`:
```js
return <ResearchScene
  buildingSystem={systems?.buildingSystem}
  buildings={game.buildings}
  treasury={playerFaction?.treasury ?? 0}
  onResearch={(id) => game.actions.doResearch(id)}
  onNavigate={navigate}
/>;
```

接続完了済み。

## やること

動作確認のみ。

1. `http://localhost:5174` でゲームを開始
2. マップ → 拠点クリック → 研究 を開く
3. 研究リストに BuildingSystem のデータが表示されること
4. ミーム残高が実際の所持ミームと一致すること
5. 研究ボタンを押すと完了マークが付くこと

確認後、KNOWLEDGE.md の BUG-005 を解決済みテーブルに移動する：

```
| BUG-005 | ResearchScene BuildingSystem未接続 | 2026-05-14 |
```
