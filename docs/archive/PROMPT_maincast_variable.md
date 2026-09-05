# PROMPT: メインキャスト数の可変化（エンジン・データ層）

作成日: 2026-08-26
担当: ClaudeCode
前提: UI（FormationScene）の改修は ClaudeDesign 納品後に別プロンプトで行う。**本プロンプトは UI を触らない。**

---

## 1. 背景

現状、戦闘の「メインキャスト（front）」は編成配列の先頭2名に固定されている。
メイン1名の編成を成立させるため、メイン数を可変にする。

確定仕様:

- 総数4。メイン1〜2、サブ0〜3
- メイン0は禁止
- 敵側は `legions.json` の `mainCount` で指定。未指定時は 2

カップリングボーナスの階層係数（メイン×メイン ×1.0 / メイン×サブ ×0.4 / サブ×サブ ×0.2）は
`BattleEngineV3._initCoupling`（L550-582）が `position` を見て決めるため、
`position` が正しく決まればロジック変更は不要。

決着判定 `_mainAlive`（L612-616）も `position === 'front'` を見るのみ。変更不要。

---

## 2. 変更対象

### 2-1. `src/game/systems/BattleEngineV3.js`

`buildUnit`（L186-205）に `mainCount` を追加する。既定値 2。

before（L186-191 抜粋）:

```js
  static buildUnit(char, sideType, index) {
    return {
      char,
      sideType,
      bonus:       resolveBonus(char, sideType),
      position:    index < 2 ? 'front' : 'rear',
```

after:

```js
  static buildUnit(char, sideType, index, mainCount = 2) {
    return {
      char,
      sideType,
      bonus:       resolveBonus(char, sideType),
      position:    index < mainCount ? 'front' : 'rear',
```

**他は一切変更しない。**

既存呼び出し元は第4引数を渡さないため、従来通り2として動く。

| 呼び出し元 | 行 | 影響 |
|---|---|---|
| `src/scenes/BattleScene.jsx` | 1302 | 本プロンプトで変更（2-2） |
| `src/scenes/BattleFullQAScene.jsx` | 75 | 変更なし。`index` に 0 / 2 を直接渡しており既定値2で従来動作 |
| `src/scenes/BattleQAScene.jsx` | 72, 75, 76 | 変更なし |
| `src/context/GameContext.jsx` | 1322 | 再エクスポートのみ。変更なし |

### 2-2. `src/scenes/BattleScene.jsx`

props に `playerMainCount` と `enemyMainCount` を追加する。いずれも既定値 2。

**(a) props 受け取り部**

コンポーネントの props 分割代入に以下2つを追加する。既定値を必ず付けること。

```js
  playerMainCount = 2,
  enemyMainCount  = 2,
```

**(b) 自軍ユニット構築（L1302）**

before:

```js
    const playerUnits = rawAllies.map((c, i) => BattleEngineV3.buildUnit(c, isDefense ? 'defense' : 'attack', i));
```

after:

```js
    const playerUnits = rawAllies.map((c, i) => BattleEngineV3.buildUnit(c, isDefense ? 'defense' : 'attack', i, playerMainCount));
```

**(c) 敵ユニット構築（L1319）**

敵側は `buildUnit` を通さずインラインでオブジェクトを組んでいる。

before:

```js
        position: i < 2 ? 'front' : 'rear',
```

after:

```js
        position: i < enemyMainCount ? 'front' : 'rear',
```

**(d) 表示同期（L1205-1229）— 3箇所目の `i < 2`**

`syncDisplay` の `make()` 内に `position` を添字で再付与している箇所がある。
ここを直さないと、エンジン内部が front 1名でも画面は2名を前衛として描画する。

L1209-1216 の現状:

```js
    const make = (units) => {
      const alive = units.filter(u => u.charHp > 0 && !u.retreated);
      const fronts = alive.filter(u => u.position === 'front');
      const rears  = alive.filter(u => u.position === 'rear');
      const reordered = fronts.length > 0 ? [...fronts, ...rears] : [...rears];
      return reordered.map((u, i) => ({
        id:          u.char.id,
        name:        u.char.name,
        position:    i < 2 ? 'front' : 'rear',
```

