# ターン終了処理リファクタリング

> 作成: 2026-05-20
> 優先度: 高（バグA・C未解消。現状は詰まりバグが残存）

---

## スコープ外（触るな）

- `GameContext.jsx` の `runEnemyPhase` 内の `runDomestic` タイミング
- `NEXT_TURN` dispatch のタイミング（別タスク `PROMPT_worldmap_bugfix.md` で対処予定）
- `PROMPT_worldmap_bugfix.md` に記載の修正項目は一切手を出さない

---

## 背景・診断

### 複雑化の根本原因

旧バージョン（kiritan/Phaser版）では防衛フローがUIScene内で同期的に完結していた。
kiritan_rでは「ADVオーバーレイ → Formation遷移 → Battle遷移 → 戻る」という
複数シーン跨ぎフローをApp.jsxのPromiseチェーン＋コールバックネストで実装した結果、
Reactのレンダリングモデルと衝突している。

### 既知バグ（未解消）

**バグA（最重要）: useEffect([focusBaseId]) 不発火**
- `processSingleDefense` が `navigate('map', { focusBaseId })` を呼ぶ
- MapSceneの `useEffect([focusBaseId])` は同値では発火しない（React仕様）
- 同一拠点への複数攻撃・放棄後再攻撃・編成キャンセル全ケースで詰まる
- `onReady` が呼ばれない → ADV表示されない → Promise永久pending

**バグC: 本拠地陥落でstartPlayerTurnが進む可能性**
- `doAbandon` 内で本拠地陥落時 `navigate('game_end')` で抜けるが `onDone` を呼ばない
- `handleNextTurn` の `await processDefenseQueue()` の resolve タイミングが不定
- `if (defResult === 'ended') return` チェックが機能しない場合がある

---

## 要求仕様（旧バージョン正仕様）

```
[ターン終了]
  ↓
enemy_turn イベント
before_faction_turn（勢力ごと）
buildAttackQueue
  ↓
attackQueue が空 → startPlayerTurn → map表示
attackQueue あり → 防衛キュー消化ループ
  ↓
[防衛キュー消化: 1アイテムずつ]
  ADV表示（「防衛する」「放棄する」）
    → 防衛する: Formation → Battle → 結果処理 → 次アイテム
    → 放棄する: 確認ADV → battleEnd(conquered:true) → 勝敗チェック → 次アイテム
  ゲーム終了条件を満たしたら即 game_end へ。キュー中断
  ↓
全アイテム消化 → startPlayerTurn → map表示
```

**startPlayerTurn の処理内容**
- NEXT_TURN dispatch（ターン++・収入・キャラ回復・penaltyTurns--）
- player_turn イベント発火

---

## リファクタリング方針

### 方針: App.jsx に defenseFlow state machine を実装

Promiseチェーン＋コールバックネストを廃止。
防衛フローの現在位置を React state として明示的に管理する。

```js
// App.jsx に追加する state
const [defenseFlow, setDefenseFlow] = useState(null);
// null = 防衛フロー外
// { queue: [...], index: number, phase: 'adv'|'formation'|'battle' }
```

各フェーズの遷移は state 更新で駆動。Promise チェーンは使わない。

### MapScene の onReady 依存を撤廃

`processSingleDefense` が MapScene の `useEffect` 完了を待つ設計を廃止。
ADV表示はカメラ移動と並行して即起動する（カメラ移動はfire-and-forget）。

```js
// 新しい processSingleDefense 相当の処理
const startDefenseItem = (item) => {
  // カメラ移動（fire-and-forget）
  setFocusBaseId(item.defenderBase?.id);
  setFocusKey(k => k + 1);  // ← MapScene 側で [focusBaseId, focusKey] を依存配列に追加
  // ADV即起動（カメラ完了を待たない）
  setDefenseAdvParams({ ... });
};
```

MapScene への変更: `useEffect([focusBaseId])` → `useEffect([focusBaseId, focusKey])`
`focusKey` は App.jsx の state。毎回インクリメントで必ず発火する。

