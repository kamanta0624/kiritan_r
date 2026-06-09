# PROMPT_battlecap_fix（BUG-09 / P1）

## 目的
防御戦の「野戦/籠城」選択 `battleCapacity` を BattleEngineV3 へ伝達する。
現状、防御で野戦選択しても Engine は常に拠点の籠城値で戦闘し、野戦が無効。

## 責任範囲（単一）
`battleCapacity` の FormationScene → App → BattleScene → Engine 伝達経路の修復のみ。

## 根拠（コード断点）
正常伝達される値の生成元:
- `src/scenes/FormationScene.jsx:611-613`
  `effectiveBattleCapacity = isDefense && battleMode==='field' ? FIELD_BATTLE_CAPACITY(5000) : (battleCapacity ?? targetNode?.battleCapacity ?? 3500)`
- `src/scenes/FormationScene.jsx:737-744` 野戦/籠城トグルは `{isDefense && ...}`（防御戦のみ表示）
- `src/scenes/FormationScene.jsx:847-851`
  `onLaunch(formation, targetNode, { isDefense, battleMode, battleCapacity: effectiveBattleCapacity })`

断点（値が落ちる箇所）:
- 断点① `src/App.jsx:269-271` 防御 formation の `onLaunch={(formation) => ...}` が第3引数 `opts` を破棄 → `opts.battleCapacity` 消失
- 断点② `src/App.jsx:290-` 防御 battle 相の `<BattleScene>` に `battleCapacity` prop なし
- 断点③ `src/scenes/BattleScene.jsx:1141-1142` `BattleFlow({...})` が `battleCapacity` prop を受けず `const BATTLE_CAP = targetNode?.battleCapacity ?? 400`
- 終端 `src/scenes/BattleScene.jsx:1296-1297` `new BattleEngineV3({ ..., battleCapacity: BATTLE_CAP, ... })`

攻撃戦は `isDefense=false` で `effectiveBattleCapacity == targetNode.battleCapacity`（トグル非表示）のため実害なし。本修正で prop 経路を通しても結果不変。

## 修正

### A. `src/App.jsx:269-271`（防御 formation onLaunch / opts を拾う）
変更前:
```
        onLaunch={(formation) => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'battle', formation } : null);
        }}
```
変更後:
```
        onLaunch={(formation, _tNode, opts) => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'battle', formation, battleCapacity: opts?.battleCapacity } : null);
        }}
```

### B. `src/App.jsx:290-`（防御 battle 相 BattleScene に prop 追加）
`<BattleScene>` の props に追加（`targetNode={item.defenderBase}` の直後）:
```
            battleCapacity={defenseFlow.battleCapacity}
```

### C. `src/scenes/BattleScene.jsx:1141-1142`（prop 受領・優先）
変更前:
```
export default function BattleFlow({ formation, targetNode, onComplete, onBattleStart, enemyChars = [], battleMode = 'normal', isDefense = false, enemyRetreatRule = 'char_dead' }) {
  const BATTLE_CAP  = targetNode?.battleCapacity ?? 400;
```
変更後:
```
export default function BattleFlow({ formation, targetNode, onComplete, onBattleStart, enemyChars = [], battleMode = 'normal', isDefense = false, enemyRetreatRule = 'char_dead', battleCapacity = null }) {
  const BATTLE_CAP  = battleCapacity ?? targetNode?.battleCapacity ?? 400;
```

### D. `src/App.jsx:437-`（攻撃 battle 相 BattleScene に prop 追加 / 契約統一）
`<BattleScene>` の props に追加（`targetNode={targetBase}` の直後）:
```
              battleCapacity={sceneParams.battleCapacity}
```
（攻撃 onLaunch `App.jsx:413-415` および dungeon navigate `App.jsx:661-666` で `sceneParams.battleCapacity` は設定済み。値不変だが prop 契約を全描画箇所で統一する。）

## 除外範囲
- 敵 AI の野戦/籠城選択（MISSING-01 / LegionAI）は対象外
- `FIELD_BATTLE_CAPACITY=5000` 等の数値調整は対象外
- 撤退ルール（`enemyRetreatRule` / `retreatRule`）は触らない
- Engine 内部の `battleCapacity` 消費ロジックは触らない
- 攻撃戦の挙動変更は不可（値不変であること）

## 完了状態（コード）
- 防御で野戦選択時、BattleEngineV3 の `battleCapacity` が `5000`（FIELD_BATTLE_CAPACITY）になる
- 防御で籠城選択時、`defenderBase.battleCapacity` になる
- 攻撃戦の `battleCapacity` は従来同値
