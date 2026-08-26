# PROMPT: tools/wiki_import.cjs 実装＋初回インポート実行（Phase 4）

## 目的
既存 `src/game/data/` 配下の JSON データを `docs/wiki/` 配下の Markdown（frontmatter のみ、本文空）に一括変換するスクリプトを実装し、実行する。

## 成果物
1. **スクリプト**: `tools/wiki_import.cjs`（新規）
2. **生成物**: `docs/wiki/` 配下の Markdown ファイル群（下表）

## 変換マッピング

| ソース | 出力先 | ファイル命名 | 件数（棚卸し基準） |
|---|---|---|---|
| `characters.json` の `isTemplate:false` | `docs/wiki/characters/<name>.md` | 日本語名 | 104 |
| `characters.json` の `isTemplate:true` | `docs/wiki/mob_templates/<id>.md` | ID | 4 |
| `factions.json` | `docs/wiki/factions/<name>.md` | 日本語名 | 8 |
| `bases.json` | `docs/wiki/bases/<name>.md` | 日本語名 | 92 |
| `items.json` | `docs/wiki/items/<name>.md` | 日本語名 | 2 |
| `legions.json` | `docs/wiki/legions/<name>.md` | 日本語名 | 15 |
| `skills.json` | `docs/wiki/skills/<id>.md` | ID | 6 |
| `dungeons.json` | `docs/wiki/dungeons/<name>.md` | 日本語名 | 1 |
| `promotion_commands.json` | `docs/wiki/commands/<id>.md` | ID | 3 |
| `events/_index.json` + 個別 JSON | `docs/wiki/chapters/<chapter>.md` | chapter ID 集約 | 8 |

**対象外**:
- `facilities.json`（中身空 → 出力なし）
- `softwares.json`（存在せず → 出力なし）
- `companion_lines.json` / `secretary_lines.json`（character に統合、独立ファイルなし）
- `terms/`（KNOWLEDGE.md 由来、Phase 4 自動化対象外）
- `archive/`（旧 kiritan、対象外）
- `src/game/data/test/*.json`（Wiki 対象外）

## 変換規則

### 共通
- frontmatter は YAML（`---` 区切り）、本文は **空**（frontmatter の閉じ `---` 後に空行 1 行のみ）
- UTF-8 / LF 改行
- 既存ファイル衝突時はエラーで停止（上書き禁止、初回実行想定）

### 東北家 ID 正規化（README §5.5）
- factions.json の `id === "東北家"` のレコード → frontmatter で:
  - `id: faction_tohoku`
  - `legacyId: 東北家`
- bases / characters / legions の `factionId === "東北家"` → `faction_tohoku` に置換

### 実行時状態フィールド除外（README §5.4 (a)）
characters の frontmatter から以下を **除外**:
- `usedThisTurn`
- `recoveryRate`
- `equipment`（`equipment.item` のみだが、`equipment` 自体省略）

### character の skills 配列化（Q8）
- `skillId` が非 null → `skills: [<skillId>]`
- `skillId` が null → `skills: []`
- 元の `skillId` フィールドは除外

### character の companionLines 統合
- `companion_lines.json` の `triggers.<triggerKey>.<charId>` を読み、当該 character の frontmatter に:
  ```yaml
  companionLines:
    turn_start: [...]
    low_treasury: [...]
    # 当該 charId の台詞が存在する全 triggerKey
  ```
- 当該 charId の台詞がどの triggerKey にも無ければ `companionLines: null`

### character の secretaryLines（Phase 4 では null 固定）
- `secretary_lines.json` は **charId をキーに持たないトップレベル trigger キー直下構造**（棚卸し記載通り）
- 全 character で `secretaryLines: null`
- 実装時に動的に読む方針のため、Phase 4 で frontmatter には初期値 null のみ

### faction の tags
- `tags: [type/faction]`

### character の tags
- `tags: [type/character, faction/<normalized factionId>]`
- `factionId` が null の場合は `faction/...` タグ省略

### base の tags
- `tags: [type/base, faction/<normalized factionId>, region/<area>]`

### legion の tags
- `tags: [type/legion, faction/<normalized factionId>]`

### mob_template の tags
- `tags: [type/mob_template]`

### item / skill / dungeon の tags
- 各 `[type/item]` / `[type/skill]` / `[type/dungeon]`

