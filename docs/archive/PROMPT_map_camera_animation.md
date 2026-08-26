# PROMPT: MapScene カメラ移動アニメーション

## 前提

`PROMPT_map_scene_persistent_layer.md`（archive済）が実装完了しており、MapScene は App.jsx
トップレベルの常時レイヤとして描画されている。scene ∈ {map, base_menu, adv} 間で
unmount されない構造。よって同一 MapScene インスタンスの `transform` 変化に対して
CSS transition を適用可能。

## 要件

拠点をクリックした瞬間、**クリック元の座標から、その拠点を画面中央に収める座標まで、
スッと補間しながら移動する**。現状は瞬間ジャンプ。

## 原因（コード根拠）

`src/scenes/MapScene.jsx` L578-579 の Draggable map div:
```jsx
<div style={{position:'absolute',
  transform:`translate(${-offset.x}px,${-offset.y}px)`,
```
`transition` プロパティなし → offset 変化が瞬間反映される。

L432-446 の focusBaseId useEffect が `setOffset({ x: tx, y: ty })` で目的地を代入するが、
CSS transition がないため補間なし。

## setOffset 呼び出し全経路（要把握）

1. **L422**: useState 初期値（仙台）
2. **L442**: focusBaseId useEffect 内 → 拠点フォーカス（**アニメーションさせたい**）
3. **L504**: onPointerMove 内 → 手動ドラッグ（**瞬間追従のまま**）
4. **L598**: MiniMap `onSeek` prop 経由 → ミニマップクリック・シークドラッグ（**瞬間移動のまま**）

MiniMap の `start` (L316付近) は `e.stopPropagation()` で親ビューポートの onPointerDown
発火を遮断している。よってミニマップ操作時は onPointerDown 経由の `setIsAnimating(false)`
が発火しない。**ミニマップ経路で明示的に `setIsAnimating(false)` を挟む必要がある。**

## 修正指示

**触るファイル: `src/scenes/MapScene.jsx` のみ。App.jsx は変更禁止。**

### 修正1: isAnimating state 追加（L422 と L423 の間に1行）

現行 L422-423:
```js
  const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
  const dragRef = useRef(null);
```

修正後（L423 に1行挿入）:
```js
  const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
  const [isAnimating, setIsAnimating] = useState(false);
  const dragRef = useRef(null);
```

### 修正2: focusBaseId useEffect にアニメーションフラグ追加（L432-446）

