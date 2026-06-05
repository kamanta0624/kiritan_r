## ⚠️ 差し戻し（1回目）
前回提出分、**本プロンプト未実装**。コード確認結果：
- 修正1（App.jsx の dialogId + `<ADVScene key>` 再マウント）= **未着手**。
- 修正2（`ev_turn1_status.json` → game_start）= **未着手**（trigger=player_turn / turn==1 のまま）。
- 実際に行われた変更は `src/context/GameContext.jsx:895` 直後への `wsAdapter.currentTurn = s.currentTurn + 1;` の**再投入のみ**。これは下記「対象外/申し送り」で revert 維持を明示した `+1` そのもの。フリーズ本体・turn1不発のいずれも未解決、かつ退行。

**必須対応（この順で全て実施）**：
1. `src/context/GameContext.jsx` の `wsAdapter.currentTurn = s.currentTurn + 1;`（895行直後・コメント「NEXT_TURN後の実ターン値に補正」付き）を**削除して revert**。
2. 下記 **修正1** を実装（未着手）。
3. 下記 **修正2** を実装（未着手）。
4. 下記 **検証** を全通過させるまで完了宣言禁止。コードを根拠に自己検証すること。

---

# PROMPT: ゲーム開始時イベント不発 + ADV逐次会話フリーズ 修正

## 背景 / 症状
1. **当初**: 新規ゲーム開始時に1ターン目イベント（`ev_turn1_status`）が発生しない。
2. **誤修正後の新バグ**: 1ターン目イベント依然不発のまま、2ターン目相当のイベントで「全セリフ表示後に黒画面（ADVクローム残置・セリフボックス消滅）のまま操作不能（フリーズ）」。コンソールエラーなし。`startPlayerTurn` の `+1` パッチは revert 済（コード確認）だが症状継続。

## 真因（コード根拠・推論なし）

### 真因A: `ev_turn1_status` が構造的に到達不能
- `player_turn` トリガの発火点は `startPlayerTurn`（`src/context/GameContext.jsx:882`）の1箇所のみ。呼び出しは `handleNextTurn`（`src/App.jsx:191–225`）＝ターン終了時のみ。
- ターン1への入場は `startNewGame` の `game_start`（GameContext.jsx:906,923）のみ。`player_turn` は currentTurn==1 で一度も評価されない。
- `ev_turn1_status` は trigger=player_turn / `turn eq 1`（`src/game/data/events/system/ev_turn1_status.json`）。上記より `turn==1` は永久不成立 → 発火不能。`+1` パッチは唯一の偶発発火経路（stale値）を消すだけで無関係。

### 真因B: ADV逐次会話でのフリーズ（「2ターン目イベントが終了しない」の正体）
- 1つの trigger で certain（probability>=1）イベントが複数あると `_filterEligible`→`for…await _runEvent` で逐次起動（`src/game/systems/EventEngine.js:101,116`）。
- 各 `_runEvent` → `startDialog` → ハンドラ（`src/App.jsx:73–77`）→ `navigate('adv', { onExit: () => { navigate('map'); onComplete?.() } })`。
- 1件目 end → `finish`（`src/scenes/ADVScene.jsx:725–730`）→ `onExit()` → `navigate('map')` + `resolve`。`resolve` が**同期で** for ループを進め、2件目 `startDialog` → `navigate('adv')` を**同一同期tick**で実行。React バッチで `map`→`adv` が相殺 → scene は 'adv' 維持。
- `<ADVScene>` に `key` 無し（`src/App.jsx:671–676`）→ **アンマウントせず同一インスタンス流用**。
- ADVScene は `script` prop 変化時に `idx`（useState, 717）/ `finishedRef`（useRef, 721）を**リセットしない**（`scenario` のみ useMemo 再計算 708–711）。
- 流用後: `idx`＝前会話の end index、`finishedRef.current`＝true のまま。`current=end` → セリフボックス非描画（＝報告の黒画面スクショ）。end useEffect（733–735）→ `finish` → `if(finishedRef.current) return`（726）で**即return、onExit 未実行**。
- 2件目の `resolve` 永久未発火 → `await startPlayerTurn` がハング → フリーズ・コンソールエラーなし。revert後も「2件逐次」という発火条件は不変のため症状継続（報告と一致）。

### 結合関係（重要・実装順序）
- 真因A の修正で `ev_turn1_status` を `game_start` へ移すと、`game_start` が **`ev_000_opening` + `ev_turn1_status` の2件逐次**になる。真因B 未修正だとフリーズがゲーム開始時へ移動する。
- **B修正はA修正の前提。両方を本プロンプトで同時に実施すること。**

