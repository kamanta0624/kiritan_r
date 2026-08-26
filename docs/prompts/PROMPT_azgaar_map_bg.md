# PROMPT — 地方連動トンマナ背景の導入（MapScene 背景差し替え）

対象: ClaudeCode
関連: `docs/AZGAAR_MAP_WORKFLOW.md`（人間側の地図作成手順）、`KNOWLEDGE.md` §3 / §6

---

## 前提

- MapScene のワールドは 4200×3200。拠点92件は `x/y` のワールド座標で配置され、辺は `adjacentBases` から動的生成される
- 現在の背景は `TohokuBg` / `HokkaidoBg`（手描きSVGグラデーション）を近傍ノードの `area` でクロスフェードしたもの。**ビューポート固定**で地図と一緒にスクロールしない
- これを **同一地形・5トンマナの画像セット**に差し替える。背景は地形になるので、**拠点と同じレイヤで動かす**
- **トンマナは地方（`area`）で切り替わり、クロスフェードする。** 既存のクロスフェード機構の一般化

## トンマナ定義

主要5勢力＝5トンマナ。画像は5枚。

| styleId | 地方（`area`） | 勢力 |
|---------|--------------|------|
| `tohoku` | `tohoku` | 東北家 |
| `kanto` | `kanto`, `koshinetsu` | ボイボ寮 |
| `hokkaido` | `hokkaido` | 小樽潮風 |
| `kansai` | `kansai`, `chushikoku` | AHS |
| `kyushu` | `kyushu`, `okinawa` | ボカロ |

`area → styleId` の対応表は**1箇所に定義しろ**（`src/game/data/` の JSON か `MapScene.jsx` 内定数。どちらにするか下記の確認事項）。

## 画像アセット

| 用途 | パス | サイズ |
|------|------|--------|
| 背景 | `public/map/world_<styleId>.webp` | 2100×1600（ワールドの1/2） |
| ミニマップ | `public/map/thumb_<styleId>.webp` | 420×320 |

**等倍 4200×3200 を5枚常駐させるな。** RGBAデコード後 53.8MB/枚 × 5 = 269MB でメモリが死ぬ。1/2解像度（13.4MB/枚）を CSS で拡大表示する。

---

## 実装前にオーナーへ確認すること（勝手に決めるな）

1. 画像フォーマットは webp でよいか。`sharp` 等のネイティブ依存を `devDependencies` に追加してよいか
2. `area → styleId` 対応表の置き場所（JSON か JSX 内定数か）
3. `AreaNameOverlay`（「東北 TOHOKU」表示）を残すか撤去するか
4. `BOUNDARY_X = 2400` の境界グロウ演出を撤去してよいか
5. クロスフェードの時間（現行 0.9s）を維持するか

回答が出るまで該当箇所には手を付けるな。

---

## 成功基準

以下が全て満たされるまでループしろ。

1. `npm run build` が成功する
2. localhost:5173 の MAP をドラッグすると、**背景地形が拠点ノードと完全に同期して動く**。ズレ・視差ゼロ
3. 地方をまたいでドラッグすると**背景トンマナがクロスフェードで切り替わる**。地形の輪郭位置は切替前後で1pxも動かない
4. **同時にメモリ常駐する背景画像は最大2枚**（現在の styleId とフェード相手）。3枚目以降はロードも保持もしない。DevTools のメモリ計測で確認しろ
5. 画像未配置（404）でも**シーンが壊れない**。無地の背景色にフォールバックし、コンソールに警告1行
6. `src/game/data/bases.json` の差分がゼロ（このタスクで拠点は動かさない。再配置は人間がエディタで行う）
7. `grep -rn "TohokuBg\|HokkaidoBg\|hokkaidoOpacity" src/` が 0 件
8. ミニマップの背景が2色矩形から `thumb_<styleId>.webp` に置き換わり、**背景と同じトンマナに追随**する。ビューポート枠と拠点ドットの位置は従来どおり
9. `node tools/azgaar_bg.cjs <svg> <styleId>` が `world_<styleId>.webp` と `thumb_<styleId>.webp` を生成する
10. エディタ（`npm run editor` → 🗺 マップタブ）のキャンバスに背景が下敷き表示され、**同一拠点の見た目位置が MapScene と一致する**
11. MapScene と エディタのワールドサイズが一致（現在 MapScene 4200×3200 / `tools/editor-modules/shared.js` 4000×3000 で**不一致**。4200×3200 に統一し、ドラッグのクランプも追随させろ）
12. 新規に書いた色は `src/shared/tokens.js` 経由。直書きなし

---

## タスク

### A. `tools/azgaar_bg.cjs` 新規

- 引数: `<入力SVGパス> <styleId>`
- 出力: `public/map/world_<styleId>.webp`（2100×1600）/ `public/map/thumb_<styleId>.webp`（420×320）
- 入力SVGのアスペクト比が 1.3125 から外れていたら警告を出して停止しろ（歪んだ地図を黙って吐くな）
- `styleId` が定義済み5種以外なら停止
- 依存は最小。Chromium/Puppeteer を持ち出すな

### B. `src/scenes/MapScene.jsx`

- `TohokuBg` / `HokkaidoBg` / `hokkaidoOpacity` / 背景クロスフェード用の旧ロジックを削除
- `currentArea`（近傍ノードの `area`）の算出は**流用してよい**。そこから `styleId` を引く
- 背景は `MAP_W`×`MAP_H` に引き伸ばした `<img>` を、**`transform: translate(-offset)` が掛かるドラッグレイヤの内側**に絶対配置（`MapLayer` の下、zIndex はノードより下）
- 背景レイヤは**2枚だけ**。`current` と `prev` を持ち、styleId が変わったら `prev` に旧画像を移して opacity 0 へ遷移、遷移完了後に `prev` を破棄（`src` を空に）
- 画像ロード失敗時は無地フォールバック

### C. `MiniMap`

- 2色矩形（`rgba(190,210,225,.6)` / `rgba(175,200,170,.6)`）を `thumb_<styleId>.webp` に置換。背景と同じ styleId に追随
- 拠点ドット・ビューポート枠の座標計算は変更するな

### D. `tools/editor-modules/tab-map.js` / `shared.js`

- `MAP_WORLD_W/H` を 4200/3200 に修正
- `drawMapCanvas` の先頭で背景サムネを `drawImage` で下敷き描画（グリッドはその上、薄く）
- エディタ側は**1トンマナ固定でよい**（既定 `tohoku`）。切替UIは不要

---

## 範囲外（触るな）

- 拠点座標の再配置、`adjacentBases` の変更
- **ノード・拠点名ラベル・隣接線・オーバーレイの配色のトンマナ連動**（第2段階。今回は背景のみ）
- province ポリゴン・面塗り支配域の導入
- `area` の定義変更、地名・シナリオ・イベントJSON
- 戦闘背景（`bgField` / `bgCastle`）
