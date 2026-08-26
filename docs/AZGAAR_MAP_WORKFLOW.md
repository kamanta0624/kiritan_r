# Azgaar's Fantasy Map Generator — 5トンマナ背景地図の作成手順

> 用途: MapScene の背景を、**同一地形・5トンマナ**の画像セットに差し替える。ドラッグで地方が変わるとトンマナがクロスフェードする。
> **拠点データ（bases.json）の構造は変更しない。** 面（ポリゴン）支配域は導入しない。
> **AI 出力をそのまま使わない。** Azgaar は地形と配色ベースを作るところまで。最終トンマナは人間が画像編集で仕上げる。
> ツール: https://azgaar.github.io/Fantasy-Map-Generator （MIT。生成物は商用利用可）

---

## 0. トンマナ定義

主要5勢力＝5トンマナ。地方に紐づける。

| styleId | 地方 | 勢力 | 目標トンマナ | Azgaar 側の当て方 |
|---------|------|------|-------------|------------------|
| `tohoku` | 東北 | 東北家 | 京アニ背景のような透明感アニメ調 | `light` / `pale` ベース。高明度・低彩度の青緑〜白のカスタム色スキーム。texture なし。Relief icons OFF でフラット化 |
| `kanto` | 関東 | ボイボ寮 | みんちりえのような写実系 | `default` / `atlas` ベース。Biomes ON + Relief icons 高密度。`soiled-paper` or `plaster` テクスチャ。Dingy 弱 |
| `hokkaido` | 北海道 | 小樽潮風 | 公式絵のような水彩画調 | **`watercolor` プリセット**が直球。`folded-paper` / `gray-paper` テクスチャ。境界に `stroke-dasharray` で滲み感 |
| `kansai` | 関西 | AHS | パステルのグラデ色調 | `clean` ベース。ピンク〜水色のカスタム色スキーム。texture なし。彩度高め |
| `kyushu` | 九州 | ボカロ | ボカコレのようなポップ調 | `cyberpunk` or 原色カスタム色スキーム。**ハーフトーン網点テクスチャを URL 指定で差す**。stroke 太め |

残り3地方（甲信越・中四国・沖縄）は近隣の styleId にフォールバックさせる。画像は作らない。

- 甲信越 → `kanto`
- 中四国 → `kansai`
- 沖縄 → `kyushu`

---

## 1. 座標系の前提

| 項目 | 値 |
|------|-----|
| ワールドサイズ | 4200 × 3200（`MapScene.jsx` の `MAP_W`/`MAP_H`） |
| アスペクト比 | 1.3125 |
| 拠点座標範囲 | x: 106〜3869 / y: 175〜2888（92件） |
| 背景画像 | `public/map/world_<styleId>.webp`（2100×1600 — ワールドの1/2解像度） |
| ミニマップ用 | `public/map/thumb_<styleId>.webp`（420×320） |

**背景を等倍 4200×3200 で5枚持つとメモリが死ぬ**（RGBAデコード後 53.8MB/枚 × 5 = 269MB）。1/2解像度なら 13.4MB/枚。背景は主役ではないので拡大ボケは許容する。

---

## 2. 生成（1回だけ）

1. **キャンバスサイズは生成後に変更できない。** 最初に決めろ。アスペクト比 1.3125 厳守

   ```
   https://azgaar.github.io/Fantasy-Map-Generator/?width=2100&height=1600&options=default
   ```

   ※ ツール側の推奨は「画面サイズ以下」。2100×1600 で重い場合は 1680×1280（同比）へ落とす
2. `Tab` でメニュー展開 → `Options` → **Points number 10K**
3. 気に入る大陸が出るまで `New Map` を繰り返す
4. **seed とジェネレータのバージョン番号を控える**

---

## 3. 地形の人間最終調整

生成物をそのまま使わない。Azgaar 内で詰めてから書き出す。

### 使う道具

- `Tools` → **Heightmap editor**。ブラシで標高を直接描く。`Erase` / `Keep` / `Risk` の3モード
  - `Keep` は既存の地形要素（河川・都市等）を保持したまま標高だけ編集する。基本これ
- `Tools` → **Heightmap template editor**。地形生成のレシピ（Hill/Pit/Range/Trough/Strait）を手で組む。大陸の骨格から作り直す場合
- **Heightmap image overlay**。下絵画像をトレースして標高を描く。狙った大陸形状がある場合はこれが最短
- `Tools` → **Rivers / Routes / Burgs エディタ**。個別に追加・削除・移動

### 調整の観点（このゲーム固有）

- 拠点92件が乗る**陸地面積を確保する**。8地方ぶんのクラスタが入る大きさか
- 地方クラスタが**海で分断されすぎない**。`adjacentBases` の辺が海を大きく横断すると破綻して見える
- 拠点名ラベル（60×16px の白箱）が乗る**平坦で明度の安定した領域**を作る。細かい島嶼だらけだとラベルが読めない

### 保存

**`Save` → `machine`（.map）を必ず保存。** 再現の唯一の手段。ブラウザストレージだけで済ませるな。
`docs/assets/` かクラウドへ。以降の5トンマナは**この1ファイルから派生させる**。

---

## 4. 背景用にレイヤを整理

ゲーム側が拠点名・勢力色・隣接線を描く。**地図側の文字と境界線は全部消す。**

`Layers` で **OFF**:

- Labels（地名）/ Borders / States / Provinces / Burg icons / Routes / Military / Markers / Zones / Scale bar

