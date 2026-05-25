# IMAGE_TASKS.md — ゲーム全体イメージ作業一覧

このドキュメントはゲームに必要な全画像アセットの網羅的リファレンスです。優先度は設けず、ファクト・ベースで現状と必要物を記載します。

---

## 1. キャラクター立ち絵

### 概要

立ち絵は現在 `src/shared/tokens.js` の `CHARS` 配列（c1–c15）にのみ `portrait` フィールドが存在します。`src/game/data/characters.json`（全90キャラクター）には `portrait` フィールド自体がありません。`public/assets/` に実在するファイルは以下の7点のみです：

- `portrait_kiritan.png`
- `portrait_una.png`
- `portrait_shuo.png`
- `portrait_zundamon.png`
- `portrait_meron.png`
- `portrait_bern_fog.png`
- `portrait_awamo.png`

### CHARS配列（tokens.js）に登録されているキャラクター（c1–c15）

| CHARS ID | 名前 | origin | portrait フィールド | ファイル存在 |
|----------|------|--------|-------------------|------------|
| c1 | 東北きりたん | 東北 | `portrait_kiritan.png` | ✓ |
| c2 | 音街ウナ | 東北 | `portrait_una.png` | ✓ |
| c3 | 彩澄しゅお | 東北 | `portrait_shuo.png` | ✓ |
| c4 | ずんだもん | 東北 | `portrait_zundamon.png` | ✓ |
| c5 | 北海道めろん | 北海道 | `portrait_meron.png` | ✓ |
| c6 | ベルン | 北海道 | `portrait_bern_fog.png` | ✓ |
| c7 | 沖縄あわも | 沖縄 | `portrait_awamo.png` | ✓ |
| c8 | 伊達かがみ | 東北 | null（未設定） | ✗ |
| c9 | 花巻ほのか | 東北 | null（未設定） | ✗ |
| c10 | 山形さくら | 東北 | null（未設定） | ✗ |
| c11 | 函館みなみ | 北海道 | null（未設定） | ✗ |
| c12 | 釧路そら | 北海道 | null（未設定） | ✗ |
| c13 | 旭川ゆき | 北海道 | null（未設定） | ✗ |
| c14 | 帯広ひかり | 北海道 | null（未設定） | ✗ |
| c15 | 会津あおい | 東北 | null（未設定） | ✗ |

### characters.json 全キャラクター一覧（mob除く・90名）

いずれも `portrait` フィールドなし。フィールド自体が存在しないため全員未対応。

