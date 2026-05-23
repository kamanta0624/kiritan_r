# PROMPT: ワールドマップ バグ修正（全10件）

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動
> 前提: PROMPT_worldmap_impl.md は完了済み

---

## 概要

旧kiritan（Phaser版 WorldMapScene.js）との設計比較で判明したバグ・差異を全件修正する。
旧kiritan が正仕様。kiritan_r 側を旧に合わせる。

**変更ファイル**
- `src/context/GameContext.jsx`
- `src/App.jsx`

---

## 修正一覧

| ID | 内容 | ファイル | 優先度 |
|----|------|---------|--------|
| M-01 | ターン数が増えない（NEXT_TURN dispatch のタイミング逆） | GameContext + App | 🔴 |
| M-02 | 敵ターン順序逆（attackQueue が state 反映前に onComplete） | App | 🔴 |
| M-03 | 首都陥落でゲームオーバーにならない（`_originalFactionId` 未設定） | GameContext | 🔴 |
| D-03 | 攻撃勝利時に `declareWar` が呼ばれていない | GameContext | 🔴 |
| D-05 | 防衛放棄時の勝敗判定が stale state で実行される | GameContext | 🔴 |
| D-04 | `conqueredThisTurn` が BATTLE_END で true にならない | GameContext reducer | 🟡 |
| D-06 | 防衛編成で攻撃側キャラ情報が空（mob の factionId が null） | App | 🟡 |
| D-07 | `player_turn` イベントの発火タイミングがM-02に依存してずれる | App | 🟡（M-02修正で解消） |
| D-02 | `before_faction_turn` EventEngine トリガーなし | GameContext | 🟢 |

---

## 修正詳細

---

### M-01: ターン数増えない → NEXT_TURN dispatch を「防衛完了後」に移動

**根本原因**

旧kiritan の正しいフロー:
```
_endTurn() → attackQueue取得 → 防衛キュー処理
→ 全防衛完了後に onDefenseQueueDone() → _startNextTurn()
→ _startNextTurn() で currentTurn++ / 収入加算 / 回復処理
```

kiritan_r の現状:
```
handleNextTurn() → navigate('enemy_turn') → await nextTurn()
→ nextTurn() の中で NEXT_TURN dispatch（currentTurn++）
→ 防衛キューはその後
```

`NEXT_TURN` dispatch（収入・回復・ターン数++）が**防衛キュー処理の前**に走っている。

**修正方針**

`nextTurn()` を2フェーズに分割する：

1. **フェーズA（敵ターン処理）**: `runDomestic()` + attackQueue 構築 + `enemy_turn` EventEngine。NEXT_TURN dispatch はしない。
2. **フェーズB（ターン開始処理）**: 収入・回復・NEXT_TURN dispatch。防衛キュー完了後に呼ぶ。

#### GameContext.jsx の修正

`nextTurn()` を `runEnemyPhase()` にリネームし、NEXT_TURN dispatch を除く。

```js
// 旧: nextTurn() → 全部やる
// 新: runEnemyPhase() → attackQueue を返すだけ
//     startPlayerTurn() → NEXT_TURN dispatch + 収入・回復

const runEnemyPhase = useCallback(async () => {
  syncLegionAI();
  const ai = legionAIRef.current;
  const s  = stateRef.current;
  const pf = s.factions.find(f => f.isPlayer);

  // 1. LegionAI 内政（モブ補充）
  if (ai) ai.runDomestic();

  // 2. EventEngine: enemy_turn
  const wsAdapter = buildWsAdapter();
  await EventEngine.processTrigger(wsAdapter, 'enemy_turn', {});

  // 3. before_faction_turn（各敵勢力ごと）※D-02
  const enemyFactionIds = s.factions.filter(f => !f.isPlayer).map(f => f.id);
  for (const factionId of enemyFactionIds) {
    await EventEngine.processTrigger(wsAdapter, 'before_faction_turn', { factionId });
  }

  // 4. LegionAI 攻撃キュー構築
  const attackQueue = ai ? ai.buildAttackQueue(pf?.id) : [];

  return attackQueue;
}, [syncLegionAI, buildWsAdapter]);

const startPlayerTurn = useCallback(async () => {
  syncLegionAI();
  const ai = legionAIRef.current;
  const bs = systemsRef.current.buildingSystem;
  const s  = stateRef.current;

  const incomeBonus = bs.getIncomeBonus(s.buildings);

  // LegionAIが追加した新規モブを取り出す
  const existingIds  = new Set(s.characters.map(c => c.id));
  const mobAdditions = ai
    ? ai.characters.filter(c => c._isMobInstance && !existingIds.has(c.id))
    : [];

  dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } });

  // EventEngine: player_turn
  const wsAdapter = buildWsAdapter();
  await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
}, [syncLegionAI, buildWsAdapter]);
```

