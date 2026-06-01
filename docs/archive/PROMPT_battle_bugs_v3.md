# 戦闘バグ調査 引き継ぎプロンプト v3（テックリード差し戻し版）

> v2 の「BUG-B はブレークポイントで確認」判断を差し戻す。
> 静的調査が未完了。ブレークポイント実装はまだ行わない。
> v2（BUG-A / BUG-B / BUG-C の前提）も併読すること。

---

## 0. 大原則（再掲・厳守）

- 原因に推論を使うこと厳禁。必ずコードを根拠とする。
- ブラウザキャッシュ・ハードリロードが解決策と結論づけた場合、推論を除く調査結果をまとめて回答停止。

---

## BUG-A（先に確定修正してよい）

`BattleScene.jsx` `onRoundEnd`:
```js
eng.applyRetreatRule('loss_50', eng.enemySide);  // ← この1行削除
```
コード確定。撤退時SP減少は仕様外（KNOWLEDGE §9-1に記述なし）。

---

## BUG-C（先に確定修正してよい）

`BattleScene.jsx` `normalizeChar` L54:
```js
// 変更前
atk: c.charAttack ?? c.soldierAtk ?? 10,
// 変更後
atk: c.soldierAtk ?? c.charAttack ?? 10,
```
コード確定。影響範囲は characters.json が enemyChars になる全戦闘。

---

## BUG-B（ブレークポイント保留・静的読解を続行せよ）

### v2 の不足点

v2 が追跡したのは消費側3点のみ:
1. enemyUnits 初期化（`BattleScene.jsx` L1219-1233）
2. overlay 初期値（`enemySolBefore = allyIsAttacker ? defSolBefore : atkSolBefore`）
3. `_resolveExchange` 内 `defSolBefore = def.soldiers`

**データ供給源を未追跡。** テックリード調査で以下が判明（コード根拠）。

### 判明事項（追跡済み・コード根拠あり）

- `enemyChars` の出所は `App.jsx` L234-270。
  ```js
  const enemyChars = attackerIds.length > 0
    ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
    : characters.filter(c => ... ).slice(0, 4);
  ```
  `filter().slice()` は **GameContext characters の生オブジェクト参照**を返す。ディープコピーなし。
- `normalizeChar` の `meme: c.soldiers ?? 500` がこの生参照の `soldiers` を直読する。
- enemyUnits は `charHp:10` をハードコード初期化。
- soldiers=0 の defender に対し `BattleEngineV3._calcOneSide` の
  ② 将軍ダメージ（`def.soldiers < this.battleCapacity`）
  ③ 将軍本人攻撃（同条件）が成立し、HP=10 を初回交換で 0 まで削りうる。
  → overlay の 0/0 表示と、再現条件（2ターン目・つるぎ限定）に整合。

### 続行する静的調査（この順で・コード根拠を出すこと）

1. **battleEnd 書き戻し**: `GameContext.jsx` `battleEnd` が `characters[].soldiers` をどう更新するか。前ターン戦闘後に つるぎ.soldiers が 0 で永続化される経路があるか。`penaltyTurns` との関係も確認。
2. **FormationScene 表示元**: 編成画面が SP=100 と表示する値はどのフィールド／どのコピーを読むか。`soldiers` か `maxSoldiers` か別snapshotか。enemyChars と同一参照を読むなら 100 と 0 の食い違いは別バグ。
3. **enemyChars 供給の同一性**: turn2 の郡山攻撃で `characters.filter` が拾う つるぎ オブジェクトと、編成画面が表示する つるぎ オブジェクトが同一参照か。
4. 1〜3 を読んでも生値 0 が説明不能な場合に限り、`_resolveExchange` 冒頭に **単発の console.log 1点のみ**（`def.char.id` / `def.soldiers` / `def.charHp`）を許可。debugger 文の常駐・複数点設置は不可。

### 報告様式

各調査項目について「ファイル:行」と該当コード片を引用し、推論と事実を分離して報告。原因確定前に修正コミットしないこと。

---

## ハードコーディング棚卸し（QA指摘・別タスク化）

BUG修正とは分離。ただし BUG-B の被害拡大要因（`charHp:10` 固定）は BUG-B 修正時に併せて見直す。

### 棚卸し対象（コード確認済み）