**ここで `playerMainCount` / `enemyMainCount` を使ってはならない。**
`make()` は自軍・敵軍の両方から呼ばれる共通関数であり、どちら側かを引数で区別していない。
`fronts` は既に `u.position` から算出済みなので、その件数をそのまま表示件数に使う。

`fronts.length === 0`（メイン全滅）時に後衛の先頭2名を前衛として描画するフォールバックが
L1213 に存在する。`_mainAlive`（L612-616）の全体フォールバックと対になる挙動であり、**維持すること。**

after:

```js
    const make = (units) => {
      const alive = units.filter(u => u.charHp > 0 && !u.retreated);
      const fronts = alive.filter(u => u.position === 'front');
      const rears  = alive.filter(u => u.position === 'rear');
      const reordered = fronts.length > 0 ? [...fronts, ...rears] : [...rears];
      const displayFrontCount = fronts.length > 0 ? fronts.length : Math.min(rears.length, 2);
      return reordered.map((u, i) => ({
        id:          u.char.id,
        name:        u.char.name,
        position:    i < displayFrontCount ? 'front' : 'rear',
```

`position` 以降のフィールドは変更しない。

**(e) 依存配列**

L1298 から始まるエンジン初期化 `useEffect` は「一度だけ」実行される契約。
`playerMainCount` / `enemyMainCount` を依存配列に**追加しない**。
戦闘中にメイン数が変わることはなく、追加するとエンジンが再初期化される。

### 2-3. `src/game/data/legions.json`

全15軍団に `mainCount` を追加する必要は**ない**。必要な軍団にのみ追加する。

本プロンプトでは**データを変更しない**。スキーマを受け入れる側だけ実装する。
実際の値設定は体験版のシナリオ実装時に別途行う。

### 2-4. `src/game/systems/LegionAI.js`

`getDefendersWithRule`（L162-188）の戻り値に `mainCount` を追加する。

現在の戻り値は `{ chars, retreatRule }` の2種類 + フォールバック1種類、計3つの return がある。

- L172: 拠点指定軍団がヒットした場合
- L183: reserve 軍団がヒットした場合
- L188: 最終手段（汎用敵）

before（L172）:

```js
      if (chars.length > 0) {
        return { chars, retreatRule: this.getRetreatRule(legion.id, defenderBase.id, mode) };
      }
```

after:

```js
      if (chars.length > 0) {
        return { chars, retreatRule: this.getRetreatRule(legion.id, defenderBase.id, mode), mainCount: legion.mainCount ?? 2 };
      }
```

reserve 側（L183）も同様に `mainCount: reserve.mainCount ?? 2` を追加する。

最終手段（L188）は `mainCount: 2` を追加する。

before:

```js
    return { chars: [], retreatRule: 'char_dead' };
```

after:

```js
    return { chars: [], retreatRule: 'char_dead', mainCount: 2 };
```

**`getDefenders`（L128-152）は変更しない。** 別メソッドであり戻り値の契約が異なる。

### 2-5. `src/App.jsx`

`case 'battle'`（L580-）で `_def` から `mainCount` を取り出し BattleScene へ渡す。

before（L585-592）:

```js
        const _def = sceneParams._dungeonEnemies
          ? { chars: sceneParams._dungeonEnemies, retreatRule: 'never' }
          : (enemyFactionId && legionAI
              ? legionAI.getDefendersWithRule(enemyFactionId, targetBase, characters, 'defense')
              : { chars: [], retreatRule: 'char_dead' });
        const enemyChars       = _def.chars.slice(0, 4);
        const enemyRetreatRule = _def.retreatRule;
```

after:

```js
        const _def = sceneParams._dungeonEnemies
          ? { chars: sceneParams._dungeonEnemies, retreatRule: 'never', mainCount: 2 }
          : (enemyFactionId && legionAI
              ? legionAI.getDefendersWithRule(enemyFactionId, targetBase, characters, 'defense')
              : { chars: [], retreatRule: 'char_dead', mainCount: 2 });
        const enemyChars       = _def.chars.slice(0, 4);
        const enemyRetreatRule = _def.retreatRule;
        const enemyMainCount   = _def.mainCount ?? 2;
```

