# ターン終了処理 現状分析・リファクタリング引き継ぎ

> 作成: 2026-05-20
> 用途: 別チャットでのリファクタリング作業用

---

## 1. スタック・起動

- React 18 + Vite、Node v22必須
- 起動: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run dev` → localhost:5174
- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`

---

## 2. 現状のフロー（コード実態）

### 全体シーケンス

```
[ターン終了ボタン]
  ↓
handleNextTurn()  ← App.jsx L192
  ↓
game.actions.runEnemyPhase()
  → LegionAI.runDomestic()
  → EventEngine.processTrigger('enemy_turn')
  → buildAttackQueue(playerFactionId)
  → return fullQueue（全勢力分）
  ↓
for (faction of enemyFactions):
  game.actions.runEnemyPhaseForFaction(faction.id)
    → EventEngine.processTrigger('before_faction_turn', {factionId})
    → 戻り値なし（副作用のみ）

  factionQueue = fullQueue.filter(q => q.attackerFactionId === faction.id)
  if empty → continue

  await new Promise(resolve =>
    navigate('enemy_turn', { faction, attackQueue: factionQueue, _onComplete: resolve })
  )
  → EnemyTurnScene: SingleFactionCutin → onComplete() → resolve

  defResult = await processDefenseQueue(factionQueue)
  if defResult === 'ended' → return  ← ゲーム終了時ループ中断

await new Promise(resolve =>
  navigate('enemy_turn', { playerTurnMode: true, _onComplete: resolve })
)
→ EnemyTurnScene: PlayerTurnCutin → onComplete() → resolve

await game.actions.startPlayerTurn()
  → NEXT_TURN dispatch（ターン++、収入、回復）
  → EventEngine.processTrigger('player_turn')

navigate('map')
```

### processDefenseQueue

```js
processDefenseQueue(queue):
  Promise:
    processNext(remaining):
      if empty → resolve()
      processSingleDefense(remaining[0], (phase) => {
        if phase === 'defeat'/'victory' → resolve('ended')
        else → processNext(rest)
      })
```

### processSingleDefense

```js
processSingleDefense(item, onDone):
  navigate('map', {
    focusBaseId: item.defenderBase?.id,
    _onReady: () => launchDefenseADV(item, onDone, { skipNavigate: true })
  })
  // MapScene の useEffect([focusBaseId]) → 500ms → onReady() → launchDefenseADV
```

### launchDefenseADV

```js
launchDefenseADV(item, onDone, { skipNavigate=false }):
  if (!skipNavigate) navigate('map', {})  // 編成戻り・確認いいえ時に scene を map に戻す
  setDefenseAdvParams({ scenario, _onChoice })

_onChoice('defend'):
  setDefenseAdvParams(null)
  navigate('formation', {
    _onCancel: () => launchDefenseADVRef.current(item, onDone),  // skipNavigate=false
    _onDone: onDone,
  })

_onChoice('abandon'):
  setDefenseAdvParams(null)
  setDefenseAdvParams({ 確認choice, _onChoice: (v) => {
    if 'confirm_abandon': doAbandon() → battleEnd() → onDone(phase)
    if 'back': launchDefenseADVRef.current(item, onDone)  // skipNavigate=false
  }})

doAbandon():
  battleEnd({ conquered:true, ... }).then(phase => {
    if phase === 'defeat'/'victory' → navigate('game_end', ...)  // onDone は呼ばない
    else → onDone(phase ?? null)
  })
```

### 編成 onCancel（App.jsx formation case）

```js
onCancel():
  if fIsDefense && sceneParams._onCancel:
    sceneParams._onCancel()  // → launchDefenseADV(item, onDone) (skipNavigate=false)
  // navigate('map',{}) + setDefenseAdvParams でADVを再表示する想定
```

### BattleScene onComplete（App.jsx battle case）

```js
onComplete(result):
  phase = await battleEnd({ ... })
  if phase → navigate('game_end', ...)  return
  if isDefense && sceneParams._onDone:
    sceneParams._onDone(phase ?? null)  // → processNext(rest)
  else navigate('map')
```

### ADVオーバーレイ表示条件（App.jsx L594）

```jsx
{defenseAdvParams && scene === 'map' && (
  <ADVScene
    scenario={defenseAdvParams.scenario}
    transparent={true}
    onChoice={defenseAdvParams._onChoice}
  />
)}
```

---

## 3. 既知バグ・構造的問題

### バグA: `useEffect([focusBaseId])` 不発火

**最重要。放棄後進行不能・戻るが効かない両方の根本原因と疑われる。**

`processSingleDefense` が `navigate('map', { focusBaseId })` を呼ぶが、
MapScene の `useEffect([focusBaseId])` は前回と同じ値では発火しない。

- 同一拠点に複数攻撃がある場合
- 放棄後に同じ拠点の次のキューを処理する場合
- `_onCancel`（編成戻る）後に同じ `focusBaseId` で `launchDefenseADV` が呼ばれた場合

