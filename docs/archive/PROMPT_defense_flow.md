# PROMPT: 防衛フロー改修

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動
> 前提: PROMPT_worldmap_bugfix.md と並行・後続作業

---

## 概要

敵ターン演出と防衛戦の処理順を以下に変更する。
またMAP視点移動・ADVによる防衛選択UIを実装する。

---

## 1. フロー変更：勢力ごとに演出→処理を順次実行

### 現状
```
runEnemyPhase() → attackQueue（全勢力分）取得
→ EnemyTurnScene（全勢力カットイン一括）
→ launchNextDefense（全防衛キュー消化）
```

### 新フロー
```
勢力Aのキュー取得 → 演出A → 防衛Aを全件消化
→ 勢力Bのキュー取得 → 演出B → 防衛Bを全件消化
→ ...
→ startPlayerTurn()
```

### 実装方針

#### GameContext: `runEnemyPhaseForFaction(factionId)` 追加

```js
// 指定勢力の内政・イベント発火・攻撃キュー構築を実行
const runEnemyPhaseForFaction = useCallback(async (factionId) => {
  syncLegionAI();
  const ai = legionAIRef.current;
  const wsAdapter = buildWsAdapter();
  await EventEngine.processTrigger(wsAdapter, 'before_faction_turn', { factionId });
  const attackQueue = ai ? ai.buildAttackQueueForFaction(factionId, stateRef.current.factions.find(f=>f.isPlayer)?.id) : [];
  return attackQueue;
}, [syncLegionAI, buildWsAdapter]);
```

既存の `runEnemyPhase()` は冒頭で `ai.runDomestic()` と `enemy_turn` イベントのみ実行し、attackQueue返却なしに変更（全体準備処理として残す）。

LegionAI に `buildAttackQueueForFaction(factionId, playerFactionId)` が存在しない場合は、既存の `buildAttackQueue` のフィルタ版を追加する。

#### App.jsx: `handleNextTurn` 改修

```js
const handleNextTurn = useCallback(async () => {
  // 1. 全体的な敵ターン準備（runDomestic + enemy_turn イベント）
  await game.actions.runEnemyPhase();  // attackQueue は返さない

  // 2. 敵勢力リスト取得
  const enemyFactions = game.factions.filter(f => !f.isPlayer);

  // 3. 勢力ごとに処理
  for (const faction of enemyFactions) {
    const queue = await game.actions.runEnemyPhaseForFaction(faction.id);
    if (!queue?.length) continue;

    // 演出
    await showEnemyTurnCutin(faction, queue);  // ← 後述

    // 防衛キュー消化
    await processDefenseQueue(queue);           // ← 後述
  }

  // 4. プレイヤーターン開始
  await game.actions.startPlayerTurn();
  navigate('map');
}, [...]);
```

`showEnemyTurnCutin` と `processDefenseQueue` は Promise を返す非同期関数として実装する。

---

## 2. 防衛フロー：MAP視点移動 → ADV選択 → 編成

### 防衛1件の流れ

```
MAP表示（対象拠点にカメラ移動）
  → ADV: 防衛するかしないかの選択肢
      → しない: 陥落処理（battleEnd conquered=true）→ 次のキューへ
      → する:   編成画面
                  → 戻る: ADVを最初から再生（再度選択可能）
                  → 出撃: 戦闘 → 戦闘完了 → 次のキューへ
```

### 実装

#### App.jsx: `processDefenseQueue(queue)` 

```js
const processDefenseQueue = useCallback((queue) => {
  return new Promise((resolve) => {
    const processNext = async (remaining) => {
      if (!remaining.length) { resolve(); return; }
      const [item, ...rest] = remaining;
      await processSingleDefense(item, () => processNext(rest));
    };
    processNext(queue);
  });
}, [...]);
```

#### App.jsx: `processSingleDefense(item, onDone)`

```js
const processSingleDefense = useCallback(async (item, onDone) => {
  // 1. MAP表示 + カメラ移動
  navigate('map', { 
    focusBaseId: item.defenderBase?.id,
    showDefenseAlert: true,
    _onReady: () => {
      // 2. ADV: 防衛選択
      launchDefenseADV(item, onDone);
    }
  });
}, [...]);
```

#### MapScene: `focusBaseId` 対応

MapSceneに `focusBaseId` prop を追加。マウント時に対象拠点の座標にカメラ（`scrollLeft/scrollTop`）をアニメーションで移動する。移動完了後に `_onReady?.()` を呼ぶ。

カメラ移動はスクロールコンテナに `scrollTo({ left, top, behavior:'smooth' })` で実装。500ms後に `_onReady` を呼ぶ。

#### App.jsx: `launchDefenseADV(item, onDone)`

ADVシナリオを動的生成して `navigate('adv', ...)` で起動する。

```js
const launchDefenseADV = useCallback((item, onDone) => {
  const attackerFaction = factions.find(f => f.id === item.attackerFactionId);
  const defenderBase = item.defenderBase;

  const scenario = [
    { type: 'setup', cast: [], bg: 'assets/bg_battle.jpg', location: defenderBase?.name ?? '拠点' },
    { type: 'narration', text: `${attackerFaction?.name ?? '敵勢力'}が${defenderBase?.name ?? '拠点'}に侵攻してきた。` },
    {
      type: 'choice',
      text: '迎撃するか？',
      choices: [
        { label: '防衛する', value: 'defend' },
        { label: '放棄する', value: 'abandon' },
      ],
    },
    { type: 'end' },
  ];

  navigate('adv', {
    scenario,
    returnTo: 'map',
    _onChoice: (value) => {
      if (value === 'abandon') {
        // 陥落処理
        game.actions.battleEnd({
          usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
          conquered: true,
          defenderBaseId: defenderBase?.id ?? defenderBase?.baseId,
          winnerFactionId: item.attackerFactionId,
        }).then(() => onDone());
      } else {
        // 編成画面へ（戻ったらADV再生）
        navigate('formation', {
          mode: 'defense',
          isDefense: true,
          attackerFactionId: item.attackerFactionId,
          attackerCharIds: item.attackerCharIds,
          defenderBase: item.defenderBase,
          legionId: item.legionId,
          retreatRule: item.retreatRule,
          _onCancel: () => launchDefenseADV(item, onDone),  // 戻るでADV再実行
          _onDone: onDone,
        });
      }
    },
  });
}, [...]);
```

