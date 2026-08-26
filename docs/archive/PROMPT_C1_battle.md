# PROMPT_C1_battle — 戦闘システム改修（Phase C-1）

対象: ClaudeCode
前提: Phase A / B 完了済（`state.affinity` 疎管理、`couplingBonus`、`_mainAlive` によるメイン全滅判定）
参照必須: `docs/DESIGN_AFFINITY_BATTLE.md` §8（仕様SSOT）/ `KNOWLEDGE.md` §5（用語）§9〜11

C-2（ダンジョン基盤）とは独立。並行可。

**用語**: キャラの兵力は**ミーム**（`soldiers` / 上限 `maxSoldiers`）。旧称 SP は廃止（`KNOWLEDGE.md` §5-1）。**フィールド名は変更しない。**

---

## 0. 成功基準

達成するまでループして直すこと。

1. `npm run build` が成功する
2. **メインキャストが全滅しても、サブキャストが近接攻撃の対象にならない**
3. メインキャスト0の状態で近接攻撃が発生してもエラーにならない（攻撃せず次へ進む）
4. **攻撃戦・防衛戦**に参加したキャラの `maxSoldiers` が **+100** される（勝敗を問わない）
5. `memeGrowthMult` が `0.1` のキャラは **+110** される
6. **ダンジョン戦闘では `maxSoldiers` が増えない**
7. モブ（`_isMobInstance === true`）の `maxSoldiers` は増えない
8. セーブ→ロードで増加後の `maxSoldiers` と `memeGrowthMult` が保持される

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

メインキャスト（`position === 'front'`）が0になると側面全体（＝サブキャスト）を返す。**メインが1名撃破されてもサブは昇格しない**という仕様に反する。

### 変更

**`front.length ? front : alive` を撤去し `front` をそのまま返す。**

メイン0のとき戻り値は空配列になる。`BattleAI.selectTarget(unit, pool)`（`BattleAI.js:65-70`）は空配列に `null` を返すため、**null を受けた側で攻撃を行わず次へ進む**防御的処理を入れること。

メイン全滅＝即決着（`_mainAlive`）のため、メイン0は `_finish` の `_delayedCall(300, ...)` 遅延中にしか発生しない。クラッシュ防止が目的。

`ranged` / `song` は従来どおり `alive` 全体が対象（**変更しない**）。

### 触らないもの

`BattleEngineV3.js:613` の `_mainAlive` にある同種のフォールバック（front 不在サイドは side 全体で判定）は**QAシナリオ保護用のため維持**。

---

## 2. ミーム増加倍率フィールドの新設

**キャラごとに「ミーム上限の増加倍率」を持たせる。**

| 項目 | 内容 |
|------|------|
| フィールド名 | `memeGrowthMult`（命名は任意。決めたら統一すること） |
| 型・初期値 | number / **0**（＝倍率なし） |
| 意味 | ミーム上限成長にかかる上乗せ率。`0.1` なら +10% |

- `characters.json` への一括追加は**不要**。読み出し時に `?? 0` でフォールバックする
- セーブ対象に含める（`GameContext.jsx` の `serializeState` / `deserializeToState`）
- **`SAVE_VERSION` を 10 → 11 に繰り上げ**、旧セーブに `0` を補填

この倍率はクラファン成功報酬で増加する（C-3 の担当。本プロンプトでは**フィールドの器を作るだけ**）。

---

## 3. 戦闘によるミーム上限成長

**戦闘に参加したキャラの `maxSoldiers` を増加させる。**

| 項目 | 値 |
|------|-----|
| 条件 | **勝敗を問わない**。参加すれば加算 |
| **適用範囲** | **攻撃戦・防衛戦のみ。ダンジョン戦闘（クラファン・浅層探索）は対象外** |
| 増加量 | `100 * (1 + memeGrowthMult)`。基本 +100、倍率0.1なら +110 |
| 上限 | なし |
| 対象外 | モブ（`_isMobInstance === true`） |

### 実装箇所

`GameContext.jsx` の `BATTLE_END` reducer。**Phase A の好感度加算と同じ場所に相乗りできる。**

```js
// 既存（Phase A）
const mobIds = new Set(state.characters.filter(c => c._isMobInstance === true).map(c => c.id));
const affinityIds = (usedCharIds ?? []).filter(id => !mobIds.has(id));
const affinity = gainAffinity(state.affinity, allPairs(affinityIds), 2);
```

同じ `affinityIds` を使い、`characters` の生成ロジック（`:203-217`）に `maxSoldiers` 加算を組み込む。

### ダンジョン戦闘の除外方法

`battleEnd` の呼び出しは `App.jsx` に4箇所ある。

| 行 | 用途 |
|----|------|
| `:307` | 防衛戦 |
| **`:442`** | **ダンジョン戦闘** |
| `:467` | 攻撃戦 |
| `:788` | ゲーム終了処理 |

`battleEnd` の payload に**フラグを1つ足して判別する**のが素直（例 `isDungeon: true`）。reducer 側でフラグが立っていれば加算をスキップする。

**新規の action / effect / システムは作らないこと。** 既存の `maxSoldiers` 変更経路（`sp_max_up` / `purchaseUpgrade` / 研究の `characterEffects` / `ItemSystem`）にも手を入れない。

---

## 4. やらないこと

- **敵編成の対称化** → クラファン挑戦の敵生成の一部。**C-3**
- ダンジョン基盤の改修 → **C-2**
- クラファン報酬による `memeGrowthMult` の増加 → **C-3**
- UI の「SP」→「ミーム」文字列置換 → 別タスク（`KNOWLEDGE.md` §16）
- `characters.json` の編集 → 対象外
- カットイン・バッジの見た目調整 → 対象外

**指示範囲外のコード・コメントを変更しないこと。**

---

## 5. 注意

- 投機的実装・不要な抽象化をしないこと。成功基準を満たす最小限のコードのみ書く
- 不明点があれば勝手に判断せず確認すること
