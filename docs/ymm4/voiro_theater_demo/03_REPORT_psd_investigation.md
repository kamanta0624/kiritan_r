# PSDパーツ合成立ち絵 — 前段調査報告書

調査日: 2026-07-24

---

## 調査項目1: github.com/oov/psd（Go, MIT）

**結論: 本ライブラリ単体での WASM ビルド手順は未提供。PSDTool が GopherJS 経由で本ライブラリを JS 化済み（項目2参照）**

- 言語: Go
- ライセンス: MIT
  - URL: https://github.com/oov/psd
- 機能: PSD/PSBバイナリパース、レイヤー画像抽出、PNG変換
- 対応カラーモード: Bitmap 1bit, Grayscale 8/16/32bit, Indexed, RGB 8/16/32bit, CMYK 8/16bit
- 対応圧縮: Raw, RLE(PackBits), ZIP(予測なし/あり)
- 制限: README に「layer composition isn't covered by this package」と明記。ブレンド関数は未実装
  - URL: https://github.com/oov/psd/blob/master/README.md
- WASM/ブラウザ対応: README に記載なし。ソースに `compress_js.go`, `compress_wasm_js.go` が存在するが、これはGoのビルドタグによるプラットフォーム別コードであり、WASM単体ビルド手順は提供されていない
  - URL: https://github.com/oov/psd
- Go ツールチェイン: 必須。Go パッケージとして `go get` / `go build` が前提
- Node.js互換: 直接の互換性なし。Go標準の `GOOS=js GOARCH=wasm` ビルドまたはGopherJSでJS化すればNode.jsから利用可能だが、本ライブラリ側でその手順は未提供

## 調査項目2: github.com/oov/PSDTool（TypeScript + Go/GopherJS, MIT）

**結論: コード流用可。PSD パース部は Go（oov/psd）を GopherJS で JS 化。レイヤーツリー・描画・PFV は TypeScript で実装済み**

- 言語: TypeScript（webpack）+ Go（GopherJS でJS化）
- ライセンス: MIT (Copyright 2016 oov)
  - URL: https://github.com/oov/PSDTool
- ライブデモ: https://oov.github.io/psdtool/
- PSD パース基盤: `src/psd/` ディレクトリに Go コードを配置し、GopherJS で JS に変換
  - `src/psd/go.mod`: `github.com/oov/psd` v0.0.0-20220121172623 に依存、Go 1.17 要求
  - `src/psd/psd_js.go`, `parse_js.go`, `filereader_js.go`, `canvas_js.go`: GopherJS 用ラッパー
  - `src/psd/psd.d.ts`: TypeScript 型定義
  - `src/psd/psd.inc.js`: JS インクルード
  - URL: https://github.com/oov/PSDTool/tree/master/src/psd
- GopherJS 依存: `github.com/gopherjs/gopherjs` v0.0.0-20220410123724（`src/psd/go.mod`）。ビルドに Go ツールチェイン + GopherJS が必要
  - URL: https://github.com/oov/PSDTool/blob/master/src/psd/go.mod
- 流用可能な TypeScript モジュール:
  - `src/layertree.ts`: レイヤー階層管理、`*` プレフィックスによるラジオボタン排他選択の実装あり（L283-290）、シリアライズ/デシリアライズ対応
    - URL: https://github.com/oov/PSDTool/blob/master/src/layertree.ts
  - `src/renderer.ts`: Canvas 描画
  - `src/favorite.ts`: PFV 形式の読み書き（項目4参照）
  - `src/downscaler.ts`: 画像縮小
  - `src/blend/`: ブレンドモード実装
  - URL: https://github.com/oov/PSDTool/tree/master/src

## 調査項目3: github.com/oov/aviutl_psdtoolkit — 「動く立ち絵」命名規則

**結論: 命名規則・まばたき/口パク仕様はドキュメントおよびソースから確認可**

- ライセンス: MIT
  - URL: https://github.com/oov/aviutl_psdtoolkit
