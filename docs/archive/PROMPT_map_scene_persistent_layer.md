# PROMPT: MapScene 常時レイヤ化（再マウント回避）

## 背景

`PROMPT_bug_map_sendai_jump.md`（archive済）で A案「focusBaseId 渡し」を実装したが、
`case 'map'` と `case 'base_menu'` の間で MapScene が unmount → 別インスタンスが mount される
構造は変わっていない。結果、詳細を開閉するたびに一瞬仙台が見えてから目的地にジャンプするフラッシュが発生。

## 症状

拠点クリックで詳細を開く / 閉じるたびに、一瞬仙台が表示されてから選択した都市に飛ぶ。

## 原因（コード根拠）

### 1. Scene 切替で MapScene が別ツリー
`src/App.jsx` の `renderScene()` は switch 文で case 毎に別ツリーを返す。
- `case 'map'` L344-368: `<MapScene ... />` を単独返却
- `case 'base_menu'` L370-405: `<div>...<MapScene 背景 .../>...<BaseMenuScene .../></div>` を返却
- `case 'adv'` L706-731: `<div>...<MapScene 背景 .../>...<ADVScene .../></div>` を返却

React 的にこれらは別位置の別インスタンス。scene 切替で unmount/remount される。

### 2. useState 初期値が仙台
`src/scenes/MapScene.jsx` L410-412:
```js
// 仙台（x:3256, y:1019）を初期表示中央に
const initOffsetX = Math.max(0, Math.min(3256 - window.innerWidth/2, MAP_W - window.innerWidth));
const initOffsetY = Math.max(0, Math.min(1019 - (window.innerHeight-104)/2, MAP_H - (window.innerHeight-104)));
const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
```
再マウント時、useState 初期値の仙台が **初回 paint** で見え、その後 useEffect が
setOffset で目的地にジャンプ（=フラッシュ）。

## 修正方針

**MapScene を App.jsx トップレベルの常時レイヤとして描画する。** scene ∈ {map, base_menu, adv}
の間で unmount させない。手動ドラッグ状態、offset、areaNameInfo 等の state を保持する。

**触るファイル: `src/App.jsx` のみ。MapScene.jsx は変更禁止。**

## 修正詳細

### 修正1: 各 case から MapScene 描画を除去

#### `case 'map'` （L344-368）
現行の `<MapScene ... />` 全体を除去。トップレベルレイヤが描画するため、ここは空でよい。
```js
case 'map':
  return null;
```

#### `case 'base_menu'` （L370-405）
BaseMenuScene.jsx L28-31 で確認済み: ルート要素は `position:'fixed', inset:0, zIndex:100`
＋ transparent 背景 ＋ 外側クリックで onClose の自前全画面 layout。
背景 MapScene の div も、外側ラッパ div（`<div style={{ position:'relative', ... }}>`）も
**不要**。BaseMenuScene を直接返却する。
```jsx
case 'base_menu':
  return (
    <BaseMenuScene
      node={sceneParams.node}
      isOwned={sceneParams.isOwned ?? true}
      canAttack={sceneParams.canAttack ?? false}
      hasDungeon={sceneParams.hasDungeon ?? false}
      onNavigate={(dest, params) => {
        if (dest === 'formation') {
          navigate('formation', { targetNode: sceneParams.node });
        } else if (dest === 'dungeon') {
          navigate('dungeon', { baseNode: sceneParams.node });
        } else {
          navigate(dest, params);
        }
      }}
      onClose={() => navigate('map', { focusBaseId: sceneParams.focusBaseId })}
    />
  );
```

