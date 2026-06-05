# PROMPT: コアフロー不具合修正（①ターン同期 ③行動力消費 ④防衛モーダル）

対象: ClaudeCode。価値基準 = 怠惰・短気・傲慢。
場当たり対処禁止。根本原因を1回で潰す。再発防止構造を優先。
着手前に `KNOWLEDGE.md` と本ファイル該当箇所のソースを必読。行番号は変動しうるため必ず実コードで確認。

---

## ① player_turn / game_start イベントが1ターン遅延

### 症状
`turn eq N` 条件のイベントが N+1 ターン目に発火。
ev_turn1_status（turn1指定）→2ターン目、ev_turn2_join_kotohaxsisters（turn2指定）→3ターン目。

### 根拠（コード）
- `GameContext.jsx:773` `stateRef.current = state` はレンダ本体で同期（useEffect でない）。関数実行中に再レンダは起きないため、dispatch 直後の `stateRef.current` は更新前。
- `GameContext.jsx:816-818` `buildWsAdapter` は `const s = stateRef.current` を読む。
- `GameContext.jsx:894-897` `startPlayerTurn`:
  ```
  dispatch({ type: 'NEXT_TURN', ... });   // currentTurn +1 を予約（未反映）
  const wsAdapter = buildWsAdapter();      // stateRef.current = NEXT_TURN 反映前 → 旧 currentTurn
  await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
  ```
  → `ws.currentTurn` が「表示ターン − 1」で条件評価される。
- 同型が `startNewGame`（同ファイル ~922-923）の `START_NEW_GAME` dispatch 直後 `buildWsAdapter()`→`game_start` にも存在。game_start は turn 非依存条件のため現状は顕在化していないが同じ構造欠陥。

### 修正方針
dispatch を `react-dom` の `flushSync` で同期反映してから `buildWsAdapter()` を呼ぶ。これにより再レンダが走り `stateRef.current` が NEXT_TURN 反映後になる。currentTurn 以外の player_turn 条件（treasury / flags / bases 等）も同時に正しい値になるため、currentTurn override 方式より堅牢。

- `import { flushSync } from 'react-dom'` を追加。
- `startPlayerTurn`:
  ```
  flushSync(() => dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } }));
  const wsAdapter = buildWsAdapter();
  await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
  ```
- `startNewGame` の `START_NEW_GAME`（および後続 `ADD_MOB_CHARS`）も同様に flushSync 化し、game_start 発火前に stateRef を確定させる。同じ欠陥を残さない（怠惰=再発防止）。

### 受け入れ基準
- ev_turn1_status を1ターン目開始時に発火。
- ev_turn2_join_kotohaxsisters を2ターン目開始時に発火。
- game_start イベント（ev_000_opening）はゲーム開始時に従来どおり発火（回帰なし）。

### スコープ外
- イベント側 JSON の turn 条件値の変更（コード側のズレが原因。データは触らない）。

---

## ③ 攻撃で行動力（actionPoints）を消費しない

### 症状
攻撃で拠点制圧しても行動力が減らない（5/5 のまま）。

### 根拠（コード）
- `GameContext.jsx:186-225` `BATTLE_END` reducer の return に actionPoints なし（`...state` 素通り）。`usedThisTurn` は記録するが行動力は不変。
- 行動力減算は `actions.setActionPoints` のみ。呼び出しはコマンド購入（`App.jsx:537`）と劇場（`App.jsx:590`）だけ。攻撃の出撃→戦闘→BATTLE_END では未呼び出し。
- 旧 kiritan 正仕様: 攻撃1回 = 行動力1消費。

### 修正方針
**攻撃の出撃確定時**に `setActionPoints(actionPoints - 1)` を1回。BATTLE_END reducer には入れない（攻撃/防衛 共通経路のため、防衛側でも誤って減る）。

- 攻撃の出撃ハンドラを特定（FormationScene の出撃確定 → `App.jsx` の `formation`→`battle` 起動箇所。`isDefense` でない攻撃フロー）。
- そこで `game.actions.setActionPoints(game.actionPoints - 1)` を実行。
- 防衛フロー（defenseFlow / PartnerWidget onDefend → formation）では減算しない。
- 出撃前に `actionPoints <= 0` なら出撃不可（ボタン無効 or 早期 return）。旧仕様未確認なら制圧成否に関わらず出撃時点で消費。

### 受け入れ基準
- 攻撃出撃1回ごとに行動力 −1。
- 防衛戦闘では行動力が減らない。
- 行動力0で攻撃出撃不可。
- ターン開始で maxActionPoints まで全回復（既存 NEXT_TURN の挙動を維持）。

### スコープ外
- 行動力上限（maxActionPoints）の調整。

---

## ④ 防衛プロンプト中に背後のマップ操作が貫通

### 症状
侵攻を受けた防衛選択（防衛する/放棄する）表示中に、背後マップのノードクリック・攻撃・ターン終了ができる。ターン終了は反応するがターンは進まない。

### 根拠（コード）
- 防衛は `defenseFlow` state machine（`App.jsx:130-` `phase: 'defense_prompt'`）。
- 防衛中も scene は `'map'`（`startDefenseQueue` が `navigate('map', ...)`）。
- `App.jsx` 最終 return:
  ```
  {renderScene()}                                  // scene='map' → MapScene 操作可能
  <PartnerWidget defensePrompt={defensePromptData} onDefend onAbandon />
  ```
  両者が並列。MapScene を覆う pointer-events 遮断オーバーレイなし。
- `case 'map'`（`App.jsx:336-`）の MapScene は `onNodeClick`（→base_menu）・`onNextTurn`（→handleNextTurn）を無条件で有効化。
- 「ターン終了で進まない」= `handleNextTurn`（`App.jsx:195-`）に defenseFlow active チェックがなく再入。

### 修正方針
防衛プロンプト表示中（`defenseFlow?.phase === 'defense_prompt'`）は、プロンプト以外の全操作を遮断。二重ガードで堅牢化（傲慢）。

1. **全面遮断オーバーレイ**: `app-root` の `{renderScene()}` の上、`<PartnerWidget>` の下に、`defenseFlow?.phase === 'defense_prompt'` のとき全面 div（`position:fixed; inset:0; pointer-events:auto`、背景は半透明 or 透明）を挿入。背後マップへのクリックを物理遮断。色は `tokens.js` 由来のみ（直書き禁止）。PartnerWidget の防衛プロンプトはこのオーバーレイより上の z-index。
2. **再入ガード**: `handleNextTurn` 冒頭に `if (defenseFlowRef.current) return;`。

### 受け入れ基準
- 防衛プロンプト中、マップノードクリック・ターン終了ボタンが無反応。
- 「防衛する」「放棄する」のみ操作可能。
- 防衛解決後（onDefend/onAbandon → advanceDefenseQueue でキュー消化）、オーバーレイ解除でマップ操作が復帰。

### スコープ外
- 防衛戦闘ロジック・defenseFlow の state 遷移そのもの（操作ガードのみ）。

---

## 完了後
- 各課題の受け入れ基準を満たすことを QA（`?qa=battlefull` 含む）で確認。
- `KNOWLEDGE.md` の該当箇所（ターン進行 / 戦闘 / 防衛フロー §）を更新。
- 本プロンプトを `docs/archive/` へ移動。

## 本対応に含めない（別件）
- ②茜葵が仲間に出ない / 在野ステータス廃止: charJoin 適用の実機 end 確認が未了。①修正後に再検証してから別プロンプト化。