- ドキュメント所在:
  - リポジトリ内: `src/docs/psd.md`（レイヤー命名規則）, `src/docs/pfv.md`（PFV 運用）
    - URL: https://github.com/oov/aviutl_psdtoolkit/tree/main/src/docs
  - リリース同梱: `PSDToolKit説明書.html`（README に記載）
    - URL: https://github.com/oov/aviutl_psdtoolkit（README）
- レイヤー命名規則:
  - `*` プレフィックス: グループ内排他選択（ラジオボタン）。同一グループ内で `*` 付きレイヤーは1枚のみ表示
    - 根拠: PSDTool `src/layertree.ts` L283-290 に実装。`input.type = 'radio'` でラジオボタン化
  - `!` プレフィックス: Lua スクリプトのレイヤーパス指定で使用（例: `"v1.!目/*開き"`）
    - 根拠: `src/docs/psd.md`
- 自動まばたき（目パチ）:
  - 「目」グループ内に段階的な開閉レイヤーを配置: 開き → ほぼ開き → 半開き → ほぼ閉じ → 閉じ
  - 根拠: `src/docs/psd.md`
- 口パク:
  - 単純方式: 「口」グループ内に 開き / ほぼ開き / 半開き / ほぼ閉じ / 閉じ
  - 母音方式: あ / い / う / え / お / ん
  - 根拠: `src/docs/psd.md`
- ソースコード: `src/lua/PSDToolKit.lua` にコア処理（まばたき・口パクのタイマー制御）が存在する可能性あり。ファイル内容はアクセス不能（ディレクトリ一覧のみ確認）
  - URL: https://github.com/oov/aviutl_psdtoolkit/tree/main/src/lua

## 調査項目4: PFV ファイル形式（PSDToolFavorites-v1）

**結論: 仕様は PSDTool ソースコード `src/favorite.ts` から確認可。テキストベースの階層構造**

- 形式仕様の所在: `github.com/oov/PSDTool/blob/master/src/favorite.ts`
  - URL: https://github.com/oov/PSDTool/blob/master/src/favorite.ts
- 運用ドキュメント: `github.com/oov/aviutl_psdtoolkit/blob/main/src/docs/pfv.md`
  - URL: https://github.com/oov/aviutl_psdtoolkit/blob/main/src/docs/pfv.md
