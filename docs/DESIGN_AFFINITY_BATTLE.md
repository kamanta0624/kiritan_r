# DESIGN_AFFINITY_BATTLE — 好感度／カップリング＋戦闘システム改修

> 状態: **仕様確定（2026-08-14）・実装未着手**
> 位置づけ: KNOWLEDGE.md §9〜11 の現行戦闘仕様を**部分的に置き換える**。矛盾する場合は本書が正。
> 一次資料: `docs/SCENARIO_DRAMA_NOTES.md`（シナリオ軸SSOT）
> 関連: `docs/DESIGN_CROWDFUNDING.md`（好感度の獲得経路のひとつ）/ `docs/DESIGN_BATTLE_RULES.md`（分類分析の検討記録。§6 の暫定結論のうち軸1・軸2は本書が具体化・一部上書き）

---

## 0. 前提 — 現行の作戦システムは事実上死んでいる（コード確認済み）

`BattleEngineV3.js:536` `_initStrategy()`:

```
maxRate(side) = そのサイドの最高 strategyRate
diff = |pRate - eRate|
発動: diff > 0 かつ Math.random() < diff/100
bonus: diff > 50 かつ Math.random() < (diff-50)/100 → 0.5、それ以外 0.1
winnerChar = 勝者サイドの最高 strategyRate キャラ（1人）
効果: ミーム与ダメ ×(1+bonus) / 被ダメ ×(1-bonus)。戦闘開始時に1回だけ確定
```

`characters.json` の `strategyRate` 分布は **20 が81人 / 0 が17人 / 個別値（15〜60）が11人**。両軍とも最高値20で並ぶため `diff = 0` となり、大半の戦闘で「両軍互角」。`quotes.strategy` は **0件**でカットイン台詞は常にフォールバック。

**この作戦システムをカップリングボーナスで全面置換する。**

---

## 1. 好感度（affinity）

### 1-1. 実装状況

**完全に未実装。** `affection` / `好感度` / `couple` / `coupling` / `カップリング` / `絆` は `src/` `tools/` `docs/wiki/` すべてで 0 件。
既存の `char.battleBonus`（`src/game/utils/BattleBonus.js`）は**キャラ単体の戦闘タイプ別固定補正**であり、組み合わせ要素は無い（`BattleEngineV3.js:179` で `resolveBonus(char, sideType)` として buildUnit 時に解決）。

### 1-2. 段階（レベル）制

好感度は数値だが、**ボーナスは段階（Lv）で決まる**。Lv1 の閾値未満のペアはボーナス 0（＝カップリング不成立）。Lv が上がるほどボーナス増。Lv は演出のトリガも兼ねる（§3-3 イベントCG）。

**3段階。Lv3 が最大。好感度の上限 40（Lv3 到達＝カンスト、超過分は切り捨て）。**

| Lv | 閾値 | 劇場抜きの到達目安 |
|----|------|------------------|
| 1 | 8 | 共闘4回（ターン5前後） |
| 2 | 20 | 共闘10回（ターン12前後） |
| **3（最大）** | **40** | **共闘20回 → ターン20〜25（中盤）** |

### 1-3. 加算経路と重み

**全経路を採用。**

| 経路 | 加算 |
|------|------|
| 劇場イベント | **+10** |
| 通常戦闘（同時出撃） | **+2** |
| クラファン挑戦（同行） | **+2** |
| 浅層探索（同行） | **+1** |

序列 `劇場イベント >>> 通常戦闘 ＝ クラファン挑戦 > 浅層探索`。劇場1回が戦闘5回分。
通常戦闘の +2 は**その戦闘で成立した6ペア全部**に加算する。

上限40に対し劇場は**4回でカンスト**。戦闘の積み上げを無意味にしない範囲で、終盤キャラの救済に足りる水準に置いた。

### 1-4. 数値設計の根拠（実装データ、2026-08-14 確認）

| 項目 | 値 | 出典 |
|------|----|------|
| 行動力 | 5/ターン・全回復 | `GameContext.jsx:81` |
| 攻撃出撃 | 1AP | `App.jsx:394-395` |
| 劇場イベント | 1AP | `App.jsx:585`（`ev.cost?.actionPoints ?? 1`） |
| ダンジョン探索 | 1AP | `App.jsx:533` |
| 1キャラ1ターン1戦闘 | `usedThisTurn` | `GameContext.jsx:209` |
| 拠点 | 92（プレイヤー初期11 / 敵81） | `bases.json` |
| 敵首都 | 25 | 勝利条件は全敵首都制圧 or `flag_vocalo_conquered`（`GameContext.jsx:724`） |
| 東北家キャラ | 16（全104体） | `characters.json` |

