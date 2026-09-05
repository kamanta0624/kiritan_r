# 実装インデックス

どのファイルのどこに何があるかを1秒で判断するための早引き。
設計思想・ゲームシステム仕様は `docs/KNOWLEDGE.md` を参照。

---

## src/App.jsx

### シーン一覧（`renderScene` switch）
| scene キー | コンポーネント | 主な sceneParams |
|-----------|--------------|----------------|
| `title` | `TitleScene` | — |
| `map` | `MapScene` | `focusBaseId`, `_onReady` |
| `base_menu` | `BaseMenuScene` | `node`, `isOwned`, `canAttack` |
| `formation` | `AttackFormationScene` | `targetNode` |
| `battle` | `BattleScene` | `formation`, `targetNode`, `battleCapacity`, `_dungeonEnemy` |
| `enemy_turn` | `EnemyTurnScene` | `faction`, `attackQueue`, `playerTurnMode`, `_onComplete` |
| `characters` | `PartyScene` | — |
| `items` | `ItemsScene` | — |
| `research` | `ResearchScene` | — |
| `theater` | `TheaterScene` | — |
| `save` | `SaveScene` | `mode` ('save'\|'load'), `returnTo` |
| `game_end` | `GameEndScene` | `isVictory`, `currentTurn`, `playerBaseCount`, `totalBaseCount` |
| `dungeon_select` | （インラインJSX） | — クラファン挑戦／浅層探索の選択。`dungeonSession` を初期化 |
| `dungeon` | `DungeonScene` | `_battleResult`, `_sessionEnded` |
| `new_game_plus` | `NewGamePlusScene` | — |
| `adv` | `ADVScene` | `script`, `effects`, `dialogId`, `onExit` |

QAモード（URL `?qa=battle|battlefull|worldmap`）はルーター手前で分岐。

### 防衛フロー state machine
`defenseFlow` state: `{ queue, index, phase: 'defense_prompt' | 'formation' | 'battle', formation? }`

- `startDefenseQueue(queue)` → `fireTrigger('base_defense', ...)` → Promise
- `advanceDefenseQueue(resultPhase)` — キュー内次アイテムへ進む
- `handleNextTurn()` — `runEnemyPhase` → 勢力ごとに `runEnemyPhaseForFaction` + 防衛 → `startPlayerTurn`

### navigate(dest, params)
`useState` ベースのシーン切り替え。`sceneParams` に params を格納してからシーン再描画。

### ダンジョンセッション state（クラファン挑戦・浅層探索。C-3で刷新・C-4で進捗ポイント制へ改訂）
`dungeonSession` state: `{ dungeonKind: 'crowdfunding'|'shallow', charIds, waveIndex,
  remainingRounds, goalId, requiredMemeByChar, goalAchieved,
  progressPoints, progressRequired, waveEnemyPointMap }`。
セーブ不可のため `GameContext.state` には載せず App.jsx ローカルで保持（`DESIGN_CROWDFUNDING.md` §1）。
`DUNGEON_ROUND_LIMIT`（crowdfunding:40 / shallow:20）・`DUNGEON_REST_COST`（5）はモジュール定数。

**ゴールは進捗ポイント制**（`DESIGN_CROWDFUNDING.md` §2-3。C-4で「1波目撃破=ゴール」から改訂）。
敵を1体撃破するごとに `waveEnemyPointMap[敵id]`（撃破した敵の `progressPoint`）を `progressPoints` に加算し、
`progressPoints >= progressRequired` の倍数を跨ぐたびに達成（100%=ゴール、200%/300%…=ストレッチ）。
`progressRequired = requiredProgress(Σ 参加キャラの必要ミーム)`（`crowdfundingConfig.js`。係数は仮置き）。
`waveEnemyPointMap` は波開始時（`startDungeonWave`）に `buildDungeonEnemies` が返す id→progressPoint を
控えたもので、`result.defeatedEnemyCharIds` と突き合わせて撃破分の合計を出す。
挑戦終了（成功・失敗問わず。負けた波 or 残ラウンド切れ）時、`requiredMemeByChar` のスナップショット値まで
`maxSoldiers`/`soldiers` を戻し、`cfChallengeCount` を+1する（この部分はC-3のまま。C-4では触っていない）。