#### ADVScene: `choice` 対応

現状 `type:'choice'` はスキップされている。以下を実装する。

**シナリオ型追加:**
```js
{ type: 'choice', text: string, choices: [{ label: string, value: string }] }
```

**表示:** テキストボックスの代わりに選択肢ボタンを縦に並べる。クリックで `_onChoice(value)` を呼ぶ。

**App.jsx との連携:** `navigate('adv', { ..., _onChoice })` で渡し、ADVScene は `onChoice` propで受け取る。

```jsx
// ADVScene.jsx の追加prop
export default function ADVScene({ scenario, onExit, onChoice }) {
  ...
  // choice ステップに到達したとき
  if (current.type === 'choice') {
    return <ChoiceUI entry={current} onSelect={(value) => onChoice?.(value)} />;
  }
}
```

**App.jsx の adv case 修正:**
```jsx
case 'adv':
  return <ADVScene
    scenario={sceneParams.scenario ?? []}
    onExit={() => {
      sceneParams._onComplete?.();
      navigate(sceneParams.returnTo ?? 'map');
    }}
    onChoice={(value) => {
      sceneParams._onChoice?.(value);
    }}
  />;
```

#### FormationScene: `onCancel` の差し替え

防衛ADVから起動した FormationScene は `onCancel`（戻るボタン）で ADV を再実行する。
`sceneParams._onCancel` を `onCancel` に渡す：

```jsx
// App.jsx formation case
onCancel={async () => {
  if (fIsDefense) {
    if (sceneParams._onCancel) {
      sceneParams._onCancel();  // ADV再実行
    } else {
      // 旧来の放棄処理（後方互換）
      const defBase = sceneParams.defenderBase;
      await game.actions.battleEnd({ ... conquered: true ... });
      sceneParams._onDone?.();
    }
  } else {
    navigate('map');
  }
}}
```

BattleScene完了後:
```jsx
onComplete={async (result) => {
  ...
  await game.actions.battleEnd({ ... });
  sceneParams._onDone?.();  // 次キューへ
}}
```

---

## 3. EnemyTurnScene の変更

現状の EnemyTurnScene は全勢力カットインを一括表示するオーケストレーターになっている。
新フローでは**1勢力分のカットインを表示して完了を通知するだけ**に変更する。

```jsx
// 新しいEnemyTurnScene props
<EnemyTurnScene
  faction={currentFaction}       // 単一勢力
  attackQueue={currentQueue}     // その勢力の攻撃キュー
  onComplete={onCutinComplete}   // カットイン完了コールバック
/>
```

または App.jsx 側で promise ベースのヘルパーを実装し、EnemyTurnScene をモーダル的に使う：

```js
const showEnemyTurnCutin = (faction, queue) => new Promise((resolve) => {
  setCurrentCutinFaction(faction);
  setCurrentCutinQueue(queue);
  setShowCutin(true);
  setCutinOnComplete(() => () => {
    setShowCutin(false);
    resolve();
  });
});
```

EnemyTurnScene を常時レンダリングして `show` prop で表示制御するか、navigate で都度遷移するか選択する。
**推奨**: navigate で `enemy_turn` に遷移し、完了後に Promise を resolve するコールバックを sceneParams 経由で渡す。

---

## 4. LegionAI: `buildAttackQueueForFaction` 追加確認

既存の `buildAttackQueue(playerFactionId)` を確認し、勢力ID別にフィルタできるオーバーロードを追加する。

```js
// LegionAI.js に追加
buildAttackQueueForFaction(factionId, playerFactionId) {
  return this.buildAttackQueue(playerFactionId)
    .filter(item => item.attackerFactionId === factionId);
}
```

---

## 5. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/context/GameContext.jsx` | `runEnemyPhaseForFaction()` 追加、`runEnemyPhase()` から attackQueue 返却を削除 |
| `src/App.jsx` | `handleNextTurn` 改修、`processDefenseQueue`・`processSingleDefense`・`launchDefenseADV` 追加、`formation`/`battle`/`adv` case 修正 |
| `src/scenes/EnemyTurnScene.jsx` | 単一勢力カットインモードに変更 |
| `src/scenes/ADVScene.jsx` | `choice` ステップ実装、`onChoice` prop 追加 |
| `src/scenes/MapScene.jsx` | `focusBaseId` prop 追加、カメラ移動実装 |
| `src/game/systems/LegionAI.js` | `buildAttackQueueForFaction()` 追加 |

---

## 6. 動作確認手順

1. 新規ゲーム開始
2. ターン終了
3. `enemy_turn` シーンで勢力Aのカットインが表示される
4. カットイン完了後、MapSceneが表示されて対象拠点にカメラが移動する
5. ADVで「防衛する」を選択 → 編成画面
6. 編成画面で「戻る」→ ADVが最初から再生される
7. 再度「防衛する」→ 編成 → 出撃 → 戦闘 → 戦闘完了
8. 勢力Aの防衛キューが全件完了したら勢力Bのカットインに移る
9. 全勢力完了後に `YOUR TURN` カットイン → マップへ
10. ターン数が +1 になっていること