## 修正箇所

### 修正1（真因B・本体・必須）: 会話ごとに ADVScene を強制再マウント（key方式）
逐次会話で前回 `idx`/`finishedRef` が残るのを、インスタンス流用そのものを断って解消する。全 `navigate('adv')` 呼び出し元（game_start / player_turn / theater）を一括救済。

**`src/App.jsx`**
1. 会話シーケンス番号 ref を追加（コンポーネント上部、他refと並べる）:
```jsx
const dialogSeqRef = useRef(0);
```
2. startDialog ハンドラ（73–77付近）で一意idを付与:
```jsx
game.setStartDialogHandler((script, effects, onComplete) => {
  navigate('adv', {
    script, effects,
    dialogId: ++dialogSeqRef.current,
    onExit: () => { navigate('map'); onComplete?.(); },
  });
});
```
3. theater 起動の `navigate('adv', …)`（592付近）にも一意idを付与:
```jsx
dialogId: ++dialogSeqRef.current,
```
4. `case 'adv':` の描画（671–676）に key を付与:
```jsx
case 'adv':
  return <ADVScene
    key={sceneParams.dialogId ?? 'adv'}
    script={sceneParams.script ?? []}
    effects={sceneParams.effects ?? null}
    onExit={sceneParams.onExit ?? (() => navigate('map'))}
  />;
```
- 効果: 各 `startDialog`/theater起動で `dialogId` が変わり key が変わる → 同一 scene 'adv' でも ADVScene が unmount→remount → `idx=0`/`finishedRef=false`/`history=[]` の新鮮な状態で必ずセリフ先頭から描画 → end で正しく `onExit`/`resolve`。順序ハザードなし。

**代替案（非推奨・記録のみ）**: ADVScene 内に `useEffect(()=>{ finishedRef.current=false; setIdx(0); setHistory([]); }, [script])` を追加する1ファイル修正。ただし end useEffect とリセット effect の実行順序により、changeover フレームで2件目セリフを1フレーム飛ばす（finish早期実行）リスクあり。確実性で key方式を採用すること。

### 修正2（真因A）: `ev_turn1_status` を `game_start` トリガへ移設
**`src/game/data/events/system/ev_turn1_status.json`**
- `"trigger": "player_turn"` → `"trigger": "game_start"`。
- `conditions` の `{ "type":"turn","op":"eq","value":1 }` を削除し `"conditions": []` に。game_start は開始時=ターン1で一度のみ発火、`maxOccurrences:1` 維持で十分。
- 発火順は priority 降順で `ev_000_opening`(999) → `ev_turn1_status`(900)。問題なし（この2件逐次を修正1が救済）。

## 検証（自己検証必須・未検証で完了宣言禁止）
1. 新規ゲーム開始 → `ev_000_opening` 表示・クローズ → 続けて `ev_turn1_status`（1ターン目イベント）表示・クローズ → map到達。**黒画面フリーズが起きないこと**（修正1の逐次2件検証を兼ねる）。
2. ターン1終了 → 敵フェーズ → ターン2移行時のイベントが**全セリフ表示後に正常終了し map到達**、フリーズ無し。
3. 各ダイアログ閉じ後に必ず map へ戻り、`await startPlayerTurn` がハングしないこと。
4. コンソールにエラー・警告が出ないこと。

## 対象外 / 申し送り
- `player_turn` の「入場ターン番号」評価（旧 `+1` 案件＝ターンずれ。`ev_turn2`等が表示ターンに対し1遅れる件）は本プロンプト対象外（保留中）。revert 状態を維持し、本修正で触れないこと。
- `ev_679817`（`conditions: []`・characterId null・name「2ターン目イベント2つ目」）は空条件で初回 player_turn に常時適格となるデータ衛生上の別件。本修正で逐次フリーズは解消するが、**本プロンプトでは変更しない**。意図が turn2 イベントなら `conditions` に turn 条件を後日追加、テスト残骸なら削除（要判断）。

## 完了後
- `KNOWLEDGE.md` を更新（① ADV は会話ごとに key で再マウントする仕様、② 1ターン目イベントは `game_start` トリガで発火する旨）。
- 本プロンプト `PROMPT_event_start_and_adv_freeze.md` を `docs/archive/` へ移動。
- 旧 `docs/prompts/PROMPT_event_turn_offset.md`（誤診断・revert済）も `docs/archive/` へ移動。