`actions` の `value` に `runEnemyPhase` と `startPlayerTurn` を公開。
既存の `nextTurn` は削除するか `runEnemyPhase` のエイリアスとして残す（App.jsx が参照している場合）。

`onPlayerTurnStart()` は `startPlayerTurn()` と統合してよい。旧の `onPlayerTurnStart` が `player_turn` EventEngine を呼んでいた場合は重複するため削除する。

#### App.jsx の修正

```js
// handleNextTurn: 敵フェーズのみ実行、attackQueueを直接渡す
const handleNextTurn = useCallback(async () => {
  setEnemyTurnPending(true);

  // attackQueue を先に取得してからEnemyTurnSceneに渡す
  const attackQueue = await game.actions.runEnemyPhase();

  setEnemyTurnPending(false);
  setPendingAttackQueue(attackQueue ?? []); // ← stateではなくrefかローカル変数で渡す（後述）
  navigate('enemy_turn');
}, [game.actions, navigate]);
```

**重要**: `defenseQueue` stateは廃止し、`pendingAttackQueue` を `useRef` で保持する。

```js
const pendingAttackQueueRef = useRef([]);

const handleNextTurn = useCallback(async () => {
  setEnemyTurnPending(true);
  const attackQueue = await game.actions.runEnemyPhase();
  pendingAttackQueueRef.current = attackQueue ?? [];
  setEnemyTurnPending(false);
  navigate('enemy_turn');
}, [game.actions, navigate]);
```

`EnemyTurnScene` には `attackQueue={pendingAttackQueueRef.current}` を渡す。

`launchNextDefense` の末尾（キュー空時）:

```js
const launchNextDefense = useCallback(async (queue) => {
  if (!queue?.length) {
    await game.actions.startPlayerTurn(); // ← ここでターン数++・収入・回復
    navigate('map');
    return;
  }
  // ...
}, [navigate, game.actions]);
```

---

### M-02: 敵ターン順序逆 → onComplete に attackQueue を直接渡す

M-01の修正（pendingAttackQueueRef）で解消される。

`EnemyTurnScene` の `onComplete` 呼び出し元（App.jsx）:

```jsx
case 'enemy_turn':
  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#0a0610' }}>
      <EnemyTurnScene
        isPending={enemyTurnPending}
        attackQueue={pendingAttackQueueRef.current}  // ← refから直接
        factionsData={factions}
        playerFactionName={playerFaction?.name}
        onComplete={() => {
          // attackQueueをrefから取り出してlaunchNextDefenseに渡す
          launchNextDefense(pendingAttackQueueRef.current);
        }}
      />
    </div>
  );
```

`defenseQueue` stateは削除する。

---

### M-03: 首都陥落でゲームオーバーにならない → `_originalFactionId` 付与

#### GameContext.jsx の修正

`createInitialState()` 内、bases の初期化：

```js
// 変更前
bases: basesData.bases,

// 変更後
bases: basesData.bases.map(b => ({ ...b, _originalFactionId: b.factionId })),
```

これで `checkVictoryCondition()` の判定が正しく機能する。

---

### D-03: 攻撃勝利時に `declareWar` が呼ばれていない

#### GameContext.jsx `battleEnd()` の修正

```js
// 制圧時: declareWarを呼ぶ（攻撃戦のみ）
if (result.conquered && result.mode === 'attack') {
  dispatch({ type: 'DECLARE_WAR', payload: { targetFactionId: result.defenderBase?.factionId ?? result.winnerFactionId } });
  // ※ winnerFactionId はプレイヤー側なので、宣戦相手は制圧前の factionId を使う
}
```

`battleEnd()` の引数に `mode` を追加するか、App.jsx 側で `conquered && !isDefense` の条件で `declareWar` を呼ぶ。

**推奨**: App.jsx の `onComplete` で処理：

```js
// battle case の onComplete 内
if (result.conquered && !isDefense) {
  game.actions.declareWar(targetBase.factionId); // 制圧前のfactionId
}
const phase = await game.actions.battleEnd({ ... });
```

`declareWar` は `actions` に既に公開されているため変更不要。

---

### D-04: `conqueredThisTurn` が BATTLE_END で true にならない

#### GameContext.jsx reducer の確認・修正

`BATTLE_END` reducer 末尾：

```js
return {
  ...state,
  characters,
  bases,
  conqueredThisTurn: conquered ? true : state.conqueredThisTurn, // ← 確認
};
```

現状すでに `conquered || state.conqueredThisTurn` になっているため reducer は正しい。

問題は MapScene 側で `conqueredThisTurn` を参照していない可能性。旧kiritan では「今ターン制圧済み → 攻撃ボタン無効」の制限があった。kiritan_r の MapScene の `canAttack` 算出に `conqueredThisTurn` を考慮する：

