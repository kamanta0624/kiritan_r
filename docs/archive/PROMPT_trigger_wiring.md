# PROMPT_trigger_wiring

## 目的

`PROMPT_event_system_redesign` Phase 3。未接続trigger4種（`base_defense` / `battle_start` / `battle_end` / `char_defeated`）を発火接続する。共通基盤として GameContext に `fireTrigger` 口を新設する。
`base_visit` はトリガー以前に訪問UIが無い（KNOWLEDGE §18 / 2026-05-23調査）ため**当面スキップ**。`theater` 接続は Phase 5。

## 前提（完了済み）

- Phase 1：`applyEffects` 公開
- Phase 4：EventEngine が `ws.applyEffects` 委譲・複数発火対応・`getAvailableTheaterEvents` 追加（`docs/archive/PROMPT_event_engine_delegation.md`）
- **行番号は Phase 1/4 でずれている。各タスクは着手前にコードで再特定すること**

---

## 調査で判明した現状（コード根拠・着手前に再確認）

### fireTrigger 口は存在しない
- `fireTrigger` はコードベースに不在（grep済）。`processTrigger` は GameContext 内の各ターン処理が `buildWsAdapter()` → `EventEngine.processTrigger` で直接呼ぶ形（enemy_turn/player_turn/game_start/base_attack/base_conquered の5系統）
- App.jsx は `buildWsAdapter`（非公開）に触れない。App側から発火する `base_defense` / `battle_start` には `game.actions` 経由の口が必須

### battleEnd の現状（GameContext）
- `battleEnd(result)`（useCallback、現行 L928付近）。`result` 分解：`usedCharIds` / `deadCharIds` / `conquered` / `unitResults`（`[{id,soldiers,charHp}]`）/ `deadMobIds`
- `base_conquered` 発火は `result.conquered` 時のみ（L947付近）
- **`battle_end` / `char_defeated` の発火は無い**（要追加）

### BattleScene の実体と result 構築（変更最小化対象）
- コンポーネント実体は `BattleFlow`（BattleScene.jsx L1103、`export default`）。**propsは `formation/targetNode/onComplete/enemyChars/battleMode/isDefense/enemyRetreatRule` のみ。`onBattleStart`/`onBattleEnd` propは存在しない**（`onBattleEnd` はBattleScene内部のエンジンコールバック名、L1254。混同注意）
- 親への通知は `onComplete(result)` 単一。`battleResultRef.current` に result を組み立て（L1270付近）、`useEffect` で `onComplete(battleResultRef.current)` 発火（L1413付近）
- result内訳（L1258〜L1273付近）：
  - `deadCharIds` = `playerSide.filter(charHp<=0).map(char.id)` … **プレイヤー側戦闘不能のみ。敵撃破を含まない**
  - `deadMobIds` = 両side `charHp<=0 && _isMobInstance`
  - `unitResults` = 両side `{id,soldiers,charHp}`
- `_isMobInstance` フィールドは実在（L1260で使用）。非モブ敵キャラ撃破の抽出に使える
- `eng.startRound()` 呼び出しが複数（L1193付近 / L1338付近）。`onBattleStart` 挿入はエンジン構築直後の初期化側。**どちらが初期化フローか要精読**
- BattleScene は Design納品物混在（KNOWLEDGE §11）。**変更は prop追加と result拡張のみ。描画ロジックに触れない**

### App.jsx の BattleScene 生成は2箇所
- 防衛（L275付近、`isDefense=true`）／攻撃（L411付近、`isDefense=false`、ダンジョン分岐あり）。両方の `onComplete` が `game.actions.battleEnd(...)` を呼ぶ
- `startDefenseQueue(queue)`（useCallback、L172付近）。`base_defense` 発火なし

---

## 実装タスク（優先順・段階）

### 段階A：fireTrigger 口（基盤）
1. GameContext に `fireTrigger(trigger, ctx)` を追加し `actions` で公開
   - 中身：`const ws = buildWsAdapter(); await EventEngine.processTrigger(ws, trigger, ctx);`
   - 既存5系統と同じ `buildWsAdapter` 経由（applyEffects委譲済のため副作用も正規経路）

### 段階B：防衛系
2. App.jsx `startDefenseQueue()`（L172付近）のキュー先頭処理前に `await game.actions.fireTrigger('base_defense', { ... })`
   - ctx に最低限 対象拠点ID。`ev_first_attack_from_natto.json` 等 `trigger:'base_defense'` 指定イベントが既にJSON側に存在（KNOWLEDGE §18）。発火さえ繋げば動く想定だが、条件フィールドをコードで確認
   - `startDefenseQueue` は useCallback。async化の要否と deps（`game.actions`）を確認

### 段階C：戦闘系（BattleScene + GameContext）
3. **BattleScene.jsx**（変更最小）
   - `onBattleStart` prop を追加（`BattleFlow` 引数）。エンジン構築直後の初期化side `eng.startRound()` 直前で `onBattleStart?.()`。startRound複数箇所のうち初期化フローを精読し特定
   - result（`battleResultRef.current`、L1270付近）に `defeatedEnemyCharIds` を追加：
     `enemySide.filter(u => u.char.charHp<=0 && !u.char._isMobInstance).map(u => u.char.id)`
   - 既存 `deadCharIds`（プレイヤー側）は変更しない
4. **App.jsx**（BattleScene生成2箇所 L275/L411付近）
   - `onBattleStart={() => game.actions.fireTrigger('battle_start', { playerCharIds, baseId })}` を渡す
     - `playerCharIds` = 出撃キャラID配列（formationから）。`baseId` = 対象拠点。「特定キャラ参戦時のみ発火」条件のため最低限 playerCharIds
   - `onComplete` の `battleEnd(...)` payload に `defeatedEnemyCharIds` を追加で渡す
5. **GameContext `battleEnd()`**（L928付近）
   - `base_conquered` 発火の後に `battle_end` 発火追加：
     `await EventEngine.processTrigger(ws, 'battle_end', { conquered, defenderBaseId, winnerFactionId })`
   - `char_defeated` 発火追加：payload の `defeatedEnemyCharIds` 各IDに対し
     `await EventEngine.processTrigger(ws, 'char_defeated', { defeatedCharId })` を直列await
   - 条件側 `_evalCondition` の `defeatedChar` は `ctx.defeatedCharId === cond.charId`（EventEngine現行L156付近で確認済）。ctxキー名を一致させる

---

## 注意事項

- **char_defeated は battleEnd 集約で実装**。BattleEngineV3 への `onCharDefeated` フック追加は「戦闘中の撃破演出」が要件化したときのみ。本Phaseでは保留（本体方針）
- `battle_end`/`char_defeated` の ctx キー名は EventEngine の `_evalCondition` が参照する名前（`defeatedCharId` 等）と厳密一致させる。不一致は無言で条件false
- 複数発火（Phase 4）+ 複数 `char_defeated` 直列awaitの順序：各 processTrigger 内の applyEffects は個別dispatch。条件評価の鮮度制約は KNOWLEDGE §8-5 参照
- BattleScene は描画ロジック非変更厳守（Design納品物）。prop追加・result拡張のみ
- 段階Aを最初に通すこと。B/C は fireTrigger 口に依存
- `base_visit` はスキップ（訪問UI未実装、ディレクター判断待ち）

---

## 完了後

- 本プロンプトを `docs/archive/` へ移動
- KNOWLEDGE §18 残タスクの該当行（base_defense未接続 等）を更新
- 残：Phase 2（ADVScene刷新・choice即時適用、App.jsx adv ケースと同一PR）、Phase 5（Theater統合）