| ID | 名前 | factionId | status |
|----|------|-----------|--------|
| char_004 | 東北きりたん | 東北家 | active |
| char_005 | 音街ウナ | 東北家 | active |
| char_006 | 彩澄しゅお | 東北家 | active |
| char_008 | 琴葉茜 | faction_new04 | standby |
| char_009 | 琴葉葵 | faction_new04 | standby |
| char_010 | 紲星あかり | faction_new04 | standby |
| char_011 | 結月ゆかり | faction_new04 | active |
| char_012 | 弦巻マキ | faction_new04 | active |
| char_013 | 彩澄りりせ | null | standby |
| char_014 | 東北ずんこ | null | standby |
| char_015 | 東北イタコ | null | standby |
| char_016 | ずんだもん | 東北家 | active |
| char_017 | 四国めたん | 東北家 | active |
| char_018 | 九州そら | 東北家 | active |
| char_019 | 中国うさぎ | 東北家 | active |
| char_020 | 大江戸ちゃんこ | faction_red | active |
| char_021 | 中部つるぎ | faction_red | active |
| char_022 | 関西しのび | faction_red | active |
| char_023 | 沖縄あわも | faction_red | active |
| char_024 | 北海道めろん | faction_red | active |
| char_025 | 小春六花 | faction_yellow | active |
| char_026 | 夏色花梨 | faction_yellow | active |
| char_027 | 花隈千冬 | faction_yellow | active |
| char_028 | さとうささら | faction_new01 | active |
| char_029 | すずきつづみ | faction_new01 | active |
| char_030 | タカハシ | faction_new01 | active |
| char_031 | ONE | faction_new01 | active |
| char_032 | IA | faction_new01 | active |
| char_033 | 双葉湊音 | null | active |
| char_034 | 桜乃そら | null | active |
| char_035 | フリモメン | null | active |
| char_036 | 宮舞モカ | faction_new04 | active |
| char_037 | ついなちゃん | faction_new04 | active |
| char_038 | 京町セイカ | faction_new04 | active |
| char_039 | 重音テト | 東北家 | standby |
| char_040 | 月読アイ | faction_new04 | active |
| char_041 | タンゲコトエ | faction_new04 | active |
| char_042 | 紡乃世詞音 | faction_new04 | active |
| char_043 | 夜語トバリ | faction_new04 | active |
| char_044 | 栗田まろん | faction_green | active |
| char_045 | 足立レイ | null | active |
| char_046 | カキョウヨサリ | faction_new04 | active |
| char_047 | つくよみちゃん | null | active |
| char_048 | No.7 | faction_green | active |
| char_049 | 雨晴はう | faction_green | active |
| char_050 | 冥鳴ひまり | faction_green | active |
| char_051 | もち子 | faction_green | active |
| char_052 | 小夜/SAYO | faction_green | active |
| char_053 | ナースロボ＿タイプＴ | faction_green | active |
| char_054 | アリアル | null | active |
| char_055 | ミリアル | null | active |
| char_056 | アベルーニ | null | active |
| char_057 | リリンちゃん | faction_green | active |
| char_058 | クロワちゃん | faction_green | active |
| char_059 | WhiteCUL | faction_green | active |
| char_060 | アンジーさん | faction_green | active |
| char_061 | ディアちゃん | faction_green | active |
| char_062 | アルマちゃん | faction_green | active |
| char_063 | アメノちゃん | faction_green | active |
| char_064 | MEIKO | faction_new03 | active |
| char_065 | KAITO | faction_new03 | active |
| char_066 | 初音ミク | null | active |
| char_067 | 鏡音リン | faction_new03 | active |
| char_068 | 鏡音レン | faction_new03 | active |
| char_069 | 巡音ルカ | faction_new03 | active |
| char_070 | 猫村いろは | faction_new03 | active |
| char_071 | 歌愛ユキ | faction_new03 | active |
| char_072 | ギャラ子 | null | active |
| char_073 | 鳴花ヒメ | faction_red | active |
| char_074 | 鳴花ミコト | faction_red | active |
| char_075 | 春日部つむぎ | faction_green | active |
| char_076 | 可不 | faction_new03 | active |
| char_077 | 星界 | faction_new03 | active |
| char_078 | 裏命 | faction_new03 | active |
| char_079 | 狐子 | faction_new03 | active |
| char_080 | 羽累 | faction_new03 | active |
| char_081 | フィーちゃん | null | active |
| char_082 | 知声 | null | active |
| char_083 | GUMI | faction_new03 | active |
| char_084 | 猫使アル | null | active |
| char_085 | 猫使ビィ | null | active |
| char_086 | Voidoll | faction_green | active |
| char_087 | ユーレイちゃん | faction_green | active |
| char_088 | 欲音ルコ | faction_new03 | active |
| char_089 | 波音リツ | faction_new03 | active |
| char_090 | 邪神ちゃん | null | active |
| char_091 | flower | null | active |
| char_092 | スーパーフリモたん | faction_new01 | active |
| char_093 | 唯世かのん | null | standby |

**補足：** `char_007` は欠番です。

---

## 2. 表情差分

### ADVSceneがサポートする表情

`ADVScene.jsx` のコメントに明記されている表情セットは以下の5種類です：

```
normal（デフォルト）/ smile / angry / surprised / thinking
```

