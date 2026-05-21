# BUG-008: BattleScene FALLBACK_ENEMIES 除去

## 対象ファイル
`src/App.jsx`（1ファイルのみ）

## 現状

`case 'battle':` で敵キャラをこう組み立てている：

```js
const enemyChars = enemyFactionId
  ? characters.filter(c =>
      c.factionId === enemyFactionId &&
      !(c.penaltyTurns > 0) &&
      (c.soldiers ?? 0) > 0
    ).slice(0, 4)
  : [];
```

問題：
1. 攻撃戦で `legionAI.getDefenders()` を使っていない（レギオン情報を無視）
2. 防衛戦で攻撃者キャラが `enemyChars` に入っていない

## 修正

`case 'battle':` の `enemyChars` 組み立て部分を以下に置き換える：

```js
const isDefense = sceneParams.mode === 'defense';
const targetBase = sceneParams.defenderBase ?? sceneParams.targetNode;
const enemyFactionId = targetBase?.factionId;

let enemyChars = [];
if (!isDefense && enemyFactionId && legionAI) {
  // 攻撃戦: LegionAI のレギオン情報から防衛キャラを取得
  enemyChars = legionAI.getDefenders(enemyFactionId, targetBase, characters).slice(0, 4);
} else if (isDefense) {
  // 防衛戦: attackerCharIds からキャラを引く
  const attackerIds = sceneParams.attackerCharIds ?? [];
  enemyChars = attackerIds.length > 0
    ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
    : characters.filter(c =>
        c.factionId === enemyFactionId &&
        !(c.penaltyTurns > 0) &&
        (c.soldiers ?? 0) > 0
      ).slice(0, 4);
}
```

`legionAI` は `useGame()` の展開から取得する。
`game` オブジェクトに含まれているか確認し、なければ `game.systems` 経由で取得する。

`LegionAI.getDefenders` のシグネチャ:
```js
getDefenders(defenderFactionId: string, defenderBase: { id: string, ... }, allCharacters: array): array
```

## 動作確認

1. マップ上で敵拠点を攻撃 → 編成 → 戦闘開始
2. 敵軍に「○○の兵1」などのFALLBACKキャラではなく実キャラ名が表示されること
3. `?qa=battle` は `enemyChars=[]` のまま → `buildDefaultEnemies` が動くこと（壊さない）

## 注意
- `BattleScene.jsx` の `buildDefaultEnemies` は削除しない（QAシーンで使用）
- 修正後、KNOWLEDGE.md の BUG-008 を「解決済み」に更新すること
