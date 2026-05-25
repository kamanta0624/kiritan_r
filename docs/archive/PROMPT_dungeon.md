# ダンジョン実装 引き継ぎプロンプト

作成: 2026-05-24
仕様元: `/Users/kamatashintarou/MCP_Learning/kiritan/docs/archive/FEATURE_SPEC_v0.6.md`

---

## 背景

「0から開発」ではない。骨格は既に存在する。

| 項目 | 状態 |
|------|------|
| dungeons.json | 完成（5階・敵パラメータ全定義済み） |
| BattleEngineV3 `battleMode:'dungeon'` | 実装済み（無制限ラウンド・撤退不可） |
| App.jsx `case 'dungeon'` | エントリポイント存在 |
| App.jsx `case 'map'` | `hasDungeon` フラグ計算済み |
| App.jsx `case 'base_menu'` | `onNavigate('dungeon')` 実装済み |
| BATTLE_END reducer | `deadCharIds` で penaltyTurns 付与済み |
| GameContext `dungeonProgress` | initialState に存在（serialize未追加） |
| DungeonScene.jsx | ダミー実装（UIパーツ再利用可） |

実質的な作業は「接続層の追加」と「DungeonSceneのphase実装」のみ。

---

## 前提確認済み事項

- `dungeons.json`: 存在。龍泉洞（dungeon_001・5階・baseId:base_012）のみ定義済み
- `bases.json`: 全拠点に `dungeonId: null` フィールド済み
- `dungeonProgress: {}`: GameContext initialStateに存在。serializeStateに未追加
- `DungeonScene.jsx`: ダミー実装（dungeons.json未接続）
- `App.jsx case 'dungeon'`: `baseNode` を渡すだけ。dungeonFlow未実装
- `App.jsx case 'map' onNodeClick`: `hasDungeon: !!node.dungeonId` を既にbase_menuに渡している
- `App.jsx case 'base_menu' onNavigate('dungeon')`: `navigate('dungeon', { baseNode: sceneParams.node })` 実装済み
- `BATTLE_END` reducer: `usedThisTurn=true`, `soldiers`, `charHp` を書き戻し済み。`deadCharIds` で `penaltyTurns=2` 付与
- `availableChars`: `soldiers > 0` 条件を削除する（後述）
- `BattleEngineV3`: `battleMode:'dungeon'` で無制限ラウンド・撤退不可

---

## 1. availableChars の修正（GameContext.jsx）

`soldiers > 0` 条件を削除する。

```js
// 変更前
const availableChars = state.characters.filter(c =>
  c.factionId === playerFaction?.id &&
  !(c.penaltyTurns > 0) &&
  !c.usedThisTurn &&
  c.soldiers > 0   // ← 削除
);

// 変更後
const availableChars = state.characters.filter(c =>
  c.factionId === playerFaction?.id &&
  !(c.penaltyTurns > 0) &&
  !c.usedThisTurn
);
```

KNOWLEDGE.md §3（仕様メモ）にも記載すること：
> availableChars は soldiers=0 を含む。soldiers=0 のキャラは通常戦闘の編成では実質戦力外だが、ダンジョン探索には参加できる。

---

## 2. bases.json 修正

base_012（盛岡）の `dungeonId` を設定：

```json
{ "id": "base_012", "name": "盛岡", "dungeonId": "dungeon_001", ... }
```

---

## 3. GameContext.jsx 修正

### 3-1. import 追加

```js
import dungeonsData from '../game/data/dungeons.json';
```

### 3-2. createInitialState に追加

```js
dungeonProgress: Object.fromEntries(
  dungeonsData.dungeons.map(d => [d.id, { clearedFloors: 0, isFullyCleared: false }])
),
dungeonExploredThisTurn: false,
```

### 3-3. NEXT_TURN reducer の return に追加

```js
dungeonExploredThisTurn: false,
```

### 3-4. reducer に case 追加

```js
case 'DUNGEON_FLOOR_CLEAR': {
  const { dungeonId, clearedFloors, isFullyCleared, rewardItem } = action.payload;
  return {
    ...state,
    dungeonProgress: {
      ...state.dungeonProgress,
      [dungeonId]: { clearedFloors, isFullyCleared },
    },
    inventory: rewardItem ? [...state.inventory, rewardItem] : state.inventory,
  };
}

case 'DUNGEON_EXPLORED':
  return { ...state, dungeonExploredThisTurn: true };

case 'DUNGEON_DEFEAT': {
  const { charId } = action.payload;
  return {
    ...state,
    characters: state.characters.map(c =>
      c.id !== charId ? c : {
        ...c,
        charHp:       1,
        soldiers:     0,
        penaltyTurns: 2,
        usedThisTurn: true,
      }
    ),
  };
}
```

