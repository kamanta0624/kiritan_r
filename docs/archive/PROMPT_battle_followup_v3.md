# 戦闘システム 追い修正プロンプト v3（実機6バグ — Chat静的調査済み）

前段: `PROMPT_battle_followup_v2.md`（残1〜残5）、`PROMPT_battle_bugs_v3.md`（BUG-A/B/C/D）、`KNOWLEDGE.md §9 / §14 / §14-1`。
本プロンプトは実機観測6バグの静的調査結果（コード根拠あり）と修正方針を確定する。

## 厳守事項（再掲）
- 原因に推論を使わない。コード・データ根拠を示す。
- 撤退（retreat）= 戦闘即終了は仕様。`_doRetreat`→`_finish` 削除は禁止。
- ハードリロード解決策と結論づけたら調査結果まとめて停止。
- デザイントークンは `src/shared/tokens.js` から import。色直書き禁止。

## 正仕様の出所（旧版 kiritan = 正）
- `kiritan/README.md`: **「攻撃タイプ: 近接（melee・反撃あり）/ 間接（ranged・反撃なし）」**。反撃の有無は**攻撃側**のタイプで決まる。守備側タイプは無関係。
- `kiritan/README.md`: **「最大5ラウンド（防衛側が全滅しなければ防衛側の勝利）」**。
- `BattleEngineV3.js` 設計コメント: **「SP への命中数 + 将軍への命中数 = N（常に成立）。N = min(soldiers, battleCapacity）」**。

---

## v3前段の状態確認（コード照合済み）

| 項目 | 状態 | 根拠 |
|---|---|---|
| BUG-A（onRoundEnd の applyRetreatRule('loss_50') 削除） | 済 | `BattleScene.jsx` onRoundEnd に applyRetreatRule 呼び出し無し |
| BUG-B（getDefenders reserve 化） | 済 | `LegionAI.js` L130-153 reserve 参照・全勢力員フォールバック廃止 |
| BUG-D（overlay 強制再マウント key） | 済 | `BattleScene.jsx` L1417 `key={animState._seq}`、onExchangeResult で `_seq` 採番 |
| defenseFlow フィルタ（v3.2 C） | 済 | `App.jsx` L267 `!(c.penaltyTurns>0) && (c.soldiers??0)>0` |
| enemyUnits `charHp:10`/`charMaxHp:10` 固定 → 実値反映 | **未** | `BattleScene.jsx` L1224 `charHp:10, charMaxHp:10` 直書き残存 |
| BUG-C／残2（charAttack 独立化） | **未** | `BattleScene.jsx` L1224 `charAttack: e.atk, soldierAtk: e.atk`（normalizeChar も charAttack を持たない L55） |
| 色トークン直書き → tokens.js import | **未** | `BattleScene.jsx` 冒頭でトークン再定義 |
| 残1（_calcOptions に retreatRule 結線） | **未** | `BattleScene.jsx` L33 `_calcOptions(unit)` 引数に retreatRule 無し。L1203 呼び出しも素 |

→ **v3 主要バグ（A/B/D）完了。付随ハードニング3件 + 残1 + 残2 が未完。** 本 v3-followup に統合。`PROMPT_battle_bugs_v3.md` は本プロンプト完了後にアーカイブ（KNOWLEDGE §14-1 の参照を本ファイルへ張り替えてから）。

---

## BUG-1【確定】近接攻撃の反撃が守備側タイプで門番されている（仕様違反）

### 症状
前衛近接つるぎ → 前衛遠距離ウナ で、つるぎが一方的に攻撃。ウナの反撃ダメージが入らない（実機画像1・2）。

### コード根拠
`BattleEngineV3.js` `_resolveExchange`:
```js
const dr = (atk.action === 'attack' && def.char.attackType === 'melee' && this._isAlive(def))
  ? this._calcOneSide(def, atk, !isPlayer)
  : null;
```
`def.char.attackType === 'melee'` が反撃成立条件に入っている。守備側（ウナ）が ranged のため `dr=null` → 反撃なし。

### 正仕様
旧版: 反撃は**攻撃側**が近接（`atk.action === 'attack'`）なら成立。守備側タイプ不問（双方直接攻撃）。間接攻撃（ranged/song）は反撃なし。

### 修正
`def.char.attackType === 'melee'` を条件から除去:
```js
const dr = (atk.action === 'attack' && this._isAlive(def))
  ? this._calcOneSide(def, atk, !isPlayer)
  : null;
```
- 反撃側 `_calcOneSide(def, atk)` は `_atkParams(def, ...)` で def.action を読む。反撃は直接攻撃扱い。def.action が ranged/song に化けて mult が下がらないか確認（化ける場合は反撃時 mult=1.0 を強制）。

---

## BUG-2【確定】防衛戦で mode='attack' 固定 → 防衛側生存でも敗北（仕様違反）

### 症状
仙台防衛戦、自軍ウナ生存・撤退未選択・ラウンド5到達で「敗北」（実機画像3）。

### コード根拠
- `App.jsx` L275 `<BattleScene isDefense={true} … />`（防衛戦は本コンポーネントに routing）。
- `BattleScene.jsx` L1096 `BattleFlow({ …, isDefense = false })`。`isDefense` は `getBgUrl` の背景画像にしか使われない。
- `BattleScene.jsx` L1234-1236 エンジン生成: **`mode: 'attack'` 固定**。
- `BattleScene.jsx` onBattleEnd L1252: `const playerWins = wins; // mode:'attack'固定なのでそのまま`、`conquered: wins`、`setWinner(playerWins ? 'player' : 'enemy')`。
- `BattleEngineV3.js` `checkRoundLimit`: R5到達で `_finish(false)`（attacker未勝利）。
- 帰結: 防衛戦でも player を attacker 扱い。R5タイムアウト → wins=false → 敗北バナー。App L284 `conquered: !result.conquered`、L286 winnerFactionId 反転も player を attacker フレームで解釈するため整合せず、拠点陥落（敵勝利）として記録。

### 正仕様
旧版: 防衛側が全滅しなければ防衛側（=この戦闘ではプレイヤー）の勝利。R5タイムアウト = 防衛成功 = プレイヤー勝利。

### App.jsx 側の契約（確認）
`App.jsx` 防衛 onComplete は `result.conquered = 「プレイヤーが勝ったか」` を期待（L284 `conquered: !(result.conquered)` で拠点陥落へ反転、L286 winner も playerWon 前提）。BattleFlow が `conquered` を「プレイヤー勝利」で返せば App 側は無改修で整合。

### 修正（BattleScene.jsx・BattleFlow 内）
1. エンジン mode を実戦に合わせる:
```js
mode: isDefense ? 'defense' : 'attack',
```
2. buildUnit の sideType を isDefense 対応（battleBonus が attack/defense で変わるため）:
```js
const playerUnits = rawAllies.map((c, i) => BattleEngineV3.buildUnit(c, isDefense ? 'defense' : 'attack', i));
// enemyUnits の sideType:'defense' も isDefense ? 'attack' : 'defense' に
```
3. onBattleEnd の勝敗導出を isDefense 対応:
```js
const playerWins = isDefense ? !wins : wins;   // 防衛: 攻撃側(=敵)が勝たなければプレイヤー勝利
battleResultRef.current = { conquered: playerWins, … };
setWinner(playerWins ? 'player' : 'enemy');
```
- 検証: 防衛戦 R5到達・自軍生存 → 「勝利」、App 側で拠点保持・winner=playerFaction。
- 検証: 防衛戦で自軍将軍全滅 → 「敗北」、拠点陥落。
- 検証: 攻撃戦（case 'battle'）は従来通り（isDefense=false で挙動不変）。

---

## BUG-4 / BUG-5【確定・同一根】overlay の命中数表示がエンジンの実 split を受け取っていない

### 症状
- BUG-4: 戦闘域400で攻撃時「SP×400 + 本体−2」= 402 相当の表示（実機画像6）。N=400 なら SP は 400−（本体命中数）であるべき。
- BUG-5: 相手SP100に N=400 で攻撃して「本体−2」のみ。命中数として不自然。

### コード根拠
- `BattleEngineV3.js` `_splitHits(N, vicSol, atkSol)` は `{ toMeme, toChar }`（toMeme+toChar=N）を返すが、`_calcOneSide` は**これを破棄**し `{ memeDmg, charDmg, selfMemeDmg, selfCharDmg, N }` のみ返す。
- `_resolveExchange` の `_onExchangeResult` は `{ atkMem, atkChr, defMem, defChr, N, Nr, …Before }` を渡す（§14 契約どおり）。**toMeme/toChar は契約に無い**。`atkMem`=SPダメージ量、`atkChr`=HPダメージ量。命中数ではない。
- `BattleScene.jsx` overlay `streams`（L708付近）:
  - SPストリーム `count: atkN`（= `N` = min(soldiers,cap) = 全突撃数）。**toMeme ではない。**
  - 本体ストリーム `count: atkChr_`（= `atkChr` = HPダメージ量）。**toChar（本体到達数）ではない。**
- バッジ描画 L866-875: SP は `SP ×{count}`、本体は `本体 −{count}`。

→ SPバッジは N（全数）、本体バッジは HPダメージ。両者が独立加算に見え 402 化。本体表示は到達数でなくダメージ量。

### 正仕様
N = SP命中数 + 将軍命中数（常に成立）。表示は toMeme（SP命中）と toChar（将軍命中）で分割。HPダメージは別系統（DamageBurst / BottomPortrait の「本体 DAMAGE −{hpDmg}」）で既に表示される。

### 修正方針（エンジン契約拡張 → overlay 消費変更）
1. `_calcOneSide` の返り値に split を含める:
```js
return { memeDmg, charDmg, selfMemeDmg, selfCharDmg, N, toMeme, toChar };
// ③将軍本人攻撃の命中も別途返すか検討（BUG-6参照）。selfMeme/selfChar の命中数 = atk.attackCount 由来。
```
2. `_resolveExchange` → `_onExchangeResult` に攻撃/反撃それぞれの toMeme/toChar を追加（§14 契約も更新）。
3. `BattleScene.jsx` onExchangeResult 消費（L1263付近）で toMeme/toChar を state に格納。
4. overlay `streams`: SPストリーム `count = toMeme`、本体ストリーム `count = toChar`。本体バッジのラベルは「命中数」（HPダメージは別表示のまま）。
- 検証: 戦闘域400で N=400 のとき、SPバッジ + 本体バッジの合計 = 400。
- 検証: SP100相手に N=400 のとき、本体命中数（toChar）が `_splitHits` 実値（数十オーダー）で表示され、HPダメージ（−2等）は別枠表示。

---

## BUG-6【要切り分け→UI寄り確定】将軍本人の攻撃（③）が独立表示されない

### 症状
守備側 SP が戦闘域を下回るのに、本体（将軍）からの攻撃が overlay に出ない（実機画像2・6）。UI問題か計算欠落かの切り分けが必要。

### コード根拠（切り分け結果: 計算は実行・表示が欠落）
- `BattleEngineV3.js` `_calcOneSide` ③: `if (atk.soldiers < this.battleCapacity && atk.charHp > 0 && def.action !== 'defend')` で将軍本人攻撃 `selfMemeDmg`/`selfCharDmg` を算出。**計算は行われている。**
- ただし `_resolveExchange` で `atkMem = ar.memeDmg + ar.selfMemeDmg`、`atkChr = ar.charDmg + ar.selfCharDmg` と**兵士分とマージ**。overlay は SP/本体の2ストリームしか持たず、将軍本人の攻撃に専用の表現が無い。
- 画像6（ウナ→つるぎ・遠距離）: 攻撃側ウナ soldiers=884 ≥ cap=400 → ③条件不成立。ウナ将軍は攻撃しない（正しい）。守備側反撃は遠距離ゆえ無し（BUG-1修正対象外、間接=反撃なし）。
- 画像2（つるぎ→ウナ・近接）: つるぎ soldiers<cap → つるぎ将軍の③攻撃が selfMeme/selfChar で発生。BUG-1 修正後はウナ反撃も発生。これらは atkMem/atkChr・defMem/defChr にマージされ独立表示されない。

→ **計算は仕様どおり実行。overlay に将軍本人攻撃の専用ストリーム/演出が無い表示欠落。**

### 修正方針
BUG-4/5 の契約拡張に統合。`_onExchangeResult` に soldier由来（toMeme/toChar）と general由来（selfMeme命中・selfChar命中）を分離して渡し、overlay で「兵士の突撃」と「将軍の攻撃」を別ストリーム描画。最小対応なら本体ストリームのツールチップ/ラベルで「将軍 +N」を併記。
- 確認用に許可する実機ログ: `_calcOneSide` 冒頭で `atk.char.id` / `atk.soldiers` / `this.battleCapacity` / `selfMemeDmg` / `selfCharDmg` を**単発 console.log 1点**のみ。debugger 常駐・複数点禁止。

---

## BUG-3【機構候補確定・実機ログで最終確認】連続交換で先行 overlay がスキップ

### 症状
戦闘前プレビュー click 直後に2番目の overlay（しのび）へ即遷移。1番目（つるぎ）の交換 overlay が表示されない。ウナ SP は既に924（つるぎ攻撃適用済み）（実機画像4→5）。

### コード根拠（機構）
- `BattleScene.jsx` `doAction`（L1163付近）:
```js
await eng.executeAction(unit, isPlayer);
if (animResolveRef.current === null && animStateRef.current) {
  await new Promise(resolve => { animResolveRef.current = resolve; });
}
```
- overlay は単一スロット（`animState` / `animStateRef.current`）。`_onExchangeResult` ごとに `setAnimState(state)` 上書き。
- `onContinue`（L1417）で `animResolveRef.current` を resolve し null へ戻す。
- 待機ガードが `animResolveRef.current === null` 成立時のみ待つ。前交換の resolve 前に次交換が走ると上書きされ先行 overlay が描画前に消える機構が成立しうる。BUG-D（key固着）と同系統の単一スロット問題。

### 最終確認（推論で断定しない）
- `doAction` の `await executeAction` 後・ガード判定前後で **単発 console.log 1点**: `unit.char.id` / `animStateRef.current?._seq` / `animResolveRef.current === null`。
- 連続する2交換（つるぎ→しのび）でガードが2回とも待機に入るか確認。1回目が待機に入らない場合、その分岐条件を根拠としてから修正。

### 修正方針（確認後）
- 交換キュー化: `_onExchangeResult` を配列に積み、overlay onContinue で次を pop。単一スロット上書きを廃止。
- または `doAction` 待機ガードを「animStateRef.current があれば必ず待つ」へ厳格化し、resolve とスロットクリアの順序を保証。

---

## 全処理レビュー（QA提案への回答・スコープ限定）
個別修正に加え、戦闘計算の仕様適合レビューを推奨。ただし無制限レビューは禁止。対象を以下に限定:
1. `BattleEngineV3._calcOneSide` の ①②③ と `_splitHits` が「N = SP命中 + 将軍命中」を破らないか（BUG-4/5/6 と同根）。
2. `_onExchangeResult` 契約（§14）と overlay 消費の対応表を作り、全フィールドの意味（量 vs 命中数）を1対1で確認。
3. enemyUnits 構築（charHp/charAttack/attackCount の実値反映）。
レビューは「観測→ファイル:行→仕様参照→差分」の様式。挙動変更を伴う数値調整は §18-8 確定後。

---

## 着手順
1. BUG-2（mode/sideType/playerWins の isDefense 対応）— 独立・低リスク・影響大。
2. BUG-1（反撃門番除去）— 1行・spec明確。
3. BUG-4/5/6（_onExchangeResult 契約拡張 + overlay split 描画）— まとめて。§14 契約更新を伴う。
4. BUG-3（実機ログ→キュー化）。
5. 付随ハードニング（enemyUnits charHp/charAttack 実値化、色トークン import、残1 retreatRule 結線）。
6. 完了後 `PROMPT_battle_followup_v1/v2.md`・`PROMPT_battle_bugs_v3.md`・本プロンプトを `docs/archive/` へ移動。KNOWLEDGE §14-1 の参照先を更新。

各バグ修正は1コミット1観点で分割。コミットメッセージに対象バグ番号を明記。
