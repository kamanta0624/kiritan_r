# PROMPT: 防衛放棄後の進行詰まりバグ修正

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動
> 経緯: PROMPT_capital_defeat.md 実装後、防衛放棄で進行不能になった

---

## 原因

`processSingleDefense` と `launchDefenseADV` が両方 `navigate('map', { focusBaseId })` を呼ぶ。

```
processSingleDefense
  → navigate('map', { focusBaseId, _onReady: () => launchDefenseADV(item, onDone) })
  → MapScene useEffect([focusBaseId]) 発火 → onReady 呼ばれる
  → launchDefenseADV(item, onDone)
      → navigate('map', { focusBaseId })  ← ここで再度 sceneParams が更新される
      → MapScene useEffect([focusBaseId]) 再発火 → onReady が再度呼ばれる
      → launchDefenseADV が再度呼ばれる → 無限ループ / ADV上書き
```

また `launchDefenseADV` が `navigate('map', { focusBaseId })` を呼んでいるため、
`setDefenseAdvParams` で表示した ADVオーバーレイが `sceneParams` 更新によって
MapScene が再レンダリングされるたびに状態がリセットされることもある。

---

## 修正

### `launchDefenseADV` から `navigate('map', ...)` を削除

カメラ移動（focusBaseId）は `processSingleDefense` で1回だけ行う。
`launchDefenseADV` は `setDefenseAdvParams` だけを担当する。

```js
const launchDefenseADV = useCallback((item, onDone) => {
  const attackerFaction = factions.find(f => f.id === item.attackerFactionId);
  const defenderBase = item.defenderBase;

  const scenario = [...];  // 既存通り

  // navigate('map', ...) を削除 ← ここが修正点
  setDefenseAdvParams({
    scenario,
    _onChoice: (value) => { ... },
  });
}, [...]);
```

### `processSingleDefense` でカメラ移動 → 完了後に ADV 表示

```js
const processSingleDefense = useCallback((item, onDone) => {
  // focusBaseId がある場合のみカメラ移動を経由
  // ない場合は直接 ADV 表示
  const baseId = item.defenderBase?.id;
  if (baseId) {
    navigate('map', {
      focusBaseId: baseId,
      _onReady: () => launchDefenseADVRef.current?.(item, onDone),
    });
  } else {
    // focusBaseId なし → onReady が呼ばれないため直接 ADV 起動
    launchDefenseADVRef.current?.(item, onDone);
  }
}, [navigate]);
```

### MapScene の `useEffect([focusBaseId])` に重複発火ガードを追加

`onReady` が複数回呼ばれないように `useRef` で呼び出し済みフラグを管理する。

```js
// MapScene.jsx
const onReadyCalledRef = useRef(false);

useEffect(() => {
  onReadyCalledRef.current = false;  // focusBaseId が変わるたびにリセット
}, [focusBaseId]);

useEffect(() => {
  if (!focusBaseId || !liveNodes.length) return;
  const target = liveNodes.find(n => n.id === focusBaseId || n.baseId === focusBaseId);
  if (!target) { 
    if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
    return; 
  }
  const tx = Math.max(0, Math.min(target.px - vpSize.w / 2, MAP_W - vpSize.w));
  const ty = Math.max(0, Math.min(target.py - vpSize.h / 2, MAP_H - vpSize.h));
  setOffset({ x: tx, y: ty });
  const t = setTimeout(() => {
    if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
  }, 500);
  return () => clearTimeout(t);
}, [focusBaseId]);
```

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/App.jsx` | `launchDefenseADV` から `navigate('map', ...)` を削除 |
| `src/scenes/MapScene.jsx` | `onReady` 重複呼び出し防止ガード追加 |

---

## 確認

1. 防衛ADVで「放棄する」→ 確認「はい」→ 次のキューへ進む（詰まらない）
2. 防衛ADVで「放棄する」→ 確認「いいえ」→ 最初のADVに戻る
3. 同一 focusBaseId に対して `onReady` が1回だけ呼ばれること