→ `onReady` が呼ばれない → `launchDefenseADV` が呼ばれない → `setDefenseAdvParams` されない → ADV表示されない → `onDone` が永遠に呼ばれない → Promise が resolve しない → **詰まり**

### バグB: 放棄確認の setDefenseAdvParams 連続セット

```js
setDefenseAdvParams(null);          // 確認choiceを消す
setDefenseAdvParams({ 確認choice }) // 確認choiceを表示
```

Reactのバッチ更新で `null → オブジェクト` が1レンダリングで処理されるが、
ADVSceneが一瞬アンマウント→再マウントされることで内部状態（idx等）がリセットされる。
実害は軽微だが潔癖でない。

### バグC: 本拠地陥落でターンが進む（未解消）

`battleEnd` は `gamePhase` を更新するが `handleNextTurn` ループは `phase` を受け取っても
`processDefenseQueue` が `'ended'` を返す前に `startPlayerTurn` まで進む可能性が残る。

BattleScene経由の `sceneParams._onDone(phase)` → `processNext(rest)` は正常だが、
放棄経由の `doAbandon` で本拠地が落ちたとき `navigate('game_end')` でループを抜けるが
`handleNextTurn` の `await processDefenseQueue(...)` が既に resolve している場合は
その後の `startPlayerTurn` が実行される。

### 修正履歴（このチャット内で実施済み）

| 修正 | 内容 | 状態 |
|------|------|------|
| skipNavigate導入 | `launchDefenseADV` の二重 `navigate` を防ぐ | 適用済みだが効果不十分 |
| MapScene onReady ガード | `useRef` で重複呼び出し防止 | 適用済み |
| processDefenseQueue 中断 | `'ended'` 返却でループ中断 | 適用済み |
| BattleScene phase チェック | `game_end` 即遷移 | 適用済み |

---

## 4. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/App.jsx` | `handleNextTurn` / `processDefenseQueue` / `processSingleDefense` / `launchDefenseADV` / 全sceneレンダリング |
| `src/context/GameContext.jsx` | `runEnemyPhase` / `runEnemyPhaseForFaction` / `startPlayerTurn` / `battleEnd` / `checkVictoryCondition` |
| `src/scenes/EnemyTurnScene.jsx` | `SingleFactionCutin` / `PlayerTurnCutin` / `LoadingOverlay` |
| `src/scenes/MapScene.jsx` | `focusBaseId` → カメラ移動 → `onReady()` 呼び出し |
| `src/scenes/FormationScene.jsx` | `onCancel` / `onLaunch` |
| `src/scenes/BattleScene.jsx` | `onComplete(result)` |
| `src/scenes/ADVScene.jsx` | `transparent` prop / `choice` ステップ / `onChoice` prop |

---

## 5. リファクタリング方針（推奨）

### 根本解決: `onReady` コールバック依存をやめる

`processSingleDefense` が MapScene の `useEffect` に依存している構造が問題の根本。
MapScene は表示専用に戻し、防衛フローのオーケストレーションを App.jsx で完結させる。

**案: `focusBaseId` を常に変化させる**

```js
// processSingleDefense
const [focusKey, setFocusKey] = useState(0);
// navigate 時に focusKey をインクリメント → useEffect([focusBaseId, focusKey]) で必ず発火
```

または

**案: onReady を待たずに直接 launchDefenseADV を呼ぶ**

カメラ移動は fire-and-forget にして、ADV表示はカメラ移動と並行して即開始する。

```js
const processSingleDefense = (item, onDone) => {
  // カメラ移動（fire-and-forget）
  setFocusBaseId(item.defenderBase?.id);
  // ADV即起動（カメラ移動完了を待たない）
  setTimeout(() => launchDefenseADVRef.current(item, onDone, { skipNavigate: true }), 100);
};
```

または

**案: 防衛フロー全体を App.jsx の state machine で管理**

`processDefenseQueue` の Promise チェーンをやめ、
`defenseQueue` / `defenseIndex` を state として持ち、
各ステップの完了を React の state 更新で駆動する。
非同期 Promise に依存しないため詰まりが発生しない。

---

## 6. 現在の docs/prompts 一覧

```
PROMPT_mapscene_faction_color.md  - マップの勢力色表示
PROMPT_topbar_realdata.md         - TopBar実数値接続（実装待ち）
PROMPT_worldmap_bugfix.md         - ワールドマップバグ修正
PROMPT_worldmap_impl.md           - ワールドマップ実装
PROMPT_worldmap_qa.md             - ワールドマップQA
PROMPT_adv_ui_fix.md              - ADVシーンUI修正（実装待ち）
PROMPT_defense_adv_overlay.md     - 防衛ADVオーバーレイ（部分実装済み）
PROMPT_defense_abandon_bugfix.md  - 放棄バグ修正（本MDが代替）
```
