# PROMPT_P1_addendum_fix.md — P1 addendum 修正

> 種別: Code 引き継ぎ（修正）
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md`
> 前提プロンプト: `docs/prompts/PROMPT_P1_addendum.md`（完了済み、本書で2点修正）

---

## 0. 原則

- 内部温存原則、トークン import、指示範囲外を変えない
- ロジック側への変更禁止

---

## 1. 修正スコープ

### 1.1 NodePopup から「収入」行削除

`src/scenes/MapScene.jsx` の `NodePopup` 内、情報グリッド（おおむね line 261 周辺）から「収入」要素を削除。
残す表示: 「勢力」「種別」のみ。

修正前:
```js
[
  ['収入', `${node.income} M/T`, AC2],
  ['勢力', node.factionName, fc],
  ['種別', typeLabel, TX],
].map(...)
```

修正後:
```js
[
  ['勢力', node.factionName, fc],
  ['種別', typeLabel, TX],
].map(...)
```

`gridTemplateColumns:'1fr 1fr'` はそのまま使用可（2要素で2列）。
`AC2` import が他で使われていない場合の去就は Code 判断（参照ゼロなら削除可）。

### 1.2 App.jsx case 'base_menu' に背景 MapScene 追加

`src/App.jsx` の `case 'base_menu'`（line 362 周辺）を `case 'adv'`（line 684 周辺）と同じパターンに変更。
背景レイヤとして MapScene を描画し、その上に BaseMenuScene をオーバーレイ。

修正前:
```jsx
case 'base_menu':
  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'rgba(248,246,244,1)' }}>
      <BaseMenuScene
        node={sceneParams.node}
        ...
      />
    </div>
  );
```

修正後:
```jsx
case 'base_menu':
  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh' }}>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <MapScene
          onNavigate={() => {}}
          onAttackNode={() => {}}
          onNodeClick={() => {}}
          gameState={gameState}
          basesData={bases}
          factionsData={factions}
          conqueredThisTurn={game.conqueredThisTurn}
          onNextTurn={() => {}}
        />
      </div>
      <BaseMenuScene
        node={sceneParams.node}
        ...
      />
    </div>
  );
```

参考: `case 'adv'` の実装と同じ構造（背景MAP・pointerEvents:none・副作用 trigger 渡さない）。
`onReady` / `focusBaseId` 等は背景用途のため渡さない。

---

## 2. 範囲外

- BaseMenuScene 内部の実装変更（背景 transparent 設定は維持）
- MapScene 側の挙動変更
- NodePopup のレイアウト・スタイル変更（「収入」行削除のみ）
- App.jsx の他 case ブロックへの影響

---

## 3. 完了報告

§1.1 §1.2 の達成状態を報告。