### command の category / effects / tags
- `category: promotion` を追加（棚卸しに無いフィールドだが、README §6 (10) で確定済）
- `effects: []` を追加
- `tags: [type/command, command/promotion]`

### chapter 集約
- `events/_index.json` を読み、`chapter` フィールドで grouping
- chapter ごとに 1 ファイル: `docs/wiki/chapters/<chapter>.md`
- frontmatter:
  ```yaml
  id: <chapter>                   # 例 ch01_tohoku
  title: ""                       # 空文字、手動入力待ち
  category: story|system|defeated|theater
  order: <number|null>
  events:
    - id: <eventId>
      trigger: <trigger>
      priority: <priority>
      maxOccurrences: <max>
  tags: [type/chapter, chapter/<chapter>]
  ```
- `category` 判定:
  - chapter が `ch01_xxx`〜`ch05_xxx` → `story`
  - chapter が `system` / `defeated` / `theater` → そのまま
- `order` 判定:
  - `story` カテゴリは chapter の先頭 `ch0N` の数字 N（1〜5）
  - それ以外は `null`
- events 配列の各イベントメタは個別 event JSON から取得（`_index.json` の path を辿る）
- 本文は **空**（Phase 6 watcher 仕様で確定するまで個別イベント本文の記述は保留）

### ファイル名安全化
- 以下文字を `_` に置換: `/` `\` `:` `*` `?` `"` `<` `>` `|`
- 全角括弧・全角スペースはそのまま（macOS でファイル名として使用可）
- ファイル名重複検知（同名 base/character 等が無いか確認）→ あれば末尾に `_<id>` を付与してエラーログ出力

### YAML 出力
- `js-yaml` パッケージ使用（既存 `package.json` の `devDependencies` 確認、無ければ `npm install --save-dev js-yaml`）
- 出力オプション: `{ indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false, noRefs: true }`
- `null` 値は YAML の `null` で明示出力

## 成功基準
1. `tools/wiki_import.cjs` が新規作成され、`node tools/wiki_import.cjs` で正常終了（exit code 0）
2. 生成ファイル数（10 ディレクトリ合計）:
   - `characters/` 104 ファイル
   - `mob_templates/` 4 ファイル
   - `factions/` 8 ファイル
   - `bases/` 92 ファイル
   - `items/` 2 ファイル
   - `legions/` 15 ファイル
   - `skills/` 6 ファイル
   - `dungeons/` 1 ファイル
   - `commands/` 3 ファイル
   - `chapters/` 8 ファイル
   - **合計 243 ファイル**
3. 全 .md ファイルが `---\n` で始まり frontmatter を `---\n\n` で閉じる
4. 全 .md ファイルが UTF-8 / LF 改行
5. `docs/wiki/README.md` と `docs/wiki/meta/json_schema_inventory.md` は変更なし（git diff で確認）
6. 既存 `.gitkeep` は残置（削除禁止）
7. ファイル名重複が発生した場合は標準エラー出力に明示報告し、当該ファイルは末尾 `_<id>` 付与で生成

## 禁止事項
- 棚卸し（`docs/wiki/meta/json_schema_inventory.md`）に無いフィールドの追加禁止（変換規則で明記された追加フィールド = command の `category` / `effects` のみ例外）
- README.md / meta/ / .gitkeep への変更禁止
- 個別イベント本文の生成禁止（chapter.md は frontmatter のみ、本文空）
- `src/game/data/` 配下の改変禁止（読み取り専用）
- 過剰な抽象化禁止（直接的に書く、エラー時は throw で即停止）

## プログラマ 3 大美徳
- **怠惰**: js-yaml に任せる、棚卸しを完全再利用、共通変換ロジックを関数化（過剰抽象化はしない）
- **短気**: 衝突・型不一致・不正値はその場で throw して止める、サイレント失敗禁止
- **傲慢**: 東北家 ID 正規化・skillId→skills 配列・companionLines 統合の 3 つを取り違えない

## 引き継ぎ
完了後、以下を報告:
1. `find docs/wiki -name "*.md" ! -name "README.md" | wc -l` の結果（期待値 243）
2. 各ディレクトリの md 件数: `for d in characters mob_templates factions bases items legions skills dungeons commands chapters; do echo "$d: $(ls docs/wiki/$d/*.md 2>/dev/null | wc -l)"; done`
3. `node tools/wiki_import.cjs` の標準出力・標準エラー出力
4. ファイル名重複が発生した場合は対象一覧

Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
