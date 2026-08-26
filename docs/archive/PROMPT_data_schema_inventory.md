# PROMPT: 既存ゲームデータJSONスキーマ完全棚卸し

## 目的
`docs/wiki/` 構築の前段として、既存ゲームデータJSONの完全な構造を1つのMarkdownドキュメントに棚卸す。

## 成果物
**ファイル**: `docs/wiki/meta/json_schema_inventory.md`（新規作成、ディレクトリも作る）

巨大化時は分割可（後述「出力ボリューム制約」参照）。

## 調査対象（網羅必須）
`src/game/data/` 配下の全 `.json` ファイル。少なくとも以下を含む:
- `characters.json`
- `factions.json`
- `bases.json`
- `facilities.json`
- `items.json`
- `legions.json`
- `softwares.json`（存在する場合）
- `events/_index.json`
- `events/` 配下の全サブディレクトリの全イベントJSON

開始前に `src/game/data/` を再帰的にリスティングし、上記以外のJSONがあれば全て対象に追加。リスト結果を成果物冒頭に記載。

## 作業環境

### 集計スクリプトの使用
- 全レコード走査は集計スクリプトで実施せよ（手動カウント禁止）
- 一時スクリプトは `tools/_scratch/` または `/tmp/` に配置可
- 使い捨て前提、commit禁止（必要なら `tools/_scratch/` を `.gitignore` に追加）
- 言語は jq / node / python など任意

### 参照可能なコード範囲
- `src/` 配下: **read のみ可**（write・exec禁止）
- 例: `BattleEngineV3`, `GameContext`, `ADVScene`, `PartyScene` 等のJSONを読むコード
- 目的: JSON外に存在する実装上の慣習（convention-basedパス、欠落時のfallback、計算式参照等）を「特記事項」として拾うため

## 成功基準

### 必須記載項目（ファイルごと）
1. **ファイルパス**（プロジェクトルートからの相対）
2. **レコード数**（配列の場合は要素数、オブジェクトの場合はトップキー数）
3. **トップレベル構造**（配列 / オブジェクト / オブジェクトの配列 など）
4. **全フィールド一覧**。各フィールドについて:
   - フィールド名（ネストはドット記法、配列内オブジェクトは `skills[].name` 記法）
   - 型（string / number / boolean / array / object / null）
   - **出現率**（全レコード中の存在率、例: `108/108 (100%)`）
   - **enum値のリスト**（取り得る値が有限の場合は全列挙、例: `class: ["general", "staff", "unit"]`）
   - **値域**（数値の場合、min/max）
   - **参照関係**（他JSONのidを指すフィールドは「→ characters.json#id」のように明記）
5. **実例レコード2件**:
   - 典型例 1件（最も平凡なレコード）
   - 特殊例 1件（外れ値・例外的構造を持つレコード）
   - **特殊例には選定理由を1行で明記**（例: 「battleCapacityが値域上限、softwareStatus欠落」）
6. **特記事項**（JSON外の実装慣習。例: 「`portrait`フィールドは存在しない、convention-basedパスで解決」）

### ネスト深度の扱い
- **深度1-2**: フィールド表に直接展開（`status.atk` まで）
- **深度3以上**: 親フィールドのみフィールド表に出し、内部スキーマは該当ファイル末尾に「`<親フィールド名>` の内部構造」として別表で記載
- 配列内オブジェクトは1階層分としてカウント

### イベントJSON固有
- イベント1件あたりの構造（`conditions[]`, `effects[]` 等）
- `conditions` と `effects` の **全種別を列挙**（type値の全パターン、それぞれの必要パラメータ）
- `_index.json` の役割と、サブディレクトリ・個別ファイルとの対応関係
- **章別ディレクトリの完全リスト**（`events/` 配下の全サブディレクトリ名）
- **章IDと所属イベント数のマッピング**（例: `ch01_tohoku: 12件, ch02_kansai: 8件`）
- 章ディレクトリ命名規約の実態（snake_case英数か、章番号の桁数、prefix有無など）
- 同一イベントが複数章に登場する事例があるか
- システムイベント（`events/system/` 等）と章イベントの区別ルール

