# 戦闘バグ修正

> 作成: 2026-05-21
> 優先度: 高（防衛戦の拠点帰属・SP/HP書き戻しが壊れている）

---

## スコープ外（触るな）

- `App.jsx` の defenseFlow state machine（実装済み・正常）
- `BattleEngineV3.js` のダメージ計算ロジック
- `GameContext.jsx` の BATTLE_END reducer 本体（正常）
- `PROMPT_worldmap_bugfix.md` の修正項目

---

## 修正対象

**`src/scenes/BattleScene.jsx` の `onBattleEnd` コールバック1箇所のみ。**

変更ファイル: `src/scenes/BattleScene.jsx`

---

## BUG-A: 防衛戦 conquered 反転（致命）

### 根拠

`BattleEngineV3` は常に `mode:'attack'` で生成される（BattleScene.jsx L1226）。

```js
// BattleEngineV3.checkGameOver()
const atkAlive = this.mode === 'attack' ? pAlive : eAlive;
const defAlive = this.mode === 'attack' ? eAlive : pAlive;
this._delayedCall(300, () => this._finish(!defAlive && atkAlive));
```

`wins = (!defAlive && atkAlive)` = 「敵（enemy側）全滅かつプレイヤー生存」= プレイヤーが攻撃側として勝利。

`onBattleEnd` 内：

```js
battleResultRef.current = { conquered: wins, ... }
```

防衛戦でプレイヤーが勝った場合、`wins=true` → `conquered=true` → App.jsx で拠点が攻撃勢力に渡る。**逆。**

### 修正

`BattleFlow` コンポーネントは `onComplete` prop を持つが、防衛か攻撃かを知らない。
`isDefense` prop を追加するか、App.jsx の呼び出し側で反転するか。

**App.jsx 側で反転する方が変更範囲が小さい。ただし BattleScene 側で修正する方が正確。**

App.jsx の防衛 `onComplete`（L371〜385）でのみ `conquered` を反転する：

```js
// App.jsx 防衛battle onComplete（defenseFlow.phase === 'battle'）
onComplete={async (result) => {
  const phase = await game.actions.battleEnd({
    usedCharIds:    result?.usedCharIds  ?? [],
    deadCharIds:    result?.deadCharIds  ?? [],
    deadMobIds:     result?.deadMobIds   ?? [],
    unitResults:    result?.unitResults  ?? [],
    conquered:      !(result?.conquered  ?? false),  // ← 反転
    defenderBaseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
    winnerFactionId: !(result?.conquered ?? false)
      ? item.attackerFactionId
      : playerFaction?.id,                           // ← winnerFactionIdも連動
  });
  advanceDefenseQueue(phase ?? null);
}}
```

攻撃戦（case 'battle'）の `onComplete` は **変更しない**。

---

## BUG-B: unitResults 欠落 → SP/HP書き戻し不全（高）

### 根拠

`BattleScene.jsx` の `onBattleEnd` コールバック内：

```js
// 現状
battleResultRef.current = {
  conquered: wins,
  usedCharIds: usedIds,
  deadCharIds: deadIds,
  deadMobIds,
  // unitResults フィールドなし
};
```

App.jsx → `game.actions.battleEnd({ unitResults: result?.unitResults ?? [] })` → 常に `[]`。

`BATTLE_END` reducer：

```js
if (unitResults?.length) {
  unitResults.forEach(u => { charMap[u.id] = u; });
}
// charMap が空 → soldiers/charHp の書き戻しをスキップ
```

結果: 戦闘後の SP・HP が GameContext に反映されない。

### 修正

`onBattleEnd` コールバック内で `unitResults` を構築して `battleResultRef.current` に追加：

```js
// BattleScene.jsx onBattleEnd コールバック内
// （既存の usedIds / deadIds / deadMobIds 構築の直後）
const unitResults = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])].map(u => ({
  id:       u.char.id,
  soldiers: Math.max(0, u.soldiers),
  charHp:   Math.max(0, u.charHp),
}));

battleResultRef.current = {
  conquered:    wins,
  usedCharIds:  usedIds,
  deadCharIds:  deadIds,
  deadMobIds,
  unitResults,  // ← 追加
};
```

