# PROMPT_mito_conquest_nofire

## 問題
水戸（base_045）を制圧しているのに、直後の player_turn で `ev_mito_conquest` イベントが発生しない。

## 対象
- イベント: `src/game/data/events/ch01_tohoku/ev_mito_conquest.json`
  - trigger: `player_turn`
  - conditions: `baseOwned("base_045")` + `noFlag("flag_mito_conquest_done")`
  - 発生時: char_020・char_021 を 東北家 に charJoin + base_045 支配権移動 + flag設定
  
- 関連システム:
  - GameContext.actions.conquerBase(baseId, winnerFactionId)
  - GameContext.actions.startPlayerTurn()
  - EventEngine.processTrigger("player_turn", ctx)
  - EventEngine._filterEligible(events, ws)

## 調査手順

### 1. conquerBase() の実装確認
ファイル: `src/context/GameContext.jsx` の `conquerBase` action

**確認項目:**
- base.factionId を winnerFactionId に即座に更新しているか
- GameContext の bases 配列/参照が正しく更新されているか
- reducer の state mutation が synchronous か

### 2. battleEnd() → conquerBase() の流れ
ファイル: `src/game/systems/BattleEngineV3.js` / `src/scenes/BattleScene.jsx` の battleEnd() コール

**確認項目:**
- battle勝利時に conquerBase(defenderBaseId, winnerFactionId) が呼ばれているか
- conquerBase() のタイミング: battleEnd() 同期実行 vs 非同期か
- conquerBase() 後に state refresh がどこで起こるか

### 3. trigger 発火順序の確認
ファイル: `src/context/GameContext.jsx` の `battleEnd` action + EventEngine

**フロー確認:**
```
BattleScene → onBattleEnd() → actions.battleEnd({..., conquered})
  → reducer で base state 更新
  → EventEngine._runEvent("base_conquered", ...) if conquered
    → イベント実行 + applyEffects + await 完了
  → battleEnd reducer 続行
  → FormationScene / MapScene に戻る
  → handleNextTurn() 呼び出し
    → runEnemyPhase()
    → startPlayerTurn() → EventEngine.processTrigger("player_turn", ctx)
```

player_turn 発火時点で base.factionId が playerFaction に更新されているか確認が必須。

### 4. _filterEligible での baseOwned 条件評価
ファイル: `src/game/systems/EventEngine.js` の _filterEligible() + baseOwned 条件handler

**確認項目:**
- ws (world state snapshot) の bases 参照が最新か
- baseOwned condition: `bases.find(b => b.id === baseId && b.factionId === playerFactionId)` 判定が正しいか
- _filterEligible の ws snapshot timing: processTrigger の直前に buildWsAdapter() が呼ばれているか

### 5. flag_mito_conquest_done の状態確認
**確認項目:**
- 水戸制圧 1回目: flag が設定されるか
- 2回目以降: flag が存在するため noFlag condition で除外されるか（正常動作）

### 6. 同一ターン内での base_conquered vs player_turn
**シナリオ:**
- Turn N で水戸攻撃開始 → battle → 勝利 → conquerBase() → base_conquered trigger 発火
- 同一ターン内で直後に player_turn が発火するか、それとも Turn N+1 で発火するか

**確認項目:**
- base_conquered event 完了後に player_turn が同一processTrigger loop で発火するか
- または handleNextTurn() が明確に2段階に分けているか

## 再現手順（開発者向け）
1. QA環境で戦闘フル: `http://localhost:5173/?qa=battlefull`
2. プレイヤー勢力（東北家）が水戸攻撃 → 勝利まで進行
3. conquerBase() 後に console.log で base_045.factionId を確認
4. 同じターンまたは次ターンで ev_mito_conquest が trigger されるか browser DevTools で確認
5. flag_mito_conquest_done が GameContext.flags に存在するか確認

## 予想される根本原因（推論禁止・コード読み取り必須）

待機中。Code へのコード読み取り結果に基づく修正案は別途 PROMPT_* として作成。