ファイル命名規則は `portrait_<base>_<expr>.png` で、ベースファイルからサフィックス前の拡張子を差し替えます。例：

- `portrait_kiritan.png`（normal / フォールバック）
- `portrait_kiritan_smile.png`
- `portrait_kiritan_angry.png`
- `portrait_kiritan_surprised.png`
- `portrait_kiritan_thinking.png`

差分ファイルが存在しない場合は `onError` で自動的にベース立ち絵にフォールバックします。現時点では **差分ファイルは一切存在しません**（ベース立ち絵もc7分のみ）。

### 表情差分が必要なキャラクター

ADVSceneの台詞で実際に使用される可能性があるのは、イベントスクリプトまたは DEMO_CAST に登場するキャラクターです。現状のDEMO_CASTは c1（きりたん）・c3（しゅお）・c4（ずんだもん）の3名で、DEMO_SCENARIOでは `normal / smile / angry / thinking` の4表情が使われています。

イベント駆動シーンが増えるほど対象キャラクターは広がります。最低限必要な差分セットとしては、ADV/イベントに登場する全キャラクターについて上記5表情分のファイルが必要です。

---

## 3. ファクション肖像・ロゴ

### ファクション一覧

`src/game/data/factions.json` に定義された8ファクション：

| ID | 名前 | isPlayer | カラー | ロゴファイル | 状態 |
|----|------|----------|--------|------------|------|
| 東北家 | 東北家 | true | `#c4427a` | `logo_tohoku.png` | ✓ 存在 |
| faction_red | 大都会 | false | `#7300ff` | `logo_daitoshi.png` | ✓ 存在（未使用） |
| faction_green | さいたま | false | `#66bb6a` | なし | ✗ 未作成 |
| faction_yellow | 小樽潮風 | false | `#ffca28` | なし | ✗ 未作成 |
| faction_new01 | 東京 | false | `#4294d7` | なし | ✗ 未作成 |
| faction_new02 | 自由都市 | false | `#2d4e37` | なし | ✗ 未作成 |
| faction_new03 | ボーカル界 | false | `#d75d42` | なし | ✗ 未作成 |
| faction_new04 | AHS（仮） | false | `#426ed7` | なし | ✗ 未作成 |

### 各ファクションに必要な画像の種別

各ファクションについて以下の用途向け画像が想定されます：

- **ロゴ／エンブレム**：UI上でファクションを識別するマーク。`logo_tohoku.png` と `logo_daitoshi.png` が既存の先例。
- **指揮官肖像（敵フェーズ演出用）**：EnemyTurnSceneなどで敵ファクションのリーダーを表示する際の立ち絵またはバスト画像。現状は未定義。
- **ファクションカラーバナー／背景パターン**：各ファクションのUI領域を彩るデコレーション素材（任意）。

**備考：** `logo_daitoshi.png` は `public/assets/` に存在しますが、現行コードのどこからも `import` または `src` 参照が確認されていません（未使用の可能性あり）。

---

## 4. 背景画像

### バトル背景

- `public/assets/bg_battle.jpg` — **存在する**。BattleSceneおよびADVSceneのデフォルト背景として使用されています。

### 拠点別背景（bgField / bgCastle）

`bases.json` の全75拠点エントリには `bgField` や `bgCastle` フィールドが存在しません。拠点ごとに異なる戦場背景・城背景を持たせるにはフィールド追加とファイル制作の両方が必要です。現時点では全バトルが `bg_battle.jpg` 1枚を共有しています。

拠点エリア分類（`area` フィールド）：`tohoku`・`hokkaido`・`kanto`・`kansai`・`koshinetsu`・`chushikoku`・`kyushu`・`okinawa` の8エリアが存在します。エリア単位でグループ化すれば最小8枚のバリアントで対応できます。

### タイトル画面背景

タイトル画面専用の背景画像は現状未確認です（コードを別途要確認）。

---

## 5. UIアセット

### 現在確認できる既存UIアセット

