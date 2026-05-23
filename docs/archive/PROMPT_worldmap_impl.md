# PROMPT: ワールドマップ 仕様バグ・実装不足・未実装 修正

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 作業概要

ワールドマップ関連の仕様バグ・実装不足・未実装を修正する。
バグ（ターン数・防衛撤退所有権・敵ターン順序）は別プロンプト（PROMPT_worldmap_qa.md）のQAで検証するため、本プロンプトでは扱わない。

---

## 修正①: 防衛編成の「戻る」→「撤退」に変更

### 対象ファイル
`src/scenes/FormationScene.jsx`

### 現状
`isDefense` 時も「戻る」ボタンが表示されており、押すと `onCancel()` → App.jsx で `navigate('map')` に繋がる。

### 正しい仕様
防衛編成画面は **出撃 OR 撤退（都市を明け渡す）** の2択。戻るボタンはNG。

### 修正内容

`isDefense` の場合、「戻る」ボタンを「撤退（都市を明け渡す）」ボタンに差し替える。

```jsx
// FormationScene.jsx 内、ボタン行（現状）
<button onClick={onCancel} style={{ flex:1, ... }}>戻る</button>

// 修正後: isDefense に応じて分岐
{isDefense ? (
  <button
    onClick={onCancel}  // App.jsx側でsurrenderとして処理する
    style={{
      flex:1, height:52, borderRadius:6,
      border:`1px solid rgba(196,66,122,.4)`,
      background:'rgba(196,66,122,.08)', color:PK,
      fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.2em',
      cursor:'pointer',
    }}
  >撤退（都市を明け渡す）</button>
) : (
  <button onClick={onCancel} style={{ flex:1, height:52, borderRadius:6,
    border:`1px solid ${BR}`, background:'rgba(255,253,251,.7)', color:TX,
    fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.2em',
    cursor:'pointer',
  }}>戻る</button>
)}
```

### App.jsx側の修正

`case 'formation'` の `onCancel` で `isDefense` 時に `battleEnd` を呼び、拠点を明け渡す。

```jsx
// App.jsx FormationScene の onCancel
onCancel={() => {
  if (sceneParams.isDefense) {
    // 撤退 → 拠点を攻撃側に明け渡す
    const defBase = sceneParams.defenderBase;
    game.actions.battleEnd({
      usedCharIds:     [],
      deadCharIds:     [],
      deadMobIds:      [],
      unitResults:     [],
      conquered:       true,
      defenderBaseId:  defBase?.id ?? defBase?.baseId,
      winnerFactionId: sceneParams.attackerFactionId,
    }).then(() => {
      const remaining = sceneParams.remainingQueue ?? [];
      launchNextDefense(remaining);
    });
  } else {
    navigate('map');
  }
}}
```

---

## 修正②: MapScene の拠点色修正

→ **`PROMPT_mapscene_faction_color.md` に分離済み。そちらを参照・実施すること。**

本プロンプトでは扱わない。

---

## 修正③: エリア区分を bases.json の `area` フィールドベースに

### 対象ファイル
- `src/game/data/bases.json`（フィールド追加）
- `src/scenes/MapScene.jsx`（エリア判定ロジック変更）
- `tools/editor-modules/tab-map.js`（エディタ対応）※エディタ移植完了後

### エリア定義

以下8区分を使用：

| key | 表示名 | 英語名 |
|-----|--------|--------|
| `tohoku` | 東北 | TOHOKU |
| `hokkaido` | 北海道 | HOKKAIDO |
| `kanto` | 関東 | KANTO |
| `koshinetsu` | 甲信越 | KOSHINETSU |
| `kansai` | 関西 | KANSAI |
| `chushikoku` | 中四国 | CHUSHIKOKU |
| `kyushu` | 九州 | KYUSHU |
| `okinawa` | 沖縄 | OKINAWA |

### bases.json への `area` フィールド追加

全拠点に `"area": "<key>"` を追加する。既存の座標を参考に割り当てること。
仙台（base_001）は `"area": "tohoku"` が正しい。

追加フィールドの例：

```json
{
  "id": "base_001",
  "name": "仙台",
  "x": 3256,
  "y": 1019,
  "factionId": "東北家",
  "income": 100,
  "isCapital": true,
  "adjacentBases": ["base_003", "base_049", "base_010"],
  "battleCapacity": 800,
  "dungeonId": null,
  "area": "tohoku"
}
```

全拠点への一括追加は座標ベースで推定して構わない（後でエディタで修正可能）。
座標の目安：
- x > 3200, y < 600 → `hokkaido`
- x > 2800, y 600-1400 → `tohoku`
- x 1800-3000, y 800-1600 → `kanto` / `koshinetsu`
- x < 2200, y > 1200 → `kansai` 以西

### MapScene.jsx の修正

**エリア定義を追加：**

```js
const AREA_META = {
  tohoku:     { name:'東北',   en:'TOHOKU' },
  hokkaido:   { name:'北海道', en:'HOKKAIDO' },
  kanto:      { name:'関東',   en:'KANTO' },
  koshinetsu: { name:'甲信越', en:'KOSHINETSU' },
  kansai:     { name:'関西',   en:'KANSAI' },
  chushikoku: { name:'中四国', en:'CHUSHIKOKU' },
  kyushu:     { name:'九州',   en:'KYUSHU' },
  okinawa:    { name:'沖縄',   en:'OKINAWA' },
};
```

**エリア判定をオフセットベースに変更：**

現状の `BOUNDARY_X` による左右判定を廃止し、ビューポート中央に最も近い拠点の `area` を現在エリアとする。

```js
const currentArea = React.useMemo(() => {
  if (!liveNodes.length) return 'tohoku';
  const cx = offset.x + vpSize.w / 2;
  const cy = offset.y + vpSize.h / 2;
  let nearest = liveNodes[0];
  let minDist = Infinity;
  liveNodes.forEach(n => {
    const d = Math.hypot(n.px - cx, n.py - cy);
    if (d < minDist) { minDist = d; nearest = n; }
  });
  return nearest.area ?? 'tohoku';
}, [liveNodes, offset, vpSize]);
```

**`AreaNameOverlay` のpropsに `areaEn` を追加し、`AREA_META[currentArea]?.en` を渡す。**

**背景切り替えロジック（当面2種維持）：**

```js
const bgType = currentArea === 'hokkaido' ? 'hokkaido' : 'tohoku';
```

### tab-map.js への `area` フィールド追加（エディタ移植完了後）

`buildBaseForm` の基本情報セクションに `area` セレクトを追加：

```js
const areaOpts = [
  ['tohoku','東北'], ['hokkaido','北海道'], ['kanto','関東'],
  ['koshinetsu','甲信越'], ['kansai','関西'], ['chushikoku','中四国'],
  ['kyushu','九州'], ['okinawa','沖縄'],
].map(([v,l]) => `<option value="${v}" ${base.area===v?'selected':''}>${l}</option>`).join('');
```

`saveBase()` に追加：

```js
base.area = v('fb_area') || 'tohoku';
```

---

## 動作確認手順

1. `npm run dev` 起動
2. 新規ゲーム開始 → マップ表示
3. **修正②確認**: `PROMPT_mapscene_faction_color.md` の動作確認手順に従う
4. **修正③確認**: マップをスクロールして東北→北海道方向に移動すると、エリア名が「東北」→「北海道」に変わること
5. **修正①確認**: 防衛編成画面（防衛キューあり状態）で「撤退」ボタンが表示されること。押すと拠点所有権が移り防衛キューの続きに進むこと