- ヘッダ: `[PSDToolFavorites-v1]`（`favorite.ts` でバリデーション）
- 構造概要:
  - テキストベース、行区切り
  - ノード種別: item（リーフ）, folder（`~folder` サフィックス）, filter（`~filter` サフィックス）
  - エントリ形式: `//[URLエンコードパス]~[種別]` + 改行 + データ値 + 空行
  - パス区切り: `/`
  - 名前のエンコード: `\x00-\x1f`, `"`, `%`, `'`, `/`, `\`, `~`, `\x7f` を `%XX` にエスケープ
  - メタデータ: `root-name/[名前]`, `faview-mode/[0|1|2]`
- 内容: PSD ファイルの全レイヤーの表示/非表示状態を保存（`pfv.md` に記載）
- デモのデータモデルへの採用可否: PFV はレイヤー表示/非表示の組み合わせ保存形式。アニメーション（まばたき・口パク）の定義は PFV の範囲外（PFV は静的な状態スナップショット）

## 調査項目5: `StandingChar` 現行実装の影響範囲

**結論: 4シーンファイルに影響。`getPortrait` / `portraitPath` は全て同一規約パス `/characters/portraits/<id>.png` を解決**

### getPortrait / portraitPath 定義箇所（4件）

| ファイル | 行 | 関数名 | 備考 |
|---------|-----|--------|------|
| `src/scenes/ADVScene.jsx` | L68 | `getPortrait(charKey)` | 本体定義 |
| `src/scenes/PartyScene.jsx` | L7 | `portraitPath(id)` | 同一ロジックの複製 |
| `src/scenes/FormationScene.jsx` | L4 | `portraitPath(id)` | 同一ロジックの複製 |
| `src/scenes/BattleScene.jsx` | L9 | `portraitPath(id)` | 同一ロジックの複製 |

### 呼び出し箇所（全列挙）

**ADVScene.jsx:**

| 行 | コンテキスト |
|----|------------|
| L74 | `StandingChar` コンポーネント内で `getPortrait(charKey)` |
| L330 | `PersonaCutin` コンポーネント内で `getPortrait(charKey)` |
| L859 | メインADVシーン描画で `<StandingChar>` レンダー |

**PartyScene.jsx:**

| 行 | コンテキスト |
|----|------------|
| L443 | `c.portrait ?? portraitPath(c.id)` — キャラ一覧表示 |

**FormationScene.jsx:**

| 行 | コンテキスト |
|----|------------|
| L84-85 | 隊列メンバー表示（img） |
| L137-138 | 隊列メンバー表示（img） |
| L231 | 隊列プレビュー表示（img） |
| L376-377 | 隊列メンバー表示（img） |

**BattleScene.jsx:**

| 行 | コンテキスト |
|----|------------|
| L61 | ユニット初期化時 `portrait:portraitPath(c.id)` |
| L159 | 勝利演出で `portraitPath(winner.char?.id)` |
| L607 | ユニットポートレート取得 |
| L869-870 | SP プレースホルダー（味方/敵） |
| L939 | 攻撃者ポートレート表示 |
| L1199 | ユニットデータ構築時 `portrait: portraitPath(u.char.id)` |

### 影響の要約

- `StandingChar` は `ADVScene.jsx` 内でのみ定義・使用（L73 定義、L859 レンダー）
- PSD パーツ描画（Canvas 等）への置き換え時、`StandingChar` コンポーネント自体の改修が主対象
- `getPortrait` / `portraitPath` は4ファイルに同一ロジックが分散（各ファイルで独立定義）
- `PersonaCutin`（L330）も `getPortrait` を呼び出しており影響範囲に含まれる

## 調査項目6: PSD 実ファイルのレイヤー構造

**結論: 彩澄しゅお PSD は `*` プレフィックス適合。四国めたん PSD は非適合。立ち絵 PNG 62枚に対し PSD は2キャラ分のみ**

### 資産状況

- 立ち絵 PNG: `public/characters/portraits/` に **62枚**（`char_*.png`）
- PSD ファイル: `docs/assets/psd/` に **2件のみ**
  - `四国めたん.psd`（6.7MB）
  - `彩澄しゅお縮小_800pix.psd`（1.9MB）
- PSD があるのは全キャラの一部であり、PSD パーツ方式に移行する場合、残り60キャラ分の PSD は不在

### 四国めたん.psd

- サイズ: 1500×1500px, 8bit RGB
- レイヤー数: 124
- `*` プレフィックス: **なし** — PSDToolKit 命名規則に**非適合**
- 構造:

```
[G] エフェクト・アクセサリ
  ♡, ？, ！, 驚きマーク, 制服のリボン, サングラス, 眼鏡, 物乞い王の冠
[G] 制服の腕（顔より前）
  手を組み合わせる（両腕）, 手を合わせる（両腕）
[G] 腕（顔より前）
  口元腕 ×2, 万歳腕
[G] 顔
  [G] 顔色 — 怒りマーク, 照れ, あせあせ, あせ, かげ, 青ざめ
  [G] 眉 — 不審, 困り, 怒り, 笑い, 普通
  [G] 目 — バツ, 線, 閉じ, 笑い, 驚き, 泣き, 白目, 半目, ハイライト消し, 目に♡, キラキラ, ぐるぐる, 左, 右, 普通
  [G] 口 — わー, いしし, にへら, 歪み(閉じ/半開き/開き), 笑い(開き/半開き/閉じ), 普通(開き/半開き/閉じ)
  コート用顔, 水着用顔, バニー用顔, 制服用, 装飾ナシ顔, 普通顔
