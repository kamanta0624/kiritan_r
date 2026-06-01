# 戦闘システム 追い修正プロンプト v2（PROMPT_battle_followup_v1.md 続き）

前段: `PROMPT_battle_followup_v1.md`（残1〜残5定義）、`KNOWLEDGE.md §9-1 / §14-1 / §18` 参照。
本プロンプトは残1の実装方針を確定し、残2〜残3も着手要件をまとめる。

---

## 厳守事項（再掲）

- 撤退（retreat）= 戦闘即終了は仕様。`_doRetreat`→`_finish` を消す提案は仕様違反。禁止。
- 原因に推論を使わない。コード・データ根拠を示すこと。
- ハードリロード解決策と結論づけたら調査結果まとめて停止。

---

## 残1【最優先】戦闘AI 撤退濫択是正

### コード根拠（調査済み）

| ファイル | 行 | 内容 |
|---|---|---|
| `BattleScene.jsx` | L39-43 | `_calcOptions`: rear+melee → `['defend','retreat']`。retreatRuleを参照しない |
| `BattleAI.js` | L51-56 | `selectAction`: 攻撃肢なければ全optionsからランダム → retreat 50%で選ばれる |
| `App.jsx` | L401-403 | `legionAI.getDefenders()` でenemyCharsを取得するがretreatRuleをBattleSceneに渡さない |
| `LegionAI.js` | L130-153 | `getDefenders`: legionを特定してcharsを返すが戻り値はchars配列のみ |
| `LegionAI.js` | L157-171 | `getRetreatRule(legionId, baseId, mode)`: retreatRuleを正しく解決するが呼び出し0件 |

### 修正方針

**Step 1: `LegionAI.js` に `getDefendersWithRule(factionId, base, allCharacters)` を追加**

既存 `getDefenders` のロジックをコピーし、戻り値を `{ chars, retreatRule }` に変更。
retreatRuleは以下で解決:

```js
// 拠点指定軍団が見つかった場合
retreatRule = this.getRetreatRule(legion.id, base.id, 'defense');
// reserve軍団の場合
retreatRule = this.getRetreatRule(reserve.id, base.id, 'defense');
// fallback（空配列の場合）
retreatRule = 'char_dead';
```

**Step 2: `App.jsx` の `enemyChars` 取得を `getDefendersWithRule` に切り替え（3箇所）**

1. `case 'formation'` (L355-360): legionAI経由のenemyChars構築
2. `case 'battle'` (L400-403): legionAI経由のenemyChars構築
3. `defenseFlow.phase === 'formation'` (L234-241): 防衛編成のenemyChars構築

取得した `retreatRule` を `<BattleScene>` / `<AttackFormationScene>` に `enemyRetreatRule={retreatRule}` propで渡す。

**Step 3: `BattleScene.jsx` で `enemyRetreatRule` propを受け取り `_calcOptions` に渡す**

```jsx
// BattleFlow の props に追加
export default function BattleFlow({ ..., enemyRetreatRule = 'char_dead' })
```

`_calcOptions` シグネチャ変更:

```js
function _calcOptions(unit, retreatRule, eng) {
  const isFront  = unit.position === 'front';
  const aType    = unit.char?.attackType;
  const isRanged = aType === 'ranged';
  const isSong   = aType === 'song';

  function canRetreat() {
    if (!retreatRule || retreatRule === 'hp_any') return true;
    if (retreatRule === 'never') return false;
    if (retreatRule === 'char_dead') {
      return (eng?.enemySide ?? []).some(u => u.charHp <= 0);
    }
    if (retreatRule === 'loss_50' || retreatRule === 'loss_25') {
      return (eng?.enemySide ?? []).some(u => u.charHp <= 0);
    }
    return true;
  }

  const retreat = canRetreat() ? ['retreat'] : [];
  if (!isFront && !isRanged && !isSong) return ['defend', ...retreat];
  const atk = isSong ? 'song' : isRanged ? 'ranged' : 'attack';
  return [atk, 'defend', ...retreat];
}
```

呼び出し側（L1204付近、AI行動決定部）:

```js
const opts = _calcOptions(unit, enemyRetreatRule, eng);
```

`eng` は `engineRef.current`（useEffect内初期化後なので常に存在）。
プレイヤー側は `_calcOptions` を使わない（UIから選ぶ）ので副作用なし。

### 検証方法

- QA: `http://localhost:5174/?qa=battlefull`
- 会津/郡山戦で即勝利が消えること（敵がchar_dead条件を満たすまで撤退しない）
- `legion_red_01` の `onDefendBase.base_071: "never"` 拠点で敵が一切撤退しないこと

---

## 残2 BUG-C副作用（敵将軍攻撃力誤り）

### コード根拠

`BattleScene.jsx` L1226-1227（enemyUnits構築）:

```js
charAttack: e.atk, soldierAtk: e.atk,
```

`normalizeChar` (L55): `atk: c.soldierAtk ?? c.charAttack ?? 10`

→ `normalizeChar` が `soldierAtk` 優先で解決するため `e.atk` は soldierAtk 相当。
`charAttack: e.atk` に soldierAtk が入り、将軍本体攻撃力が soldierAtk に化ける。

### 修正

`normalizeChar` の戻り値に `charAttack` を独立フィールドで保持:

```js
function normalizeChar(c, idx) {
  return {
    id:c.id, name:c.name, position: idx < 2 ? 'front' : 'rear',
    atk: c.soldierAtk ?? c.charAttack ?? 10,
    charAttack: c.charAttack ?? 20,
    def: c.soldierDef ?? 8,
    meme:c.soldiers??500, max:c.maxSoldiers??c.soldiers??500, memeMax:c.maxSoldiers??c.soldiers??500,
    hp:c.charHp??200, hpMax:c.charMaxHp??200, portrait:c.portrait??null, _raw:c, status:idx===0?'active':'pending',
  };
}
```

enemyUnits L1226-1227:

```js
charAttack: e.charAttack,
soldierAtk: e.atk,
```

---

## 残3 ハードコーディング解消

### コード根拠

`BattleScene.jsx` L1222-1232（enemyUnits構築）:

```js
charHp: 10, charMaxHp: 10, attackCount: 8,
```

`normalizeChar` L57: `hp: c.charHp ?? 200`, `hpMax: c.charMaxHp ?? 200`

### 修正（enemyUnits 構築部）

```js
charHp: e.hp,
charMaxHp: e.hpMax,
attackCount: e._raw?.attackCount ?? 8,
```

色直書き（L8-13）→ `tokens.js` import は影響範囲広いため別対応可。

---

## 着手順

残1（getDefendersWithRule + _calcOptions修正）→ 残2（charAttack独立化）→ 残3（HP実値化）→ 残4/残5（調査）

完了後、`PROMPT_battle_followup_v1.md` と本プロンプトを `docs/archive/` へ移動。
