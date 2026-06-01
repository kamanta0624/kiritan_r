# 戦闘システム 追い修正プロンプト v4（実機2バグ — Chat静的調査済み）

前段: `PROMPT_battle_followup_v3.md`（実機6バグ・全修正済み）、`PROMPT_battle_followup_v2.md`（残1〜残5）、`KNOWLEDGE.md §9 / §14`。
本プロンプトは v3 完了後の実機観測2件を確定する。**P2 は v3-followup で「未完」と明記した残1（敵AI撤退濫択）が表面化したもの。**

## 厳守事項（再掲）
- 原因に推論を使わない。コード・データ根拠を示す。
- 撤退（retreat）= 戦闘即終了は仕様。`_doRetreat`→`_finish` 削除は禁止。
- 色直書き禁止（tokens.js import）。

---

## P1【確定】モブの現在値が最大値を上回る（HP 5/4・SP 22/21）

### 症状
ふくしま攻撃戦の敵モブ。フォーグ HP 5/4、SP 22/21。ドラン SP 20/21。現在HP/SP > 最大HP/SP（実機画像1）。

### コード根拠
`BuildingSystem.js` `createMobInstance` L150-153:
```js
soldiers:     vary(template.soldiers),
maxSoldiers:  vary(template.maxSoldiers),
charHp:       vary(template.charMaxHp),
charMaxHp:    vary(template.charMaxHp),
```
`vary(val)` L130-133 = `Math.max(1, Math.round(val * (1 + (Math.random()*2-1)*variance)))`。**呼ぶたび独立に乱数を引く。**
- `soldiers` と `maxSoldiers` は別 `vary()` 呼び出し → 独立乱数 → soldiers > maxSoldiers が成立（22 > 21）。
- `charHp` と `charMaxHp` は**同一ソース `template.charMaxHp`** を別 `vary()` で2回振る → charHp > charMaxHp が成立（5 > 4）。

### 正仕様
現在値 ≤ 最大値（常に成立）。モブ生成時は満タン想定（template に charHp フィールドは無く charMaxHp のみ）。

### 修正（createMobInstance）
最大値を1回だけ確定し、現在値はそれ以下に固定:
```js
const maxSol = vary(template.maxSoldiers);
const maxHp  = vary(template.charMaxHp);
// ...
soldiers:     Math.min(vary(template.soldiers), maxSol),
maxSoldiers:  maxSol,
charHp:       maxHp,   // 生成時は満タン（charHp は charMaxHp と同値）
charMaxHp:    maxHp,
```
- 検証: 生成モブの soldiers ≤ maxSoldiers、charHp === charMaxHp。実機で 5/4・22/21 が出ない。
- 注意: `runDomestic`（毎ターン補充）でも soldiers が maxSoldiers を超えないか併せて確認（補充ロジックが cap している場合は不要）。

---

## P2【確定・残1】軍団 retreatRule が敵AIに未結線 → 条件未達でも撤退

### 症状
ふくしま攻撃戦。敵軍団（納豆ファクトリー第一軍団）の撤退条件は「キャラ倒れたら撤退」（onDefend=char_dead、高崎=撤退しない）。だが敵キャラ全員生存中にモブ「ドラン」が撤退→戦闘終了→プレイヤー勝利（実機画像2・3）。

### コード根拠
- `BattleScene.jsx` processNext L1201: `const opts = _calcOptions(unit, eng.allowRetreat);`。`eng.allowRetreat` は dungeon/duel 判定の真偽のみ。**軍団 retreatRule を参照しない。**
- `BattleScene.jsx` `_calcOptions(unit, allowRetreat)` L33: 後衛近接は `['defend', ...retreatOpt]`。通常戦 `allowRetreat=true` → 'retreat' が常に options に入る。
- `BattleAI.selectAction(unit, options)` L48-54: 攻撃肢が無い場合 `options[Math.floor(Math.random()*options.length)]`。後衛近接モブ（ドラン/フォーグ）は options=`['defend','retreat']` → **約50%で retreat**。
- `BattleEngineV3._doRetreat`: retreat = `_finish` で戦闘即終了（仕様どおり）。敵が撤退すると攻撃側プレイヤー勝利。
- → 軍団の char_dead / never（高崎）が一切効いていない。v2 残1（`applyRetreatRule`/retreatRule 未結線）の本体。`LegionAI.getRetreatRule(legionId, baseId, mode)` は実装済みだが呼び出し0件。