- `logo_tohoku.png` — 東北家ロゴ（使用中）
- `logo_daitoshi.png` — 大都会ロゴ（存在するが参照確認要）
- `bg_battle.jpg` — バトル背景（使用中）

### 必要と思われるUIアセット（現状未作成）

- 残り7ファクション分のロゴ画像（`logo_<faction>.png`）
- ファクション別の戦旗・エンブレム（マップ画面での旗表示用）
- マップ画面でのベースアイコン（拠点の種別：首都 / 一般 / ダンジョン付き など）
- ダンジョン関連のアイコン類（`dungeonId` がセットされた拠点が存在：base_012など）
- ターン通知・勝敗演出用の装飾バナー
- キャラクターのステータス画面用のクラス・役割アイコン（front / ranged / rear / support）

---

## 6. 拠点・マップ

### bases.jsonのimageUrl状況

`bases.json` の全75エントリに `imageUrl` フィールドは**存在しません**。拠点サムネイル画像の仕組み自体が未実装です。

### 拠点一覧（全75件）

| ID | 名前 | factionId | isCapital | area |
|----|------|-----------|-----------|------|
| base_001 | 仙台 | 東北家 | true | tohoku |
| base_002 | 新潟 | 東北家 | false | tohoku |
| base_003 | ふくしま | faction_red | false | tohoku |
| base_004 | 函館 | faction_new02 | true | hokkaido |
| base_005 | 前橋 | faction_green | false | kanto |
| base_006 | 小樽 | faction_yellow | true | hokkaido |
| base_007 | 熊谷 | faction_green | false | kanto |
| base_008 | 鳥取 | faction_new04 | false | chushikoku |
| base_009 | 大阪 | faction_new04 | false | kansai |
| base_010 | 山形 | 東北家 | false | tohoku |
| base_011 | 青森 | 東北家 | false | tohoku |
| base_012 | 盛岡 | 東北家 | false | tohoku |
| base_013 | 秋田 | 東北家 | false | tohoku |
| base_014 | 会津 | faction_red | false | tohoku |
| base_015 | 札幌 | faction_yellow | false | hokkaido |
| base_016 | オホーツク | faction_new02 | false | hokkaido |
| base_017 | 釧路 | faction_new02 | true | hokkaido |
| base_018 | 女満別 | faction_new02 | true | hokkaido |
| base_019 | 登別 | faction_new02 | true | hokkaido |
| base_020 | 宇都宮 | faction_green | false | kanto |
| base_021 | 郡山 | faction_red | false | tohoku |
| base_022 | 大宮 | faction_green | false | kanto |
| base_023 | 秩父 | faction_green | false | kanto |
| base_024 | 動物公園 | faction_green | false | kanto |
| base_025 | 武蔵村山 | faction_green | false | kanto |
| base_026 | 浦和 | faction_green | false | kanto |
| base_027 | 川越 | faction_green | false | kanto |
| base_028 | 春日部 | faction_green | true | kanto |
| base_029 | 越谷 | faction_green | false | kanto |
| base_030 | 千葉 | faction_new01 | false | kanto |
| base_031 | 横浜 | faction_new01 | false | kanto |
| base_032 | 秋葉原 | faction_new01 | true | kanto |
| base_035 | 岐阜 | faction_new04 | false | kansai |
| base_037 | 金沢 | faction_new04 | false | kansai |
| base_039 | 静岡 | faction_new04 | false | kansai |
| base_041 | 福井 | faction_new04 | false | kansai |
| base_042 | 和歌山 | faction_new04 | false | kansai |
| base_043 | 滋賀 | faction_new04 | false | kansai |
| base_045 | 水戸 | faction_red | true | kanto |
| base_046 | いわき | faction_red | false | tohoku |
| base_047 | 三陸 | faction_red | false | tohoku |
| base_048 | 浄土ヶ浜 | 東北家 | false | tohoku |
| base_049 | 平泉 | 東北家 | false | tohoku |
| base_050 | 八戸 | 東北家 | false | tohoku |
| base_051 | 湯沢 | 東北家 | false | tohoku |
| base_052 | 苫小牧 | faction_new02 | true | hokkaido |
| base_053 | 襟裳 | faction_new02 | true | hokkaido |
| base_054 | ニセコ | faction_new02 | true | hokkaido |
| base_055 | 新千歳 | faction_new02 | true | hokkaido |
| base_056 | すすきの | faction_new02 | true | hokkaido |
| base_057 | 上川 | faction_new02 | true | hokkaido |
| base_058 | 石垣 | faction_new02 | false | okinawa |
| base_059 | 宮古 | faction_new02 | false | okinawa |
| base_060 | 稚内 | faction_new02 | true | hokkaido |
| base_061 | 那覇 | faction_new02 | false | okinawa |
| base_062 | 竹富 | faction_new02 | false | okinawa |
| base_063 | 厚岸 | faction_new02 | false | hokkaido |
| base_064 | 知床 | faction_new02 | false | hokkaido |
| base_065 | 奄美 | faction_new02 | false | okinawa |
| base_066 | 帯広 | faction_new02 | true | hokkaido |
| base_067 | 北見 | faction_new02 | true | hokkaido |
| base_068 | 日高 | faction_new02 | true | hokkaido |
| base_069 | 親不知 | 東北家 | false | koshinetsu |
| base_070 | 子不知 | faction_new04 | false | koshinetsu |
| base_071 | 高崎 | faction_green | false | kanto |
| base_072 | 所沢 | faction_green | false | kanto |
| base_073 | 深谷 | faction_green | false | kanto |
| base_074 | 京都 | faction_new04 | true | kansai |
| base_075 | 神戸 | faction_new04 | true | kansai |
| base_076 | 奈良 | faction_new04 | true | kansai |
| base_077 | 名古屋 | faction_new04 | true | kansai |
| base_078 | 浜松 | faction_new04 | false | kansai |
| base_079 | 三重 | faction_new04 | false | kansai |
| base_080 | 岡山 | faction_new04 | false | chushikoku |
| base_081 | 島根 | faction_new04 | false | chushikoku |
| base_082 | 広島 | faction_new04 | false | chushikoku |
| base_083 | 佐渡 | faction_new02 | true | tohoku |
| base_084 | 桜島 | faction_new03 | false | kyushu |
| base_085 | 鹿児島 | faction_new03 | false | kyushu |
| base_086 | 宮崎 | faction_new03 | false | kyushu |
| base_087 | 熊本 | faction_new03 | false | kyushu |
| base_088 | 佐賀 | faction_new03 | false | kyushu |
| base_089 | 博多 | faction_new03 | false | kyushu |
| base_090 | 長崎 | faction_new03 | false | kyushu |
| base_091 | 下関 | faction_new03 | false | chushikoku |
| base_092 | 北九州 | faction_new03 | true | kyushu |
| base_093 | 香川 | faction_new03 | false | chushikoku |
| base_094 | 高知 | faction_new03 | false | chushikoku |
| base_095 | 愛媛 | faction_new03 | false | chushikoku |
| base_096 | 徳島 | faction_new03 | false | chushikoku |
| base_097 | 壇ノ浦 | faction_new03 | false | chushikoku |
| base_098 | 富士山 | faction_new02 | true | koshinetsu |

**注意：** base_033, base_034, base_036, base_038, base_040, base_044 は欠番です。

### 拠点サムネイル画像

`bases.json` に `imageUrl` フィールドが存在しないため、現在拠点別サムネイルの仕組みは未実装です。サムネイルを追加する場合はスキーマ変更とファイル制作の両方が必要です。

---

*最終更新: 2026-05-25 — characters.json（90名）、factions.json（8派閥）、tokens.js（CHARS c1–c15）、bases.json（75拠点）、ADVScene.jsx をもとに作成。*