敵はプール抽選（`buildDungeonEnemies` / `drawEnemyDefs` / `drawTieredEnemyDefs` / `drawShallowEnemyDefs` /
`scaleEnemyDef` / `computeStrengthScore`。乱数を使うものは App.jsx モジュールスコープの純関数
（`drawTieredEnemyDefs` は `crowdfundingConfig.js` 側）、`react-hooks/purity` 対策でコンポーネント外に配置）。
クラファンは選出数をプレイヤー編成人数と常に対称化。`tier`（強さ帯）はプレイヤー側の強さスコア
（`computeStrengthScore` = 参加キャラの `charHp+charAttack+charDefense+soldierAtk+soldierDef` 合計 ＋
必要ミーム合計。`maxSoldiers` は挑戦中0になるため指標に使わない）で重み付け抽選（`pickEnemyTier` /
`TIER_WEIGHTS_BY_BAND` / `STRENGTH_TIER_THRESHOLDS`）。`BOSS_FREQUENCY` 波ごとに選出数の代わりに
ステータス・進捗ポイントへ `BOSS_MULT` を掛ける。浅層探索は対称化・強さ連動なし、
`SHALLOW_ENEMY_COUNT_RANGE` からランダム人数を抽選するのみ（tier/progressPoint は付与するが未使用）。

報酬・好感度加算・ミーム回復は App.jsx の `applyGoalReward` / `applyStretchReward` / `applyShallowReward` /
`endCrowdfundingSession` が担う（`game.actions.updateChar` + `game.actions.applyEffects([{type:'affinityGain',...}])`）。
各 apply* は `{ kind, delta, charNames }` を返し、`onComplete` がそれを `sceneParams._rewardInfo` に載せて
`DungeonScene` の `wave_result` フェーズへ渡す（`RewardList` コンポーネントがフィールド名+増加量を具体値で列挙。
「参加キャラが強化された」のような曖昧文言は不可、`DESIGN_CROWDFUNDING.md` §4-2）。
1波で複数の100%刻みを跨いだ場合は `mergeDeltas` で合算して1回にまとめる。
`battleEnd` の dispatch 直後は `characters` に未反映のため、charHp/soldiers の起点は
`result.unitResults` から作った `hpMap`/`spMap` を使う（stale read で戦闘結果を上書きしないため）。
`GameContext.jsx` の `BATTLE_END` は `isDungeon:true` のとき好感度+2を自動加算しない
（クラファン/浅層探索は加算量が異なるため App.jsx 側で明示的に加算）。

進捗表示は `DungeonShell` の `progressPercent` prop（`Math.floor(progressPoints/progressRequired*100)`。
100%超は240%のようにそのまま表示。浅層探索は概念が無いため常に非表示）。

報酬・必要ミーム・ボス頻度倍率・進捗ポイントの係数・強さ抽選テーブルなど仮置き数値は
`src/game/data/crowdfundingConfig.js` に集約。
`src/game/data/dungeons.json` は `crowdfundingPool[]` / `shallowPool[]` / `goals[]`
（`{id,name,rewardType}`。`rewardType` は `'song'|'stat'|'memeGrowthMult'` でレジストリ解決、
ハードコードなし）の構成。各敵エントリに `tier` / `progressPoint` を持つ（C-4で追加）。
`dungeonFloorClear` action は現在どこからも呼ばれない（`@deprecated`。rewardItem付与は
`DESIGN_CROWDFUNDING.md` §3-1 により廃止）。`dungeonProgress` は空オブジェクトのまま未使用。

