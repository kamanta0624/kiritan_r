# BattleAnimOverlay SP/HP 初期値バグ修正

> 優先度: 高
> 変更ファイル: 2つのみ

---

## バグの説明

戦闘アニメーション画面（BattleAnimOverlay）のcountsフェーズ（「クリックでダメージ解決」表示中）で、
自軍の部下数が既に0になっている。

### 原因

`_resolveExchange` の処理順：

1. ダメージ計算
2. **ダメージ適用**（`atk.soldiers` / `def.soldiers` / `charHp` を書き換え）
3. `_onExchangeResult(atk, def, result)` を呼ぶ

`onExchangeResult` コールバックで `animState = { attacker: atk, defender: def, ... }` をセット。
`BattleAnimOverlay` マウント時に `useState(attacker.soldiers)` → **ダメージ後の値で初期化される**。

さらに、countsフェーズでクリックすると `setAllySP(v => v - allySPdmg)` が走るため、
ダメージが二重適用される。

### あるべき動作

- countsフェーズ: ダメージ**前**のSP/HPを表示
- damagesフェーズ（クリック後）: ダメージ量を差し引いて表示

---

## 修正内容

### Step 1: BattleEngineV3.js — ダメージ前スナップショットを _onExchangeResult に渡す

`_resolveExchange` 内でダメージ適用前の値を保存し、resultに追加する。

```js
// ダメージ適用前（既存コードの直前）に追加
const atkSolBefore = atk.soldiers;
const defSolBefore = def.soldiers;
const atkHpBefore  = atk.charHp;
const defHpBefore  = def.charHp;

// （既存のダメージ適用コードはそのまま）
def.soldiers      = Math.max(0, def.soldiers - atkMem);
def.char.soldiers = def.soldiers;
atk.soldiers      = Math.max(0, atk.soldiers - defMem);
atk.char.soldiers = atk.soldiers;
// ...
atk.charHp      = newAtkHp;
atk.char.charHp = atk.charHp;
def.charHp      = newDefHp;
def.char.charHp = def.charHp;

// _onExchangeResult の呼び出し箇所を変更
this._onExchangeResult(atk, def, {
  atkMem, atkChr, defMem, defChr,
  N:  ar.N,
  Nr: dr ? dr.N : 0,
  atkSolBefore,   // ← 追加
  defSolBefore,   // ← 追加
  atkHpBefore,    // ← 追加
  defHpBefore,    // ← 追加
});
```

変更箇所は `_resolveExchange` の末尾付近（`this._onExchangeResult` の呼び出し1箇所と、その直前への4行追加）のみ。

---

### Step 2: BattleScene.jsx — animState に before 値を含める

`onExchangeResult` コールバック内の `state` 組み立てを変更する。

```js
onExchangeResult: (atk, def, result) => {
  const isPlayerUnit = playerUnits.some(u => u.char.id === atk.char.id);
  const state = {
    attacker:    atk,
    defender:    def,
    atkMem:      result.atkMem,
    atkChr:      result.atkChr,
    defMem:      result.defMem,
    defChr:      result.defChr,
    N:           result.N,
    Nr:          result.Nr,
    // ← 以下4行追加
    atkSolBefore: result.atkSolBefore,
    defSolBefore: result.defSolBefore,
    atkHpBefore:  result.atkHpBefore,
    defHpBefore:  result.defHpBefore,
    actionLabel: ATK_LABEL[atk.action] ?? atk.action,
    attackType:  atk.char.attackType,
    attackerSide: isPlayerUnit ? 'player' : 'enemy',
  };
  animStateRef.current = state;
  setAnimState(state);
},
```

---

### Step 3: BattleAnimOverlay — before 値で useState を初期化

`BattleAnimOverlay` の props 分解と useState 初期化を変更する。

```js
function BattleAnimOverlay({ anim, onContinue }) {
  const {
    attacker, defender,
    atkMem, atkChr, defMem, defChr,
    N, Nr, actionLabel, attackType='melee', attackerSide='player',
    atkSolBefore, defSolBefore, atkHpBefore, defHpBefore,  // ← 追加
  } = anim;

  // allyIsAttacker の判定はそのまま
  const allyIsAttacker = attackerSide === 'player';
  const allyUnit  = allyIsAttacker ? attacker : defender;
  const enemyUnit = allyIsAttacker ? defender : attacker;

  // before 値から ally/enemy を振り分け
  const allySolBefore  = allyIsAttacker ? atkSolBefore : defSolBefore;
  const allyHpBefore   = allyIsAttacker ? atkHpBefore  : defHpBefore;
  const enemySolBefore = allyIsAttacker ? defSolBefore : atkSolBefore;
  const enemyHpBefore  = allyIsAttacker ? defHpBefore  : atkHpBefore;

  // useState をダメージ前の値で初期化
  const [allySP,  setAllySP]  = useState(allySolBefore);   // 変更前: attacker.soldiers
  const [allyHP,  setAllyHP]  = useState(allyHpBefore);    // 変更前: attacker.charHp
  const [enemySP, setEnemySP] = useState(enemySolBefore);  // 変更前: defender.soldiers
  const [enemyHP, setEnemyHP] = useState(enemyHpBefore);   // 変更前: defender.charHp
  // 以降は変更なし
```

---

## 完了条件

- countsフェーズ（クリック前）で自軍部下数がダメージ前の値（例: 100/100）で表示される
- クリック後のdamagesフェーズでダメージ量分だけ減少した値が表示される
- 二重適用がないこと（クリック後の値 = 初期値 - ダメージ量）
- Battlefield復帰後のSP/HPはエンジン値と一致すること（syncDisplay経由で更新される）
- 完了後このファイルを `docs/archive/` に移動