```js
// MapScene.jsx の liveNodes useMemo 内
canAttack: !isPlayer && isAtWar && attackableIds.has(b.id) && !conqueredThisTurn,
```

`conqueredThisTurn` を `useGame()` から取得する（GameContext の `value` に追加が必要な場合は追加）。

---

### D-05: 防衛放棄・撤退時の勝敗判定が stale state で実行

**現状の問題**

`battleEnd()` 内で勝敗チェックを行う際：

```js
const nextState = {
  ...stateRef.current,
  bases: result.conquered
    ? stateRef.current.bases.map(b =>
        b.id === result.defenderBaseId ? { ...b, factionId: result.winnerFactionId } : b
      )
    : stateRef.current.bases,
};
const phase = checkVictoryCondition(nextState);
```

`stateRef.current` は `dispatch({ type: 'BATTLE_END', ... })` 前のstateを参照している。`nextState` を手動構築することで `_originalFactionId` の有無に関わらず正しい判定ができる。

M-03の修正（`_originalFactionId` 付与）で `checkVictoryCondition` は正しく動くようになるが、`nextState` の bases に `_originalFactionId` が含まれているか確認すること。

`stateRef.current.bases` に `_originalFactionId` が含まれていれば問題なし（M-03修正で `createInitialState` に追加するため含まれるようになる）。

---

### D-06: 防衛編成で攻撃側キャラ情報が空

**原因候補**

App.jsx `formation` ケースの防衛時 `fEnemyChars` 算出：

```js
const attackerIds = sceneParams.attackerCharIds ?? [];
fEnemyChars = attackerIds.length > 0
  ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
  : characters.filter(c =>
      c.factionId === sceneParams.attackerFactionId &&
      !(c.penaltyTurns > 0) &&
      (c.soldiers ?? 0) > 0
    ).slice(0, 4);
```

LegionAI が生成するモブキャラの `factionId` が `null` になっている場合、fallback の `c.factionId === sceneParams.attackerFactionId` でヒットしない。

**修正**: LegionAI の `buildAttackQueue()` が返す `attackerCharIds` に mob の id が含まれているか確認。含まれている場合は `attackerIds.length > 0` の分岐でヒットするはずなので、`characters` state に mob が含まれているかを確認する。

`characters.filter(c => attackerIds.includes(c.id))` が空になる場合は、mob が `ADD_MOB_CHARS` で追加されていない可能性がある。`game.characters` にデバッグ出力して確認すること。

暫定対応として：

```js
fEnemyChars = attackerIds.length > 0
  ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
  : characters.filter(c =>
      (c.factionId === sceneParams.attackerFactionId || c.legionId === sceneParams.legionId) &&
      !(c.penaltyTurns > 0) &&
      (c.soldiers ?? 0) > 0
    ).slice(0, 4);
```

`legionId` フィールドがキャラに存在する場合はそれでフォールバック。

---

## 修正後の正しいフロー

```
[プレイヤーがターン終了]
  handleNextTurn()
    → runEnemyPhase()        // LegionAI内政 + EventEngine:enemy_turn + before_faction_turn
    → attackQueue取得        // LegionAI.buildAttackQueue()
    → pendingAttackQueueRef.current = attackQueue
    → navigate('enemy_turn')

[EnemyTurnScene]
  isPending=false になった時点で attackQueue(ref) を参照
  攻撃勢力カットイン（attackQueue由来）
  → onComplete()
    → launchNextDefense(pendingAttackQueueRef.current)

[防衛編成・戦闘]
  キュー1件ずつ消費
  戦闘完了 → battleEnd() → conqueredThisTurn更新 / declareWar
  次のキューへ or キュー空

[全防衛完了]
  launchNextDefense(空配列)
    → startPlayerTurn()      // NEXT_TURN dispatch（currentTurn++ / 収入 / 回復）
    → EventEngine:player_turn
    → navigate('map')
```

---

## 動作確認手順

1. `npm run dev` 起動
2. 新規ゲーム開始
3. **M-01確認**: ターン終了 → マップに戻った後、ターン数が `2` になっていること
4. **M-02確認**: 敵カットイン → 即座に防衛編成が起動すること（マップに戻らないこと）
5. **M-03確認**: 仙台（首都）が陥落するとゲームオーバーになること（`?qa=worldmap` のT06でも確認）
6. **D-03確認**: 攻撃で制圧後、次ターンで隣接拠点が攻撃可能になること
7. **D-04確認**: 1ターンに同じ勢力の複数拠点を連続制圧できないこと
8. **D-06確認**: 防衛編成画面のBALTTEFIELD左下に攻撃側キャラが表示されること

`?qa=worldmap` を実行して T01〜T13 が全件 PASS することを確認。