---

## src/context/GameContext.jsx

### state 構造（`createInitialState`）
```
currentTurn: number          // 0 start, player_turn ごとに +1
factions: Faction[]          // { id, name, isPlayer, treasury, atWarWith[], warFlags{} }
bases: Base[]                // { id, factionId, income, battleCapacity, isCapital, _originalFactionId, ... }
characters: Character[]      // isTemplate=false のみ（モブも含む）
inventory: InventoryItem[]   // { id, itemId }
buildings: string[]          // 研究済みID配列（例: ['voice_1', 'aiv']）
dungeonProgress: { [dungeonId]: { clearedFloors, isFullyCleared } }
dungeonExploredThisTurn: boolean
eventFlags: { [flagKey]: boolean }
occurredEvents: { [eventId]: number }   // 発生回数
flagTimestamps: { [flagKey]: number }   // セットされたターン番号
conqueredThisTurn: boolean
hireCooldownUntil: number
gamePhase: 'playing' | 'victory' | 'defeat' | 'demo_complete'
actionPoints: number
maxActionPoints: number
researchQueue: null | { id: string, turnsRemaining: number }
upgradeUnlocks: string[]     // ['sp_refill', 'sp_max_up', ...]
secretaryId: string | null
```

### reducer action types
| type | payload |
|------|---------|
| `LOAD_SAVE` | state スナップショット |
| `START_NEW_GAME` | — |
| `NEXT_TURN` | `{ incomeBonus, mobAdditions }` |
| `BATTLE_END` | `{ usedCharIds, deadCharIds, deadMobIds, conquered, defenderBaseId, winnerFactionId, unitResults, defeatedEnemyCharIds, isDungeon }` |
| `APPLY_EFFECTS` | `{ effects }` |
| `DECLARE_WAR` | `{ targetFactionId }` |
| `UPDATE_CHAR` | char オブジェクト（id 必須） |
| `SET_FLAG` | `{ key, value, withTimestamp? }` |
| `CLEAR_FLAG` | `{ key }` |
| `INCREMENT_EVENT` | `{ eventId }` |
| `SET_TREASURY` | `{ factionId, amount }` |
| `ADD_RESEARCH` | `{ id, characterEffects }` |
| `ADD_MOB_CHARS` | `{ mobs }` |
| `ADD_ITEM` | `{ item }` |
| `REMOVE_ITEM` | `{ instanceId }` |
| `CONQUER_BASE` | `{ baseId, winnerFactionId }` |
| `SET_GAME_PHASE` | `{ phase }` |
| `SET_RESEARCH_QUEUE` | `{ id, turnsRemaining }` |
| `SET_ACTION_POINTS` | number |
| `SET_SECRETARY` | charId |
| `LOAD_SAVE_MOBS` | `{ mobs }` |
| `DUNGEON_FLOOR_CLEAR` | `{ dungeonId, clearedFloors, isFullyCleared, rewardItem }` |
| `DUNGEON_EXPLORED` | — |
| `DUNGEON_DEFEAT` | `{ charIds }` |

### actions（`useGame().actions`）
```js
startNewGame()
runEnemyPhase()                          // → attackQueue[]
runEnemyPhaseForFaction(factionId)
startPlayerTurn()
battleEnd(result)                        // → gamePhase | null
beforeAttack(defenderBaseId, attackerFactionId)
fireTrigger(trigger, ctx)
doResearch(researchId)                   // → bool
purchaseUpgrade(charId, cmdId)           // → bool
declareWar(targetFactionId)
isAtWar(targetFactionId)                 // → bool
applyEffects(effects)
getTheaterEvents()                       // → EventDef[]
runTheaterEvent(eventId)                 // → EventDef | null
updateChar(char)
setFlag(key, val, withTimestamp?)
clearFlag(key)
setTreasury(factionId, amount)
addItem(item)
removeItem(instanceId)
conquerBase(baseId, winnerFactionId)
save(slot)  /  load(slot)  /  getSaveSlots()
startResearch(id)                        // キュー登録（turns対応）
setActionPoints(n)
setSecretary(charId)
dungeonFloorClear(payload)               // @deprecated 未使用。C-3以降 dungeons.json は floors 形式を持たない
dungeonExplored()                        // @deprecated 未使用（C-3で dungeonExploredThisTurn の制限を撤廃）
dungeonDefeat(charIds)                   // @deprecated 未使用（C-3のクラファン/浅層探索は endCrowdfundingSession 等で処理）
```

