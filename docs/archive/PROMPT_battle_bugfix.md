# 戦闘バグ修正 + unit.char同期設計

> 作成: 2026-05-21
> 優先度: 高（防衛戦の拠点帰属・SP/HP書き戻しが壊れている）

---

## スコープ外（触るな）

- `App.jsx` の defenseFlow state machine（実装済み・正常）
- `GameContext.jsx` の BATTLE_END reducer 本体（正常）
- `BattleFullQAScene.jsx`（変更不要）
- `PROMPT_worldmap_bugfix.md` の修正項目

---

## 設計方針（重要・先に読め）

### 旧kiritan（Phaser版）の正仕様

旧版では `WorldMapScene.characters` というミュータブル配列を全シーンが共有していた。
`buildUnit(c, sideType, i)` で `unit.char = c`（実参照）を渡し、
戦闘終了時に `u.char.soldiers = u.soldiers` と書けばそのままゲーム状態に反映された。

### kiritan_r のあるべき姿

React の useReducer が state を管理するため「ミュータブル参照の書き換えが即反映」は使えない。
ただし `unit.char` は GameContext state への参照を保ち続ける必要がある（id参照のため）。

正しい設計：

```
unit.soldiers / unit.charHp が変化するたびに unit.char.soldiers / unit.char.charHp も同時更新する
→ 戦闘終了時に unitResults を構築すると unit.char.* から正しい値が取れる
→ reducer が unitResults を受け取ってstateを更新する（唯一の書き戻し経路）
```

これにより：
- `unit.soldiers` と `unit.char.soldiers` が常に同値
- syncDisplay（BattleScene表示）も unitResults（reducer渡し）もどちらを読んでも正しい
- `onBattleEnd` 内の `u.char.soldiers = u.soldiers` ブロック（BUG-C）が不要になり削除できる

---

## 変更ファイル

| ファイル | 内容 |
|---|---|
| `src/game/systems/BattleEngineV3.js` | `unit.soldiers/charHp` 変更箇所に `unit.char` 同期を追加 |
| `src/scenes/BattleScene.jsx` | `onBattleEnd` 修正 + `unitResults` 構築追加 + char直書きブロック削除 |
| `src/App.jsx` | 防衛戦 `onComplete` の `conquered` 反転 |

---

## Step 1: BattleEngineV3.js — unit.char同期

`unit.soldiers` / `unit.charHp` を変更している全箇所の直後に `unit.char.*` への同期を追加する。

### 1-1. `_resolveExchange`

```js
// 変更前
def.soldiers = Math.max(0, def.soldiers - atkMem);
atk.soldiers = Math.max(0, atk.soldiers - defMem);
// ...
atk.charHp = newAtkHp;
def.charHp = newDefHp;

// 変更後
def.soldiers = Math.max(0, def.soldiers - atkMem);
def.char.soldiers = def.soldiers;                    // ← 追加
atk.soldiers = Math.max(0, atk.soldiers - defMem);
atk.char.soldiers = atk.soldiers;                    // ← 追加
// ...
atk.charHp = newAtkHp;
atk.char.charHp = atk.charHp;                       // ← 追加
def.charHp = newDefHp;
def.char.charHp = def.charHp;                       // ← 追加
```

### 1-2. `_execSpecial` (sp_strike分岐)

```js
// 変更前
target.soldiers = Math.max(0, target.soldiers - dmg);

// 変更後
target.soldiers = Math.max(0, target.soldiers - dmg);
target.char.soldiers = target.soldiers;              // ← 追加
```

### 1-3. `_execSpecial` (char_strike分岐)

```js
// 変更前
target.charHp = Math.max(0, target.charHp - dmg);

// 変更後
target.charHp = Math.max(0, target.charHp - dmg);
target.char.charHp = target.charHp;                 // ← 追加
```

### 1-4. `_execInstant` (volley分岐)

```js
// 変更前
d.soldiers = Math.max(0, d.soldiers - dmg);

// 変更後
d.soldiers = Math.max(0, d.soldiers - dmg);
d.char.soldiers = d.soldiers;                        // ← 追加
```

### 1-5. `applyRetreatRule`

```js
// 変更前
u.soldiers = Math.floor(u.soldiers * 0.5);
u.retreated = true;

// 変更後
u.soldiers = Math.floor(u.soldiers * 0.5);
u.char.soldiers = u.soldiers;                        // ← 追加
u.retreated = true;
```

---

## Step 2: BattleScene.jsx — onBattleEnd 修正

`onBattleEnd` コールバック全体を以下に差し替える。

### 変更前（現状）