---

## BUG-C: penaltyTurns 二重書き換え（中）

### 根拠

`onBattleEnd` コールバック内で `u.char` を直接書き換えている：

```js
// BattleScene.jsx onBattleEnd（現状）
const e = engineRef.current;
if (e) {
  [...e.playerSide, ...e.enemySide].forEach(u => {
    u.char.soldiers = u.soldiers;
    u.char.charHp   = Math.max(0, u.charHp);
    if (u.charHp <= 0 && !(u.char.penaltyTurns > 0)) u.char.penaltyTurns = 2;
  });
}
```

これに加えて `BattleEngineV3._applyPenalty()` も `u.char.penaltyTurns = 2` を書く。
さらに `BATTLE_END` reducer も `deadCharIds` 対象に `penaltyTurns: 2` をセットする。

React の state は `u.char` オブジェクトへの参照を持たないため、engine 側の直接書き換えは Reactに無視される。BUG-B を修正して `unitResults` が正しく渡れば、reducer が正しく書き戻す。

### 修正

`onBattleEnd` 内の `u.char` 直接書き換えブロックを**丸ごと削除**：

```js
// 削除するブロック
const e = engineRef.current;
if (e) {
  [...e.playerSide, ...e.enemySide].forEach(u => {
    u.char.soldiers = u.soldiers;
    u.char.charHp   = Math.max(0, u.charHp);
    if (u.charHp <= 0 && !(u.char.penaltyTurns > 0)) u.char.penaltyTurns = 2;
  });
}
```

`unitResults` 経由で reducer が担保するため不要。
`engineRef.current` の参照は `usedIds` / `deadIds` 構築のために引き続き必要なので、変数 `e` 自体は残す。

---

## 修正後の onBattleEnd 全体像

```js
onBattleEnd: (wins) => {
  const e = engineRef.current;

  const usedIds    = rawAllies.map(c => c.id);
  const deadIds    = (e?.playerSide ?? []).filter(u => u.charHp <= 0).map(u => u.char.id);
  const deadMobIds = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])]
    .filter(u => u.charHp <= 0 && u.char._isMobInstance).map(u => u.char.id);
  const unitResults = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])].map(u => ({
    id:       u.char.id,
    soldiers: Math.max(0, u.soldiers),
    charHp:   Math.max(0, u.charHp),
  }));

  const playerWins = wins;  // mode:'attack'固定なのでそのまま
  battleResultRef.current = {
    conquered:    wins,
    usedCharIds:  usedIds,
    deadCharIds:  deadIds,
    deadMobIds,
    unitResults,
  };
  setWinner(playerWins ? 'player' : 'enemy');
  setPhase('battleend');
},
```

---

## App.jsx の変更箇所

`defenseFlow.phase === 'battle'` の `onComplete` のみ。L371〜385付近。

```js
conquered:      !(result?.conquered  ?? false),
winnerFactionId: !(result?.conquered ?? false)
  ? item.attackerFactionId
  : playerFaction?.id,
```

攻撃戦（`case 'battle'`）の `onComplete` は変更しない。

---

## 完了条件

- [ ] `?qa=battlefull` で防衛フローを通す
  - [ ] 防衛勝利 → 拠点が自軍のまま
  - [ ] 防衛敗北 → 拠点が攻撃側に移る
  - [ ] 防衛戦後のキャラSP・HPがマップに戻ったあと正しく減っている
  - [ ] penaltyTurns が戦闘不能キャラに正しくセットされている
- [ ] 攻撃戦（通常フロー）が壊れていないこと
  - [ ] 攻撃制圧 → 拠点が自軍に移る
  - [ ] 攻撃敗北 → 拠点が変わらない
- [ ] 完了後このファイルを `docs/archive/` に移動