**想定攻略ターン数: 下限30 / 上限60、中央値40前後。中盤 = ターン15〜30。**
東北家16キャラ・4人編成で最大4部隊。AP5のうち劇場・探索に1〜2割くため実効攻撃は2〜4回/ターン。敵81拠点（首都25＋通り道）。

主力4人を固定運用すると6ペアが毎ターン同時加算。編成を回す実プレイでも特定ペアは20ターンで10〜15回共闘 → +20〜30。**Lv3閾値40は「主力コンビなら中盤、準主力なら終盤」に落ちる。**

### 1-5. 終盤参戦キャラの底上げ

共闘回数を稼げないため劇場側で補う。2段構え。

1. **加入時の初期好感度に下駄** — 既存主力との関係性に応じて 0 ではなく **+20（Lv2）** から開始。シナリオ上の既知関係（「東北家とボイボ寮は元々仲が良い」等）を数値化する
2. **劇場枠を1キャラ5イベント**（DESIGN_V2 §4.3 の構造）で整備 — 下駄20 ＋ **劇場2回（+20）で 40 ＝ Lv3 カンスト**。2AP で済むため終盤の余剰APで回収可能

下駄なしで加入した場合でも劇場4回（4AP）で Lv3 に届く。5イベント枠は余裕を持たせた設計。

### 1-6. 敵側の好感度

**固定値を JSON 定義。育たない。** 敵勢力の主要ペアにあらかじめ好感度を付与し、ボス戦で「敵の絆の強さ」を演出する。**モブ（`_isMobInstance`）は好感度なし。**

### 1-7. データ構造 — **疎（sparse）管理で確定（2026-08-14）**

- `state.affinity: { [pairKey]: number }`。pairKey は**ソート済み charId を `__` で連結**（例 `char_004__char_016`）
- **値が 0 のペアはデータに持たない。** 初期値は `{}`。加算が発生したペアだけがキーとして生える
- 読み出しは `getAffinity(a, b) => state.affinity[pairKey(a,b)] ?? 0`
- キャラ配列に持たせると A→B / B→A の二重管理になるため採らない
- `SAVE_VERSION` 9 → 10 へ繰り上げ。旧セーブに `affinity: {}` を補填（`GameContext.jsx` の `serializeState` / `deserializeToState` 両方）

**疎管理を採る理由**: 104体の全ペアは `104C2 = 5,356` 通りだが、実際に育つのは共闘したペアのみ。東北家16体で上限120ペア、仲間40体でも理論上限780ペアで、実プレイでは主力中心のため数十〜数百に収まる。セーブは1ペアあたり20byte強で、1,000ペアでも30KB程度。localStorage の制限に対して問題ない。戦闘中に引くのは編成4人の6ペアのみ。

---

## 2. 戦闘システム改修 — メインキャスト／サブキャスト

### 2-1. 編成

現行の「1・2体目→front / 3・4体目→rear」を**メインキャスト2名／サブキャスト2名**と読み替える。
`buildUnit(char, sideType, index)` の `position: index < 2 ? 'front' : 'rear'` は**ロジックそのまま流用可**。呼称のみ変更。

### 2-2. 勝利条件（変更点）

| | 現行 | 改修後 |
|---|---|---|
| 決着 | 片側の**全ユニット**が戦闘不能 | 片側の**メインキャスト2名**が戦闘不能 |
| 該当コード | `checkGameOver():132` の `playerSide.some(_isAlive)` | front のみを見る判定へ |

サブキャスト2名が生存していてもメイン全滅で敗北。

### 2-3. 維持する仕様

- 近接攻撃は**前衛（メイン）同士でのみ有効**
- ranged / song → 敵全体、近接 → 敵前衛
- 後衛近接の options は `['defend','retreat']` のみ
- 撤退＝即座に戦闘終了（**仕様。変更禁止**）
- 戦闘不能は `charHp <= 0` のみ。`penaltyTurns = 2`（死亡廃止）
- ミーム／本体の同時確率按分（`_calcOneSide` / `_splitHits` / `_calcRate` / `_calcDamage`）は本書の対象外

---

## 3. カップリングボーナス（作戦システムの置換）

### 3-1. 成立数と階層