- `BattleScene.jsx`: トークン（PK/AC/TEAL/TX 等）をファイル内再定義。`src/shared/tokens.js` から import していない → コーディングルール「色直書き禁止」違反。import へ置換。
- `BattleScene.jsx` enemyUnits: `charHp:10` / `charMaxHp:10` / `attackCount:8` 固定。実キャラの charHp/charMaxHp を反映しない。
- `BattleEngineV3.js` マジックフォールバック: `charAttack ?? ... ?? 70`、`charSong ?? 20`、`soldierDef ?? 8`、`charDefense ?? 10`、`soldiers ?? 500`。
- `BattleEngineV3.js` 計算定数: `_calcRate` の `*8`、`_atkParams` の倍率 `ranged 0.7 / song 0.8`、`_calcDamage` 分岐閾値（81・10 等）。
- `'loss_50'` 文字列直書き（onRoundEnd・防衛キュー retreatRule）。

### 方針案（要レビュー）

- 色: tokens.js import へ統一（機械的・低リスク）。
- enemyUnits の HP: normalizeChar 経由で実キャラ charHp/charMaxHp を渡す。BUG-B 修正と同時。
- 計算定数: `BattleEngineV3` 冒頭に定数オブジェクト集約（数値は据え置き・名前付けのみ。バランス変更は §18-8 確定後）。挙動不変を保つこと。

棚卸しは BUG-A/B/C 確定後に着手。1コミット1観点で分割。


---

## BUG-B 追記（v3.1 — CODE報告 1回目を受けた差し戻し）

### CODE報告の評価

CODE は機構を正確に特定:
- `BATTLE_END` reducer が `result.soldiers` を `Math.max(0,…)` で書き戻し、0 も永続化。
- `penaltyTurns=2` の間 `nextTurn` 回復がスキップされ soldiers=0 が継続。
- `enemyChars = characters.filter().slice()` は更新済み新参照を拾う。
- `normalizeChar` の `meme: c.soldiers ?? 500` は `??` ゆえ 0 を素通し。

これらは **正当な潜在バグ**。記録してよい。ただし BUG-B の原因とは未確定。

### 未解決の矛盾（最優先・これを先に解け）

CODE 自身が §2 末尾で指摘:
- PartyScene L460 も App.jsx の enemyChars も **同一の `characters[].soldiers`** を読む。
- soldiers=0 が永続したなら編成画面も 0 表示になるはず。
- 再現条件は「編成画面でつるぎ SP=100」。
- → 「敵 soldiers=0 永続」説では 100（編成）と 0（戦闘）の同時発生を説明できない。

**原因未確定。この矛盾を解くまで修正コミット禁止。**

### 解くべき問い（この順・コード根拠を出す）

1. **つるぎは味方か敵か**: 再現「2ターン目に郡山を攻撃」の編成画面はプレイヤー自軍選出画面。つるぎがそこに 100 で出るなら **プレイヤー配備ユニットの可能性**。
   - `characters` 中の つるぎ の `factionId` と `playerFaction.id` を照合。
   - FormationScene が敵プレビューを描画するか確認（描画するならどのフィールドか）。「つるぎ100」が自軍選出枠か敵プレビュー枠か判別。
2. **どの構築経路が 0/0 ユニットを生むか**:
   - 味方なら `BattleEngineV3.buildUnit`（L174, `soldiers: char.soldiers` フォールバックなし）。`normalizeChar` も `?? 500` も通らない → CODE調査は経路ごと誤り。
   - 敵なら `normalizeChar` 経路。
   - overlay の 0/0 が ally パネルか enemy パネルか（`attackerSide`・`allyIsAttacker` のどちら側か）も確認。
3. 1・2 確定後、初めて修正先を決める。

### 修正案の判定（現時点いずれも不採用）

- 案A `meme:(c.soldiers>0?c.soldiers:null)??500`: 敗走ユニットが SP500 で復活。意味的に不正・症状隠蔽。**不可**。
- 案B `App.jsx` enemyChars で `penaltyTurns>0` 除外: §9-1 の選出不変条件（`!(penaltyTurns>0)`）と整合。**ただし「敵経路が原因」確定後のみ採用可**。

両案とも「つるぎ＝敵」前提。前提が未確認のため現時点で承認しない。

### 報告様式