### 3-5. serializeState に追加

```js
dungeonProgress: state.dungeonProgress ?? {},
```

### 3-6. deserializeToState に追加

```js
dungeonProgress: data.dungeonProgress ?? Object.fromEntries(
  dungeonsData.dungeons.map(d => [d.id, { clearedFloors: 0, isFullyCleared: false }])
),
dungeonExploredThisTurn: false,
```

### 3-7. actions に追加

```js
dungeonFloorClear: (payload) => dispatch({ type: 'DUNGEON_FLOOR_CLEAR', payload }),
dungeonExplored:   ()        => dispatch({ type: 'DUNGEON_EXPLORED' }),
dungeonDefeat:     (charId)  => dispatch({ type: 'DUNGEON_DEFEAT', payload: { charId } }),
```

### 3-8. context value に追加

```js
dungeonProgress:         state.dungeonProgress,
dungeonExploredThisTurn: state.dungeonExploredThisTurn,
```

---

## 4. App.jsx 修正

### 4-1. dungeonFlow state 追加

```js
// null | { dungeonId, explorerCharId, floor, baseNode }
const [dungeonFlow, setDungeonFlow] = useState(null);
```

### 4-2. dungeon ケース書き換え

```js
case 'dungeon': {
  const baseNode  = sceneParams.baseNode;
  const dungeonId = baseNode?.dungeonId;
  const dungeon   = dungeonsData.dungeons.find(d => d.id === dungeonId);
  if (!dungeon) return <div>迷宮データが見つかりません</div>;

  const progress = game.dungeonProgress?.[dungeonId]
    ?? { clearedFloors: 0, isFullyCleared: false };

  return (
    <DungeonScene
      dungeon={dungeon}
      progress={progress}
      availableChars={availableChars}
      dungeonExploredThisTurn={game.dungeonExploredThisTurn}
      battleResult={sceneParams._battleResult ?? null}
      resumeFloor={sceneParams._resumeFloor ?? null}
      resumeCharId={sceneParams._resumeCharId ?? null}
      onStartBattle={(explorerCharId, floor, floorData) => {
        setDungeonFlow({ dungeonId, explorerCharId, floor, baseNode });
        game.actions.dungeonExplored();
        navigate('battle', {
          mode:           'dungeon',
          formation:      characters.filter(c => c.id === explorerCharId),
          targetNode:     { name: dungeon.name, battleCapacity: 99999 },
          _dungeonEnemy:  floorData.enemy,
          battleCapacity: 99999,
        });
      }}
      onFloorClear={(payload) => game.actions.dungeonFloorClear(payload)}
      onDefeat={(charId)      => game.actions.dungeonDefeat(charId)}
      onNavigate={navigate}
    />
  );
}
```

### 4-3. battle ケース onComplete の先頭にダンジョン分岐を追加

既存の onComplete クロージャの **先頭**（declareWar より前）に追加する。

```js
onComplete={async (result) => {
  // ── ダンジョン戦闘の場合 ──
  if (dungeonFlow) {
    const { dungeonId, explorerCharId, floor, baseNode } = dungeonFlow;
    setDungeonFlow(null);

    // charHp/soldiers/usedThisTurn を書き戻す
    // 敗北（conquered===false）時は deadCharIds に入れて penaltyTurns=2 も付与
    const isWin = result?.conquered === true;
    await game.actions.battleEnd({
      usedCharIds:     [explorerCharId],
      deadCharIds:     isWin ? [] : [explorerCharId],
      deadMobIds:      [],
      unitResults:     result?.unitResults ?? [],
      conquered:       false,      // 拠点制圧なし
      defenderBaseId:  null,
      winnerFactionId: null,
    });

    navigate('dungeon', {
      baseNode,
      _battleResult: isWin ? 'win' : 'lose',
      _resumeFloor:  floor,
      _resumeCharId: explorerCharId,
    });
    return;  // 通常戦闘ロジックには進まない
  }

  // ── 以降は既存の通常戦闘ロジック（変更不要） ──
  ...
```

### 4-4. dungeonsData import 追加

```js
import dungeonsData from './game/data/dungeons.json';
```

---

## 5. DungeonScene.jsx 全面書き換え

### Props