出撃4名から2名を選ぶ組み合わせ ＝ **最大6組**。

| 組 | 数 | ボーナス |
|---|---|---|
| メイン × メイン | 1 | **×1.0** |
| メイン × サブ | 4 | ×0.4 |
| サブ × サブ | 1 | ×0.2 |

各ペアのボーナスは **「好感度 Lv による基礎値」×「階層係数」**。Lv1 未満は 0。

### 3-1b. Lv ごとの基礎ボーナス（ミーム与ダメ倍率への加算）

| Lv | 基礎値 |
|----|--------|
| 1 | 0.05 |
| 2 | 0.10 |
| **3（最大）** | **0.18** |

合計試算

| 状態 | 計算 | 合計 |
|------|------|------|
| 全6組 Lv1 | `0.05 + 0.05×0.4×4 + 0.05×0.2` | +0.14（×1.14） |
| 全6組 Lv2 | `0.10 + 0.10×0.4×4 + 0.10×0.2` | +0.28（×1.28） |
| **全6組 Lv3（理論最大）** | `0.18 + 0.288 + 0.036` | **+0.504（×1.504）** |

**合計キャップ +0.60**（安全弁。理論最大は 0.504 のため通常は到達しない）。
※ 当初案は +0.55 だったが、Phase B 実装時に +0.60 を採用。理論最大 0.504 を上回るためどちらでも挙動は同一。**実装値は 0.60**（`BattleEngineV3.js` の `COUPLING_CAP`）。

Lv3 が最大レベルであるため、全6組Lv3 の +0.504 が実質的な天井になる。現行作戦システムの最大 ×1.5（bonus 0.5）とほぼ同水準に揃えた。

### 3-2. 適用方式

**成功／失敗の判定を廃止。双方が各自の成立ボーナスを単純加算して常時保持する。**

- 適用先は**倍率への加算**。`1 + Σ(成立ボーナス)` を ミーム与ダメに乗算
- `_strat(isAtkPlayer)` は関数の形を保ったまま中身を差し替える（改修最小）
- `strategyMult` の構造が `{ give, take, side, bonus, winnerChar }` から**両サイドが各自の合計を持つ形**へ変わる

### 3-3. UI・演出

- **StrategyCutin**: 成立ペアを順に表示。**立ち絵＋ボーナスポイントの描写のみ**
- **イベントCG は実装しない（2026-08-14 判断）。** 全ペア分のCG（`104C2 = 5,356` 通り）は用意できないため、CG分岐は Phase A/B のスコープから外す。将来やるなら「CGデータのあるペアだけ Lv3 で差し替え、無ければ立ち絵にフォールバック」の形になる（§6-3）
- **ペア専用台詞は不要**。`quotes.strategy` の整備も不要（現状0件のまま放置してよい）
- 現行は勝者1人の立ち絵＋`quotes.strategy`。`strategyMult.side` / `winnerChar` を参照する `BattleScene.jsx:1032/1059/1509` は**破壊的変更**となり要改修

---

## 4. 影響を受ける既存コード

| ファイル・箇所 | 変更 |
|---|---|
| `BattleEngineV3.js:536` `_initStrategy()` | 全面置換 |
| `BattleEngineV3.js:562` `_strat()` | 中身差し替え（形は維持） |
| `BattleEngineV3.js:75` `strategyMult` 初期化 | 構造変更 |
| `BattleEngineV3.js:132` `checkGameOver()` | front のみ判定へ |
| `BattleScene.jsx:110` `StrategyBadge` / `:123` `StrategyCutin` | 破壊的。ペア表示・イベントCG対応 |
| `BattleScene.jsx:1389` `strategyMult` 読み出し | 構造変更に追従 |
| `FormationScene.jsx` | front/rear → メイン/サブ表記。勝利条件変更の明示 |
| `GameContext.jsx` serialize/deserialize | `affinity` 追加、SAVE_VERSION 10 |
| `characters.json` | 変更なし。`strategyRate` はデータとして残置（§6-2 で戦闘システムからの参照を廃止） |

### 4-1. 派生して確認が要る点

- 近接のターゲットプール「前衛0なら全体」フォールバックは、**メイン0＝即決着**になるため到達不能になる。撤退経由で残る経路があるか要確認
- メイン全滅で決着した際、**生存しているサブ2名は現行 `_applyPenalty` の仕様上ペナルティなしで帰還する**（`charHp<=0` のユニットにしか `penaltyTurns=2` を付けないため）。本書ではこれを踏襲する前提とする。変更が必要なら別途判断

