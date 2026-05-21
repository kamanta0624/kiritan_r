# BUG-007: GameEndScene 実データ接続

## 対象ファイル
- `src/App.jsx`
- `src/scenes/GameEndScene.jsx`

## 現状の問題

`GameEndScene.jsx` の Stats がデモデータ固定：

```jsx
<EndStat label="到達ターン" value={GAME_STATE.turn} unit="T" color={tone.c1}/>
<EndStat label="制圧拠点" value={GAME_STATE.bases.split('/')[0]} unit={`/${GAME_STATE.bases.split('/')[1]}`} color={TEAL}/>
```

`App.jsx` の game_end 遷移：
```js
navigate('game_end', { isVictory: true, clearedCount: 0 });
// currentTurn / playerBases.length / bases.length を渡していない
```

## 修正手順

### Step 1: App.jsx — gamePhase監視の navigate に実データを追加

```js
if (gamePhase === 'victory') {
  navigate('game_end', {
    isVictory:       true,
    clearedCount:    0,
    currentTurn,
    playerBaseCount: playerBases.length,
    totalBaseCount:  bases.length,
  });
} else if (gamePhase === 'defeat') {
  navigate('game_end', {
    isVictory:       false,
    clearedCount:    0,
    currentTurn,
    playerBaseCount: playerBases.length,
    totalBaseCount:  bases.length,
  });
}
```

`currentTurn` / `playerBases` / `bases` は `useGame()` 展開済みであること確認。

### Step 2: App.jsx — case 'game_end': に props を追加

```jsx
case 'game_end':
  return <GameEndScene
    isVictory={sceneParams.isVictory ?? true}
    clearedCount={sceneParams.clearedCount ?? 0}
    currentTurn={sceneParams.currentTurn ?? 1}
    playerBaseCount={sceneParams.playerBaseCount ?? 0}
    totalBaseCount={sceneParams.totalBaseCount ?? 92}
    hasNewGamePlus={false}
    onNavigate={navigate}
  />;
```

### Step 3: GameEndScene.jsx — props 定義と Stats 表示を修正

関数シグネチャ：
```jsx
export default function GameEndScene({
  isVictory = true,
  clearedCount = 3,
  onNavigate,
  hasNewGamePlus = true,
  currentTurn = 1,
  playerBaseCount = 0,
  totalBaseCount = 92,
}) {
```

Stats 表示：
```jsx
<EndStat label="到達ターン" value={currentTurn}     unit="T"                    color={tone.c1}/>
<EndStat label="制圧拠点"   value={playerBaseCount} unit={`/${totalBaseCount}`} color={TEAL}/>
{isVictory && <EndStat label="キャラクリ" value={clearedCount} unit="人" color={tone.c1}/>}
```

`GAME_STATE` の参照がこれで消えるなら import から削除してよい。

## 動作確認

1. ゲーム開始 → 全拠点制圧（またはHQ陥落）
2. GameEndScene で「到達ターン」「制圧拠点」が実数値で表示されること

## 注意
- `clearedCount` は 0 固定でよい（別タスク）
- 修正後、KNOWLEDGE.md の BUG-007 を「解決済み」に更新すること
