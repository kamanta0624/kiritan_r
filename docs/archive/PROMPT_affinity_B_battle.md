# PROMPT_affinity_B_battle — 戦闘システム改修（Phase B）

対象: ClaudeCode
前提: Phase A 完了済（`src/game/utils/Affinity.js` / `state.affinity` 疎管理が既にある）
参照必須: `docs/DESIGN_AFFINITY_BATTLE.md`（仕様SSOT）§2・§3・§4 / `KNOWLEDGE.md` §9〜11（現行戦闘仕様）

---

## 0. 成功基準（これが満たされたら完了）

達成するまでループして直すこと。

1. `npm run build` が成功する
2. **メインキャスト2名が全滅した時点で決着する。** サブキャスト2名が生存していても敗北になる
3. 好感度がすべて 0 のときの与ダメージが、現行の「作戦: 両軍互角」時と同じになる（ボーナス 0）
4. 主力ペアを Lv3 まで育てた状態で戦闘すると、SP与ダメージが最大 **+50%程度**まで伸びる
5. **作戦の成否ランダム判定が消えている。** 同じ編成・同じ好感度なら毎回同じボーナス値になる
6. 敵側にもボーナス欄が存在する（現状は常に 0。敵側固定好感度は後回しのため）
7. `characters.json` の `strategyRate` を書き換えても戦闘結果が変わらない（参照が切れている）
8. カットイン・バッジがエラーなく表示され、成立ペアとボーナス値が読める
9. FormationScene が「メインキャスト」「サブキャスト」表記になっている

QA は `?qa=battlefull` または実機の攻撃戦で行う。

---

## 1. 仕様

### 1-1. 編成の読み替え（ロジック変更なし）

`buildUnit(char, sideType, index)` の `position: index < 2 ? 'front' : 'rear'`（`BattleEngineV3.js:180`）は**そのまま**。
`front` = **メインキャスト**、`rear` = **サブキャスト**と呼称を変えるだけ。UI ラベルのみ変更する。

### 1-2. 勝利条件（変更点）

現行 `checkGameOver()`（`BattleEngineV3.js:132`）:

```js
const pAlive = this.playerSide.some(u => this._isAlive(u));
const eAlive = this.enemySide.some(u => this._isAlive(u));
```

これを **`position === 'front'` のユニットのみ**で判定するよう変える。サブキャストの生死は決着に影響しない。

`_isAlive` の定義そのものは変えない。

### 1-3. カップリングボーナス（作戦システムの置換）

**`_initStrategy()`（`BattleEngineV3.js:536`）を全面置換する。** 成否のランダム判定は廃止。

計算:

1. 各サイドの出撃ユニットから**全6ペア**を作る（`allPairs` を利用）
2. 各ペアの好感度 Lv を `getAffinityLv` で取る
3. Lv → 基礎値: `[0, 0.05, 0.10, 0.18]`（Lv0 は 0 ＝ 不成立）
4. 階層係数を掛ける
   - 両方 `front`（メイン×メイン）: **×1.0**
   - `front` と `rear`（メイン×サブ）: **×0.4**
   - 両方 `rear`（サブ×サブ）: **×0.2**
5. サイドごとに合計し、**上限 0.60 でクランプ**

`strategyMult` の構造を変える:

```js
// 変更前: { give, take, side, bonus, winnerChar }
// 変更後の例（フィールド名は任意、下記が満たせればよい）
this.couplingBonus = {
  player: 0.28,
  enemy:  0,
  playerPairs: [ { a: 'char_004', b: 'char_016', lv: 3, bonus: 0.18 }, ... ],
  enemyPairs:  [],
};
```

`playerPairs` / `enemyPairs` は**成立ペア（Lv1以上）のみ**を入れる。UI がこれを読んで表示する。

### 1-4. 適用方式

`_strat(isAtkPlayer)`（`BattleEngineV3.js:562`）は**関数の形を保ったまま中身を差し替える**。呼び出し元（`:409` の `const stratMult = this._strat(isAtkPlayer)`）は変更しない。

```js
_strat(isAtkPlayer) {
  return 1 + (isAtkPlayer ? this.couplingBonus.player : this.couplingBonus.enemy);
}
```

現行の「勝者は与ダメ +bonus / 被ダメ -bonus」という非対称処理は**廃止**。各サイドが自分の与ダメージに自分のボーナスを乗せるだけ。

### 1-5. 好感度の受け渡し

`BattleEngineV3` は GameContext に依存していない。**コンストラクタ opts で受け取る。**