---

## 5. `docs/DESIGN_BATTLE_RULES.md` との関係

同メモは分類分析の**検討記録**であり決定事項ではない。§6 の暫定結論との対応:

- 軸5（損耗＝ペナルティ制）: 現状維持。本書も踏襲
- 軸4（空間性）: 見送り。本書も追加しない
- 軸1（層結合）: 同メモは E型（イベント分離）を有力としたが、本書の決定は**加算モディファイア型（軸1のA型）のカップリングボーナス導入**。ミーム/本体の同時按分（D型）は維持したまま、ボーナス層をA型で重ねる形。E型への転換は本書の範囲外で未決
- 軸2（乱数可視性）: 作戦の**成否ランダム判定を廃止**して常時加算にしたことで、確定寄りへ一歩進む。ミーム命中の試行乱数自体は現状維持

---

## 6. 未確定（着手前に決めるもの）

### 6-1. 数値設計 — **確定済（2026-08-14）**

Lv閾値（§1-2）/ 加算量（§1-3）/ 階層係数（§3-1）/ 基礎ボーナス・キャップ（§3-1b）/ 終盤キャラの下駄（§1-5）すべて確定。
実装後のプレイ感触で再調整する前提。調整時は §1-4 の想定ターン数（下限30 / 上限60）を基準に据えること。

### 6-2. 実装方式 — 確定分（2026-08-14）

| 項目 | 決定 |
|------|------|
| `strategyRate` | **廃止。** `characters.json` のデータは残置するが、**戦闘システムからは一切参照しない**。KNOWLEDGE §16 の「strategyRate 実値調整」タスクは消滅 |
| ペア専用台詞 | **不要。** `quotes.strategy` の整備もしない |
| Lv 段階数 | **3段階（Lv3 が最大）。** 好感度上限 40 |
| データ保持 | **疎（sparse）管理**（§1-7） |
| イベントCG | **実装しない。** Lv3 でも立ち絵＋ボーナスポイント描写のみ |
| 好感度UI | 仲間画面（PartyScene）から見えるようにする。**ただし後回し** |

### 6-3. 後回し（実装優先度の外）

1. 好感度UIの実装（PartyScene 表示 / FormationScene 編成時プレビュー）
2. **イベントCG**（やるなら「CGデータのあるペアだけ Lv3 で差し替え、無ければ立ち絵にフォールバック」）
3. 敵側固定好感度の定義先（`characters.json` か `factions.json` か新規JSON）
4. 終盤参戦キャラの「初期好感度の下駄」を誰と誰に何点付けるか（シナリオ既知関係の数値化）
5. 劇場イベントの1キャラ5イベント整備（DESIGN_V2 §4.3・P4 と同一作業）

---

## 7. 実装フェーズ分割（2026-08-14）

| Phase | スコープ | 状態 |
|-------|---------|------|
| **A** | 好感度データ層 — `state.affinity` 疎管理 / pairKey / Lv判定 / 通常戦闘での加算 / `affinityGain` effect / SAVE_VERSION 10 | **完了（2026-08-14）**。プロンプトは `docs/archive/PROMPT_affinity_A_data.md` |
| **B** | 戦闘システム改修 — メイン／サブキャスト、勝利条件変更、作戦システムのカップリングボーナス置換、UI（StrategyCutin/Badge・FormationScene） | **完了（2026-08-14）**。プロンプトは `docs/archive/PROMPT_affinity_B_battle.md` |

A 単体で QA 可能な単位で切っている（戦闘後に好感度が加算されるかを確認できる）。B は A に依存。

### Phase A 実装結果（2026-08-14・コード確認済み）

- 新規 `src/game/utils/Affinity.js` — `AFFINITY_MAX=40` / `AFFINITY_THRESHOLDS=[8,20,40]` / `pairKey` / `getAffinity` / `getAffinityLv` / `allPairs` / `gainAffinity`。純関数のみ
- `GameContext.jsx:87` `createInitialState` に `affinity: {}`
- `GameContext.jsx:226-236` `BATTLE_END` — `state.characters` から `_isMobInstance` の ID を集めて `usedCharIds` から除外 → `allPairs` → `gainAffinity(..., 2)`
- `GameContext.jsx:429` `PURE_EFFECT_TYPES` に `'affinityGain'`、`:575` `applyEffectToState` に `case 'affinityGain'`（`eff.pairs ?? []` / `eff.amount ?? 0`）
- `GameContext.jsx:590` `SAVE_VERSION = 10`、`:659` serialize、`:734` deserialize（`data.affinity ?? {}`）
- `useGame()` は `...state` 展開のため `affinity` が自動露出