#### `case 'adv'` （L706-731）
背景 MapScene 描画（`<div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>...<MapScene .../></div>`）
のみ除去。ADVScene 部分は変更禁止。ラッパ div `<div style={{ position:'relative', width:'100vw', height:'100vh' }}>`
はそのまま残す。
```jsx
case 'adv':
  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh' }}>
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

### 修正2: return 文トップレベルに MapScene レイヤ追加

現在の return 文（L749-791 付近）:
```jsx
return (
  <div id="app-root" style={{ position:'relative', width:'100vw', height:'100vh' }}>
    {renderScene()}
    {defenseFlow?.phase === 'defense_prompt' && (
      <div style={{ position:'fixed', inset:0, zIndex:150, pointerEvents:'auto', background:'transparent' }} />
    )}
    <PartnerWidget ... />
  </div>
);
```

修正後: `{renderScene()}` の**手前に** MapScene レイヤを追加。表示条件は
`scene ∈ {'map', 'base_menu', 'adv'}` かつ **防衛フローの formation/battle でない**こと。
```jsx
// MapScene 表示条件
const showMapLayer =
  ['map', 'base_menu', 'adv'].includes(scene) &&
  (!defenseFlow || defenseFlow.phase === 'defense_prompt');

// MapScene の props を scene に応じて分岐
const isInteractiveMap = scene === 'map' && (!defenseFlow || defenseFlow.phase === 'defense_prompt');
const mapLayerHandlers = isInteractiveMap ? {
  onNavigate:   navigate,
  onAttackNode: (node) => navigate('formation', { targetNode: node }),
  onNodeClick:  (node) => {
    setFocusKey(k => k + 1);
    navigate('base_menu', {
      node,
      isOwned:     node.factionId === playerFaction?.id,
      canAttack:   node.canAttack ?? false,
      hasDungeon:  !!node.dungeonId,
      focusBaseId: node.id,
    });
  },
  onNextTurn:   handleNextTurn,
  onReady:      sceneParams._onReady,
} : {
  onNavigate:   () => {},
  onAttackNode: () => {},
  onNodeClick:  () => {},
  onNextTurn:   () => {},
  onReady:      undefined,   // 背景用途では onReady 渡さない（KNOWLEDGE.md §8-2b 準拠）
};

const sceneEl = renderScene();

