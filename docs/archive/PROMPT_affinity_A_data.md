# PROMPT_affinity_A_data — 好感度データ層の実装（Phase A）

対象: ClaudeCode
参照必須: `docs/DESIGN_AFFINITY_BATTLE.md`（仕様SSOT）/ `KNOWLEDGE.md` §7（GameContext API）

---

## 0. 成功基準（これが満たされたら完了）

以下がすべて再現できること。達成するまでループして直すこと。

1. `npm run build` が成功する
2. 4人編成で通常戦闘を1回行うと、その4人の**全6ペア**の好感度が **+2** される
3. 同じ4人で10回戦闘すると各ペアが **20（Lv2）** になる
4. 20回戦闘すると **40（Lv3）** で止まる。それ以上戦っても 40 を超えない
5. 一度も共闘していないペアの好感度を引くと **0** が返る。`state.affinity` にそのキーは**存在しない**
6. セーブ → ロードで `affinity` の内容が保持される
7. 既存の v9 セーブをロードしてもエラーが出ず、`affinity` が `{}` で補填される
8. `{ "type": "affinityGain", "pairs": [["char_004","char_016"]], "amount": 10 }` を effects に含むイベントで、そのペアが +10 される
9. モブ（`_isMobInstance === true`）は好感度の加算対象に**ならない**

確認手段は `?qa=battlefull` またはブラウザの devtools で `localStorage.getItem('kiritan_save_0')` を見る等、任意。

---

## 1. 仕様（`docs/DESIGN_AFFINITY_BATTLE.md` より）

### データ構造 — 疎（sparse）管理

```js
state.affinity = {}                          // 初期値。0のペアは持たない
state.affinity = { "char_004__char_016": 4 } // 加算が起きたペアだけ生える
```

- pairKey = **2つの charId をソートして `__` で連結**。`pairKey('char_016','char_004') === 'char_004__char_016'`
- 読み出しは未登録なら 0
- **上限 40。** 超過分は切り捨て（`Math.min(40, ...)`）

### Lv 判定

| Lv | 閾値 |
|----|------|
| 0 | 0〜7（カップリング不成立） |
| 1 | 8 |
| 2 | 20 |
| 3（最大） | 40 |

### 加算経路（Phase A で実装するのは 1 と 2 のみ）

| 経路 | 加算 | Phase A |
|------|------|---------|
| 通常戦闘（同時出撃） | +2 | **実装する** |
| `affinityGain` effect | 任意 | **実装する（受け口）** |
| クラファン挑戦（同行） | +2 | 範囲外（実装順[2]で結線） |
| 浅層探索（同行） | +1 | 範囲外（実装順[2]で結線） |
| 劇場イベント | +10 | `affinityGain` effect 経由。イベントJSONの整備は範囲外 |

---

## 2. 実装

### 2-1. 新規ファイル `src/game/utils/Affinity.js`

純関数のみ。React・GameContext に依存させない。

```js
export const AFFINITY_MAX = 40;
export const AFFINITY_THRESHOLDS = [8, 20, 40];   // Lv1, Lv2, Lv3

export function pairKey(a, b)            // ソートして '__' 連結
export function getAffinity(affinity, a, b)   // 未登録なら 0
export function getAffinityLv(affinity, a, b) // 0〜3
export function allPairs(ids)            // ID配列 → 全ペアの配列（重複なし・自分自身を除く）
export function gainAffinity(affinity, pairs, amount)  // 新しい affinity オブジェクトを返す（上限40でクランプ）
```

`allPairs(['a','b','c','d'])` は 6 組を返すこと。

### 2-2. `src/context/GameContext.jsx`

| 箇所 | 変更 |
|------|------|
| `createInitialState`（L70付近） | `affinity: {}` を追加 |
| `PURE_EFFECT_TYPES`（L415） | `'affinityGain'` を追加 |
| `applyEffectToState`（L421〜） | `case 'affinityGain'` を追加。`{ type, pairs: [[a,b],...], amount }` を受け、`gainAffinity` で新 state を返す |
| `BATTLE_END` reducer（L195付近） | `usedCharIds` から**モブを除いた**ID群の全ペアに **+2**。`characters` の更新と同じ return 内で `affinity` も更新する |
| `serializeState`（L576） | `affinity: { ...(state.affinity ?? {}) }` を追加 |
| `SAVE_VERSION`（L573） | **9 → 10** |
| `deserializeToState`（L695付近） | `affinity: data.affinity ?? {}` を追加（v9以前の補填） |

`useGame()` の戻り値に `affinity` を露出させること。`actions` への専用メソッド追加は不要（effect と BATTLE_END で足りる）。

### 2-3. モブ除外

`usedCharIds` は `BattleScene.jsx:1309` の `rawAllies.map(c => c.id)`（プレイヤー側出撃キャラ全員）。
reducer 側で `state.characters` を引き、`_isMobInstance === true` のキャラを**除外してから**ペアを作ること。

---

## 3. やらないこと（Phase A の範囲外）

- **戦闘ボーナスへの反映**（`_initStrategy` / `_strat` の置換）→ Phase B
- **メインキャスト／サブキャストへの改称、勝利条件の変更** → Phase B
- **UI 表示**（PartyScene の好感度一覧、FormationScene のプレビュー）→ 後回し
- **イベントCG** → 実装しない（`DESIGN_AFFINITY_BATTLE.md` §6-2）
- **敵側の固定好感度** → 後回し
- クラファン・浅層探索の加算経路 → 実装順[2]
- イベントJSON への `affinityGain` の記述追加 → 範囲外（受け口だけ作る）

**指示範囲外のコード・コメントを変更しないこと。**

---

## 4. 注意

- `characters.json` の `strategyRate` には**触れない**。Phase B で戦闘システムからの参照を切るが、データは残置する
- 投機的実装・不要な抽象化をしないこと。上記の成功基準を満たす最小限のコードのみ書く
- 不明点があれば勝手に判断せず確認すること