```js
onBattleEnd: (wins) => {
  const e = engineRef.current;
  if (e) {
    [...e.playerSide, ...e.enemySide].forEach(u => {
      u.char.soldiers = u.soldiers;
      u.char.charHp   = Math.max(0, u.charHp);
      if (u.charHp <= 0 && !(u.char.penaltyTurns > 0)) u.char.penaltyTurns = 2;
    });
  }
  const usedIds    = rawAllies.map(c => c.id);
  const deadIds    = (e?.playerSide ?? []).filter(u => u.charHp <= 0).map(u => u.char.id);
  const deadMobIds = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])]
    .filter(u => u.charHp <= 0 && u.char._isMobInstance).map(u => u.char.id);
  const playerWins = wins;
  battleResultRef.current = {
    conquered:    wins,
    usedCharIds:  usedIds,
    deadCharIds:  deadIds,
    deadMobIds,
  };
  setWinner(playerWins ? 'player' : 'enemy');
  setPhase('battleend');
},
```

### 変更後

```js
onBattleEnd: (wins) => {
  const e = engineRef.current;

  // unit.char.* は Step1 で随時同期済み。char直接書き換えブロックは不要（BUG-C解消）

  const usedIds    = rawAllies.map(c => c.id);
  const deadIds    = (e?.playerSide ?? []).filter(u => u.charHp <= 0).map(u => u.char.id);
  const deadMobIds = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])]
    .filter(u => u.charHp <= 0 && u.char._isMobInstance).map(u => u.char.id);

  // unit.char.* が最新値なので、そこから unitResults を構築（BUG-B解消）
  const unitResults = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])].map(u => ({
    id:       u.char.id,
    soldiers: Math.max(0, u.char.soldiers),
    charHp:   Math.max(0, u.char.charHp),
  }));

  battleResultRef.current = {
    conquered:    wins,
    usedCharIds:  usedIds,
    deadCharIds:  deadIds,
    deadMobIds,
    unitResults,
  };
  setWinner(wins ? 'player' : 'enemy');
  setPhase('battleend');
},
```

---

## Step 3: App.jsx — 防衛戦 conquered 反転（BUG-A解消）

`defenseFlow.phase === 'battle'` の `onComplete`（L371付近）の2行のみ変更。

```js
// 変更前
conquered:       result?.conquered    ?? false,
winnerFactionId: result?.conquered
  ? item.attackerFactionId
  : playerFaction?.id,

// 変更後
conquered:       !(result?.conquered  ?? false),   // ← 反転
winnerFactionId: !(result?.conquered  ?? false)
  ? item.attackerFactionId
  : playerFaction?.id,                             // ← winnerFactionIdも連動
```

攻撃戦（`case 'battle'`）の `onComplete` は**変更しない**。

---

## 根拠（バグ一覧）

### BUG-A: 防衛戦 conquered 反転（致命）

`BattleEngineV3` は `mode:'attack'` 固定で生成される。
`wins = (!defAlive && atkAlive)` = 「敵全滅かつプレイヤー生存」= **プレイヤー視点の勝利**。
防衛戦でプレイヤーが守り切った場合 `wins=true` → `conquered=true` → 拠点が攻撃勢力に渡る。逆。

### BUG-B: unitResults 欠落 → SP/HP書き戻し不全（高）

旧 `onBattleEnd` に `unitResults` フィールドがなかった。
App.jsx で `result?.unitResults ?? []` → 常に `[]` → BATTLE_END reducer の charMap が空 → soldiers/charHp 書き戻しスキップ。

Step1 で `unit.char.*` が随時同期されるため、`unitResults` を `u.char.*` から構築すれば常に正しい値が取れる。

### BUG-C: penaltyTurns 二重書き換え（中）

旧 `onBattleEnd` 内の `u.char.soldiers = u.soldiers` ブロックは React state オブジェクトのミュータブル書き換えであり、Reactには無視される。かつ `_applyPenalty` と reducer の両方が `penaltyTurns` を書くという並走状態だった。

Step1 実装後は `unit.char.*` 同期がエンジン内で完結するため、`onBattleEnd` 内の char 直書きブロックは不要になり削除する。

---

## 完了条件

- [ ] `?qa=battlefull` で E10（penaltyTurns書き戻し）・E11（char書き戻し）がPASS
- [ ] 攻撃戦：制圧 → 拠点が自軍に移る
- [ ] 攻撃戦：敗北 → 拠点が変わらない
- [ ] 防衛戦：勝利 → 拠点が自軍のまま
- [ ] 防衛戦：敗北 → 拠点が攻撃側に移る
- [ ] 戦闘後にマップへ戻ったとき、出撃キャラのSP・HPが減っている
- [ ] penaltyTurns が戦闘不能キャラに正しくセットされ、次ターンのFormationSceneで出撃不可になっている
- [ ] 完了後このファイルを `docs/archive/` に移動