### stateRef パターン
`stateRef.current = state` を `useReducer` の直後で常時同期。非同期コールバック（`battleEnd` 等）内で最新 state を参照するときは `stateRef.current` を使う（`state` クロージャは古い）。

### 勝利条件（`checkVictoryCondition`）
1. `eventFlags.flag_vocalo_conquered === true` → victory
2. 自首都が敵に奪われた → defeat
3. 全敵首都を制圧 → victory

### セーブバージョン
`SAVE_VERSION = 12`（C-3で `cfChallengeCount` 追加のため11→12）、キー: `kiritan_save_${slot}`
v9以前のロード時は `affinity: {}` を補填。

---

## src/game/utils/Affinity.js — 好感度（純関数）

仕様は `docs/DESIGN_AFFINITY_BATTLE.md` §1。React / GameContext 非依存。

| export | 内容 |
|--------|------|
| `AFFINITY_MAX` | `40`（Lv3＝カンスト） |
| `AFFINITY_THRESHOLDS` | `[8, 20, 40]`（Lv1 / Lv2 / Lv3） |
| `pairKey(a, b)` | charId をソートして `__` 連結。`'char_004__char_016'` |
| `getAffinity(affinity, a, b)` | 未登録なら 0 |
| `getAffinityLv(affinity, a, b)` | 0〜3 |
| `allPairs(ids)` | ID配列 → 全ペア（4件 → 6組） |
| `gainAffinity(affinity, pairs, amount)` | 新オブジェクトを返す。上限40でクランプ |

`state.affinity` は**疎（sparse）管理**。値0のペアはキーを持たない。

### 加算経路

| 経路 | 加算 | 実装箇所 |
|------|------|---------|
| 通常戦闘（同時出撃） | +2 | `GameContext.jsx` `BATTLE_END`（`usedCharIds` から `_isMobInstance` を除外して `allPairs`） |
| `affinityGain` effect | 任意 | `applyEffectToState` |
| クラファン挑戦（同行） | +2 | `App.jsx` `endCrowdfundingSession`（挑戦終了時に1回） |
| 浅層探索（同行） | +1 | `App.jsx` `applyShallowReward`（波の勝利ごと） |

---

## src/game/systems/BattleEngineV3.js

### コンストラクタ
```js
new BattleEngineV3({
  playerSide, enemySide,
  mode,            // 'attack' | 'defense'
  battleCapacity,
  battleMode,      // 'normal' | 'dungeon' | 'duel' | 'event'  (省略時 'normal')
  maxRounds,       // 省略時: normal=5, その他=Infinity
  allowRetreat,    // 省略時: dungeon/duel以外=true
  onLog, onCardUpdate, onShake, onPopup, onBattleEnd, onExchangeResult, delayedCall,
})
```

### 主要公開 API
```js
static buildUnit(char, sideType, index) → unit
startRound()          → { round, maxRounds }
nextActor()           → { u: unit, isPlayer: bool } | null
markActed(unit)
executeAction(unit, isPlayer)
checkGameOver()       → bool
checkRoundLimit()     → bool
applyRetreatRule(rule, side)   // rule: 'loss_25'|'loss_50'|'hp_any'|'char_dead'|'never'
isDead(unit)          → bool
```