```js
new BattleEngineV3({
  ...,
  affinity:      {},   // プレイヤー側の state.affinity。省略時 {}
  enemyAffinity: {},   // 敵側。Phase B では常に {}（敵側固定好感度は後回し）
})
```

`BattleScene`（`BattleFlow`、`:1147`）は `useGame()` を使っていないため、**props で受け取る**。`App.jsx` の `case 'battle'`（`:409`）で `affinity={affinity}` を渡すこと（`useGame()` から取れる）。防衛戦の呼び出し（`App.jsx:307` 付近のフロー）にも同様に渡す。

---

## 2. UI 改修

### 2-1. `BattleScene.jsx`

`strategyMult.side` / `bonus` / `winnerChar` を読んでいる箇所（`:1389-1397`）が**壊れる**ため要改修。

| 箇所 | 変更 |
|------|------|
| `:110` `StrategyBadge({ side, bonus })` | ボーナス合計値を表示。`+{Math.round(bonus*100)}%` の形は維持してよい |
| `:123` `StrategyCutin({ winner, ... })` | **成立ペアを順に表示**する形へ。2名の立ち絵とペアのボーナス値を出す |
| `:1179-1180` `strategyWinner` / `strategyBonus` state | 新構造に合わせて置き換え |
| `:1389-1397` engine からの読み出し | `couplingBonus` を読む形へ |
| `:1032` / `:1059` `<StrategyBadge>` 描画 | プレイヤー側・敵側それぞれのボーナスを表示（敵側は常に0のため 0 のときは非表示でよい） |

**ペア専用台詞は不要。** `winner.char.quotes?.strategy` の参照は削除し、固定文言かボーナス表示のみにする。`quotes.strategy` は `characters.json` に0件のため元から機能していない。

**イベントCG は実装しない。** Lv3 でも立ち絵＋ボーナス表示のみ。

成立ペアが0組のときはカットインを出さない。

### 2-2. `FormationScene.jsx`

| 箇所 | 変更 |
|------|------|
| `:311-320` `<Zone label="後衛" / "前衛" / "敵前衛" / "敵後衛">` | メインキャスト / サブキャスト表記へ |
| `:732-735` `<SlotRow slotLabel="① 前衛" ...>` | 「① メイン」「② メイン」「③ サブ」「④ サブ」等へ |
| `:216-217` `playerFront` / `playerRear` の変数名 | 変更不要（内部名） |

**勝利条件が変わったことを画面上で分かるようにすること**（メインキャスト2名が倒れると敗北である旨）。文言は簡潔に。

`formation` の構造 `{ front1, front2, rear1, rear2 }` は**変更しない**（App.jsx・BattleScene が依存）。

---

## 3. `strategyRate` の扱い

**戦闘システムからの参照を切る。** `_initStrategy` 置換に伴い `char.strategyRate` を読む箇所がなくなるはず。

- `characters.json` の `strategyRate` フィールドは**削除しない**（データとして残置）
- `App.jsx` の `enemyStrategyRate`（`:386` 付近）や `BattleScene` の受け取りが不要になるなら削除してよい
- 削除後に `grep -rn "strategyRate" src/` して、残るのが `characters.json` 側だけになることを確認する

---

## 4. やらないこと（Phase B の範囲外）

- **好感度UI**（PartyScene 一覧 / FormationScene の編成時プレビュー）→ 後回し
- **敵側の固定好感度データ** → 後回し。`enemyAffinity` は空のまま
- **イベントCG** → 実装しない
- **クラファン・浅層探索の加算経路** → 実装順[2]
- SP/本体の同時按分（`_calcOneSide` / `_splitHits` / `_calcRate` / `_calcDamage`）→ 対象外。触らない
- 撤退仕様（`_doRetreat` → `_finish`）→ **変更禁止**（KNOWLEDGE §9-2）

**指示範囲外のコード・コメントを変更しないこと。**

---

## 5. 注意

- 近接のターゲットプール「前衛0なら全体」フォールバックは、メイン0＝即決着になるため到達しにくくなる。**フォールバック自体は削除しないこと**（撤退経由で到達する可能性がある）
- メイン全滅で決着した際、生存しているサブは現行 `_applyPenalty` の仕様上ペナルティなしで帰還する。**これは踏襲する**（変更しない）
- 投機的実装・不要な抽象化をしないこと。成功基準を満たす最小限のコードのみ書く
- 不明点があれば勝手に判断せず確認すること