### handleNextTurn の非同期制御を state 駆動に変更

```js
// 現在（Promiseチェーン）
const defResult = await processDefenseQueue(factionQueue);
if (defResult === 'ended') return;

// 変更後（state machine）
// handleNextTurn はキュー構築まで担当。
// 防衛キュー消化は defenseFlow state の更新で駆動。
// startPlayerTurn はキュー完全消化後に呼ぶ。
```

### game_end 遷移の一元化

`gamePhase` の `useEffect` で game_end 遷移を行う既存処理（App.jsx L57付近）が既にある。
`doAbandon` や `BattleScene.onComplete` から直接 `navigate('game_end')` を呼ぶのをやめ、
`battleEnd` の返り値 `phase` を受けて `defenseFlow` を終了するだけにする。
`gamePhase` useEffect が game_end 遷移を担保する。

---

## 実装手順

### Step 1: MapScene の focusKey 対応（影響小・バグA根本解決）

`App.jsx` に `focusKey` state を追加。
`MapScene` に `focusKey` prop を追加し `useEffect([focusBaseId, focusKey])` に変更。
`processSingleDefense` で `setFocusKey(k => k + 1)` を呼ぶ。

変更ファイル: `App.jsx`, `src/scenes/MapScene.jsx`

### Step 2: defenseFlow state machine 実装

```
defenseFlow = null
  → handleNextTurn が queue 構築後に setDefenseFlow({ queue, index:0, phase:'adv' })

defenseFlow.phase === 'adv'
  → ADVオーバーレイ表示（既存 defenseAdvParams の代替または併用）
  → 「防衛」選択 → setDefenseFlow({ ...df, phase:'formation' })
  → 「放棄」選択 → battleEnd(conquered:true) → phase判定 → index++ or 終了

defenseFlow.phase === 'formation'
  → FormationScene 表示
  → onCancel → setDefenseFlow({ ...df, phase:'adv' })
  → onDone → setDefenseFlow({ ...df, phase:'battle' })

defenseFlow.phase === 'battle'
  → BattleScene 表示
  → onComplete → battleEnd → phase判定 → index++ or 終了

index >= queue.length
  → setDefenseFlow(null) → startPlayerTurn() → navigate('map')
```

### Step 3: handleNextTurn の整理

EnemyTurnScene カットインは現行のまま維持。
防衛キュー消化部分を state machine 起動に差し替え。

### Step 4: 旧フロー互換コードの削除

- `processDefenseQueue` / `processSingleDefense` / `launchDefenseADV` / `launchDefenseADVRef` 削除
- `launchNextDefense`（旧フロー互換）削除
- `defenseAdvParams` は state machine 内で管理するため廃止または統合

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/App.jsx` | defenseFlow state machine 実装・旧フロー削除 |
| `src/scenes/MapScene.jsx` | focusKey prop 追加・useEffect依存配列変更 |

`GameContext.jsx` は変更不要。

---

## 注意事項

- `defenseAdvParams` の ADVオーバーレイ表示条件（`scene === 'map'`）は state machine に合わせて見直す
- EnemyTurnScene カットインの Promise は現行維持（問題なし）
- `runEnemyPhase` 内の `runDomestic` タイミングは旧バージョンと逆（`_startNextTurn`内が正仕様）だが、現行の別タスク（PROMPT_worldmap_bugfix.md）で対処予定。本リファクタリングでは触らない
- QA確認: `?qa=battlefull` で防衛フロー・放棄フロー・編成キャンセル・複数キューを通す

---

## 完了条件

- [ ] 同一拠点への複数攻撃でADVが表示される（バグA解消）
- [ ] 編成キャンセル後にADVが再表示される
- [ ] 放棄後に次のキューアイテムが処理される
- [ ] 本拠地陥落時に `startPlayerTurn` が実行されない（バグC解消）
- [ ] ゲームエンド後にmap遷移しない
- [ ] Promise チェーンがターン終了処理から消えている