### unit オブジェクト（`buildUnit` 出力）
```
char, sideType, bonus, position ('front'|'rear')
soldiers, maxSoldiers, charHp, charMaxHp, charActive
action, retreated, charged, skillUsed
attackCount  (= char.attackCount ?? 8)
charDefense  (= char.charDefense ?? 10)
level, targetId
```

### action 種別
`'attack'` | `'retreat'` | `'defend'` | `'skill'` | `'focus'` | `'special'` | `'ranged'` | `'song'`

### スキル種別（skills.json）
- `instant` 型: rally（味方攻撃+20%）, pierce（防御無視）, fortress（被ダメ無効）, volley（乱撃）
- `charge` 型: focus（集中） → special（必殺発動）

### カップリング補正（`_initCoupling`）— 旧「作戦補正」

`strategyRate` ベースの作戦システムは 2026-08-14 に廃止。好感度（`state.affinity`）ベースのカップリングボーナスへ置換。**乱数なし。**コンストラクタで1回決定。

```
COUPLING_LV_BASE = [0, 0.05, 0.10, 0.18]   // Lv0〜Lv3
COUPLING_CAP     = 0.60                     // 合計上限（理論最大 0.504）
階層係数: メイン×メイン 1.0 / メイン×サブ 0.4 / サブ×サブ 0.2
```

`couplingBonus = { player, enemy, playerPairs, enemyPairs }`。`*Pairs` は成立ペア（Lv1以上）のみ `{ a, b, lv, bonus }`。
`_strat(isAtkPlayer)` は `1 + couplingBonus[side]` を返す（形は維持、呼び出し元 `:409` は無改修）。
コンストラクタ opts に `affinity` / `enemyAffinity`（敵側は現状常に `{}`）。

### 勝利判定（`checkGameOver` / `_mainAlive`）

**`position === 'front'`（メインキャスト）のみで生死を判定。** サブキャスト生存でもメイン全滅なら敗北。
front 不在サイドは side 全体で判定するフォールバックあり（QAシナリオ保護。実戦では編成4枠に必ず front が居るため到達しない）。

---

## src/game/systems/EventEngine.js

### 静的メソッド
```js
EventEngine.processTrigger(ws, trigger, ctx)        // async
EventEngine.getAvailableTheaterEvents(ws)            // → EventDef[] (副作用なし)
EventEngine.checkConditions(ws, conditions, ctx)     // → bool
EventEngine.getOccurrenceCount(ws, eventId)          // → number
clearEventCache()                                    // テスト用 named export
getEventById(id)                                     // named export → EventDef | null
```

### trigger 種別
`game_start` | `player_turn` | `enemy_turn` | `before_faction_turn` | `base_attack` | `base_conquered` | `battle_end` | `char_defeated` | `base_defense` | `theater`

### condition types（`_evalCondition`）
| type | 主なフィールド |
|------|-------------|
| `turn` | `op` ('gte'\|'lte'\|'eq'), `value` |
| `flag` | `flag` |
| `noFlag` | `flag` |
| `hasChar` | `charId` |
| `baseOwned` | `baseId` |
| `atWar` | `factionId` |
| `attackerFaction` | `factionId` |
| `defenderFaction` | `factionId` |
| `baseConquered` | `baseId`, `factionId?` |
| `turnAfterFlag` | `flag`, `value`（経過ターン数） |
| `defeatedChar` | `charId` |
| `noOther` | `eventIds[]` |