問1・問2 それぞれ「ファイル:行」+ コード片 + 値の根拠で報告。
実機確認が必要なら v3 のルール通り `_resolveExchange` 冒頭の単発 console.log 1点のみ許可（`def.char.id`/`def.soldiers`/`def.charHp`）。加えて編成マウント時の `characters[つるぎ].soldiers` も同様に1点ログ可。確定前にコミットしないこと。


---

## BUG-B 追記（v3.2 — CODE報告 2回目を受けた再差し戻し）

### CODE報告2回目の評価：経路誤りにつき BUG-B 原因として却下

CODE は `App.jsx:237/265`（defenseFlow の `item.attackerCharIds` 分岐）にフィルタ欠落を見つけ、これを BUG-B 原因と断定。**却下する。** コード根拠2点。

1. **経路不一致**: 再現「2ターン目に郡山を攻撃」はプレイヤー攻撃戦 = `App.jsx case 'battle'`（L395-402）。enemyChars は `legionAI.getDefenders(enemyFactionId, targetBase, characters)` 由来。CODE が分析した `App.jsx:237/265` は defenseFlow（プレイヤー防衛）であり、再現が通らない経路。
2. **実経路は既に除外済み**: `LegionAI.js` L238-249 `_getLegionCombatChars` は legion 分岐・フォールバック分岐の両方で `c.soldiers > 0 && c.charHp > 0` を強制。攻撃戦で soldiers=0 の敵は enemyChars に入らない。CODE の機構（soldiers=0→meme=0→0/0）は攻撃経路で発生不能。

→ v3.1 の「編成画面=100」矛盾は未解決のまま。soldiers=0 説は本バグに対し棄却。

### CODE報告で有効な部分（別件として処理）

- defenseFlow `attackerIds.length>0` 分岐のフィルタ欠落（L237/265）は**防衛シナリオの正当な潜在バグ**。else 分岐・§9-1 と非対称。**単独の整合性修正として承認**。
  - 修正: `attackerIds.includes(c.id) && !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0`
  - 注意: 全員除外で `enemyChars=[]` になると `BattleScene` の `buildDefaultEnemies` が幻のデフォルト敵を生成。全員除外時は攻撃をキューしないガードを併せて検討。
  - **この修正で BUG-B は閉じない。** コミットメッセージに「defenseFlow consistency fix, NOT BUG-B」と明記。

### BUG-B 再投入（攻撃経路を正しく追え）

soldiers=0 説は棄却済み。以下を順に、コード根拠で。

1. **再現シナリオの確定**: 「郡山を攻撃」が攻撃戦（case 'battle'）か防衛戦（defenseFlow）か。どの画面のどのボタンか実機で特定。
2. **つるぎの所属**: `characters` 中の つるぎ `factionId` と `playerFaction.id` を照合。つるぎが編成画面に 100 で出るのは「プレイヤー自軍ユニット」か「敵プレビュー枠」か判別。
3. **0/0 ユニットの生成経路**:
   - 味方なら `BattleEngineV3.buildUnit`（L174, `soldiers: char.soldiers` フォールバックなし）。100 がそのまま入るはず → 0/0 は初回交換削りか、overlay の表示マッピング不正（`allyIsAttacker` / `allySolBefore` / 表示対象ユニット取り違え）を疑う。
   - 敵なら `getDefenders → normalizeChar`。ただし getDefenders が soldiers>0 を保証する点と矛盾しないか確認。
4. **「編成画面=100」の出所**: その画面が読むフィールド（soldiers / maxSoldiers / 見積り値）を特定。戦闘と同一ソースなら 100 は soldiers≠0 を意味する。別ソースなら snapshot 乖離が本バグ。
5. 実機確認は v3 ルール通り単発 console.log のみ。`_resolveExchange` 冒頭（`def.char.id`/`def.soldiers`/`def.charHp`）＋ overlay マウント時の対象ユニット id・SP・HP を 1 点ずつ。

確定するまで BUG-B 修正コミット禁止。事実と推論を分離して報告。


---

## BUG-B 真因確定（v3.3 — コード+データ+実機の三点一致）

### CODE の結論（soldiers=0 永続）は棄却

実機観測でつるぎは **soldiers=100 で参戦**。BATTLE_END による 0 永続は本バグと無関係。経路（defenseFlow）・機構（soldiers=0）とも誤り。

