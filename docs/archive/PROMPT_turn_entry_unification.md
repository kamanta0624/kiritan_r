# PROMPT: ターン入場処理の共通シーケンス化

## 目的

「ターン1への入場」だけが他ターンと非対称な現状を解消する。
ターン入場処理（`NEXT_TURN` + 収入回復 + `player_turn` 発火）を全ターン共通の単一経路に統一し、`game_start` と `player_turn` の責務を分離する。

## 背景（コード根拠）

- `createInitialState.currentTurn` = **1**（`src/context/GameContext.jsx:58`）。ターン1を「入場済み」の体裁で開始。
- `NEXT_TURN` = `currentTurn + 1`（`GameContext:175`）。
- `startNewGame()` は `START_NEW_GAME` dispatch → `game_start` 発火のみ。`startPlayerTurn` を呼ばない（`GameContext:909-931`）。
- `startPlayerTurn()` が `NEXT_TURN` → `player_turn` 発火を担うが、呼出は `handleNextTurn` 末尾（`App.jsx:228`）のみ。
- 結果: **ターン1だけ `player_turn` が一度も発火しない**。ターン1入場イベントを `game_start` に肩代わりさせている。

### trigger 実データ（`events/**` 棚卸し済み）

| trigger | 件数 | 内訳 |
|---------|:---:|------|
| `game_start` | 2 | `ev_000_opening`(priority 999)／`ev_turn1_status`(priority 900) |
| `player_turn` | 多数 | ターン2以降の全イベント（`{type:'turn',op:'eq',value:N}` 条件で分岐） |

`ev_turn1_status` は `conditions:[]` / `maxOccurrences:1` / effects で char_008・char_009 を `charJoin`。
二重発火ガードは `EventEngine._filterEligible` の `getOccurrenceCount(ws,ev.id) < maxOccurrences`（`EventEngine.js:114-115`）で担保済。

## あるべき状態（2層分離）

```
[層A] game_start  = ゲーム生涯1回。ターン非依存の開幕のみ（ev_000_opening）
[層B] player_turn = 毎ターン入場の唯一の起点。ターン1も例外にしない（turn条件で分岐）

新規開始:
  startNewGame()
    → START_NEW_GAME dispatch（currentTurn=0, occurredEvents/flags リセット）
    → game_start 発火（層A: ev_000_opening）
    → startPlayerTurn()           ← 追加。NEXT_TURN(0→1) → player_turn 発火（層B）
  App 側で navigate('map')

ターン送り（変更なし）:
  handleNextTurn → … → startPlayerTurn()（NEXT_TURN +1 → player_turn）

ロード（変更なし・非対称を維持）:
  LOAD_SAVE（currentTurn=保存値＝入場済み）→ navigate
    → startPlayerTurn 非経由・game_start 非発火（途中再開）
```

## 変更指示

### 1. `src/context/GameContext.jsx`

- `createInitialState`: `currentTurn: 1` → **`0`**（:58）。
  - `LOAD_SAVE` は `{ ...createInitialState(), ...action.payload }`（:96）で保存値が上書きするため影響なし。
- `startNewGame()`（:909-931）: `game_start` 発火（:930）の**後**に `await startPlayerTurn()` を追加。`useCallback` 依存配列に `startPlayerTurn` を追加（現状 `[buildWsAdapter]`）。
  - 順序厳守: `START_NEW_GAME` → `game_start`（ev_000_opening）→ `startPlayerTurn`（NEXT_TURN 0→1 → player_turn で ev_turn1_status）。
  - 既存の `flushSync` / LegionAI 再初期化 / `ADD_MOB_CHARS` の順序は維持。
- `startPlayerTurn()`（:882-903）: 挙動変更不要。`NEXT_TURN` が 0→1 でも `+1` で成立。
  - この関数を「ターン入場の唯一の関数」と位置づけるコメントを付す。将来 NGP・周回も必ずこの関数を通す旨を明記。

### 2. `src/App.jsx` — 変更不要（確認のみ）

- TitleScene `onNavigate` の `dest==='map'` 分岐（:327-331）は**既に** `await game.actions.startNewGame()` → `navigate('map')` の順。§1 で `startNewGame` が `startPlayerTurn` を内包すれば、await 完了＝player_turn 発火完了を待って遷移する。**追加変更なし。**
- `handleNextTurn` 末尾の `startPlayerTurn`（:228）: 変更なし。
- ロード経路（:619）・防衛フロー: 変更なし。

### 3. `src/game/data/events/system/ev_turn1_status.json`

- `"trigger": "game_start"` → **`"player_turn"`**
- `"conditions": []` → **`[{ "type": "turn", "op": "eq", "value": 1 }]`**
- `maxOccurrences` / `priority` / `script` / `effects` は変更しない。

## 満たすべき不変条件（実装観点）

- 新規開始で `ev_000_opening` → `ev_turn1_status` の順に発火。char_008・char_009 が加入。
- 新規開始直後の `currentTurn === 1`。
- ターン送りで `currentTurn` が +1、`player_turn` 発火が継続。
- ロード再開で保存ターンを維持。`ev_turn1_status` 等の発火済みイベントが再発火しない（`maxOccurrences` ガード）。
- `game_start` トリガーのイベントは `ev_000_opening` のみが残る（ターン依存イベントは player_turn 側に存在）。

## スコープ外（このプロンプトで触らない）

- **NGP / 周回経路**（`App.jsx:677` `onNavigate={navigate}` 直呼び）。`startNewGame` を経由せず初期化ゼロ。本来は同じ `startPlayerTurn` 経由に集約すべきだが、実データ接続（KNOWLEDGE §16 機能#1）と同時対応の別タスク。
  - 補足: 本改修で `currentTurn` 初期値が 0 になるため、startNewGame 非経由で map に入る経路（NGP 直 navigate・`?qa=` 専用シーン）は `currentTurn=0` を読む。NGP は既に初期化ゼロで非機能（§6 🔴）・QA は専用シーンのため非ブロッキング。NGP の `startPlayerTurn` 経由集約時に併せて解消。
- `ev_saitama_chain_3` の `turn_start`（未接続 trigger）。chain_4 の `legionForceAttack` 連動を含む別調査が必要（KNOWLEDGE §16 シナリオ要調査）。
- 下記「申し送り」の重複イベント。

## 申し送り（別途判断・本タスクで変更しない）

- `ev_turn1_status`（→ player_turn turn==1）と `ev_turn2_join_kotohaxsisters`（player_turn turn==2）が**いずれも char_008・char_009 を `charJoin`**。後者は `noFlag: flag_kotoha_sisters_joined` + `setFlag` を持つが、前者は flag を立てない。ターン1加入後、フラグ未設定のままターン2で `noFlag` 通過→再 `charJoin` する重複の可能性。**この重複は本改修の新規発生ではなく現状（game_start で ev_turn1_status 発火→turn2 で ev_turn2 発火）から既存。** 本改修は trigger を game_start→player_turn に移すのみで重複条件を変えない。どちらが正か・前者に setFlag を持たせるか等は仕様確認が必要。
