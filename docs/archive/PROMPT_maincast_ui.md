# PROMPT: 編成画面のメイン数選択（自軍メイン1の動線）

対象: ClaudeCode
作成: 2026-08-26
前提: `PROMPT_maincast_variable.md`（実装完了）。エンジン側の受け皿は実装済み。

---

## 1. 背景

`BattleScene` は `playerMainCount` を受け取れるようになったが、**渡す側が無い**。
`App.jsx` からも `FormationScene` からも渡していないため自軍は常にメイン2。
体験版で自軍メイン1の編成が必要なため、動線を通す。

**`formation` の構造は変更しない。** `BattleScene.jsx:1172` が根拠。

```js
  const slots     = ['front1','front2','rear1','rear2'];
  const rawAllies = useRef(slots.map(k => formation?.[k]).filter(Boolean)).current;
```

キー名は `position` を決めておらず、**配列の順序だけが意味を持つ**。
`position` は `i < playerMainCount`（L1303）で決まる。
したがって `mainCount:1` のとき `front2` に入っている2人目は自動的に rear になる。
`picks` の割り当てロジック（`FormationScene.jsx:615-620`）も変更不要。

---

## 2. 変更対象

### 2-1. `src/scenes/FormationScene.jsx` — state 追加

`battleMode` の state（L606）の隣に追加する。

```js
  const [mainCount, setMainCount] = useState(2);
```

### 2-2. 同 — メイン数トグルUI

「EDITING — 編成スロット」見出し（L698-699）とスロット4行（L702-705）の間に、
メイン数を 1 / 2 で切り替えるUIを置く。

- 既存の `battleMode` トグル（野戦／籠城）と同じ見た目の作りにしろ。新しい様式を発明するな
- ラベルは「メインキャスト数」
- 色は `tokens.js` から import 済みの `PK`（選択中）/ `TXF`（非選択）を使う。**直書き禁止**
- `isDefense` でも表示する（防衛戦でも選べる）

### 2-3. 同 — スロットのラベルと色を動的化

before（L702-705）:

```jsx
              <SlotRow slotLabel="① メイン" color={PK}   char={formation.front1} onRemove={() => removeAt(0)}/>
              <SlotRow slotLabel="② メイン" color={PK}   char={formation.front2} onRemove={() => removeAt(1)}/>
              <SlotRow slotLabel="③ サブ"   color={TEAL} char={formation.rear1}  onRemove={() => removeAt(2)}/>
              <SlotRow slotLabel="④ サブ"   color={TEAL} char={formation.rear2}  onRemove={() => removeAt(3)}/>
```

添字 `i`（0〜3）に対し `i < mainCount` ならメイン（`PK`）、そうでなければサブ（`TEAL`）。
丸数字（①②③④）は位置を表すのでそのまま維持しろ。

`slotLabel` は `` `${MARU[i]} ${i < mainCount ? 'メイン' : 'サブ'}` `` の形。
`formation` の参照キーと `removeAt` の添字は**変更するな**。

### 2-4. 同 — onLaunch へ受け渡し

before（L826-830）:

```js
            onLaunch(formation, targetNode, {
              isDefense,
              battleMode,
              battleCapacity: effectiveBattleCapacity,
            });
```

`mainCount` を1行追加する。他は変えるな。

### 2-5. `src/App.jsx` — 攻撃経路

`onLaunch`（L563-）の `navigate('battle', { mode:'attack', formation, ... })` に
`playerMainCount: opts?.mainCount ?? 2` を追加する。

`case 'battle'`（L582-）の `<BattleScene>`（L596-）に
`playerMainCount={sceneParams.playerMainCount ?? 2}` を追加する。

### 2-6. `src/App.jsx` — 防衛経路

`onLaunch`（L452）の `setDefenseFlow` が持つオブジェクトに
`playerMainCount: opts?.mainCount ?? 2` を追加する。

防衛フローの `<BattleScene>`（L473-）に
`playerMainCount={defenseFlow.playerMainCount ?? 2}` を追加する。

### 2-7. `src/scenes/DungeonScene.jsx` — メイン数トグル

クラファン挑戦・浅層探索は編成画面を通らず、本シーンが自前でキャラを選ぶ。
ここにも同じトグルが要る（2026-08-26 オーナー判断）。

`selectedGoalId` の state（L43）の隣に追加する。