`<BattleScene>`（L594-）の props に `enemyMainCount={enemyMainCount}` を追加する。

`playerMainCount` は**渡さない**。UI 改修後に FormationScene から受け取る。既定値2で従来動作。

### 2-6. `src/App.jsx` — ダンジョン戦闘経路（`startDungeonWave`）

クラファン挑戦・浅層探索は `case 'battle'` を通らず `startDungeonWave`（L376-）から
`navigate('battle', { mode: 'dungeon', ... })` で直接遷移する。
`sceneParams._dungeonEnemies` が設定されるため §2-5 の `_def` は
`{ chars, retreatRule:'never', mainCount: 2 }` の分岐に入る。

**ダンジョン敵のメイン数は人数からの自動決定とする。** 追加実装は不要。
`enemyMainCount` 既定値2に対し §2-2(c) の `i < enemyMainCount` を評価すると、
敵1名なら front 1名、2名以上なら front 2名となり `Math.min(敵人数, 2)` と等価になる。
ダンジョン敵はプールからの抽選であり軍団定義を持たないため、
`dungeons.json` に `mainCount` を追加しない。

**注意すべきは同名変数の衝突。**

L379-380 に既に `mainCount` が存在する。

```js
    const mainCount = Math.min(charIds.length, 2);
    const subCount  = Math.max(0, charIds.length - 2);
```

これは**敵の抽選数を決めるためだけの局所変数**で、L384 の
`drawTieredEnemyDefs(dungeonsData.crowdfundingPool, mainCount + subCount, strengthScore)`
でしか使われない。`mainCount + subCount` は `charIds.length` と常に等価。
本プロンプトで扱うメインキャスト数とは無関係。

**この2行および L384 を変更してはならない。** 意味が異なるだけで動作は正しい。
リネームもしない（スコープ外の変更になる）。

`startDungeonWave` の `navigate('battle', ...)` に `playerMainCount` を**追加しない**。
自軍メイン数の可変化は UI 改修後の別プロンプトで、通常戦闘・ダンジョン戦闘の両経路に
まとめて対応する。本プロンプトの時点ではダンジョン戦闘も既定値2で従来動作すればよい。

---

## 3. スコープ外（触るな）

- `src/scenes/FormationScene.jsx` — Design 納品後に別プロンプトで扱う
- `src/scenes/BattleFullQAScene.jsx` / `BattleQAScene.jsx` — 既定値2で従来動作するため変更不要
- `BattleEngineV3._initCoupling` / `_mainAlive` — `position` を見るだけなので変更不要
- `LegionAI.getDefenders`（`getDefendersWithRule` とは別メソッド）
- `src/game/data/legions.json` の値
- 防衛フロー（`defenseFlow`）側の敵編成 — 別途調査してから扱う
- 上記以外のあらゆるファイル・コメント

---

## 4. 成功基準

1. `npm run dev` が警告なく起動する
2. `http://localhost:5173/?qa=battlefull` が従来通り動作する（メイン2固定の挙動が変わらない）
3. 通常プレイで攻撃戦闘を1回行い、戦闘ログの「カップリング成立 N組」表示が改修前と一致する
4. `legions.json` の任意の軍団に `"mainCount": 1` を一時追加して該当拠点へ攻撃した場合、
   その軍団の先頭1名のみが front になり、2番目以降が rear になる
   （確認方法は Code が決めてよい。確認後 `legions.json` の一時変更は必ず戻すこと）
5. `grep -rn "< 2 ? 'front'" src/` の結果が `src/scenes/BattleScene.jsx:56` の1件のみになる
   （§2-1 / §2-2(c) / §2-2(d) の3箇所が消えていること。L56 は `normalizeChar` の戻り値だが、
   その `position` は L1306 の `enemyUnits` 構築で添字から再付与され上書きされる死んだ値。
   **本プロンプトでは触らない。**）
6. `grep -n "mainCount" src/App.jsx` が L379 の局所変数と §2-5 で追加した `enemyMainCount` のみを返す
   （L379-380 と L384 が改修前と一致すること）

---

## 5. 報告

完了時に以下を報告すること。

- 変更したファイルと行番号
- 成功基準4の確認方法と結果
- 想定外に変更が必要だった箇所があれば、その理由と該当行