```js
export default function DungeonScene({
  dungeon,                  // dungeons.json の1エントリ
  progress,                 // { clearedFloors, isFullyCleared }
  availableChars,           // GameContext.availableChars（soldiers=0含む）
  dungeonExploredThisTurn,  // bool
  battleResult,             // null | 'win' | 'lose'
  resumeFloor,              // number | null（BattleScene戻り時の階層）
  resumeCharId,             // string | null
  onStartBattle,            // (explorerCharId, floor, floorData) => void
  onFloorClear,             // ({ dungeonId, clearedFloors, isFullyCleared, rewardItem }) => void
  onDefeat,                 // (charId) => void
  onNavigate,
})
```

### 内部フェーズ定義

| phase | 内容 |
|-------|------|
| `'select'` | キャラ選択UI |
| `'floor_intro'` | 階層情報・敵情報・「戦闘開始」ボタン |
| `'floor_result'` | 戦闘結果（battleResultで復帰後ここへ） |
| `'adv'` | eventId発火時のADVScene embed |
| `'next_or_escape'` | ADV後の「次の階へ / 退却」選択 |

### 初期フェーズ決定

```js
const initialPhase = () => {
  if (battleResult === 'win' || battleResult === 'lose') return 'floor_result';
  return 'select';
};

const [phase, setPhase]               = useState(initialPhase);
const [selectedCharId, setSelected]   = useState(resumeCharId ?? null);
const [currentFloor, setFloor]        = useState(resumeFloor ?? progress.clearedFloors + 1);
const clearedCalledRef                = useRef(false);
```

### select フェーズ

探索不可条件（いずれかに該当する場合はボタンをgrayout・理由表示）:
- `dungeonExploredThisTurn === true`: 「本日探索済み」
- `progress.isFullyCleared === true`: 「探索完了済み」
- `availableChars.length === 0`: 「出撃可能なキャラがいない」

表示: availableChars リスト（1体選択）→「探索開始」→ `setPhase('floor_intro')`

### floor_intro フェーズ

```js
const floorData = dungeon.floors.find(f => f.floor === currentFloor);
```

表示: 階層番号・ダンジョン名・敵情報（name・soldiers）
- 「戦闘開始」→ `onStartBattle(selectedCharId, currentFloor, floorData)`
- 「退却」→ `onNavigate('map')`

### floor_result フェーズ

**敗北時:**

```js
useEffect(() => {
  if (phase === 'floor_result' && battleResult === 'lose') {
    onDefeat(resumeCharId);
    const t = setTimeout(() => onNavigate('map'), 2000);
    return () => clearTimeout(t);
  }
}, [phase, battleResult]);
```

表示: 「探索失敗」・キャラ名・「2ターンの休養が必要です」

**勝利時:**

```js
useEffect(() => {
  if (phase !== 'floor_result' || battleResult !== 'win') return;
  if (clearedCalledRef.current) return;
  clearedCalledRef.current = true;

  const floorData    = dungeon.floors.find(f => f.floor === currentFloor);
  const isLastFloor  = currentFloor >= dungeon.totalFloors;
  const rewardItemId = floorData?.rewardItemId ?? null;
  const eventId      = floorData?.eventId ?? null;

  const rewardItem = rewardItemId
    ? { instanceId: `${rewardItemId}_${Date.now()}`, itemId: rewardItemId }
    : null;

  onFloorClear({
    dungeonId:      dungeon.id,
    clearedFloors:  currentFloor,
    isFullyCleared: isLastFloor,
    rewardItem,
  });

  if (eventId) {
    // eventsDataからシナリオを引いてadvフェーズへ（eventsDataのimportが必要）
    setPhase('adv');
  } else if (isLastFloor) {
    setPhase('dungeon_cleared');
  } else {
    setPhase('next_or_escape');
  }
}, [phase, battleResult]);
```

### dungeon_cleared フェーズ

表示: 「迷宮クリア！」・報酬アイテム名（あれば）・「マップへ戻る」→ `onNavigate('map')`

### next_or_escape フェーズ

表示: 「B{currentFloor} クリア」・報酬アイテム名（あれば）
- 「次の階へ」→ `setFloor(f => f+1)` → `setPhase('floor_intro')`
- 「退却する」→ `onNavigate('map')`

### adv フェーズ

eventsData から eventId のシナリオを引いてADVSceneをembed:

```jsx
import eventsData from '../game/data/events.json';
import ADVScene, { convertEventScript } from './ADVScene.jsx';

// adv フェーズの render
const eventDef   = eventsData.events?.find(e => e.id === currentEventId);
const { scenario, cast } = eventDef
  ? convertEventScript(eventDef.script ?? [])
  : { scenario: [{ type:'end' }], cast: [] };

return (
  <ADVScene
    scenario={scenario}
    cast={cast}
    bg={null}
    transparent={false}
    onExit={() => {
      const isLastFloor = currentFloor >= dungeon.totalFloors;
      setPhase(isLastFloor ? 'dungeon_cleared' : 'next_or_escape');
    }}
  />
);
```

`currentEventId` は `dungeon.floors.find(f => f.floor === currentFloor)?.eventId`。
state に持たせること（`floor_result` フェーズで setCurrentEventId する）。

---

## 6. BattleScene への dungeonEnemy 対応

`App.jsx case 'battle'` で `sceneParams._dungeonEnemy` が存在する場合、
`enemyChars` として渡す。

```js
// battle ケース内
const enemyChars = sceneParams._dungeonEnemy
  ? [buildDungeonEnemy(sceneParams._dungeonEnemy)]
  : (enemyFactionId && legionAI
      ? legionAI.getDefenders(...)
      : []);
```

`buildDungeonEnemy` を App.jsx に定義（または utils に置く）:

```js
function buildDungeonEnemy(enemy) {
  return {
    id:           `dungeon_enemy_${Date.now()}`,
    name:         enemy.name,
    factionId:    '__dungeon__',
    isLeader:     true,
    role:         'attacker',
    attackType:   'melee',
    charHp:       enemy.charHp,
    charMaxHp:    enemy.charHp,
    charAttack:   enemy.charAttack,
    charSong:     0,
    charDefense:  0,
    soldiers:     enemy.soldiers,
    maxSoldiers:  enemy.soldiers,
    soldierAtk:   enemy.soldierAtk,
    soldierDef:   enemy.soldierDef,
    strategyRate: 30,
    penaltyTurns: 0,
    usedThisTurn: false,
    skillId:      null,
    battleBonus: {
      attack:  { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      defense: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      dungeon: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
    },
  };
}
```

---

## 7. 実装順序

1. `availableChars` の `soldiers > 0` 削除（GameContext）
2. `bases.json`: base_012 の `dungeonId` 設定
3. `GameContext.jsx`: import・initialState・reducer 3case・actions・context value・serialize/deserialize
4. `App.jsx`: dungeonFlow state・dungeonsData import・dungeon ケース・battle onComplete 分岐・buildDungeonEnemy
5. `DungeonScene.jsx`: 全面書き換え

---

## 8. QA確認手順

通常プレイで以下を確認する（`?qa=battlefull` 不可）:

### ダンジョン動作確認
1. 盛岡（base_012）をプレイヤー勢力が所有した状態でマップ表示
2. 盛岡クリック → BaseMenuScene に「迷宮を探索」ボタンが表示される
3. ボタンクリック → DungeonScene（select フェーズ）
4. キャラ選択 → floor_intro（龍泉洞 B1・敵情報表示）
5. 「戦闘開始」→ BattleScene（dungeonモード・撤退不可）
6. 勝利 → DungeonScene（floor_result）→「次の階へ」
7. B5まで繰り返し → 「迷宮クリア」→ マップへ
8. 同ターン中に同じ拠点から再探索しようとすると「本日探索済み」でブロック
9. ターン終了 → `dungeonExploredThisTurn` がリセットされ再探索可能
10. 敗北時: charHp=1・soldiers=0・penaltyTurns=2 をGameContext上で確認
11. セーブ → ロード → dungeonProgress が復元されることを確認

### 通常戦闘リグレッション確認（`?qa=battlefull` で実施）
battle ケースに `_dungeonEnemy` 分岐を追加したことによる既存戦闘への影響を確認する。

12. 通常の攻撃戦（プレイヤー→敵拠点）が正常に起動する
13. 防衛戦（敵→プレイヤー拠点）が正常に起動する
14. 戦闘終了後、通常の battleEnd フロー（拠点制圧・キャラHP書き戻し）が正常に動作する
15. `dungeonFlow` が null のとき、ダンジョン分岐に入らないことを確認

---

## 9. KNOWLEDGE.md 更新指示

完了後に以下を更新すること:
- §3 仕様メモ: availableChars の soldiers=0 許容を記載
- §6 シーン実装状況テーブル: dungeon 行を `✅ / ✅` に
- §18 残タスク: #5 dungeon を完了扱いに