```js
  const [mainCount, setMainCount] = useState(2);
```

キャラ選択リスト（L101-）と決定ボタン（L134-135）の間に、§2-2 と**同じ様式**の
メイン数トグルを置く。色は `tokens.js` の import 済み定数を使う。**直書き禁止。**

`onConfirm` に第3引数として渡す。

before（L135）:

```js
              onClick={() => onConfirm(selectedCharIds, isCF ? selectedGoalId : null)} />
```

after:

```js
              onClick={() => onConfirm(selectedCharIds, isCF ? selectedGoalId : null, mainCount)} />
```

### 2-8. `src/App.jsx` — ダンジョン経路

`case 'dungeon'` の `onConfirm`（L912-）のシグネチャに第3引数 `mainCount` を追加し、
`next` オブジェクト（L925-928）に `mainCount` を持たせる。

```js
            onConfirm={(charIds, goalId, mainCount) => {
```

```js
              const next = {
                ...dungeonSession, charIds, goalId, requiredMemeByChar, waveIndex: 1,
                progressPoints: 0, progressRequired, mainCount,
              };
```

`startDungeonWave`（L377-）の `navigate('battle', ...)`（L398-）に1行追加する。

```js
      playerMainCount: session.mainCount ?? 2,
```

`case 'battle'` 側の配線は §2-5 で追加済みのため**追加不要**。
`startDungeonWave` の navigate も同じ `sceneParams` を通る。

`onContinue`（次の波）は `{ ...dungeonSession }` を引き継ぐため、
`mainCount` は波をまたいで自動的に維持される。**追加実装は不要。**

**L379-380 の `mainCount` / `subCount` は触るな。** あれは敵の抽選数を決める別物で、
`position` とは無関係（`PROMPT_maincast_variable.md` §2-6）。同名だが混同するな。

---

## 3. スコープ外（触るな）

- `formation` の構造・`picks` の割り当てロジック（`FormationScene.jsx:615-620`）
- `removeAt` / `togglePick` の挙動
- 出撃ボタンの活性条件（L746-758）。`totalSelected < 1` のままでよい。
  メイン0は `picks.length >= 1` で自然に担保される
- `App.jsx:379-380` の `mainCount` / `subCount`（敵の抽選数）と L385 の使用箇所
- `BattleScene.jsx` / `BattleEngineV3.js` / `LegionAI.js` — 前プロンプトで完了済み
- メインに誰を置くかの並べ替えUI（下記 §6）
- 上記以外のあらゆるファイル・コメント

---

## 4. 成功基準

1. `npm run build` が通る
2. 編成画面でメイン数トグルが表示され、1 を選ぶとスロット①のみ「メイン」、②③④が「サブ」表示になる
3. メイン数2（既定）で出撃した場合、戦闘の前衛が2名になる（従来どおり）
4. **メイン数1で3名編成して出撃し、戦闘画面の前衛が1名・後衛が2名になる**
5. 防衛戦でも 4 と同じ結果になる
6. **クラファン挑戦でメイン数1・3名で開始し、戦闘の前衛が1名・後衛が2名になる**
7. **2の波（「進む」）でもメイン数1が維持されている**
8. `grep -n "playerMainCount" src/App.jsx` が攻撃2件・防衛2件・ダンジョン1件の計5件を返す
9. `grep -n "const mainCount" src/App.jsx` が L379 の1件のみ（既存の局所変数が無改変）
10. 色の直書きが無い（`tokens.js` からの import のみ）

**確認方法**: `npm run dev` で 5173 を起動し、URLを人間に伝えて目視を依頼しろ。
起動前に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認し、5174以降が生きていたら kill しろ。
**Playwright を使うな。**

---

## 5. やるな

- `formation` を配列化するリファクタリング
- 4スロット構造の変更
- 色の直書き
- Playwright の起動

---

## 6. 申し送り（実装するな・記録のみ）

現状、メインに誰を置くかは**選んだ順**で決まる。任意のキャラをメインにするには
一度スロットから外して選び直す必要がある。並べ替えUIは本プロンプトの範囲外。
体験版で不便が出たら別途扱う。

`dungeons.json` の敵プールは軍団定義を持たないため、**敵側は既定のメイン2のまま**。
クラファンの「対称化」を敵のメイン数にも及ぼすかは未決。必要になったら別途扱う。