`Layers` で **ON**（トンマナごとに取捨する）:

- Ocean / Coastline / Rivers / Heightmap または Biomes / Relief icons

この ON/OFF 自体もトンマナの差になる。写実系は Relief icons 高密度、アニメ調は OFF でフラット。

---

## 5. トンマナを5つ作る（同一地形のまま）

`Style` タブで作り込み → **`+` ボタンでカスタムプリセット保存**（`localStorage` に `fmgStyle_<名前>` で保存される）。
`kiritan_tohoku` / `kiritan_kanto` / `kiritan_hokkaido` / `kiritan_kansai` / `kiritan_kyushu` の5つを登録する。

### 触るところ

| レバー | 場所 | 効き |
|--------|------|------|
| **システムプリセット** | `Style` → preset選択 | 12種: `default / ancient / gloom / pale / light / watercolor / clean / atlas / darkSeas / cyberpunk / night / monochrome`。まずベースを選ぶ |
| **Heightmap カラースキーム** | Select element → `Heightmap` → Scheme の `+` | **最重要**。任意の色ストップを登録できる（既定例 `#ffffff,#EEEECC,#D2B48C,#008000,#008080`）。5トンマナの配色差はここで作る |
| **Texture** | Select element → `Texture` | 内蔵25種（folded-paper / gray-paper / soiled-paper / plaster / marble / stone / pergamena 等）。**`+` で URL 指定すれば自前テクスチャを差せる**（水彩紙・網点・キャンバス地） |
| **グローバルフィルタ** | `Style` 下部 | `Grayscale` / `Sepia` / `Dingy` / `Tint` |
| **要素別 opacity / stroke / SVGフィルタ** | Select element → 各要素 | 海・河川・生物群系・境界を個別に調整 |
| **Vignette** | Select element → `Vignette` | 周辺減光。アニメ調では切る |

**トンマナを切り替えても地形データは一切変わらない。** 見た目の属性だけを差し替えている。

---

## 6. エクスポート（5回）

プリセットを切り替えるたびに `Export` → **`.svg`**。

- `.svg` は**全図**が出る
- `.png` / `.jpeg` は**画面に見えている範囲だけ**。使うな
- ファイル名を `world_tohoku.svg` のように styleId で揃える

---

## 7. 人間の仕上げ（ここが本番）

Azgaar が出せるのは地形・構図・配色ベースまで。**「京アニ調」「写実」は Azgaar 単体では出ない。**

### レイヤ分離出力の裏技

レイヤを個別に ON/OFF して複数回エクスポートすると、海・陸・河川・山・海岸線を**別レイヤの画像として取り出せる**。画像編集ソフトで重ねれば、レイヤごとに質感・ぼかし・色調を変えられる。5トンマナぶん手描きするより圧倒的に速い。

推奨の分離単位:

1. Ocean のみ
2. Heightmap（または Biomes）のみ
3. Rivers のみ
4. Relief icons のみ
5. Coastline のみ

### 仕上げの目安

- 東北: 空気遠近・弱ブルーム・ハイライトの粒。彩度を落として明度を上げる
- 関東: テクスチャを強めに乗せ、陰影のコントラストを立てる
- 北海道: 水彩紙テクスチャ + 輪郭のにじみ・色ムラ
- 関西: グラデーションオーバーレイ（ピンク→水色）、光の粒
- 九州: 網点・原色・太い輪郭・斜めストライプ

**5枚は必ず同一地形。** 仕上げ工程で輪郭をずらすと切替時にガタつく。地形の輪郭レイヤは全トンマナで共有すること。

---

## 8. ラスタ化

```bash
node tools/azgaar_bg.cjs world_tohoku.svg tohoku
```

→ `public/map/world_tohoku.webp`（2100×1600）と `public/map/thumb_tohoku.webp`（420×320）を生成。5回繰り返す。

SVG を直接 React に貼るな。数MB・数万ノードで DOM が死ぬ。

---

## 9. 拠点の再配置

背景が新しい大陸に変わると、既存92拠点は海上に浮く。

```bash
npm run editor   # → localhost:3001 → 🗺 マップタブ
```

- 背景が下敷き表示される。拠点をドラッグして陸地へ移動
- **`adjacentBases` は変更しない。** 隣接グラフはシナリオ・LegionAI・攻撃可否判定が依存している
- 8地方（`area`）のクラスタが混ざらないよう、地方ごとにまとめて移動
- **トンマナ切替は `area` で判定される。** クラスタが混ざると切替がチラつく

保存後 `npm run dev` → localhost:5173 で確認。

---

## 10. 未解決（オーナー判断）

1. **地名と地形の乖離。** 拠点名は実在日本（いわき・すすきの・仙台）、`AreaNameOverlay` は「東北 TOHOKU」を表示する。背景だけファンタジー大陸にすると噛み合わない
2. **`BOUNDARY_X = 2400` の境界グロウ。** 手描き背景2種の境目を示す演出。撤去可否
3. **トンマナ適用範囲の第2段階。** 現時点は背景のみ。将来ノード・ラベル・隣接線の配色も地方連動させる（`tokens.js` に地方別パレットを追加）

---

## 参考

- [Quick Start Tutorial](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial)
- [Heightmap customization](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization)
- [Heightmap image overlay](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-image-overlay)
- [Heightmap template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor)
- [URL parameters](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/URL-parameters)
- [Q&A](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A)