### effect types（`applyEffectToState` / `applyEffects` オーケストレータ）
| type | 処理先 | 主なフィールド |
|------|--------|-------------|
| `affinityGain` | APPLY_EFFECTS | `pairs: [[charId, charId], ...]`, `amount` |
| `demoEnd` | APPLY_EFFECTS | 体験版終了。`gamePhase='demo_complete'` |
| `treasury` | APPLY_EFFECTS | `factionId?`, `delta` |
| `charJoin` | APPLY_EFFECTS | `charId`, `factionId?` |
| `charLeave` | APPLY_EFFECTS | `charId` |
| `charParam` | APPLY_EFFECTS | `charId`, `field`, `delta`, `min?` |
| `baseIncome` | APPLY_EFFECTS | `baseId`, `delta` |
| `battleCap` | APPLY_EFFECTS | `baseId`, `delta` |
| `baseTransfer` | APPLY_EFFECTS | `fromFactionId`, `toFactionId?` |
| `baseTransferSingle` | APPLY_EFFECTS | `baseId`, `toFactionId` |
| `warFlag` | APPLY_EFFECTS | `factionId`, `atWar` |
| `attackUnlock` | APPLY_EFFECTS | `factionId` |
| `setFlag` | APPLY_EFFECTS | `flag` |
| `setFlagWithTurn` | APPLY_EFFECTS | `flag` |
| `clearFlag` | APPLY_EFFECTS | `flag` |
| `actionPointsBonus` | APPLY_EFFECTS | `delta` |
| `dungeonUnlock` | APPLY_EFFECTS | `baseId` |
| `charUsedThisTurn` | APPLY_EFFECTS | `charId` |
| `itemLose` | APPLY_EFFECTS | `itemId` |
| `itemGain` | ADD_ITEM（副作用） | `itemId` |
| `legionForceAttack` | legionAI 直接 | `factionId`, `targetFactionId` |
| `legionUpdate` | legionAI 直接 | `legionId`, `factionId?`, `attackFrequency?` |

### イベント JSON スキーマ
```json
{
  "id": "ev_xxx",
  "trigger": "player_turn",
  "priority": 10,
  "maxOccurrences": 1,
  "probability": 1.0,
  "conditions": [...],
  "script": [
    { "type": "text", "characterId": "kiritan", "position": "left", "text": "..." },
    { "type": "narration", "text": "..." },
    { "type": "conversation", "lines": [{ "characterId", "position", "text" }] },
    { "type": "choice", "characterId", "position", "text", "choices": [{ "label", "next", "effects?" }] },
    { "type": "end" }
  ],
  "effects": {
    "default": [...],
    "choice_a": [...]
  }
}
```

### ws アダプタ必須フィールド（`buildWsAdapter`）
`currentTurn`, `factions`, `bases`, `characters`, `inventory`, `buildings`, `eventFlags`, `occurredEvents`, `flagTimestamps`, `legionAI`, `itemSystem`, `applyEffects(effects)`, `declareWar(factionId)`, `startDialog({script, effects}) → Promise`

---

## src/game/systems/BuildingSystem.js

### インスタンスメソッド
```js
getDef(researchId)                      → def | null
getAllDefs()                             → def[]
getResearchable(buildings, treasury)    → { ...def, canAfford }[]
getIncomeBonus(buildings)               → 0  // 廃止、常に0
getUpgradeCommands(charId, buildings)   → cmd[]
getResearchNames(buildings)             → string[]
```

### 静的メソッド
```js
BuildingSystem.createMobInstance(template, factionId)  → mob
BuildingSystem.getMobTemplates()                        → template[]
```

---

## src/scenes/ResearchScene.jsx

### Props
```js
{ onNavigate, buildingSystem, buildings = [], treasury = 0, researchQueue = null, onStartResearch }
```

### 研究ノード ID 一覧（LAYOUT）
列0: `voice_1`, `terms`, `public_assets`, `font`
列1: `voice_plus`, `vocal_1`, `studio_1`, `ink`
列2: `voice_2`, `vocal_2`, `studio_2`, `vox_dorm`
列3: `aiv`, `vocal_nt`, `studio_ai`, `hybrid_v`, `ex_voice_1`, `ex_voice_2`, `collab`
列4: `aiv_2`, `nu_tori`, `uta`, `hybrid_v2`, `md`
列5: `peak`, `crowdfund`

---

## src/scenes/PartyScene.jsx