**未結線（実装順[2]で行う）**: クラファン挑戦 +2 / 浅層探索 +1。
**未実装（後回し §6-3）**: 好感度UI、敵側固定好感度、イベントCG。

### Phase B 実装結果（2026-08-14・コード確認済み）

- `BattleEngineV3.js:23` `COUPLING_LV_BASE = [0, 0.05, 0.10, 0.18]`、`:26` `COUPLING_CAP = 0.60`
- `:551` `_initCoupling()` — 全6ペア × Lv基礎値 × 階層係数（front×front 1.0 / rear×rear 0.2 / それ以外 0.4）、`Math.min(COUPLING_CAP, total)`。**乱数呼び出しなし**
- `:587` `_strat(isAtkPlayer)` — `1 + couplingBonus[side]`。呼び出し元 `:409` は無改修
- `:144-145` `checkGameOver()` → `:613` `_mainAlive(side)` — `position==='front'` のみ判定。**front 不在サイドは side 全体へフォールバック**（QAの rear 単独シナリオ E02/E03 保護用。実戦では到達しない）
- コンストラクタ opts に `affinity` / `enemyAffinity`
- `BattleScene.jsx` — props に `affinity`、バッジは両サイド表示（0なら非表示）、カットインは成立ペアを立ち絵2名＋Lv＋ボーナスで順次表示。`quotes.strategy` 参照削除、0組なら非表示
- `App.jsx` — `affinity` を攻撃戦・防衛戦へ伝搬。`enemyStrategyRate` 系と `buildDungeonEnemy` の `strategyRate` を削除
- `FormationScene.jsx` — ①②メイン／③④サブ、BATTLEFIELD のゾーン名変更、作戦成功率パネル2箇所を勝利条件表示に置換
- QA — `BattleQAScene` / `BattleFullQAScene` の `strategyMult` 読み出しを `couplingBonus` へ追従。E12→「カップリング補正」、E15→「メイン全滅で決着」に張り替え

**検証済み**: `grep -rn "strategyRate" src/` の残りは `characters.json` のみ。`strategyMult` は `src/` から消滅。`npm run build` 成功。

### Phase B の未検証・積み残し

1. **カットインの寸法** — 実機 1280×900 で横幅が溢れたため立ち絵を 150×210 → 112×158 に縮小。**縮小後の実機再描画は未実施**（攻撃可能拠点まで到達できず）。計算上 1280×720 に収まる。**人間QAで要確認**
2. **`tools/` 側に `strategyRate` の入力UIが残存** — `tools/editor-modules/tab-characters.js:271-275`（「作戦成功率 (strategyRate)」スライダー）、`tools/bulk-input.html:137,186`（「作戦率」列）、`tools/editor-modules/tab-promotion.js:9`（「戦略率」選択肢）、`tools/wiki_import.cjs:113,158`。**死んだフィールドの編集UIが残っている**。Phase B のスコープは `src/` のみだったため未対応。エディタから消すか、残すかの判断が要る

---

## 8. Phase C 仕様（2026-08-14 決定・未実装）

> 本書は当初「好感度／カップリング」の設計書だったが、戦闘システム改修の受け皿を兼ねている。以降の戦闘仕様もここに追記する。

### 8-1. サブキャストの昇格を禁止

**現行実装に「前衛が全滅すると後衛が近接攻撃の対象になる」フォールバックがある。**

```js
// BattleScene.jsx:46-52  _calcPool()
const front = alive.filter(u => u.position === 'front');
return front.length ? front : alive;   // ← front 0 なら後衛が狙われる
```

これは実質的に「サブキャストがメインキャストに引き摺り出される」挙動。**メインが1名撃破されてもサブは昇格しない**という仕様に反する。

**撤去する。** front が 0 のサイドは近接攻撃の対象を持たない。ただしメイン全滅＝即決着（`_mainAlive`）のため、front 0 は `_finish` の遅延（`_delayedCall(300, ...)`）中にしか発生しない。プール空時の扱い（攻撃スキップ）を明示的に実装すること。

