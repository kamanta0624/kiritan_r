# 差し戻し（Chat宛）: ①ターン同期 — ev_turn1_status がturn1で発火不能の仕様矛盾

宛先: Chat（ディレクター／プランナー）
発信: ClaudeCode
対象元: `docs/prompts/PROMPT_core_flow_fixes.md` ① player_turn / game_start 1ターン遅延

---

## 結論（先に判断が欲しい点）

`PROMPT_core_flow_fixes.md` ① の **flushSync 修正は実装済み・正しく機能**します。
ただし **受け入れ基準#1「ev_turn1_status を1ターン目開始時に発火」は、現在のデータ（player_turn トリガ）では構造的に達成不可能**です。
プロンプトの「スコープ外: データは触らない」と受け入れ基準#1 が衝突しています。**どう処理するか判断願います（下記3択）。**

---

## 根拠（コードとデータの三点確認）

### 1. player_turn は「ターン1入場時」には一度も発火しない

- `startPlayerTurn`（`GameContext.jsx`）が player_turn を発火する唯一の経路。
- `startPlayerTurn` の呼び出しは `App.jsx handleNextTurn`（=ターン終了時）の1箇所のみ。
- `startPlayerTurn` は必ず先に `NEXT_TURN`（currentTurn +1）を dispatch してから player_turn を発火する。
- ゲーム開始（`startNewGame`）は `game_start` のみ発火し、player_turn は呼ばない。currentTurn 初期値=1。

→ **最初の player_turn 発火は「ターン1終了 → currentTurn=2 入場時」**。currentTurn=1 の状態で player_turn が評価されることは一度もない。

### 2. データ側も「最初の player_turn = ターン2」を前提に作られている

- `events/system/ev_679817.json`: `trigger:"player_turn"` / `conditions:[]` / 名前「2ターン目イベント2つ目」。
  条件なしで最初の player_turn 発火に乗る＝**作者自身がそれをターン2として設計**している。

### 3. KNOWLEDGE §8-4 が正仕様を明記済み

> 1ターン目イベントは `game_start` トリガで発火する（2026-06-02）: player_turn は startPlayerTurn（ターン終了後）のみ発火するため、ターン1入場時に player_turn は一度も評価されない。ターン1専用イベントは `trigger:"game_start"` / `conditions:[]` で定義する（**ev_turn1_status が例**）。

→ 文書化された正仕様では ev_turn1_status は `game_start` のはず。だが**実データ（HEAD 時点から）は `player_turn` / `turn eq 1`** にドリフトしている。

---

## flushSync 修正で「直った／変わらない／直らない」の内訳

| イベント | trigger / 条件 | 修正前 | 修正後 | 評価 |
|---|---|---|---|---|
| ev_turn2_join_kotohaxsisters | player_turn / turn eq 2 | ターン3で発火 | **ターン2で発火** | ✅ 直った |
| ev_679817 | player_turn / conditions:[] | ターン2で発火 | ターン2で発火 | ✅ 回帰なし |
| ev_000_opening | game_start / [] | 開始時 | 開始時 | ✅ 回帰なし |
| **ev_turn1_status** | **player_turn / turn eq 1** | ターン2で発火（遅延） | **永久に発火しない** | ❌ 基準#1 未達 |

flushSync は「stale stateRef による off-by-one」を根治するので、turn≥2 の player_turn 系は正しくなる。
だが ev_turn1_status は元々 trigger 選択が誤っているため、off-by-one を直すと「遅れて出ていたものが出なくなる」だけ。

---

## 判断してほしい3択

### 案A（推奨）: ev_turn1_status の trigger を `game_start` に変更
- `trigger:"player_turn"` → `trigger:"game_start"`、`conditions` は `[]`（または `turn eq 1` のまま＝game_start はturn1でのみ発火するので実害なし）。
- KNOWLEDGE §8-4 の正仕様どおり。ターン1冒頭に確実発火。
- 触るのは1ファイルのみ。「turn 条件値の変更」ではなく trigger の是正。
- 留意: 現在 working tree で**イベント大量刷新が進行中**（`PROMPT_event_renewal.md`、多数の events JSON が D/M）。この1件を CODE 側で直すと刷新作業と競合する可能性。**刷新側に寄せるなら案B。**

### 案B: データは触らず保留
- ①は flushSync 修正のみで完了扱い（ev_turn2 等は正常化）。
- ev_turn1_status は **進行中のイベント刷新作業の中で `game_start` 化**する前提でそちらに委譲。
- 受け入れ基準#1 は本タスクでは未達のまま明示クローズ。

### 案C（非推奨）: player_turn をターン1入場時にも発火させる構造変更
- `startNewGame` で game_start 後に player_turn も発火。
- **副作用**: `ev_679817`（conditions:[]、ターン2想定）が**ターン1で誤発火**する。条件なし player_turn イベント全てがターン1にも乗るため、既存設計を壊す。→ 推奨しない。

---

## 現在の実装状況（参考）

- ① flushSync: `GameContext.jsx` `startPlayerTurn` / `startNewGame` に適用済み（ビルド通過）。
- ③ 行動力消費: `App.jsx` `case 'formation'` onLaunch で `actionPoints<1` ガード＋`setActionPoints(-1)`。防衛/ダンジョンは非減算。実装済み。
- ④ 防衛プロンプト貫通遮断: 全面オーバーレイ（zIndex150）＋`handleNextTurn` 冒頭 `defenseFlowRef.current` ガード。実装済み。
- KNOWLEDGE.md 更新・本プロンプト群の archive 移動は**判断後に実施**。

→ **案A / B / C のいずれかを返信ください。** 返信後に ① のクローズと文書更新を行います。