### Props
```js
{
  onNavigate, characters, treasury,
  upgradeUnlocks,    // 解禁済みコマンドID[]
  actionPoints, maxActionPoints,
  secretaryId, buildings, buildingSystem,
  onUpgrade,         // (charId, commandId) => void
  onSetSecretary,    // (charId) => void
  onPurchaseUpgrade, // (charId, cmdId) => void
}
```

### ポートレートパス規約
`/characters/portraits/${charId}.png` — 404 時は `onError` でプレースホルダへ。

---

## src/scenes/MapScene.jsx

### Props
```js
{
  onNavigate, onAttackNode, onNodeClick,
  gameState,          // { turn, meme, income, bases, actionPoints, maxActionPoints }
  basesData, factionsData,
  conqueredThisTurn,
  onNextTurn,
  focusBaseId,        // フォーカスしたい拠点 ID
  focusKey,           // 同 baseId の再フォーカス強制用カウンタ
  onReady,            // マップ表示完了コールバック
}
```

### マップ定数
`MAP_W = 4200`, `MAP_H = 3200`, `BOUNDARY_X = 2400`

### エリア ID
`tohoku`, `hokkaido`, `kanto`, `koshinetsu`, `kansai`, `chushikoku`, `kyushu`, `okinawa`

### 拠点タイプ判定（`deriveType`）
- `city`: `isCapital === true`
- `town`: `income >= 80`
- `fort`: `battleCapacity >= 600`
- `village`: それ以外

---

## src/game/data/facilities.json

### 研究ノード構造
```json
{
  "id": "voice_1",
  "name": "ボイス",
  "category": "engine",   // "engine" | "produce"
  "cost": 200,
  "turns": 2,
  "description": "...",
  "prerequisites": [],
  "unlocks": {
    "upgradeCommands": [],   // 解禁される upgradeCommand ID[]
    "flags": []              // セットされるフラグ名[]
  }
}
```

### upgradeCommands 構造
```json
{
  "id": "kiritan_aiv",
  "charId": "kiritan",
  "requiredResearch": "aiv",
  "label": "AIVきりたん",
  "desc": "...",
  "cost": 300,
  "repeatable": true,
  "maxPurchase": 3,
  "effects": [
    { "type": "charSong", "delta": 5 },
    { "type": "spMaxUpCostMult", "delta": -0.2 }
  ]
}
```
effect type: `charSong`, `maxSoldiers`, `spMaxUpCostMult`

---

## src/game/data/characters.json

### キャラフィールド一覧
```
id                   string
isTemplate           bool          // true = モブテンプレ（state に投入しない）
displayName          string        // テンプレのみ
name                 string
nameVariants         string[]      // テンプレのみ
statVariance         number        // テンプレのみ（バラつき率）
kana                 string | null
factionId            string | null // null = 在野
joinCondition        string | null
hireCost             number
role                 string        // 'attacker' | 'support' | ...
attackType           string        // 'melee' | 'ranged' | 'song'
isLeader             bool
usedThisTurn         bool          // runtime
penaltyTurns         number        // runtime（0=使用可能）
purchasedUpgrades    string[]      // runtime

// 戦闘パラメータ
soldiers             number
maxSoldiers          number
memeGrowthMult       number        // ミーム上限成長の上乗せ率。既定0（?? 0）。戦闘参加時 +100*(1+this)
cfChallengeCount     number        // クラファン挑戦回数（キャラ単位）。既定0（?? 0）。C-3で追加
charHp               number
charMaxHp            number
charAttack           number
charSong             number
charDefense          number        // HP被ダメ軽減
soldierAtk           number
soldierDef           number
attackCount          number        // 将軍本人の攻撃回数 (BattleEngineV3: ?? 8)
strategyRate         number        // 作戦補正率
recoveryRate         number | null // null = デフォルト(HP5%/ミーム+50)
skillId              string | null
specialType          string | null // 'char_strike' | 'sp_strike'
battleCapacity       number        // このキャラが守る拠点容量（モブ用）

// 装備・ボーナス
equipment            { item: null | ItemInstance }
battleBonus          {
  attack:  { soldierAtk, soldierDef, charAttack, charSong },
  defense: { soldierAtk, soldierDef, charAttack, charSong },
  dungeon: { soldierAtk, soldierDef, charAttack, charSong }
}

// 非戦闘
description          string
talkEventId          string | null
portrait             string | null // portrait パス（PartyScene は規約パスを優先）
origin               string        // 所属地名など
quote                string        // 加入後セリフ
```

