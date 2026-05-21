# PROMPT: 本拠地陥落即エンディング + 放棄確認

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 概要

1. 本拠地制圧時に即エンディングへ遷移する（ターン進行を中断）
2. 防衛ADVで「放棄する」選択時に確認choiceを挟む

---

## 1. 本拠地陥落 → 即エンディング

### 原因

`handleNextTurn` のループが `battleEnd` の返り値（`phase`）をチェックしない。
`gamePhase` 変化は `useEffect` 経由のため非同期で、ループ完了後に `navigate('game_end')` が起動してしまう。

### 修正: `processDefenseQueue` / `processSingleDefense` でphaseを伝播

#### App.jsx: `launchDefenseADV` の abandon 分岐

```js
if (value === 'abandon') {
  game.actions.battleEnd({ ... conquered:true ... }).then((phase) => {
    if (phase === 'defeat' || phase === 'victory') {
      // gamePhaseのuseEffectに任せず即navigate
      navigate('game_end', {
        isVictory:       phase === 'victory',
        clearedCount:    0,
        currentTurn,
        playerBaseCount: playerBases.length,
        totalBaseCount:  bases.length,
      });
      return;  // onDone は呼ばない
    }
    onDone();
  });
}
```

#### App.jsx: `processDefenseQueue` をphase対応に変更

`processNext` に「中断フラグ」を持たせる。

```js
const processDefenseQueue = useCallback((queue) => {
  return new Promise((resolve) => {
    const processNext = (remaining) => {
      if (!remaining.length) { resolve(); return; }
      const [item, ...rest] = remaining;
      processSingleDefense(item, (phase) => {
        // phaseがあれば中断（game_end遷移はlaunchDefenseADV内で実施済み）
        if (phase === 'defeat' || phase === 'victory') {
          resolve('ended');  // handleNextTurnに伝える
          return;
        }
        processNext(rest);
      });
    };
    processNext(queue);
  });
}, [processSingleDefense]);
```

`processSingleDefense` の `onDone` コールバックに `phase` を引数として渡す：

```js
const processSingleDefense = useCallback((item, onDone) => {
  navigate('map', {
    focusBaseId: item.defenderBase?.id,
    _onReady: () => launchDefenseADVRef.current?.(item, onDone),
  });
}, [navigate]);
```

`launchDefenseADV` 側でも `onDone(phase)` として phase を渡す：

```js
// abandon分岐
game.actions.battleEnd({ ... }).then((phase) => {
  if (phase === 'defeat' || phase === 'victory') {
    navigate('game_end', { isVictory: phase === 'victory', ... });
    return;
  }
  onDone(phase ?? null);
});

// 戦闘完了後（FormationScene/_onDone経由）
// BattleScene の onComplete で phase を受け取り onDone に渡す処理も追加
```

#### App.jsx: `handleNextTurn` でループを中断

```js
for (const faction of enemyFactions) {
  await game.actions.runEnemyPhaseForFaction(faction.id);
  const factionQueue = (fullQueue ?? []).filter(q => q.attackerFactionId === faction.id);
  if (!factionQueue.length) continue;

  await new Promise((resolve) => {
    navigate('enemy_turn', { faction, attackQueue: factionQueue, _onComplete: resolve });
  });

  const result = await processDefenseQueue(factionQueue);
  if (result === 'ended') return;  // ← ゲーム終了時はループを抜けてターン進行しない
}
```

#### App.jsx: BattleScene完了後の phase チェック

FormationScene → BattleScene 完了後も same チェックを行う。
BattleScene の `onComplete(result)` から `battleEnd` を呼んでいる箇所で：

```js
// formation case の onComplete
const phase = await game.actions.battleEnd({ ... });
if (phase === 'defeat' || phase === 'victory') {
  navigate('game_end', { isVictory: phase === 'victory', ... });
  return;
}
sceneParams._onDone?.(phase ?? null);
```

---

## 2. 放棄確認choiceを挟む

### 修正: `launchDefenseADV` のシナリオに確認ステップを追加

「放棄する」を選んだとき即陥落ではなく、確認choiceを再度表示する。
ADVシナリオの choice ネストは現構造で対応できないため、
**choice._onChoice 内でシナリオを差し替えて再度 `setDefenseAdvParams`** する。

```js
// _onChoice の abandon 分岐
if (value === 'abandon') {
  // 確認ADVに差し替え
  setDefenseAdvParams({
    scenario: [
      {
        type: 'choice',
        text: `本当に ${defenderBase?.name ?? '拠点'} を放棄しますか？`,
        choices: [
          { label: 'はい、放棄する', value: 'confirm_abandon' },
          { label: 'いいえ、戻る',   value: 'back' },
        ],
      },
    ],
    _onChoice: (confirmValue) => {
      setDefenseAdvParams(null);
      if (confirmValue === 'confirm_abandon') {
        game.actions.battleEnd({ ... conquered:true ... }).then((phase) => {
          if (phase === 'defeat' || phase === 'victory') {
            navigate('game_end', { isVictory: phase === 'victory', ... });
            return;
          }
          onDone(phase ?? null);
        });
      } else {
        // 戻る → 最初のADVを再表示
        launchDefenseADVRef.current?.(item, onDone);
      }
    },
  });
  return;
}
```

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/App.jsx` | `launchDefenseADV` 内 abandon 分岐に phase チェックと確認choice追加、`processDefenseQueue` を中断対応に変更、`handleNextTurn` に `result === 'ended'` チェック追加、BattleScene完了後に phase チェック追加 |

---

## 確認

1. 本拠地が陥落したターン中に即 `game_end` 画面へ遷移すること
2. 「放棄する」選択後に「本当に放棄しますか？」確認choiceが表示されること
3. 確認で「いいえ」→ 最初の防衛選択ADVに戻ること
4. 確認で「はい」→ 本拠地なら即エンディング、通常拠点なら次のキューへ進むこと
5. 戦闘（FormationScene→BattleScene）で本拠地を失っても同様に即エンディングになること
