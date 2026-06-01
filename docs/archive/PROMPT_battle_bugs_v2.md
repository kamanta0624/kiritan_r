# 戦闘バグ調査 引き継ぎプロンプト v2

## BUG-A: 撤退時 loss_50ログ・兵士減少

### 結論
仕様外バグ。KNOWLEDGE.md §9-1に撤退時SP減少の記述なし。

### 修正箇所
`BattleScene.jsx` `onRoundEnd`:
```js
// 削除する1行
eng.applyRetreatRule('loss_50', eng.enemySide);
```

---

## BUG-B: 戦闘開始直後にSP=0/HP=0のユニットがアニメーション表示される

### 再現条件
- 2ターン目に郡山を攻撃
- 編成画面で中部つるぎSP=100と表示
- 戦闘開始直後のBattleAnimOverlayでつるぎSP=0/HP=0

### 調査済み事項（コードベース）

**enemyUnitsは正しく初期化されているか**:
`BattleScene.jsx` L1219〜1233:
```js
const enemyUnits = initEnemies.map((e, i) => ({
  char: { ..., soldiers: e.meme, charHp: 10, ... },
  soldiers: e.meme, charHp: 10, ...
}));
```
`e.meme = c.soldiers = 100`。初期値は正しいはず。

**BattleAnimOverlayのenemySP初期値**:
```js
const enemySolBefore = allyIsAttacker ? defSolBefore : atkSolBefore;
const [enemySP] = useState(enemySolBefore);
```
`defSolBefore`は`_resolveExchange`内で`def.soldiers`変更前に取得した数値コピー。

**未解明点**: `defSolBefore`が0になる経路がコードから特定できなかった。
ブレークポイントで以下を確認すること:
1. `_resolveExchange`開始時の`def.soldiers`の値
2. `onExchangeResult`コールバックに渡る`result.defSolBefore`の値
3. `BattleAnimOverlay`に渡る`anim.defSolBefore`の値

---

## BUG-C: SPダメージが理論値と乖離（soldierAtkにcharAttackが使われる）

### 根本原因（コード確定）

`BattleScene.jsx` `normalizeChar` L54:
```js
atk: c.charAttack ?? c.soldierAtk ?? 10,
```

`enemyUnits`生成 L1224:
```js
soldierAtk: e.atk,   // ← e.atk = c.charAttack（将軍本体攻撃力）が入る
```

実キャラの`charAttack`（将軍本体攻撃力）が`soldierAtk`（SP攻撃力）として使われる。

| キャラ | charAttack | soldierAtk（正） | enemyUnitsに設定される値 |
|--------|-----------|----------------|----------------------|
| 中部つるぎ | 21 | 8 | **21** |
| 沖縄あわも | 70 | 7 | **70** |
| 大江戸ちゃんこ | 10 | 7 | **10**（偶然一致） |
| 関西しのび | 10 | 8 | **10** |

### 修正箇所
`BattleScene.jsx` `normalizeChar` L54:
```js
// 変更前
atk: c.charAttack ?? c.soldierAtk ?? 10,

// 変更後
atk: c.soldierAtk ?? c.charAttack ?? 10,
```

### 影響範囲
実キャラ（characters.json）がenemyCharsとして渡る全戦闘（攻撃戦・防衛戦）。
BattleFullQASceneはインラインTEST_CHARSを使うため影響なし。