### 横断的に記載
- JSONファイル間の参照関係マップ（例: characters.factionId → factions.id）
- ID命名規約の実態（snake_case か camelCase か、英数のみか日本語混在か）
- 整合性検査結果（次セクションの定義に従う）

### 各エンティティの日本語表示名フィールド
**この項目はWiki側仕様の例外として記載許可**。後続Phaseで横断的に必要なため。

各エンティティに**日本語表示名フィールドが存在するか**を明記:
- 例: `characters.name: string (日本語表示名)`、`bases.name: なし`
- 章を識別する日本語表示名がイベントJSON内に存在するか

これ以外のWiki側仕様（テンプレ・ディレクトリ・命名規約・変換スクリプト）への言及は禁止。

### 整合性検査の定義
以下の3項目を必ず検査し、結果を記載:

| 項目 | 定義 |
|---|---|
| 孤立参照 | 参照フィールド（factionId, commander 等）のIDが、参照先JSONに存在しない |
| 重複ID | 同一JSON内で `id` フィールドの値が複数レコードに存在する |
| 型不一致 | 同一フィールド名が、同じJSON内のレコード間で異なる型で出現する |

各項目について「0件」または「N件（具体的なid・パス列挙）」で結果記載。**修正はしない、報告のみ**。

## 出力ボリューム制約

### 1ファイル運用の上限
- 概ね 2000 行 / 80KB を目安とする
- 超える見込みなら以下のいずれかで圧縮または分割せよ

### 圧縮
- 実例レコードは典型例＋特殊例の 2 件まで（追加禁止）
- 深度3以上は別表で集約（フィールド表は親型のみ）
- 同一構造を持つイベントJSON群はスキーマ共通化（個別ファイル列挙は省略可、件数集計表のみ）

### 分割（圧縮しても収まらない場合のみ）
- ディレクトリ `docs/wiki/meta/json_schema_inventory/` を作成
- ファイル単位で分割（例: `characters.md`, `events.md`）
- index ファイル `docs/wiki/meta/json_schema_inventory.md` に各分割ファイルへのリンク一覧と全体サマリを残す
- 分割を選択した場合、index に「分割の理由」を1行記載

## 自己検証手順（成果物末尾に「自己検証ログ」セクションを設けて記録）

### 必須検証
1. **網羅証明**: `find src/game/data -name "*.json"` の出力と棚卸し対象一覧を突合。差分0を確認
2. **レコード数突合**: 各JSONについて、`jq` 等で再カウント（配列なら `jq 'length'`、オブジェクトなら `jq 'keys | length'`）し、表の「レコード数」と突合。差分0を確認
3. **enum列挙の完全性**: 主要enumフィールド（class, type, category 等）について、`jq -r '... | unique'` の結果と表記載のenumリストを突合
4. **整合性検査の再現性**: 孤立参照・重複ID・型不一致の検出スクリプトを `tools/_scratch/` に残し、コマンドを自己検証ログに記載

### 自己検証ログのフォーマット
```
## 自己検証ログ
- find結果ファイル数: N / 棚卸し対象数: N → 一致
- characters.json レコード数: jq 出力=108 / 表記載=108 → 一致
- ...
- 検証スクリプト: tools/_scratch/verify_inventory.sh
```

## 制約・スコープ外

### やってはいけないこと
- データファイルの**変更・整形・修正は禁止**。読み取り専用
- フィールドの「あるべき姿」「設計判断」を書かない。**現状の事実のみ記載**
- サンプリング禁止。**全レコード走査**（集計スクリプト経由で実施）
- 推測でフィールドを書かない。コード（JSONそのもの＋それを読むTypeScript/JavaScript）に存在するもののみ
- 既存JSONを読むコード（GameContext, BattleEngineV3 等）を**改変しない**
- KNOWLEDGE.md, src/, tools/（`tools/_scratch/` 除く）への書き込み禁止
- 成果物外への書き込み禁止（`docs/wiki/meta/json_schema_inventory.md` および分割時の `docs/wiki/meta/json_schema_inventory/` のみ）
- Wiki側仕様（テンプレ・ディレクトリ・命名規約・変換スクリプト）への言及・提案を含めない（**例外: 日本語表示名フィールドの有無のみ記載可**）