### 確定した真因：getDefenders フォールバックの漏れ

**データ事実**:
- 郡山 = `base_021`, `factionId:"faction_red"`（bases.json）
- char_021 = 中部つるぎ, `factionId:"faction_red"`, soldiers=100, charHp=9（characters.json）
- faction_red の軍団 defendBases:
  - legion_red_01 → [base_003, base_014, base_071]
  - legion_faction_red_02（つるぎ所属・新規軍団） → [base_047, base_046]
  - → **base_021（郡山）を守る軍団が存在しない**

**コード事実**（`LegionAI.js` L130-146 `getDefenders`）:
```js
const legion = this.legions.find(l =>
  l.factionId === defenderFactionId && l.defendBases?.includes(defenderBase.id));
if (legion) { const chars = this._getLegionCombatChars(legion); if (chars.length>0) return chars; }
// フォールバック
return allCharacters.filter(c => c.factionId === defenderFactionId && c.soldiers > 0);
```
郡山を守る軍団なし → `legion=undefined` → フォールバックが **全 faction_red の soldiers>0 キャラを地理・軍団無視で返す** → つるぎ（三陸/いわき担当）が郡山防衛に漏出。`App.jsx case 'battle'` がこれを `.slice(0,4)` して enemyChars に渡す。

**実機事実**（ターン2・郡山プレビュー）:
- 敵軍 = 大江戸ちゃんこ710 / 中部つるぎ100 / 関西しのび100 / 沖縄あわも500
- = 全 faction_red 先頭4体。郡山所属で絞られていない。
- 沖縄あわもはターン1ふくしま防衛にも出現 → 同一ユニットが複数拠点を同時防衛（フォールバックの副症状）。

### 「0/0 戦闘開始直後」の正体

症状であり別バグではない。つるぎ soldiers=100・charHp=9（`enemyUnits` が **charHp:10 固定**で実値9を上書き）の脆弱ユニットが、自軍前衛（きりたん1200SP）の初回交換で SP100・HP10 とも即0化 → overlay が 0/0 表示。戦闘計算自体は正しい。**真因はつるぎが郡山に湧くこと自体**。

### 修正方針（2系統・要design判断）

旧kiritanが正仕様。「防衛軍団未割当の拠点を誰が守るか」の仕様を旧版で確認した上で決める。

1. **コード修正（systemic・推奨）**: `getDefenders` フォールバックを是正。全勢力員ではなく、(a) その拠点の駐留mob/守備のみ、(b) 他軍団に未所属のキャラのみ、(c) 該当拠点 or 隣接拠点に紐づくキャラのみ、等に限定。現フォールバック（全faction_red）は明確に誤り（ユニットが瞬間移動して全拠点を守る）。
2. **データ修正（対症）**: 郡山(base_021)・水戸(base_045) に防衛軍団を割当（legions.json）。ただし他の防衛未割当拠点で同症状が残るため systemic 修正の代替にならない。

### 併せて直す（BUG-B付随）

- `BattleScene.jsx` enemyUnits の `charHp:10`/`charMaxHp:10` 固定 → normalizeChar 経由で実 charHp/charMaxHp を反映（つるぎ実値9）。ハードニング §（v3）と統合。

### CODE の defenseFlow 修正（v3.2承認分）の扱い

別件の正当な潜在バグとして維持してよい。ただし **BUG-B の修正ではない**。コミットを分離し、本 v3.3 の getDefenders 修正を BUG-B 本体とする。


---

## BUG-D 確定（v3.4 — 実機観測。overlay state staleness。getDefenders とは独立）

### 症状

戦闘アニメーション overlay（`BattleAnimOverlay`）が、生存中の敵を SP=0/HP=0 と誤表示する。

実機観測（郡山攻撃・ラウンド1）:
- overlay 表示: 大江戸ちゃんこ 部下数0/710・HP0/10
- 同時刻のエンジン実状態（ENEMY UNITSパネル＋ACTION LOG）: 大江戸ちゃんこ 690/710・HP10/10（生存）
- overlay の ally 側も 四国めたん の枠に HP15（=東北きりたんの値）が残留表示

### 根本原因（コード根拠）

