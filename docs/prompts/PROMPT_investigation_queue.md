# 調査キュー（Chat先行・コードレビュー由来）

実装プロンプト化の前にコード根拠を確定すべき未確認項目。
各項目: 確認対象・確認方法・確定後の扱い。

---

## I-1. 劇場アクション実装有無（NOTE-17）

- 確認: `GameContext.jsx` に `getTheaterEvents` / `runTheaterEvent` が実装済みか
- 方法: GameContext content検索
- 確定後: 未実装なら劇場機能のプロンプト要否を判断

---

## I-2. ダンジョン整合（NOTE-21/22/23）

- 確認1: `onDefeat`で `penaltyTurns=2` が実際にセットされるか（DungeonScene/App/GameContext）
- 確認2: `dungeonExploredThisTurn` のセット位置（`onFloorClear` か `onStartBattle` か）
- 確認3: `floorData.enemy.soldiers` 表示と `buildDungeonEnemy`（App）生成オブジェクトのフィールド一致
- 確定後: 不整合があればダンジョン修正プロンプト化

---

## I-3. clearedCount（NOTE-30）

- 確認: GameEndSceneの「キャラクリ」表示が何を指すか・App.jsxの渡し方
- 方法: GameEndScene/App content検索
- 確定後: 意味確定後に表示修正要否を判断

---

## I-4. ngpFactionId処理（NOTE-32）

- 確認: `onNavigate('map', { ngpFactionId })` 受領後のApp.jsx処理
- 関連: NGP real data wiring（KNOWLEDGE.md未完了タスク・§16）と接続
- 確定後: NGP接続プロンプトの前提資料

---

## I-5. strategyRate確率（NOTE-26）

- 状況: 表示「+50%」とBattleEngineV3の確率判定（`Math.random()<(diff-50)/100`）の乖離
- 確認済み: 計算式は一致。表示が確率を無視
- 確定後: バグではない。表示文言の補足要否のみ判断
