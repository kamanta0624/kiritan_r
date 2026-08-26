# PROMPT_phaseC1_battle — 戦闘システム改修（Phase C-1）

対象: ClaudeCode
前提: Phase A / B 完了済（`state.affinity` 疎管理、`couplingBonus`、`_mainAlive` によるメイン全滅判定が実装済）
参照必須: `docs/DESIGN_AFFINITY_BATTLE.md` §8（仕様SSOT）/ `KNOWLEDGE.md` §9〜11

C-2（ダンジョン基盤）とは独立。並行して進めてよい。

---

## 0. 成功基準

達成するまでループして直すこと。

1. `npm run build` が成功する
2. **前衛（メインキャスト）が全滅しても後衛（サブキャスト）が近接攻撃の対象にならない**
3. 前衛0の状態で近接攻撃が発生してもエラーにならない（攻撃せず次へ進む）
4. 4人編成で攻撃を仕掛けると、**敵もメイン2名・サブ2名の4人編成**になる
5. 1人編成で攻撃を仕掛けると、**敵もメイン1名のみ**になる
6. 戦闘に参加したキャラの `maxSoldiers` が **+100** される（勝敗を問わない）
7. モブ（`_isMobInstance === true`）の `maxSoldiers` は増えない
8. セーブ→ロードで増加後の `maxSoldiers` が保持される

QA は `?qa=battlefull` または実機の攻撃戦で行う。

---

## 1. サブキャストの昇格を禁止

### 現状

```js
// src/scenes/BattleScene.jsx:46-52
function _calcPool(unit, action, isPlayer, eng) {
  const opponents = isPlayer ? eng.enemySide : eng.playerSide;
  const alive = opponents.filter(u => !eng.isDead(u) && !u.retreated);
  if (action === 'ranged' || action === 'song') return alive;
  const front = alive.filter(u => u.position === 'front');
  return front.length ? front : alive;   // ← ここ
}
```

前衛が0になると側面全体（＝後衛）を返す。これが「サブキャストがメインキャストに引き摺り出される」挙動。

### 変更

**`front.length ? front : alive` のフォールバックを撤去し、`front` をそのまま返す。**

前衛0のとき戻り値は空配列になる。`BattleAI.selectTarget(unit, pool)`（`BattleAI.js:65-70`）は空配列に対し `null` を返すため、**null を受けた側で攻撃を行わず次へ進む**防御的処理を入れること。

メイン全滅＝即決着（`_mainAlive`）のため、前衛0は `_finish` の `_delayedCall(300, ...)` 遅延中にしか発生しない。想定外の状態でクラッシュしないことが目的。

`ranged` / `song` は従来どおり `alive` 全体が対象（変更なし）。

### 触らないもの

`BattleEngineV3.js:613` の `_mainAlive` にある同種のフォールバック（front 不在サイドは side 全体で判定）は **QAシナリオ保護用のため維持**。

---

## 2. 敵編成の対称化

**プレイヤーの編成人数 ＝ 敵の編成人数。メイン・サブとも同数にする。**

| プレイヤー | 敵 |
|-----------|-----|
| メイン1名のみ | メイン1名のみ |
| メイン2名 | メイン2名 |
| メイン2名＋サブ2名 | メイン2名＋サブ2名 |

### 対象箇所

`App.jsx` の `case 'battle'`（`:409`）で敵構成を決めている。

```js
const _def = sceneParams._dungeonEnemy
  ? { chars: [buildDungeonEnemy(sceneParams._dungeonEnemy)], retreatRule: 'never' }
  : (enemyFactionId && legionAI
      ? legionAI.getDefendersWithRule(enemyFactionId, targetBase, characters, 'defense')
      : { chars: [], retreatRule: 'char_dead' });
const enemyChars = _def.chars.slice(0, 4);
```

`slice(0, 4)` を**プレイヤーの編成人数に合わせる**よう変更する。プレイヤー編成は `sceneParams.formation`（`{ front1, front2, rear1, rear2 }`）から数える。

防衛戦（プレイヤーが守備側）も同様に対称化すること。該当は `App.jsx:307` 付近のフロー。

### 注意

- 敵の人数が足りない場合の扱い（プレイヤー4名に対し敵が2名しかいない等）を決めて実装すること。**不明なら確認すること**
- `buildUnit(char, sideType, index)` の `position: index < 2 ? 'front' : 'rear'` は変更しない。渡す配列の長さを揃えるだけ

---

## 3. 戦闘によるSP上限成長

**戦闘に参加したキャラの `maxSoldiers` を +100 する。**

| 項目 | 値 |
|------|-----|
| 条件 | **勝敗を問わない**。参加すれば加算 |
| 増加量 | **+100**（定数） |
| 上限 | なし |
| 対象外 | モブ（`_isMobInstance === true`） |

### 実装箇所

`GameContext.jsx` の `BATTLE_END` reducer（`:195`付近）。**Phase A で実装済みの好感度加算と同じ場所に相乗りできる。**

```js
// 既存（Phase A）
const mobIds = new Set(state.characters.filter(c => c._isMobInstance === true).map(c => c.id));
const affinityIds = (usedCharIds ?? []).filter(id => !mobIds.has(id));
const affinity = gainAffinity(state.affinity, allPairs(affinityIds), 2);
```

同じ `affinityIds`（モブ除外済み）を使って `characters` の `maxSoldiers` を加算する。既存の `characters` 生成ロジック（`:203-217`）に組み込むこと。

**新規の action / effect / システムは作らないこと。** 既存の `maxSoldiers` 変更経路（`sp_max_up` / `purchaseUpgrade` / 研究の `characterEffects` / `ItemSystem`）にも手を入れない。

### セーブ

`maxSoldiers` は既に serialize / deserialize 対象（`GameContext.jsx:616`, `:686`）。**変更不要。SAVE_VERSION の繰り上げも不要。**

---

## 4. やらないこと

- クラファン／浅層探索のダンジョン改修 → **C-2 / C-3**
- 好感度の加算経路の追加 → C-3
- `sp_max_up` 強化コマンドのUI復活 → 対象外
- `characters.json` の編集 → 対象外
- カットイン・バッジの見た目調整 → 対象外

**指示範囲外のコード・コメントを変更しないこと。**

---

## 5. 注意

- 投機的実装・不要な抽象化をしないこと。成功基準を満たす最小限のコードのみ書く
- 不明点があれば勝手に判断せず確認すること（特に §2 の「敵の人数が足りない場合」）
