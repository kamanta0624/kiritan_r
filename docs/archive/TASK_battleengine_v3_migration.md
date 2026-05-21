# TASK: BattleEngineV3 移植（旧kiritan版 → kiritan_r版）

## 概要

旧kiritan（Phaser版）の `BattleEngineV3.js` をkiritan_r（React版）に移植する。
kiritan_r側の現行 `BattleEngineV3.js` は旧版の劣化コピーであり、
以下の機能が欠落している。これを旧版から移植することで復元する。

---

## 移植元・移植先

| | パス |
|--|--|
| 移植元（正） | `/Users/kamatashintarou/MCP_Learning/kiritan/src/systems/BattleEngineV3.js` |
| 移植先（現行・要置換） | `/Users/kamatashintarou/MCP_Learning/kiritan_r/src/game/systems/BattleEngineV3.js` |

**移植元ファイルをそのままコピーしてはいけない。** importパスを kiritan_r の構成に合わせる必要がある（後述）。

---

## importパスの変換

移植元のimport:
```js
import { resolveBonus } from '../utils/BattleBonus.js';
import skillsData from '../data/skills.json';
```

移植先での正しいパス（kiritan_r の構成）:
```js
import { resolveBonus } from '../utils/BattleBonus.js';
import skillsData from '../data/skills.json';
```

kiritan_r での `BattleEngineV3.js` の配置場所は
`src/game/systems/BattleEngineV3.js` なので、
`../utils/BattleBonus.js` = `src/game/utils/BattleBonus.js` ✅
`../data/skills.json`     = `src/game/data/skills.json`     ✅

両ファイルとも存在確認済み。パスの変更は不要。

---

## kiritan_r 側の skills.json の差分対応

移植元が参照する `skills.json` には `trigger` フィールド（`"instant"` / `"charge"`）がある。
kiritan_r の現行 `skills.json` にはこのフィールドがない。

以下の内容で `src/game/data/skills.json` を上書きする：

```json
{
  "skills": [
    {
      "id": "rally",
      "name": "鼓舞",
      "description": "味方全体の攻撃力を1ターン +20%",
      "trigger": "instant",
      "assignTo": "leader"
    },
    {
      "id": "pierce",
      "name": "看破",
      "description": "相手の防御を無視して攻撃",
      "trigger": "instant",
      "assignTo": "attacker"
    },
    {
      "id": "fortress",
      "name": "鉄壁",
      "description": "このターンの被SP/HPダメージを無効化",
      "trigger": "instant",
      "assignTo": "guardian"
    },
    {
      "id": "volley",
      "name": "乱撃",
      "description": "相手全体に通常の50%ダメージ（反撃なし）",
      "trigger": "instant",
      "assignTo": "commander"
    },
    {
      "id": "special_sp",
      "name": "必殺（SP撃）",
      "description": "集中後に発動。相手の残存SP数分の攻撃（反撃なし）",
      "trigger": "charge",
      "specialType": "sp_strike",
      "assignTo": "attacker"
    },
    {
      "id": "special_char",
      "name": "必殺（本体撃）",
      "description": "集中後に発動。ミームを無視して相手本体にattackCount回攻撃（反撃なし）",
      "trigger": "charge",
      "specialType": "char_strike",
      "assignTo": "attacker"
    }
  ]
}
```

---

## BattleScene.jsx への影響（最小限の修正が必要）

移植後、`BattleEngineV3` のコンストラクタが新しい opts を受け取るようになる。
`src/scenes/BattleScene.jsx` の `new BattleEngineV3({...})` 呼び出し箇所を以下に更新する：

```js
engineRef.current = new BattleEngineV3({
  playerSide:     playerUnits,
  enemySide:      enemyUnits,
  mode:           'attack',
  battleCapacity: BATTLE_CAP,
  battleMode:     'normal',       // 追加
  allowRetreat:   true,           // 追加
  onBattleEnd: (wins) => { setBattleOver(true); setAttackerWins(wins); },
  onLog:        () => {},
  onCardUpdate: () => {},
  onShake:      () => {},
  onPopup:      () => {},
  delayedCall:  (ms, fn) => setTimeout(fn, ms),
});
```

`onRoundEnd` は移植後のエンジンに存在しないため削除してよい。

---

## 移植後に不要になるコード（BattleScene.jsx内）

現行kiritan_r版の `BattleEngineV3` には `_split` 関数（外部関数）がある。
移植後のエンジンでは `_splitHits` に改名・統合されているため、
BattleScene.jsx 側に `_split` を直接呼ぶコードがあれば削除する（現状はない）。

---

## 動作確認手順

1. `http://localhost:5174/?qa=battle` を開く
2. コンソールエラーがないこと（特に `skills.json` のimportエラー）
3. ラウンド1〜5を正常に進行できること（BUG-004修正との競合なし）
4. 撤退を選んだとき即戦闘終了すること
5. 防御コマンドが正常に機能すること（被ダメ減少）

---

## 注意

- `BattleEngineV2.js`（kiritan_r側に存在する場合）は触らない
- `BattleAI.js` は変更不要。`selectAction` のオプションに `'skill'`/`'focus'`/`'special'` を追加するかどうかは今回のスコープ外
- 移植完了後、`KNOWLEDGE.md` の「10. BattleEngineV3 仕様要点」セクションを旧kiritan版の内容に合わせて更新すること