### 調査範囲外
- Wiki構造そのものの設計（Chat側で実施済み）
- JSON→Markdown変換スクリプトの実装（後続タスク）
- データ修正

## QA
QAはディレクター側で実施。Codeは自己検証ログで以下を示せ:
- find結果と棚卸し対象の一致
- jq 等でのレコード数再カウントと表記載の一致
- enum列挙の完全性
- 整合性検査スクリプトの存在
- 出力ボリューム制約の遵守（1ファイル運用か分割か、分割なら理由）

## 出力フォーマット例

````markdown
# JSON Schema Inventory

生成日: YYYY-MM-DD
対象: src/game/data/ 配下の全JSON
運用: 1ファイル / 分割（分割の場合は理由）

## ファイル一覧
- src/game/data/characters.json (108件)
- src/game/data/factions.json (N件)
- src/game/data/bases.json (N件)
- ...

---

## characters.json

- パス: `src/game/data/characters.json`
- レコード数: 108
- トップ構造: オブジェクトの配列

### フィールド一覧（深度1-2）

| field | type | 出現率 | enum/値域 | 参照 | 備考 |
|---|---|---|---|---|---|
| id | string | 108/108 | - | - | snake_case英数 |
| name | string | 108/108 | - | - | 日本語表示名 |
| factionId | string | 108/108 | - | → factions.json#id | - |
| status.hp | number | 108/108 | 50-200 | - | - |
| status.battleCapacity | number | 108/108 | 100-500 | - | - |
| skills | array | 100/108 | - | - | 深度3+、別表参照 |
| ... | ... | ... | ... | ... | ... |

### `skills` の内部構造（深度3+）

| field | type | 出現率 | enum/値域 | 備考 |
|---|---|---|---|---|
| skills[].name | string | 100% | - | - |
| skills[].type | string | 100% | ["charge", ...] | - |
| ... | ... | ... | ... | ... |

### 実例

典型例:
```json
{ "id": "akari", "name": "紲星あかり", ... }
```

特殊例（選定理由: status.battleCapacity が値域上限、softwareStatusフィールド欠落）:
```json
{ "id": "...", ... }
```

### 特記事項
- `portrait` フィールドは存在しない。`/characters/portraits/<id>.png` のconvention-basedパスで解決（ADVScene, PartyScene の onError fallback で実装）
- ...

---

## factions.json
（同様）

---

## events/

### _index.json
- 役割: ...
- 構造: ...

### イベントレコード共通スキーマ
- フィールド一覧（上記と同様の表）

### conditions の全種別
| type | 必須パラメータ | 出現件数 |
|---|---|---|
| `flag` | name | 42 |
| `hasItem` | itemId | 15 |
| ... | ... | ... |

### effects の全種別
（同上）

### 章別ディレクトリ完全リスト

| ディレクトリ | 章ID | 所属イベント数 | 日本語表示名フィールド | 備考 |
|---|---|---|---|---|
| `events/system/` | system | N | なし | システムイベント |
| `events/ch01_tohoku/` | ch01_tohoku | N | なし | - |
| ... | ... | ... | ... | ... |

### 章ディレクトリ命名規約の実態
- prefix: ch{NN}_{region}
- 例外: ...

---

## 横断参照マップ

- characters.factionId → factions.id
- bases.factionId → factions.id
- legions.commander → characters.id
- ...

## ID命名規約の実態
- 全ID: snake_case英数（例外なし、または例外を列挙）

## 各エンティティの日本語表示名フィールド
- characters.name: あり (string, 日本語)
- factions.name: あり
- bases.name: あり
- events.{title?}: なし／あり（フィールド名明記）
- ...

## 整合性検査結果
- 孤立参照: 0件 / N件（具体的なid・パス列挙）
- 重複ID: 0件 / N件
- 型不一致: 0件 / N件

## 自己検証ログ
- find src/game/data -name "*.json" 結果: N件 / 棚卸し対象: N件 → 一致
- characters.json: jq 'length' = 108 / 表記載 = 108 → 一致
- factions.json: ... → 一致
- enum検証: characters.class jq出力 = ["general","staff","unit"] / 表記載 = 同 → 一致
- 検証スクリプト: tools/_scratch/verify_inventory.sh
````
