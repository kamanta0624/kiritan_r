# PROMPT_engine_forced_opening_battle

イベントから戦闘を1回だけ強制発生させる仕組みを作る。
体験版オープニングの「旅館防衛戦」（大都会が白石＝ずんだ旅館を攻撃）に使う。

**ADVスクリプトに `battle` ステップを追加する設計は採らない。**
既存の防衛フロー（`startDefenseQueue`）を再利用する。

---

## 成功基準

1. `game_start` イベントの effects に `forceDefenseBattle` を書くと、
   オープニングADV終了後・ターン1開始前に防衛戦が発生する
2. その戦闘の終了後、`battle_end` トリガーのイベントが発火する
3. 戦闘終了後に通常どおりターン1のプレイヤーフェーズへ入る
4. `forceDefenseBattle` を持たない通常の `startNewGame` の挙動が変わらない
5. 上記を `npm run dev` で通しプレイして自分で確認してから完了報告すること

---

## 既存の仕組み（調査済み・前提）

`App.jsx:223-237`

```js
const startDefenseQueue = useCallback(async (queue) => { ... });
```

queue の要素は `LegionAI.buildAttackQueue`（`LegionAI.js`）が返す形と同一。

```js
{
  attackerFactionId: 'faction_red',
  defenderBase:      <bases の要素そのもの>,
  attackerCharIds:   ['char_020', ...],
  legionId:          'legion_red_01',
  retreatRule:       'char_dead',
}
```

このキューを渡せば「防衛プロンプト → 編成 → 戦闘 → `battleEnd`」まで既存経路が全部走る。
`battleEnd`（`GameContext.jsx:1009-1027`）が `base_conquered` / `battle_end` / `char_defeated`
を発火するので、戦闘後イベントも既存のまま動く。

`startNewGame`（`GameContext.jsx:949-975`）は
`game_start` トリガー発火 → `startPlayerTurn()` の順で、両者の間に割り込む余地がない。
ここが唯一の変更点になる。

---

## 実装

### 1. effect 型 `forceDefenseBattle` を追加

`GameContext.jsx` の `applyEffects` に case を追加する（`legionForceAttack` の近く）。

イベントJSON側の書式:

```json
{
  "type": "forceDefenseBattle",
  "baseId": "base_001",
  "attackerFactionId": "faction_red",
  "attackerCharIds": ["char_111", "char_021", "char_022", "char_024"],
  "retreatRule": "char_dead"
}
```

effect は state に控えるだけにする。`pendingForcedBattle` を1件保持できれば足りる。
配列にするな。同時に2件は要らない。

`defenderBase` は `baseId` から `state.bases` を引いて解決する。
解決できなければ何もせず `console.warn` して抜ける。

### 2. startNewGame に割り込み口を作る

`startNewGame` に引数を1つ追加する。

```js
const startNewGame = useCallback(async (onForcedBattle) => {
  ...
  await EventEngine.processTrigger(ws, 'game_start', {});
  // ここで pendingForcedBattle があれば onForcedBattle に渡して await する
  await startPlayerTurn();
}, [...]);
```

- `pendingForcedBattle` が無ければ従来どおり素通しする
- 渡したら `pendingForcedBattle` をクリアする
- `onForcedBattle` が未指定でも落ちないこと

### 3. App.jsx で受ける

`startNewGame` の呼び出し元で、`onForcedBattle` に
`(item) => startDefenseQueue([item])` を渡す。

`startDefenseQueue` は `defenseFlowResolveRef` 経由で戦闘完了まで待つ Promise を返すので、
`await` すればターン1開始が戦闘後まで遅れる。

---

## 使用箇所（このプロンプトでは書かない）

体験版のオープニングイベント（`ev_demo_opening`）の effects に
上記 `forceDefenseBattle` を1件置く。イベントJSONの作成は別プロンプト。

---

## やるな

- ADVScene の `buildScenario`（L682-740）へ新ステップ型を追加すること
- `pendingForcedBattle` を配列やキューにすること（1件で足りる）
- 汎用の「任意タイミングで戦闘を挿入する仕組み」を作ること。
  必要なのは game_start 直後の1回だけ
- `LegionAI` / `BattleEngineV3` / `BattleScene` への変更
- `startDefenseQueue` 本体の変更
- 既存の `legionForceAttack` / `attackUnlock` の整理（使用0件だが今回の対象外）
- 指示範囲外のコードやコメントの整形