`BattleScene.jsx` `BattleAnimOverlay` L678-681 — SP/HP を `useState(初期値)` で保持:
```js
const [allySP, setAllySP]   = useState(allySolBefore);
const [allyHP, setAllyHP]   = useState(allyHpBefore);
const [enemySP, setEnemySP] = useState(enemySolBefore);
const [enemyHP, setEnemyHP] = useState(enemyHpBefore);
```
`useState(初期値)` の初期化はマウント時1回のみ。`streams` / `attackLine` も `useMemo(..., [])`（空依存）で同様。

描画側 L1414-1419 — `key` なし:
```jsx
{animState && (<BattleAnimOverlay anim={animState} ... onContinue={...}/>)}
```
連続する交換で `animState` が null を挟まず差し替わると、React は同一インスタンスを再利用。名前・ラベルは `anim` から毎描画読むため更新されるが、SP/HP state は前交換の値で固着。→ **現交換の名前 ＋ 前交換の SP/HP** が合成表示される。

### 実証（交換順・観測値が一致）

1. Exchange A: 中部つるぎ→東北きりたん。つるぎ死亡（0/10）、きりたんHP15。
2. Exchange B: 大江戸ちゃんこ→四国めたん。overlay は名前を ちゃんこ/めたん に更新するが、SP/HP は A の残留（ちゃんこ枠=つるぎの0/0、めたん枠=きりたんのHP15）。
3. Exchange C: 四国めたん→関西しのび。**正常フレーム**（fresh相当）。counts相でダメージ前の実値（めたん981、しのび100/10）＋攻撃数バッジを正しく表示。→ 対照群。

### 2症状は単一根

- 「名前は現交換・値は前交換」
- 「クリック前（counts相）から0/0」（counts相は本来ダメージ前値を出すべき。Exchange C が証明。stale seed が0なので counts相でも0表示）

両方とも `useState` seed のマウント時固着＋`key`無しで説明可。別バグではない。

### 修正方針

最小: overlay に交換ごと変わる `key`（例: 交換連番 or `atk.char.id + def.char.id + 連番`）を付与し強制再マウント。
代替: `anim` 変化時に `useEffect` で SP/HP/streams/attackLine をリセット、または SP/HP を state 化せず `anim` から直接算出。

### v2「つるぎ0/0」報告の再解釈

2バグの重なり: ①つるぎが郡山に湧く（BUG-B / getDefenders）②生存敵が0/0表示（BUG-D / overlay staleness）。CODE はどちらにも到達していない。

---

## 要追加調査（保留・未確定）

実機で別系統の異常を2点観測。コード未読のため結論保留。BUG-B/D とは別。

- **敵生存カウント誤り**: ヘッダ「ENEMY UNITS 0 / 3」。敵が複数生存（charHp>0）でも 0 表示。
- **side panel の敵HP乖離**: ACTION LOG が「関西しのび 0/10 戦闘不能」の時、ENEMY UNITS パネルは しのび HP 10/10 表示。`syncDisplay`（overlay とは別系統）の更新タイミング or charHp:10 固定が絡む可能性。

両点は `syncDisplay` / 敵表示生成（`BattleScene.jsx`）を精読して切り分けること。推論で原因断定しない。


---

## 実装方針確定（v3.5 — CODE引き継ぎ・テックリード承認済み）

ディレクター決定: **防衛軍団未設定拠点は、その勢力の「防衛専用モブ軍団（reserve）」が守る。getDefenders の全勢力員フォールバックは廃止。全勢力に防衛専用モブ軍団を設定する。**

### A. BUG-B 本修正（getDefenders + legions.json）

**A-1. legions.json: 勢力ごとに防衛専用モブ軍団を1つ追加**

対象: プレイヤー（東北家）を除く全勢力（faction_red, faction_green, faction_yellow, faction_new01, faction_new02, faction_new04 ほか factions.json 全件）。プレイヤー拠点は AI 攻撃時に defenseFlow（プレイヤー編成）が処理するため getDefenders を経由せず、reserve 不要（必要性は CODE が factions.json で確認）。