[G] 通常服
  [G] 腕（胴体より前） — 万歳腕, 通常腕
  胴体
  [G] 腕（胴体より後） — 通常腕
[G] 制服胴体
  (腕・手・体パーツ 10レイヤー)
[G] 他の服
  [G] 腕（胴体より前） [G] 体(下着/水着/バニー/コート) [G] 腕（胴体より後）
[G] 髪（胴体より後）
  ツインテ右, ツインテ左, ツインテ ×2
[G] ドリル
  ドリル（手持ち）, ドリル（背中）
```

- まばたき適合性: 「目」グループに「閉じ」「半目」「普通」は存在するが、PSDToolKit の5段階（開き/ほぼ開き/半開き/ほぼ閉じ/閉じ）に対し3段階であり、`*` プレフィックスもない
- 口パク適合性: 「口」グループに「開き」「半開き」「閉じ」系は存在するが、`*` プレフィックスなし。普通/笑い/歪みの3バリエーション各3段階

### 彩澄しゅお縮小_800pix.psd

- サイズ: 518×800px, 8bit RGB
- レイヤー数: 139
- `*` プレフィックス: **あり** — PSDToolKit 命名規則に**適合**
- 構造:

```
[G] マーク
  花, 溜息, ばってん, おこ, ひらめいた, ビクッ, 焦り, ！, おっ, 汗, もやもや, ぼのぼの汗, ぷんすこ, ？反転, ？, ハート, キラーン, 落ち込み
[G] アクセサリー
  犬耳, ぼさぼさ, メガネ, おひげ, 吐息, 汗, 涙(×2)
[G] 眉 — *怒り2, *怒り1, *悲し, *困り, *普通
[G] 目 — *つぶら, *ニカッ, ... *普通, *ちょっと閉じ, *半目, *閉じ, *閉じ　笑み （計36レイヤー、全て*プレフィックス付き）
[G] 口 — *V, *よだれ2, ... *開き, *アニメ2, *アニメ1, *閉じ （計33レイヤー、全て*プレフィックス付き。口形状3セット各4段階含む）
[G] 右腕 — *上げ　制服, *下げ　制服, *上げ　ぴた声, *下ろし　ぴた声
[G] 左腕 — *上げ　制服, *下げ　制服, *上げ　ぴた声, *下ろし　ぴた声
[G] 顔効果 — *青ざめ, *茹で, *照れ
[G] 本体　制服 — おだんご, 本体
[G] 本体　ぴた声 — おだんご, 本体
```

- まばたき適合性: 「目」グループに `*普通`, `*ちょっと閉じ`, `*半目`, `*閉じ` の4段階あり。PSDToolKit の段階分けに近い構成
- 口パク適合性: 「口」グループに `*閉じ`, `*アニメ1`, `*アニメ2`, `*開き` のセットが3組（口形状違い）存在。アニメーション用の段階分けが明示的
- 口パクの `*アニメ1` / `*アニメ2` 命名は PSDToolKit 標準の「ほぼ開き/半開き」とは異なるが、段階数は一致

### レイヤー抽出方法

依存追加なしの使い捨て Node.js スクリプトで PSD バイナリを直接パース。Pascal 文字列の Shift-JIS デコードおよび `luni`（Unicode レイヤー名）レコード、`lsct`（セクション区切り）レコードを解析してグループ階層を復元。スクリプトは scratchpad に作成し、リポジトリには残していない。

---

## 抽出方法の注記

- 外部リポジトリの調査は GitHub の Web ページ取得による。ソースコードのうちファイル内容まで確認できたのは `favorite.ts`, `layertree.ts`, `go.mod`, `psd.md` 等の一部。`PSDToolKit.lua` のファイル内容はアクセス不能（ディレクトリ一覧のみ）
- `oov/psd` の README は `master` ブランチで取得成功。`main` ブランチは 404