`BattleEngineV3` 側の `_mainAlive`（`:613`）にも同種のフォールバックがある（front 不在サイドは side 全体で判定）。こちらは QA シナリオ保護用で実戦では到達しないため**維持**。

### 8-2. 敵編成を対称化 — **クラファン挑戦のみ**

**プレイヤーの編成人数 = 敵の編成人数。メイン・サブとも対称にする（2026-08-14 確定）。**

**適用範囲はクラファン挑戦のみ。** 通常戦闘（拠点攻撃・防衛）と浅層探索には適用しない。

- メイン1名で挑めば敵もメイン1名
- メイン2名で挑めば敵もメイン2名
- サブキャストも同数

これが複数キャラ挑戦時の「ゴールが遠のく」実体でもある。人数を増やせば報酬は増えるが、敵も同数に増える。別途の算式は不要。

### 8-3. 戦闘によるミーム上限成長

**戦闘に参加したキャラの `maxSoldiers` を増加させる。** 実装対象。

既存の `maxSoldiers` 変更経路（調査済み・2026-08-14）:

| 経路 | 実装箇所 | 状態 |
|------|---------|------|
| `sp_max_up` 強化コマンド | `App.jsx:517-538`。`maxSoldiers + 200`、`treasury` から 200 支払い + AP 1 | **UI削除済（P1）・ロジック生存** |
| `purchaseUpgrade` の `maxSoldiers` effect | `GameContext.jsx:1112` | 機構あり。`facilities.json` の `upgradeCommands` は**空配列** |
| 研究の `characterEffects` | `GameContext.jsx:318-333` の `ADD_RESEARCH`。`field: 'maxSoldiers'` で全キャラ一括 | 機構あり。`facilities.json` の `research` も**空配列** |
| `PromotionDevScene` | `MAX_UP_DELTA = 50` | `?qa=promotion` 隔離・本体未統合 |
| `ItemSystem` | `ItemSystem.js:107,132` | アイテムUIは P1 で削除済 |

**新規機構は不要。** 戦闘終了時（`BATTLE_END`）に加算するのが素直。好感度の加算（`usedCharIds` からモブ除外）と同じ場所に相乗りできる。

**条件・増加量（2026-08-14 確定）**

| 項目 | 値 |
|------|-----|
| 条件 | **勝敗を問わない**。戦闘に参加すれば加算 |
| 適用範囲 | **攻撃戦・防衛戦のみ。** ダンジョン戦闘（クラファン・浅層探索）は対象外 |
| 増加量 | 基本 **+100**（仮置き）×**キャラごとのミーム増加倍率**。倍率 +10% なら +110 |
| 上限 | なし |
| モブ | 対象外（好感度と同じく `_isMobInstance` を除外） |

想定される伸び — 主力キャラは毎ターン出撃するため、想定攻略ターン数30〜60（§1-4）に対し30〜60戦。+100 なら 30戦で **+3000**。`maxSoldiers` 1000 のキャラは 4000 まで伸びる。`maxSoldiers` 100 のキャラ（ずんこ・イタコ・テト）は **2戦で 300 に到達**し、クラファンの必要ミーム 300 を早期に超えられる。実装後のプレイ感触で再調整する。

### 8-4. 確定した仮置き値

| 項目 | 値 |
|------|-----|
| クラファン挑戦の必要ミーム | **300 → 300 → 600 → 900 → 1500 → 2400**（フィボナッチ・判定は `maxSoldiers`） |
| タイムリミット | クラファン **40ラウンド** / 浅層探索 **20ラウンド**。`DESIGN_CROWDFUNDING.md` §2-7 |
| 休憩 | **HP全回復・ラウンド5消費**。ミーム は上限0のため回復対象外。同 §2-7 |
| 敵データ | **全員仮置きでよい** |
| ゴール | **7種**（今後増える）。達成条件は全種「敵全撃破」。報酬は共通強化＋種別固有。同 §2-3 |
| ミーム上限成長 | 勝敗問わず **+100/戦闘**（仮置き）。**攻撃戦・防衛戦のみ**（ダンジョン戦闘は対象外）。キャラごとの**ミーム増加倍率**がかかる。§8-3 |

### 8-5. 実装方針が確定した細部

- **`_calcPool` で front 0 のとき** — フォールバック撤去後、対象候補は空配列になり `BattleAI.selectTarget` が `null` を返す。**null を受けたら攻撃を行わず次へ進む**（防御的処理を1行）。メイン全滅＝即決着のため `_finish` の 300ms 遅延中にしか発生しない
- **「ターン数」の定義** — `BattleEngineV3` の `round`。各戦闘の `round` を挑戦セッション全体で累積する。`DESIGN_CROWDFUNDING.md` §2-2 に詳細

