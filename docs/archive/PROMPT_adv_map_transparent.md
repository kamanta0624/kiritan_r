# PROMPT_adv_map_transparent

## 目的
ADVパートの背景黒（`#0a0610`）を排除。bg画像を設定せずとも背後にMAPが透けて見える状態にする。

## 確定事実（コード根拠・推論なし）

### 1. ADVScene は transparent 対応済み
`src/scenes/ADVScene.jsx` Main `ADVScene`：
- ルート要素 `background: transparent ? 'transparent' : '#0a0610'`
- BG描画 `{bg && !transparent && (...)}` → transparent時スキップ
- BG dim overlay `{!transparent && <div .../>}` → transparent時スキップ
- DialogBox は transparent時 全幅下部バー表示

`transparent` の解決：
```
const transparent = transparentProp ?? meta.transparent ?? false;
```
→ プロップ未伝達かつ script.meta.transparent 未設定で `false` → 黒背景。

### 2. App.jsx adv ケースが transparent 非伝達（L684-689）
```jsx
case 'adv':
  return <ADVScene
    key={sceneParams.dialogId ?? 'adv'}
    script={sceneParams.script ?? []}
    effects={sceneParams.effects ?? null}
    onExit={sceneParams.onExit ?? (() => navigate('map'))}
  />;
```

### 3. renderScene は switch 単一 return（排他描画）
`case 'adv'` 時 MapScene はアンマウント。透過しても背後にMAPが存在しない。
→ transparent 化だけでは「ブラウザ地」が見えるだけ。**背後にMAPを残す描画が別途必要。**

## 対処（2点・最小スコープ）

### 変更A: adv ケースで背後にMAPを残し、透過ADVを重ねる
`src/App.jsx` `case 'adv'` を以下へ置換。

**before:**
```jsx
      case 'adv':
        return <ADVScene
          key={sceneParams.dialogId ?? 'adv'}
          script={sceneParams.script ?? []}
          effects={sceneParams.effects ?? null}
          onExit={sceneParams.onExit ?? (() => navigate('map'))}
        />;
```

**after:**
```jsx
      case 'adv':
        return (
          <div style={{ position:'relative', width:'100vw', height:'100vh' }}>
            {/* 背景レイヤ: MAPを表示専用で残す。pointer-events:none で操作貫通を物理遮断。
                onReady 等の副作用トリガは渡さない（背景用途のため発火させない）。 */}
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
            <ADVScene
              key={sceneParams.dialogId ?? 'adv'}
              script={sceneParams.script ?? []}
              effects={sceneParams.effects ?? null}
              transparent={sceneParams.transparent ?? true}
              onExit={sceneParams.onExit ?? (() => navigate('map'))}
            />
          </div>
        );
```

注記：
- 背景MapScene の props は同 `renderScene` スコープの map ケース（L342-)で使用中の変数をそのまま流用。`focusBaseId`/`focusKey`/`onReady` は背景用途のため意図的に省略。
- `transparent={sceneParams.transparent ?? true}` で既定透過。非透過にしたい呼び出しは `navigate('adv', { transparent:false, ... })`。

### 変更B: なし
ADVScene 側は改修不要（transparent 経路は既に実装済み）。色直書きも増やさない。

## 禁止/留意
- デザイントークン規約維持。色直書き追加禁止（上記 diff に新規カラー無し）。
- 背景MapScene は必ず `pointerEvents:'none'` ラッパ内。adv 中のMAP誤操作を遮断。
- MapScene に副作用系コールバック（onReady 等）を渡さないこと。背景の二重副作用を防ぐ。

## 完了後
このプロンプトを `docs/archive/` へ移動。KNOWLEDGE.md のADV/シーン描画記述を実装状態に同期。