return (
  <div id="app-root" style={{ position:'relative', width:'100vw', height:'100vh' }}>
    {/* MapScene 常時レイヤ: scene 切替で unmount させない */}
    {showMapLayer && (
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: isInteractiveMap ? 'auto' : 'none',
        zIndex: 0,
      }}>
        <MapScene
          {...mapLayerHandlers}
          gameState={gameState}
          basesData={bases}
          factionsData={factions}
          conqueredThisTurn={game.conqueredThisTurn}
          focusBaseId={sceneParams.focusBaseId}
          focusKey={focusKey}
        />
      </div>
    )}

    {/* シーン描画（MapScene の上）。
        sceneEl が null のときはラッパ自体を描画しない
        （空全画面 div が pointerEvents:auto で MapScene 操作を全遮断するのを防ぐ）。 */}
    {sceneEl != null && (
      <div style={{ position:'relative', zIndex:1, width:'100%', height:'100%' }}>
        {sceneEl}
      </div>
    )}

    {/* 防衛プロンプト遮断レイヤ（既存） */}
    {defenseFlow?.phase === 'defense_prompt' && (
      <div style={{ position:'fixed', inset:0, zIndex:150, pointerEvents:'auto', background:'transparent' }} />
    )}

    {/* PartnerWidget（既存、変更禁止） */}
    <PartnerWidget ... />
  </div>
);
```

**重要**: `sceneEl != null && (...)` の条件付きラッパは必須。`case 'map'` は `return null` を
返すため、無条件でラッパを描画すると空の全画面 div（pointerEvents:auto, zIndex:1）が
MapScene（zIndex:0）を全面覆い、マップのクリック・ドラッグ操作が完全に遮断される。
`defenseFlow.phase === 'formation'/'battle'` の上書きや base_menu/adv 等は非null を返すため
ラッパが描画され、既存の zIndex 挙動が維持される。

## 成功基準

1. **フラッシュ解消**: map で拠点をクリックして base_menu を開く → 仙台が一瞬も見えない。
   閉じる → 仙台が一瞬も見えない。カメラは選択した拠点位置のまま。
2. **ADV 遷移も同様**: theater からイベント発火 → adv シーン → onExit で map 復帰、この間
   仙台フラッシュなし。ADV 背景に MAP が透けて見える（KNOWLEDGE.md §8-2b 維持）。
3. **拠点位置維持**: map で東京にドラッグ → 拠点クリック → 詳細開く → 閉じる →
   カメラは選択した拠点位置。機序: 拠点クリック時 `setFocusKey(k=>k+1)` + `focusBaseId=node.id`
   により MapScene useEffect が発火してカメラを拠点へ移動。閉じる際は `sceneParams.focusBaseId`
   同値・`focusKey` 不変で useEffect deps が変化せず、MapScene カメラは静止（開いた状態を維持）。
4. **初回マウント**: title → START → map 初回遷移で仙台中央表示（既存挙動、変更なし）。
5. **battle/formation → map 復帰**: MapScene がその区間で unmount されるため
   仙台に戻る（既存挙動を維持。今回の対象外）。焦点を保つ必要がある場合は別途 focusBaseId
   を navigate params に渡すが、**今回のスコープ外**。
6. **防衛フロー**:
   - defense_prompt 中: MapScene 表示、PartnerWidget モーダル表示、focusBaseId で拠点にカメラ移動
   - formation/battle 中: MapScene 非表示（`!defenseFlow || defenseFlow.phase === 'defense_prompt'`）
   - 完了後 map 復帰: MapScene 再マウント（現状挙動）
7. **base_menu 中の操作貫通なし**: MapScene レイヤの pointerEvents:'none' が効いていて、
   MapScene 上のノードクリックや BottomBar/TopBar 操作が反応しない。BaseMenuScene の操作のみ有効。
8. **ADV 中の操作貫通なし**: 同上（KNOWLEDGE.md §8-2b の pointerEvents:'none' ラッパを維持）。
9. **TopBar / BottomBar 表示**: MapScene 内部に含まれるため、map/base_menu/adv 中は表示される（既存挙動）。
   party/items/research/theater/save/battle/dungeon/... など MapScene 非表示のシーンでは
   各シーンが自前で TopBar/BottomBar を持つ（既存挙動、変更なし）。
10. **areaName オーバーレイ**: map 中にドラッグしてエリア境界を跨いだときのエリア名表示が
    再マウントで消えず継続する（構造改修の副次効果）。
11. **手動 QA**: `http://localhost:5173` で以下を確認:
    - タイトル → START → 仙台中央表示
    - 仙台をクリック → 詳細開く（フラッシュなし） → 閉じる（フラッシュなし）
    - 隣の拠点をクリック → その拠点が中央（フラッシュなし）→ 閉じる → 同拠点が中央
    - ターン終了 → 敵ターン → 防衛プロンプト → 防衛編成 → 戦闘 → プレイヤーターン復帰
    - theater から theatre イベント起動 → ADV → 終了 → map 復帰（フラッシュなし）

## 触るな

- `src/scenes/MapScene.jsx` は変更禁止。useState 初期値の仙台ハードコード L410-412 は残置。
- `PartnerWidget` の JSX と props は変更禁止。
- `defenseFlow?.phase === 'formation'` `defenseFlow?.phase === 'battle'` の renderScene 冒頭の
  上書き描画（L253-321 付近）は変更禁止。
- 他のシーン case（title/formation/battle/enemy_turn/party/items/research/theater/save/game_end/dungeon/new_game_plus/gallery/settings/credits）は変更禁止。
- `setFocusKey` の他呼び出し箇所（`advanceDefenseQueue` / `startDefenseQueue`）は変更禁止。
- 指示範囲外のコード・コメントは変更禁止。

## 注意点

- **KNOWLEDGE.md §8-2b の透過背景 MAP** は今回の常時レイヤ化で自然に満たされる。ADVScene の
  `transparent` prop 挙動は変更なし。
- **KNOWLEDGE.md §10 の防衛フロー**の `defenseFlow.phase` state machine は不変。
- **メモリ・パフォーマンス**: MapScene が map/base_menu/adv 間で保持されるため
  SVG 描画・areaNameInfo 更新等の副作用が動き続ける。実測で問題があれば別途対応。

## QA
実装完了後、オーナーが localhost:5173 で QA。Code は QA 不担当。