各 reserve 軍団のスキーマ:
```json
{
  "id": "legion_<factionId>_reserve",
  "name": "<勢力名>防衛隊",
  "factionId": "<factionId>",
  "charIds": [],
  "mobSlots": [ { "slotId":"slot_1","templateId":"mob_001","charId":null,"respawnIn":null }, ... ],
  "maxMobSlots": <2〜4>,
  "attackPriority": [],
  "defendBases": [],
  "attackFrequency": null,
  "isDefenseReserve": true,
  "retreatRule": { "onAttack":"never", "onDefend":"char_dead", "onDefendBase": {} }
}
```
- `templateId` は既存の有効なmobテンプレ（mob_001 等。BuildingSystem.getMobTemplates で実在確認）を使う。
- mobSlot 数・テンプレ強度は防衛強度の設計値。battleCapacity（拠点ごと400〜800）を踏まえ CODE が初期値設定 → ゲームバランスは後調整（§18-8）。
- `defendBases:[]` でよい（reserve は拠点列挙不要。下記 getDefenders が拾う）。

**A-2. getDefenders 改修（LegionAI.js L130-146）**

全勢力員フォールバックを廃止し、reserve 軍団参照に置換:
```js
getDefenders(defenderFactionId, defenderBase, allCharacters) {
  // 1. 拠点指定の防衛軍団
  const legion = this.legions.find(l =>
    l.factionId === defenderFactionId && !l.isDefenseReserve &&
    l.defendBases?.includes(defenderBase.id));
  if (legion) {
    const chars = this._getLegionCombatChars(legion);
    if (chars.length > 0) return chars;
  }
  // 2. 勢力の防衛専用モブ軍団（旧・全勢力員フォールバックを置換）
  const reserve = this.legions.find(l =>
    l.factionId === defenderFactionId && l.isDefenseReserve);
  if (reserve) {
    const chars = this._getLegionCombatChars(reserve);
    if (chars.length > 0) return chars;
  }
  // 3. 最終手段: 空配列（全勢力員を引かない）。BattleScene が buildDefaultEnemies で汎用敵を出す。
  return [];
}
```
- これにより 中部つるぎ 等の実フィールドキャラが、所属外拠点（郡山等）の防衛に漏出しなくなる。
- `_getLegionCombatChars` は soldiers>0 && charHp>0 で絞る既存実装のまま流用。
- mob 生成・補充は `_initMobSlots`（構築時）と `runDomestic`（毎ターン）が mobSlots 持つ全軍団に対し既に動作。reserve 追加で自動的にmobが供給される。
- `createMobInstance` は treasury コストなし・factionId/soldiers/charHp 付与済み。

**A-3. 検証**

- ターン2で郡山攻撃 → 敵プレビューが faction_red 防衛隊の mob のみ（つるぎ/あわも/ちゃんこ/しのび が出ない）。
- 沖縄あわもが複数拠点を同時防衛する副症状が消える。
- 防衛軍団設定済み拠点（ふくしま=legion_red_01 等）は従来通り実キャラ防衛。

### B. BUG-D 修正（BattleScene.jsx）

overlay の state staleness。最小修正: 描画側に交換ごと変わる `key` を付与し強制再マウント。
```jsx
{animState && (
  <BattleAnimOverlay
    key={`${animState.attacker?.char?.id}_${animState.defender?.char?.id}_${animState._seq ?? ''}`}
    anim={animState} ... />
)}
```
- `animState` に単調増加の連番（`_seq`）を持たせると確実（同一attacker/defenderの連続交換でも再マウント）。onExchangeResult で `state._seq = ++counter` を付与。
- 代替: overlay 内の SP/HP を `useState` seed でなく `anim` から毎描画算出、または `anim` 変化で useEffect リセット。`streams`/`attackLine` の `useMemo(...,[])` も同様に要修正。

### C. 別件（既出・分離コミット）

- defenseFlow `attackerIds` 分岐フィルタ欠落（App.jsx L237/265, v3.2承認分）: 整合性修正として別コミット。BUG-B本体はAで対応するため、こちらは防衛フローの予防。
- enemyUnits `charHp:10`/`charMaxHp:10` 固定 → 実 charHp 反映（ハードニング）。
- 色トークン直書き → tokens.js import。

### D. 要調査（保留・別タスク）

- 敵生存カウント「ENEMY UNITS 0/3」誤表示。
- side panel 敵HP乖離（しのび実0/10だがパネル10/10）。
- 両者 `syncDisplay`/敵表示生成を精読。推論で断定しない。

### 着手順

A（BUG-B本体）→ B（BUG-D）→ C（分離）→ D（調査）。A・B は独立に検証可能。完了後このプロンプトを docs/archive/ へ移動。