### 正仕様
`KNOWLEDGE.md §9-1`: 撤退の終了は仕様。バグは「AIが条件未達で安易に撤退を選ぶ」こと。retreatRule（char_dead/never/loss_50/loss_25/hp_any）を戦闘エンジンに結線し、条件成立時のみ 'retreat' を選択肢に含める。

### 修正方針（残1 本実装・v2 §残1 を踏襲）

**Step 1: `LegionAI.js` に `getDefendersWithRule(factionId, base, allCharacters)` 追加**
既存 `getDefenders` のロジックで chars を解決しつつ、採用した軍団（拠点指定軍団 or reserve）の retreatRule を `getRetreatRule(legion.id, base.id, 'defense')` で解決し `{ chars, retreatRule }` を返す。
- 拠点指定軍団採用時: その legion.id。
- reserve 採用時: reserve.id（reserve の `retreatRule.onDefend` 等）。
- 空配列（buildDefaultEnemies 経路）時: `retreatRule = 'char_dead'` fallback。

**Step 2: `App.jsx` `case 'battle'`（L401付近）で `getDefendersWithRule` に切替**
```js
const { chars: enemyChars, retreatRule: enemyRetreatRule } =
  legionAI.getDefendersWithRule(enemyFactionId, targetBase, characters);
```
`<BattleScene … enemyRetreatRule={enemyRetreatRule} />` を渡す。
- 防衛戦（defenseFlow・App L275）にも同様に渡す（プレイヤー攻撃時の敵=AI側の retreatRule）。防衛戦の敵=攻撃側軍団なので `getRetreatRule(legionId, baseId, 'attack')`（onAttack）を使う点に注意。経路ごとに mode を正す。

**Step 3: `BattleScene.jsx` BattleFlow が `enemyRetreatRule` prop を受け取り `_calcOptions` に渡す**
```js
export default function BattleFlow({ …, enemyRetreatRule = 'char_dead' }) { … }
```
`_calcOptions` を retreatRule 対応に拡張（プレイヤー側はUI選択なので影響なし。敵のみ gate）:
```js
function _calcOptions(unit, allowRetreat, retreatRule, eng) {
  const isFront  = unit.position === 'front';
  const aType    = unit.char?.attackType;
  const isRanged = aType === 'ranged';
  const isSong   = aType === 'song';

  const canRetreat = () => {
    if (!allowRetreat) return false;          // dungeon/duel
    if (!retreatRule || retreatRule === 'hp_any') return true;
    if (retreatRule === 'never') return false; // 高崎 base_071 等
    // char_dead / loss_50 / loss_25: 味方(=同サイド)に戦闘不能が出たら許可（v2準拠の簡易判定）
    return (eng?.enemySide ?? []).some(u => u.charHp <= 0);
  };
  const retreatOpt = canRetreat() ? ['retreat'] : [];
  if (!isFront && !isRanged && !isSong) return ['defend', ...retreatOpt];
  const atk = isSong ? 'song' : isRanged ? 'ranged' : 'attack';
  return [atk, 'defend', ...retreatOpt];
}
```
processNext 呼び出し L1201:
```js
const opts = _calcOptions(unit, eng.allowRetreat, enemyRetreatRule, eng);
```
- `eng.enemySide` は敵AI側ユニット集合（このコンポーネントでは敵= enemySide）。retreatRule の判定対象が「撤退を検討している軍団自身の損耗」になるよう、判定対象サイドを確認（敵ユニットの行動なので敵サイドの charHp<=0 を見る）。
- loss_50/loss_25 を厳密にやるなら `eng._lossRatio` 相当が必要。初期実装は char_dead と同条件でよい（v2 §残1 と同じ簡易版）。バランス厳密化は後続。

### 検証
- ふくしま攻撃戦: 敵キャラ全員生存中はモブ/キャラが retreat を選ばない（char_dead 未成立）。
- 高崎(base_071) 防衛軍団: 敵が一切撤退しない（never）。
- 敵キャラが1体戦闘不能になった後は char_dead 成立で撤退が選択肢に復帰。
- プレイヤー側の撤退（手動）は従来どおり（_calcOptions はプレイヤーに不使用）。

---

## 着手順
1. P1（createMobInstance の現在値≤最大値）— 局所・低リスク。
2. P2（残1 retreatRule 結線: getDefendersWithRule → enemyRetreatRule prop → _calcOptions gate）。
3. 完了後、v1/v2/v3-followup/本プロンプト・`PROMPT_battle_bugs_v3.md` を `docs/archive/` へ移動。KNOWLEDGE の参照先更新。残1 クローズを KNOWLEDGE §9-1 に追記。

1コミット1観点。コミットメッセージに P1/P2 を明記。