### 8-6. 未確定

なし。Phase C の設計判断はすべて確定。数値はすべて仮置きであり、実装後のプレイ感触で再調整する。

### 8-7. Phase C の分割（2026-08-14）

| Phase | スコープ | プロンプト | 依存 |
|-------|---------|-----------|------|
| **C-1** | 戦闘システム改修 — `_calcPool` フォールバック撤去 / `memeGrowthMult` 新設 / ミーム上限成長 | **完了（2026-08-14）**。`docs/archive/PROMPT_C1_battle.md` | — |
| **C-2** | ダンジョン基盤改修 — 拠点付属の廃止 / BottomBar へ入口付け替え / 複数キャラ挑戦 / ラウンド累積タイムリミット / 進む・休む | **完了（2026-08-14）**。`docs/archive/PROMPT_C2_dungeon_base.md` | — |
| **C-3** | クラファン挑戦と浅層探索 — 敵プール / 必要ミーム・上限没収 / ゴール7種と報酬 / 浅層探索 / `rewardItem` 停止 / 好感度加算 | **完了（2026-08-14）**。`docs/archive/PROMPT_C3_crowdfunding.md` | — |
| **C-4** | 進捗ポイント制とUI改善（C-3 の QA 指摘対応）— 進捗%表示 / 報酬の具体値一覧 / 敵の tier 抽選 | **完了（2026-08-14）**。`docs/archive/PROMPT_C4_progress_ui.md` | — |

C-1 と C-2 は独立。並行可能。


### 8-8. Phase C-1 実装結果（2026-08-14・コード確認済み）

- `BattleScene.jsx:47-52` `_calcPool` — `return alive.filter(u => u.position === 'front')`。フォールバック撤去済み
- `BattleScene.jsx:1289-1290` — `selectTarget` が `null` を返したら `unit.action = 'defend'` に変換。**仕様の「攻撃せず次へ進む」を防御アクションで代替している**。メイン0＝即決着直前の 300ms 内にしか発生しないため実害は無いが、厳密には仕様と異なる
- `GameContext.jsx:211` `growthIds = new Set(isDungeon ? [] : affinityIds)` — ダンジョン戦闘を除外
- `GameContext.jsx:217` `growth = growthIds.has(c.id) ? 100 * (1 + (c.memeGrowthMult ?? 0)) : 0`
- `GameContext.jsx:223` `maxSoldiers: (c.maxSoldiers ?? 1000) + growth` — **Chat 側で `?? 1000` ガードを追加**（下記）
- `GameContext.jsx:622` / `:693` serialize / deserialize、`:595` `SAVE_VERSION = 11`
- `App.jsx:444` ダンジョン戦闘の `battleEnd` に `isDungeon: true`

**Chat 側で加えた修正**: `:223` は当初 `c.maxSoldiers + growth` だった。`growth` が 0 でも `c.maxSoldiers` が undefined なら `NaN` になり、**参加していないキャラ・ダンジョン戦闘でも全キャラの `maxSoldiers` が壊れる**。既存コード（`:122` `:136` `:1119`）が `?? 1000` でガードしている水準に揃えた。`npm run build` 成功を確認済。

**未検証**: 成功基準 #4〜#8（実機での加算・倍率・ダンジョン除外・セーブ往復）はコード追跡での確認のみ。**人間QAで要確認**。


### 8-9. Phase C-2 実装結果（2026-08-14・コード確認済み）