### モブインスタンス追加フィールド（`_isMobInstance=true`）
```
_isMobInstance: true
_legionId: string | null
_slotId: string | null
```

---

## tools/editor.cjs — 音声一括生成

### `/api/voice/generate`（POST）
```
body: { eventId }
```
イベント JSON の script 内で `voice.speakerId` を持つステップを走査し、ローカル VOICEVOX ENGINE（`http://localhost:50021`）に `audio_query` → `synthesis` を逐次リクエスト。生成 wav を `public/audio/voice/<eventId>/<連番>.wav` に書き出し、各ステップの `voice.file` を更新してイベント JSON を上書き保存する。

---

## tools/psd_extract.cjs — PSD展開ツール

### 実行
```bash
node tools/psd_extract.cjs <psdファイル> <charKey>
```
PSD バイナリを直接パース（npm 依存なし・Node 組み込み zlib のみ）し、全画像レイヤーをレイヤー境界クロップの RGBA PNG として出力。RLE / Raw 圧縮対応（ZIP 圧縮は停止・報告）。

### 出力先
```
public/characters/parts/<charKey>/
  <連番3桁>_<サニタイズ名>.png   ← 各レイヤー画像
  parts.json                      ← レイヤーメタデータ
```

### parts.json 形式
```json
{
  "canvas": { "w": 518, "h": 800 },
  "layers": [
    { "id": 1, "name": "本体", "group": "", "left": 82, "top": 103,
      "w": 336, "h": 650, "opacity": 255, "visible": true, "file": "000_本体.png" }
  ]
}
```
グループ / 空レイヤーは `file: null`。PSD の重ね順（bottom-to-top）を保持。

### rig.json 形式（手書き）
```json
{
  "base": [1, 2, 16, 22, 26, 67, 103],
  "blink": { "frames": [[67], [66], [65], [64]] }
}
```
- `base`: 常時表示レイヤー id 配列（重ね順）
- `blink.frames`: 開→閉の各フレームで表示する目レイヤー id 群。StandingChar が base 内の目レイヤーを差し替えて自動まばたき再生

---

## src/scenes/ADVScene.jsx — StandingChar パーツ合成

### フォールバック方式
`useRigData(charKey)` が `/characters/parts/<charKey>/rig.json` + `parts.json` を fetch。

- **成功**: `CompositeChar` でパーツ合成表示 + 自動まばたき（2〜6秒ランダム間隔、1フレーム50ms）
- **失敗（404等）**: `rigData = null` → 従来の静止画 PNG（`/characters/portraits/<charKey>.png`）にフォールバック。例外は ADV に伝播しない

### 対応済みキャラ
| charKey | キャラ | blink段階 |
|---------|--------|----------|
| `char_006` | 彩澄しゅお | 4段階（普通→ちょっと閉じ→半目→閉じ） |
| `char_017` | 四国めたん | 3段階（普通→半目→閉じ） |

他60キャラは rig.json 不在のため静止画 PNG 表示（変更なし）。

### 音声再生
`scenario[idx].voice.file` が存在する場合、`new Audio(voice.file)` で再生。ステップ切替時に前の audio を停止。音声ファイルは事前生成方式（`/api/voice/generate` で生成済みの wav を参照）。
