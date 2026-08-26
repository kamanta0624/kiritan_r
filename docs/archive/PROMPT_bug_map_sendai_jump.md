# PROMPT: MapScene 再マウントで視点が仙台に飛ぶバグ修正

## 症状
マップ画面で拠点をクリックすると視点が仙台に飛ぶ。

## 原因（コード根拠）

### 1. 仙台座標のハードコード
`src/scenes/MapScene.jsx` L410-411:
```js
// 仙台（x:3256, y:1019）を初期表示中央に
const initOffsetX = Math.max(0, Math.min(3256 - window.innerWidth/2, MAP_W - window.innerWidth));
const initOffsetY = Math.max(0, Math.min(1019 - (window.innerHeight-104)/2, MAP_H - (window.innerHeight-104)));
const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
```
MapScene のアンマウント → 再マウントの度に useState 初期値が採用される。

### 2. 拠点クリック時に focusBaseId 未指定
`src/App.jsx`:
- `case 'map'` L323-355: `onNodeClick={(node) => navigate('base_menu', {node, isOwned, canAttack, hasDungeon})}` → **focusBaseId 未指定**
- `case 'base_menu'` L367-378: 背景 MapScene を新規マウントするが **focusBaseId 未指定**
- L392: `onClose={() => navigate('map')}` → **focusBaseId 未指定**で map 再マウント

結果：base_menu 遷移時に背景 MapScene が仙台位置で再マウント、閉じて map に戻っても再マウントで仙台位置。

### 3. focusBaseId の仕組みは既存
`src/scenes/MapScene.jsx` L432-446 で `focusBaseId` と `focusKey` に応じてカメラ移動する useEffect が既に存在。防衛フロー（`startDefenseQueue` / `advanceDefenseQueue`）で使われている。今回はこの仕組みを拠点クリック経路にも接続するだけ。

## 修正指示

**触るファイル: `src/App.jsx` のみ。MapScene.jsx は変更禁止。**

### 修正1: `case 'map'` の onNodeClick（L323 付近）

現行:
```js
onNodeClick={(node) => navigate('base_menu', {
  node,
  isOwned:    node.factionId === playerFaction?.id,
  canAttack:  node.canAttack ?? false,
  hasDungeon: !!node.dungeonId,
})}
```

修正後:
```js
onNodeClick={(node) => {
  setFocusKey(k => k + 1);
  navigate('base_menu', {
    node,
    isOwned:     node.factionId === playerFaction?.id,
    canAttack:   node.canAttack ?? false,
    hasDungeon:  !!node.dungeonId,
    focusBaseId: node.id,
  });
}}
```

### 修正2: `case 'base_menu'` の背景 MapScene（L367-378 付近）

現行:
```jsx
<MapScene
  onNavigate={() => {}}
  onAttackNode={() => {}}
  onNodeClick={() => {}}
  gameState={gameState}
  basesData={bases}
  factionsData={factions}
  conqueredThisTurn={game.conqueredThisTurn}
  onNextTurn={() => {}}
/>
```

修正後: `focusBaseId` と `focusKey` を追加。他 prop は変更しない。
```jsx
<MapScene
  onNavigate={() => {}}
  onAttackNode={() => {}}
  onNodeClick={() => {}}
  gameState={gameState}
  basesData={bases}
  factionsData={factions}
  conqueredThisTurn={game.conqueredThisTurn}
  onNextTurn={() => {}}
  focusBaseId={sceneParams.focusBaseId}
  focusKey={focusKey}
/>
```

### 修正3: `case 'base_menu'` の onClose（L392）

現行:
```js
onClose={() => navigate('map')}
```

修正後: 直前クリックした拠点にフォーカスして戻る。
```js
onClose={() => navigate('map', { focusBaseId: sceneParams.focusBaseId })}
```

## 成功基準

1. マップ画面で任意の拠点をクリック → base_menu 遷移中、背景マップは **クリックした拠点が中央**（仙台に飛ばない）。
2. base_menu の「閉じる」で map に戻る → **同じ拠点が中央のまま**。
3. 別拠点を続けてクリック → その拠点が中央に来る。
4. 既存の防衛フロー（`startDefenseQueue` / `advanceDefenseQueue` の focusBaseId 挙動）が変わらないこと。
5. マップの手動ドラッグ・ミニマップパンが変わらず動作すること。
6. 初回タイトル → START → map 遷移時の初期表示（仙台）は変わらないこと（`sceneParams` 空の経路）。

## 触るな

- `src/scenes/MapScene.jsx` は変更禁止。仙台ハードコード L410-411 は残置（初回表示・focusBaseId 未指定時のフォールバック用）。
- `case 'map'` の他 prop（gameState / basesData / factionsData 等）は変更禁止。
- `advanceDefenseQueue` / `startDefenseQueue` 内の setFocusKey 呼び出しは変更禁止。
- 指示範囲外のコード・コメントは変更禁止。

## QA
実装完了後、オーナーが localhost:5173 で QA。Code は QA 不担当。
