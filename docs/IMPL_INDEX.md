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
| `base_menu` | `BaseMenuScene` | `node`, `isOwned`, `canAttack`, `hasDungeon` |
| `formation` | `AttackFormationScene` | `targetNode` |
| `battle` | `BattleScene` | `formation`, `targetNode`, `battleCapacity`, `_dungeonEnemy` |
| `enemy_turn` | `EnemyTurnScene` | `faction`, `attackQueue`, `playerTurnMode`, `_onComplete` |
| `characters` | `PartyScene` | — |
| `items` | `ItemsScene` | — |
| `research` | `ResearchScene` | — |
| `theater` | `TheaterScene` | — |
| `save` | `SaveScene` | `mode` ('save'\|'load'), `returnTo` |
| `game_end` | `GameEndScene` | `isVictory`, `currentTurn`, `playerBaseCount`, `totalBaseCount` |
| `dungeon` | `DungeonScene` | `baseNode`, `_battleResult`, `_resumeFloor`, `_resumeCharId` |
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
gamePhase: 'playing' | 'victory' | 'defeat'
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
| `BATTLE_END` | `{ usedCharIds, deadCharIds, deadMobIds, conquered, defenderBaseId, winnerFactionId, unitResults, defeatedEnemyCharIds }` |
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
| `DUNGEON_DEFEAT` | `{ charId }` |

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
dungeonFloorClear(payload)
dungeonExplored()
dungeonDefeat(charId)
```

### stateRef パターン
`stateRef.current = state` を `useReducer` の直後で常時同期。非同期コールバック（`battleEnd` 等）内で最新 state を参照するときは `stateRef.current` を使う（`state` クロージャは古い）。

### 勝利条件（`checkVictoryCondition`）
1. `eventFlags.flag_vocalo_conquered === true` → victory
2. 自首都が敵に奪われた → defeat
3. 全敵首都を制圧 → victory

### セーブバージョン
`SAVE_VERSION = 9`、キー: `kiritan_save_${slot}`

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

### 作戦補正（`_initStrategy`）
`strategyRate` 差分で SP ダメージを ±10% / ±50% 補正。コンストラクタ時に1回決定。

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
charHp               number
charMaxHp            number
charAttack           number
charSong             number
charDefense          number        // HP被ダメ軽減
soldierAtk           number
soldierDef           number
attackCount          number        // 将軍本人の攻撃回数 (BattleEngineV3: ?? 8)
strategyRate         number        // 作戦補正率
recoveryRate         number | null // null = デフォルト(HP5%/SP+50)
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