現行 L432-446:
```js
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
  }, [focusBaseId, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

修正後: `setIsAnimating(true)` を setOffset 直前に、`setIsAnimating(false)` を setTimeout 内の
onReady 呼び出し前に追加。
```js
  useEffect(() => {
    if (!focusBaseId || !liveNodes.length) return;
    const target = liveNodes.find(n => n.id === focusBaseId || n.baseId === focusBaseId);
    if (!target) {
      if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
      return;
    }
    const tx = Math.max(0, Math.min(target.px - vpSize.w / 2, MAP_W - vpSize.w));
    const ty = Math.max(0, Math.min(target.py - vpSize.h / 2, MAP_H - vpSize.h));
    setIsAnimating(true);
    setOffset({ x: tx, y: ty });
    const t = setTimeout(() => {
      setIsAnimating(false);
      if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
    }, 500);
    return () => clearTimeout(t);
  }, [focusBaseId, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

setTimeout の時間は 500ms 維持（アニメーション 400ms + 余裕 100ms + 既存 onReady タイミング）。

### 修正3: onPointerDown でアニメーション即応解除（L490-495）

現行 L490-495:
```js
  const onPointerDown = useCallback(e=>{
    e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    dragRef.current={startX:cx, startY:cy, offsetX:offset.x, offsetY:offset.y, moved:false};
  },[offset]);
```

修正後: `setIsAnimating(false)` を `e.preventDefault()` 直後に追加。手動ドラッグ開始で
transition:none に切替。
```js
  const onPointerDown = useCallback(e=>{
    e.preventDefault();
    setIsAnimating(false);
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    dragRef.current={startX:cx, startY:cy, offsetX:offset.x, offsetY:offset.y, moved:false};
  },[offset]);
```

### 修正4: Draggable map div の style に transition/willChange 追加（L578-580）

現行 L577-580:
```jsx
        {/* Draggable map */}
        <div style={{position:'absolute',
          transform:`translate(${-offset.x}px,${-offset.y}px)`,
          width:MAP_W, height:MAP_H, zIndex:1}}>
```

修正後: `transform` 行の直後に `transition` と `willChange` の 2 行を追加。他プロパティ
（position/width/height/zIndex）と子要素は変更禁止。
```jsx
        {/* Draggable map */}
        <div style={{position:'absolute',
          transform:`translate(${-offset.x}px,${-offset.y}px)`,
          transition: isAnimating ? 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'transform',
          width:MAP_W, height:MAP_H, zIndex:1}}>
```

### 修正5: MiniMap の onSeek にアニメーション解除挟み込み（L598）

MiniMap の `start` (L316付近) は `e.stopPropagation()` で親ビューポートの onPointerDown
発火を遮断するため、ミニマップ操作時に修正3の経路が動かない。focusBaseId アニメーション中の
500ms 窓内にミニマップ操作 → transition 400ms 付きで反映 → ミニマップ挙動が瞬間移動でなくなる。
これを回避する。

まず setOffset を呼ぶ関数を `useCallback` 化して MiniMap の deps 安定性を確保する。
MiniMap 内部の `seekToClient` は `onSeek` を deps に含むため、インライン関数を渡すと
毎レンダで MiniMap の内部 useEffect のリスナ登録/解除が繰り返しトリガーされる。

**追加**: 修正1 直後（isAnimating state 定義の後、L423 相当）に以下を追加してもよい。
または fresh な位置として focusBaseId useEffect の後、`useMemo(currentArea)` の前（L447 付近）に配置する。
配置位置は Code 側で自然な場所を選ぶ。

```js
  // ミニマップからの setOffset は常に瞬間移動（isAnimating を解除してから）
  const seekInstant = useCallback((o) => {
    setIsAnimating(false);
    setOffset(o);
  }, []);
```

現行 L598:
```jsx
        <MiniMap offsetX={offset.x} offsetY={offset.y} vpW={vpSize.w} vpH={vpSize.h}
          nodes={liveNodes} onSeek={setOffset} clamp={clamp} />
```

修正後: `onSeek={setOffset}` を `onSeek={seekInstant}` に置換。
```jsx
        <MiniMap offsetX={offset.x} offsetY={offset.y} vpW={vpSize.w} vpH={vpSize.h}
          nodes={liveNodes} onSeek={seekInstant} clamp={clamp} />
```

## 成功基準

1. **拠点クリックで補間移動**: マップ上の拠点をクリック → base_menu 遷移中、背景マップの
   カメラが**クリック元の座標**から**その拠点を画面中央に収める座標**へ 400ms かけて
   スッと補間移動する。瞬間ジャンプでないこと。
2. **base_menu 閉じた後もカメラ維持**: base_menu を閉じても、カメラは開いた位置のまま
   （focusBaseId 同値・focusKey 不変で useEffect deps 変化なし → 静止）。
3. **手動ドラッグ即応**: マップ手動ドラッグ操作は補間なし（従来通り 1:1 追従）。
   拠点クリックによるアニメーション中にドラッグ開始しても、その瞬間 transition が
   解除されて即座に手動追従に切替わる。
4. **ミニマップパン**: 従来通り瞬間移動（アニメーションなし）。focusBaseId アニメーション
   直後 500ms 以内のミニマップ操作でも transition が効かず、瞬間反映であること。
   ミニマップドラッグシークが 60fps でガタつかないこと。
5. **仙台からの初回遷移**: title → START → map 初回表示（仙台）から拠点をクリック →
   仙台からその拠点まで補間移動が見える。
6. **防衛フロー**: 防衛プロンプトで focusBaseId が渡された際も同様に補間移動する
   （既存の focusBaseId 経路に isAnimating が乗るため自動的に成立）。
7. **回帰なし**: 常時レイヤ化（archive済 PROMPT）で解消したフラッシュ挙動が
   再発しないこと。
8. **手動 QA**: `http://localhost:5173` で以下を確認:
   - タイトル → START → 仙台中央表示
   - 仙台以外の拠点をクリック → 仙台からその拠点まで 400ms でスッと移動
   - 閉じる → 同拠点のまま静止
   - 別拠点クリック → 現在位置から新拠点まで補間移動
   - ドラッグ中に拠点クリック → その瞬間から拠点へ補間移動
   - ミニマップクリック → 瞬間移動（変わらず）
   - 拠点クリック直後（アニメーション中）にミニマップクリック → ミニマップは瞬間移動
   - ミニマップをドラッグシーク → 連続的な瞬間追従、ガタつきなし

## 触るな

- L419-422 の仙台コメント・座標ハードコード（フォールバック）は変更禁止。
- L504 の onPointerMove 内 `setOffset(...)` は変更禁止。
- MiniMap コンポーネント本体（L280-350 付近）は変更禁止。
- `App.jsx` は変更禁止（常時レイヤ化は archive 済プロンプトで完了）。
- 他 useEffect、他コンポーネント、他コールバックは変更禁止。
- 修正4で追加する 2 行以外に Draggable map div の style プロパティを変更しないこと。
- 指示範囲外のコード・コメントは変更禁止。

## 設計上の判断根拠

- **CSS transition 方式採用**: RAF 補間より最小コード、React state 更新頻度も 1 回のみ。怠惰。
- **isAnimating state（useRef ではない）**: style プロパティに反映するため再レンダが必要。
  useRef では DOM 直操作になり React 純粋実装から外れる。
- **400ms**: Material Design 標準（cubic-bezier(0.4, 0, 0.2, 1) = standard easing）。
- **willChange: 'transform' 常時付与**: 単一要素のみ、恒常合成レイヤ化のコストは許容範囲。
  条件付きにすると transition 開始直前の合成レイヤ化ラグが目立つ可能性あり。
- **setTimeout 500ms 維持**: アニメーション時間 400ms より長い余裕を確保、既存 onReady
  タイミングと統合。
- **seekInstant を useCallback 化（修正5）**: インライン関数だと MiniMap 内 `seekToClient`
  の deps `[onSeek]` が毎レンダ再生成 → 内部 `useEffect [dragging, seekToClient]` の
  リスナ登録/解除が繰り返される。ドラッグシーク中の毎フレーム発火で実害あり。
  useCallback + deps=[] で関数参照安定化（`setOffset` `setIsAnimating` は React setter で安定）。

## QA
実装完了後、オーナーが localhost:5173 で QA。Code は QA 不担当。