- 撤去完了 — `bases.json` の `dungeonId` 0件 / `dungeons.json` の `baseId` 0件 / `hasDungeon` 消滅 / `BaseMenuScene` の「迷宮」消滅 / `MapScene` の `dungeonId` パススルー削除
- `SharedUI.jsx:87` — BottomBar に「ダンジョン」→ `dungeon_select`
- `App.jsx:28-31` — `DUNGEON_ROUND_LIMIT = { crowdfunding: 40, shallow: 20 }` / `DUNGEON_REST_COST = 5`
- `App.jsx:623` `case 'dungeon_select'` — クラファン／浅層探索の選択、`dungeonSession` 初期化
- `App.jsx:40` `dungeonSession = { dungeonKind, charIds, floor, remainingRounds }`（**ローカル state**。セーブ対象外）
- `DungeonScene.jsx:112` — `selectedCharIds.length >= 4` で選択上限、`resumeCharIds`（配列）
- `BattleScene.jsx:1357` — `battleResultRef` に `round: e?.round ?? 0` を追加
- `App.jsx:435` — `remainingRounds - (result?.round ?? 0)`。勝敗を問わず減算
- `App.jsx:689-694` `onRest` — `charHp = charMaxHp` 全回復＋5ラウンド消費。`DungeonScene.jsx:262` で残5未満なら disabled
- `DungeonScene.jsx:76` — `remainingRounds < 0` で強制帰還
- `GameContext.jsx:402-416` `DUNGEON_DEFEAT` — `charId` → `charIds`（Set化）。既存の `charHp=1`/`soldiers=0`/`penaltyTurns=2`/`usedThisTurn=true` は不変
- `SAVE_VERSION` は 11 のまま。除去フィールドは元から serialize 対象外のため互換性に影響なし

**想定内の残存**: `App.jsx:678` の `_dungeonEnemy: floorData.enemy` は単騎の敵をそのまま渡している。**C-3 の敵プール化で複数体対応に置き換わる**。

**未検証**: 成功基準 6・7（ラウンド 40→33→28 の減算）と 9（休むでHP全回復）は実機確認が必要。**人間QAで要確認**。


### 8-10. Phase C-3 / C-4 実装結果（2026-08-14・コード確認済み）

#### C-3

- `dungeons.json` を `crowdfundingPool`(5) / `shallowPool`(3) / `goals`(7) へ作り替え。`goals` は `rewardType` で解決（`song` / `stat` / `memeGrowthMult`）
- `src/game/data/crowdfundingConfig.js` 新設 — 仮置き数値を1箇所に集約
- `requiredMeme(challengeCount)` — フィボナッチ。検算済（0→300 / 1→300 / 2→600 / 3→900 / 4→1500 / 5→2400）
- 参加条件 `DungeonScene.jsx:53` `(c.maxSoldiers ?? 0) >= requiredMeme(c.cfChallengeCount ?? 0)`
- 没収 `App.jsx` `updateChar({ id, maxSoldiers: 0, soldiers: 0 })` / 返還 `endCrowdfundingSession` で `maxSoldiers: req, soldiers: req, cfChallengeCount +1`
- 敵の人数対称化はクラファンのみ（`mainCount + subCount = charIds.length`）
- `SAVE_VERSION = 12`、`cfChallengeCount` を serialize / deserialize
- 報酬適用時に `charHp` と同時に `charMaxHp` も加算（`App.jsx:284`）
- **好感度の二重加算を回避** — `GameContext.jsx:236-238` で `isDungeon` なら BATTLE_END では加算せず、`App.jsx:323`（浅層+1）/ `:344`（クラファン+2）で明示加算

#### C-4（QA指摘対応）

QA で「1戦でゴールになる」「報酬が表示されずわかりづらい」の2点が判明。原因は `App.jsx:575` の `isGoalWave = waveIndex === 1`（1波目撃破でゴール）。旧仕様「敵全撃破」の記述が曖昧だったため**進捗ポイント制へ改訂**した。

- `PROGRESS_COEFFICIENT = 0.3` / `requiredProgress(requiredMemeSum)` = **Σ(参加キャラの必要ミーム) × 係数**
- `dungeons.json` 全敵に `tier` / `progressPoint` を付与
- `pickEnemyTier(strengthScore)` / `drawTieredEnemyDefs` — `computeStrengthScore` で算出したプレイヤー強さに応じ上位 tier の出現率が上がる
- 撃破ごとに `progressPoint` 加算。**撃破していれば敗北でも進捗に乗る**
- マイルストーン判定 `Math.floor(newProgress / progressRequired)` の差分で、初回はゴール報酬、以降はストレッチ報酬。**進捗はリセットせず累積**
- `DungeonScene.jsx:239` に進捗 % を常時表示、`:278` `RewardList` で報酬の具体値一覧、`milestoneHit` で到達演出
- 長いキャラ一覧でボタンが top bar に埋もれる不具合も修正（スクロール可）

**実機確認済**（Playwright + headless Chrome）: 1戦目16% / 撃破ごとに増加 / 97%→114%で達成＋報酬一覧 / 200%・300%でストレッチ / 406%まで累積 / tier 1〜3 混在 / コンソールエラーなし。
