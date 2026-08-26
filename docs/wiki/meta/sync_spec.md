# Wiki ↔ JSON 双方向同期仕様書

生成日: 2026-06-29
位置づけ: Phase 6 watcher 実装の契約書。Phase 1〜4 の確定事項を統合し、運用時の変換規則・衝突解決・実装要件を定義する。

## 目次

- [1. 同期アーキテクチャ](#1-同期アーキテクチャ)
- [2. 同期方向の定義](#2-同期方向の定義)
- [3. 出力先と中間ファイル](#3-出力先と中間ファイル)
- [4. エンティティ別フィールド対応表（13 種）](#4-エンティティ別フィールド対応表13-種)
- [5. 変換規則](#5-変換規則)
  - [5.1 東北家 ID 正規化](#51-東北家-id-正規化最重要)
  - [5.2 skills 配列 ↔ skillId 単一](#52-skills-配列--skillid-単一)
  - [5.3 companionLines / secretaryLines](#53-companionlines--secretarylines)
  - [5.4 ファイル名 ↔ id の双方向解決](#54-ファイル名--id-の双方向解決)
  - [5.5 タグ・portrait 等の Wiki 限定フィールド](#55-タグportrait-等の-wiki-限定フィールド)
  - [5.6 配列順序の保持](#56-配列順序の保持)
  - [5.7 個別イベント本文の構造化記法](#57-個別イベント本文の構造化記法)
- [6. 既定値補完ルール](#6-既定値補完ルール)
- [7. 手書き例外](#7-手書き例外)
- [8. 衝突解決](#8-衝突解決)
- [9. watcher 実装契約](#9-watcher-実装契約)
- [10. エラー処理と回復](#10-エラー処理と回復)
- [11. テスト戦略](#11-テスト戦略)

---

## 1. 同期アーキテクチャ

```
[編集者]
   │ Markdown 編集
   ▼
docs/wiki/**/*.md      ← Single Source of Truth（SSOT）
   │
   │ chokidar watcher
   ▼
tools/wiki_build.cjs   ← 変換器（双方向ロジックの単一実装）
   │
   ▼
build/data/            ← 中間生成物（git 追跡対象外を推奨、`.gitignore` 検討）
   │
   │ コピーフェーズ
   ▼
src/game/data/         ← 実行時参照（既存コードが直接読む）
```

- **SSOT**: `docs/wiki/` の Markdown frontmatter
- **二次生成物**: `build/data/` および `src/game/data/`
- **逆流（JSON 直接編集）**: 原則 **禁止**。初回インポート（Phase 4）以降、JSON への手書きは厳禁。例外は `test/` 配下のみ
- **`src/game/data/` の扱い**: 過渡期は watcher が直接書き込む。最終的に `build/data/` のみが生成物、`src/game/data/` は廃止または symlink 化を検討（Phase 7 以降）

---

## 2. 同期方向の定義

### 2.1 Wiki → JSON（プライマリ方向、常時）

- watcher が `docs/wiki/**/*.md` の変更を検知 → `wiki_build.cjs` 起動 → `src/game/data/` と `build/data/` を上書き
- 全 13 エンティティ対象（character / mob_template / faction / base / facility / item / legion / skill / dungeon / software / chapter / command / term）
- ただし facility / software / term は現状空または未実装 → ビルド対象外（生成スキップ）

### 2.2 JSON → Wiki（限定的）

- 初回インポート（Phase 4）のみ実施済。以降は **手動コマンド起動時のみ**
- 用途: 緊急時の JSON 手動修正後、Wiki に反映させる場合
- Phase 4 実装の `tools/wiki_import.cjs` は衝突時エラー停止のみ。`--force-overwrite` オプションは **現状未実装**、Phase 7 以降で追加検討
- 通常運用では使用しない

### 2.3 ループ防止

- watcher は `docs/wiki/` のみ監視、`build/data/` および `src/game/data/` は監視対象外
- ビルド処理中は watcher のイベント受信を一時停止（debounce 500ms 推奨）

---

## 3. 出力先と中間ファイル

| パス | 役割 | 生成元 | 編集可否 |
|---|---|---|---|
| `docs/wiki/**/*.md` | SSOT | 人手 | 編集可（プライマリ） |
| `build/data/` | 中間生成物 | watcher 自動生成 | **編集禁止** |
| `src/game/data/*.json` | 実行時参照 | watcher 自動生成 | **編集禁止**（例外: `test/` / `companion_lines.json` / `secretary_lines.json` / `facilities.json`） |
| `src/game/data/test/*.json` | テスト専用データ | 人手 | 編集可（Wiki 対象外） |
| `src/game/data/companion_lines.json` | 軍師台詞データ | Phase 4 既存 | watcher 触らず、手動編集も非推奨 |
| `src/game/data/secretary_lines.json` | 秘書台詞データ | Phase 4 既存 | 同上 |
| `src/game/data/facilities.json` | 施設データ（現状空） | Phase 4 既存 | watcher 触らず、現状の空状態維持 |

`build/data/` は `.gitignore` 追加候補（運用フェーズで判断）。

---

## 4. エンティティ別フィールド対応表（13 種）

### 4.1 character

Wiki: `docs/wiki/characters/<factionId>/<日本語名>.md`（factionId 値が文字列）または `docs/wiki/characters/<日本語名>.md`（factionId: null）または `docs/wiki/mob_templates/<id>.md`
JSON: `src/game/data/characters.json` の `characters` 配列要素

**スキャン規約**: `docs/wiki/characters/` 直下の `.md` ファイル（factionId: null キャラ用）+ subdirectory 内の `.md` ファイル（factionId 持ちキャラ用、1 階層のみ）を結合。subdirectory 名は frontmatter `factionId` 値と一致すべき（不一致時はビルドエラー）。

| Wiki frontmatter | JSON フィールド | 変換規則 |
|---|---|---|
| `id` | `id` | そのまま |
| `name` | `name` | そのまま |
| `factionId` | `factionId` | `faction_tohoku` → `東北家` に逆変換（factions.legacyId 解決） |
| `isLeader` | `isLeader` | そのまま |
| `isTemplate` | `isTemplate` | そのまま |
| `role` | `role` | そのまま（enum: attacker / guardian） |
| `attackType` | `attackType` | そのまま（enum: melee / ranged / song） |
| `charHp` / `charMaxHp` / `charAttack` / `charDefense` / `charSong` | 同名 | そのまま |
| `attack` / `defense` / `attackCount` | 同名 | そのまま |
| `soldiers` / `maxSoldiers` / `soldierAtk` / `soldierDef` | 同名 | そのまま |
| `strategyRate` | `strategyRate` | そのまま |
| `skills` (array) | `skillId` (single) | `skills[0]` を `skillId` に、空配列なら `null`。**`skills.length > 1` の場合は警告 stderr 出力後 `skills[0]` のみ JSON 反映**。多 skill 対応は JSON スキーマ拡張で将来対応 |
| `specialType` | `specialType` | 省略時は `null` 補完 |
| `kana` | `kana` | 省略時は `null` 補完 |
| `hireCost` | `hireCost` | そのまま |
| `joinCondition` | `joinCondition` | そのまま |
| `description` | `description` | そのまま |
| `talkEventId` | `talkEventId` | 省略時は `null` 補完 |
| `battleBonus` | `battleBonus` | object そのまま、欠損キーは 0 で補完 |
| `portrait` | （JSON に無し） | **Wiki のみ。JSON 出力時は除外** |
| `companionLines` | （JSON に無し） | **Wiki のみ。companion_lines.json への逆統合は Phase 7 以降検討** |
| `secretaryLines` | （JSON に無し） | **Wiki のみ。常に null（実装側で動的読込）** |
| `tags` | （JSON に無し） | **Wiki のみ、ビルド時除外** |
| — | `usedThisTurn` | **JSON にのみ存在、常に `false` 注入** |
| — | `recoveryRate` | **JSON にのみ存在、常に `null` 注入** |
| — | `equipment` | **JSON にのみ存在、常に `{ item: null }` 注入** |

mob_templates の場合は以下を追加:

| Wiki frontmatter | JSON フィールド | 変換規則 |
|---|---|---|
| `displayName` | `displayName` | そのまま（mob 必須） |
| `nameVariants` | `nameVariants` | そのまま（任意） |
| `statVariance` | `statVariance` | そのまま（任意、default 0.15） |

### 4.2 faction

Wiki: `docs/wiki/factions/<日本語名>.md`
JSON: `src/game/data/factions.json` の `factions` 配列要素

| Wiki | JSON | 変換規則 |
|---|---|---|
| `id` | `id` | `legacyId` があれば `legacyId` の値を JSON `id` に出力（東北家対応） |
| `legacyId` | （JSON に無し） | **Wiki のみ、JSON 出力で id 解決後は破棄** |
| `name` | `name` | そのまま |
| `color` | `color` | そのまま |
| `isPlayer` | `isPlayer` | そのまま |
| `treasury` | `treasury` | そのまま（初期値） |
| `atWarWith` | `atWarWith` | そのまま（初期値） |
| `warFlags` | `warFlags` | object そのまま、欠損は `{}` 補完 |
| `tags` | — | Wiki のみ |

### 4.3 base

Wiki: `docs/wiki/bases/<日本語名>.md`
JSON: `src/game/data/bases.json` の `bases` 配列要素

全フィールド 1:1 対応。`factionId` のみ `faction_tohoku` ↔ `東北家` 変換。`tags` は Wiki のみ。`bgCastle` / `bgField` は任意（出現率 1%）、省略時は JSON 出力で `null` 補完。

### 4.4 item

Wiki: `docs/wiki/items/<日本語名>.md`
JSON: `src/game/data/items.json` の `items` 配列要素

全フィールド 1:1 対応。`tags` は Wiki のみ。

### 4.5 legion

Wiki: `docs/wiki/legions/<日本語名>.md`
JSON: `src/game/data/legions.json` の `legions` 配列要素

全フィールド 1:1 対応。`factionId` のみ `faction_tohoku` ↔ `東北家` 変換。`isDefenseReserve` は任意（出現率 46%）、省略時は JSON 出力で `false` 補完。`tags` は Wiki のみ。

### 4.6 skill

Wiki: `docs/wiki/skills/<id>.md`
JSON: `src/game/data/skills.json` の `skills` 配列要素

全フィールド 1:1 対応。`specialType` は任意（出現率 33%）、省略時は JSON 出力で `null` 補完。`tags` は Wiki のみ。

### 4.7 dungeon

Wiki: `docs/wiki/dungeons/<日本語名>.md`
JSON: `src/game/data/dungeons.json` の `dungeons` 配列要素

全フィールド 1:1 対応。`floors[].rewardItemId` / `floors[].eventId` は任意、省略時は `null` 補完。`tags` は Wiki のみ。

### 4.8 command

Wiki: `docs/wiki/commands/<id>.md`
JSON: `src/game/data/promotion_commands.json` の `promotion_commands` 配列要素

| Wiki | JSON | 変換規則 |
|---|---|---|
| `id` | `id` | そのまま |
| `name` | `name` | そのまま |
| `limited` | `limited` | そのまま |
| `category` | （JSON に無し） | **Wiki のみ、ビルド時除外** |
| `effects` | （JSON に無し） | **Wiki のみ（将来用）、ビルド時除外** |
| `tags` | — | Wiki のみ |

### 4.9 chapter

Wiki: `docs/wiki/chapters/<chapterId>.md`
JSON: `src/game/data/events/<chapter>/<eventId>.json` および `src/game/data/events/_index.json`

**注意**: chapter.md は集約ページ。frontmatter `events[]` から個別 JSON を生成し、本文の構造化記法（Phase 6 で確定）から conditions / effects / script を抽出する。

| Wiki | JSON | 変換規則 |
|---|---|---|
| `id` | `_index.json` の `chapter` フィールド | そのまま |
| `title` | （JSON に無し） | **Wiki のみ** |
| `category` | （JSON に無し） | **Wiki のみ**（story/system/defeated/theater 判別用） |
| `order` | （JSON に無し） | **Wiki のみ** |
| `events[].id` | 個別 JSON の `id` | そのまま |
| `events[].trigger` | 個別 JSON の `trigger` | そのまま |
| `events[].priority` | 個別 JSON の `priority` | そのまま |
| `events[].maxOccurrences` | 個別 JSON の `maxOccurrences` | そのまま |
| 本文（`## <eventId>` セクション直下の \`\`\`yaml フェンスドコードブロック） | 個別 JSON の全フィールド（conditions / effects / script / dialogue 等） | YAML ブロックの内容を JSON に変換、ブロック内キー名は個別 event JSON と完全一致。詳細は §5.7 |

`_index.json` は chapter.md 全件を集約して watcher が自動生成（詳細は §5.7）。

### 4.10 facility / software / term

- **facility**: `src/game/data/facilities.json` は watcher が **一切触らない**（現状の空状態 `{ research: [], upgradeCommands: [] }` を維持）。Wiki に `facilities/*.md` エントリが追加されても無視する。実装変更時に別フェーズで対応規約を確定
- **software**: `src/game/data/softwares.json` は現状存在しない。watcher は **生成しない**。Wiki に `softwares/*.md` エントリが追加されても無視。実装時に別フェーズで対応
- **term**: JSON 出力対象外、Wiki 専用エンティティ。watcher は読み取りも書き込みも行わない

これら 3 種は Phase 6 watcher の **ビルド対象から完全除外**。

---

## 5. 変換規則

### 5.1 東北家 ID 正規化（最重要）

- factions: Wiki `id: faction_tohoku` + `legacyId: 東北家` → JSON `id: 東北家`
- characters / bases / legions: Wiki `factionId: faction_tohoku` → JSON `factionId: 東北家`
- 逆方向（JSON → Wiki）: factions の `id === "東北家"` レコードに `legacyId` を併記、他レコードは `legacyId` 無し

実装: factions.json から `legacyId 辞書` を構築し、参照する全エンティティで変換適用。

### 5.2 skills 配列 ↔ skillId 単一

- Wiki `skills: [<skillId>]` → JSON `skillId: <skillId>`
- Wiki `skills: []` → JSON `skillId: null`
- 将来複数 skill 対応時は JSON スキーマ変更必要（現状 1:1）

### 5.3 companionLines / secretaryLines

- 現状: JSON 側 `companion_lines.json` / `secretary_lines.json` は Wiki への統合先未確定の charId 群を含む
- Phase 6 では `companionLines` フィールドの Wiki → JSON 逆統合は **実装しない**
- 当面 companion_lines.json / secretary_lines.json は **watcher が読み書きしない**（Phase 4 時点の状態を維持）
- 手動編集も非推奨（編集時は git 直接コミット、Wiki 整合性チェックの対象外）
- Wiki frontmatter の `companionLines` / `secretaryLines` フィールドは **将来用プレースホルダ**として現状 null 固定
- Phase 7 以降で character 単位の Wiki frontmatter フィールドへの完全移行を再設計

### 5.4 ファイル名 ↔ id の双方向解決

- Wiki → JSON: frontmatter の `id` を JSON の `id` として使用、ファイル名は無視
- JSON → Wiki（逆方向、Phase 7 以降）: JSON `id` → Wiki ファイル名は `name` 日本語化、安全文字置換適用

### 5.5 タグ・portrait 等の Wiki 限定フィールド

以下は Wiki frontmatter にのみ存在し、JSON 出力時に除外:
- `tags`（全エンティティ）
- `portrait`（character）
- `legacyId`（faction）
- `category` / `effects`（command）
- `title` / `category` / `order`（chapter）
- `companionLines` / `secretaryLines`（character、§5.3 参照）

### 5.6 配列順序の保持

- 同一エンティティ内の配列順序は **Wiki 上の記述順** を保持
- characters 配列、bases 配列、events 配列など全て対象
- 順序入れ替えで挙動が変わるロジックがある可能性 → 順序保持厳守

### 5.7 個別イベント本文の構造化記法

chapter.md の本文では、frontmatter `events[]` で列挙した各イベントを `## <eventId>` 見出しで区切り、見出し直下に YAML フェンスドコードブロックを配置する:

````markdown
## ev_000_opening
```yaml
id: ev_000_opening
chapter: system
trigger: game_start
priority: 1000
maxOccurrences: 1
conditions: []
effects:
  - type: dialogue
    speaker: char_004
    text: ...
script: []
```

## ev_turn1_status
```yaml
id: ev_turn1_status
# ...
```
````

**規則**:
- 見出しは `## ` から始まる H2、テキストは frontmatter `events[].id` と完全一致（不一致時はビルドエラー）
- 見出し直後（空行を挟んでよい）に YAML フェンスドコードブロック 1 個
- YAML ブロック内のキー名は個別 event JSON のフィールドと完全一致
- YAML ブロック内の `id` と見出しテキストが不一致 → ビルドエラー
- YAML ブロック内の `chapter` と chapter.md の frontmatter `id` が不一致 → ビルドエラー
- YAML ブロックの内容を JSON に変換して `src/game/data/events/<chapter>/<eventId>.json` に出力
- chapter.md の frontmatter `events[]` の各項目（id / trigger / priority / maxOccurrences）と YAML ブロック内の同名フィールドが不一致 → ビルドエラー

**`_index.json` の生成**:
- 全 chapter.md を集約して watcher が自動生成
- 出力構造: `{ "events": [ { "id", "chapter", "trigger", "priority", "maxOccurrences", "path" }, ... ] }`
- `path` は `events/<chapter>/<eventId>.json`（`src/game/data/` からの相対パス）
- 順序は chapter.md ファイル名のアルファベット順 → 各 chapter 内の events[] 順

---

## 6. 既定値補完ルール

JSON 出力時、Wiki frontmatter で省略されたフィールドは以下で補完:

| エンティティ | フィールド | 既定値 |
|---|---|---|
| character | `usedThisTurn` | `false` |
| character | `recoveryRate` | `null` |
| character | `equipment` | `{ item: null }` |
| character | `specialType` | `null` |
| character | `kana` | `null` |
| character | `talkEventId` | `null` |
| character | `joinCondition` | `null` |
| character | `battleBonus.*.{soldierAtk,soldierDef,charAttack,charSong}` | `0` |
| faction | `warFlags` | `{}` |
| base | `bgCastle` / `bgField` | `null` |
| legion | `isDefenseReserve` | `false` |
| legion | `attackFrequency` | `null` |
| skill | `specialType` | `null` |
| dungeon | `floors[].rewardItemId` / `eventId` | `null` |

---

## 7. 手書き例外

以下は Wiki 上で手動編集するフィールド（自動生成されない）:

1. **`description` 全般**: 人物紹介・拠点説明・アイテム効果など、人手で書く
2. **`chapter.md` の `title`**: 章タイトル日本語（例: 「第一章 東北統一」）
3. **`chapter.md` の本文**: 個別イベント記述（Phase 6 構造化記法で確定）
4. **`term/*.md`**: KNOWLEDGE.md §5 から手動移行
5. **`archive/*`**: 旧 kiritan 資料、手動配置

---

## 8. 衝突解決

### 8.1 同時編集

- watcher は単一プロセス、ファイル変更は順次処理（debounce 500ms）
- 複数人同時編集時は git レベルで衝突解決（Wiki が SSOT、git 上の最終状態を採用）

### 8.2 Wiki → JSON ビルド失敗時

- ビルドエラー（YAML パース失敗、型不一致、参照解決失敗）発生時:
  - 標準エラー出力にエラー詳細
  - `build/data/` および `src/game/data/` は **前回成功時の状態を維持**（中途半端な状態を残さない）
  - 修正後の次回ビルドで再試行

### 8.3 参照整合性違反

- character の `factionId` が factions に存在しない id → ビルドエラー
- base の `factionId` 同様
- legion の `charIds` / `mobSlots.templateId` 同様
- chapter の `events[].id` が個別 JSON と不一致 → ビルドエラー

整合性検査は Phase 1 で `consistency.py` 確立済（孤立参照 0 / 重複 ID 0 確認済）。watcher は同等の検査を毎ビルド実行。

### 8.4 ファイル名重複（OS 物理上の衝突）

- 同一ディレクトリで同名 md ファイル（例: `bases/仙台.md` を 2 件作成）は OS が許さないため発生し得ない
- 異なる name で同一 id を持つ 2 ファイル → ID 重複エラー（§10.1）
- Wiki 初期生成・追加生成時に同一 name キャラ等が複数存在する場合 → Phase 4 と同様、末尾 `_<id>` 付与で衝突回避（例: `小夜_SAYO.md`）
- Phase 6 以降の追加生成（JSON → Wiki 逆方向時、`wiki_import.cjs`）でも同規約を継続適用

---

## 9. watcher 実装契約

### 9.1 実装ファイル

- `tools/wiki_build.cjs`: Wiki → JSON ビルダー本体
- `tools/wiki_watch.cjs`: chokidar 監視 + debounce + ビルド起動
- `tools/wiki_import.cjs`: 逆方向（既に Phase 4 で実装済）

### 9.2 依存

- `js-yaml` (Phase 4 で導入済)
- `chokidar` (新規導入、`npm install --save-dev chokidar`)

### 9.3 起動方法

- `npm run wiki:watch` （`package.json` scripts に追加）
- `npm run wiki:build` （単発ビルド、CI 等で使用）

### 9.4 監視対象

- `docs/wiki/**/*.md`（再帰）
- `docs/wiki/archive/**` は監視対象外

### 9.5 debounce

- 500ms（同時編集や保存連打のバーストを抑制）

### 9.6 ビルド処理フロー

1. 全 `docs/wiki/**/*.md` を再帰スキャン
2. frontmatter を YAML パース
3. 整合性検査（参照解決、ID 重複、必須フィールド）
4. エンティティ別に集約（characters 配列、factions 配列、...）
5. 既定値補完
6. Wiki 限定フィールド除外
7. JSON 書き出し（`build/data/` → `src/game/data/`）
8. 完了ログ（標準出力）

### 9.7 増分ビルドの可否

- Phase 6 初期実装は **全件再ビルド**（シンプルさ優先）
- パフォーマンス問題発生時に増分ビルド導入を検討（Phase 7 以降）

---

## 10. エラー処理と回復

### 10.1 エラー分類

| エラー種別 | 例 | 挙動 |
|---|---|---|
| YAML パース失敗 | frontmatter 構文エラー | 該当ファイル特定、エラー収集 |
| 型不一致 | `treasury: "abc"`（数値期待） | 該当フィールド特定、エラー収集 |
| 必須フィールド欠落 | character の `id` 無し | 該当ファイル特定、エラー収集 |
| 参照解決失敗 | base の factionId が存在しない | 該当 ID 表示、エラー収集 |
| ID 重複 | 同一 id の character 2 件 | 両方のファイルパス表示、エラー収集 |
| chapter 本文記法違反 | 見出しと YAML `id` 不一致等（§5.7） | 該当 chapter / event 特定、エラー収集 |
| ファイル書き込み失敗 | 権限エラー、ディスク不足 | OS エラー表示、即停止（出力フェーズ） |

**複数エラー発生時の方針**: ビルドは「収集 → 検証 → 出力」の 3 段階。検証フェーズ（YAML パース・型・参照・重複）で複数エラーが見つかっても **即停止せず全件収集してから一括 stderr 出力 → ビルド中止**。中途半端な書き込みを避けるため出力フェーズには進まない。出力フェーズでの書き込み失敗のみ即停止。

### 10.2 回復手順

- 編集者が stderr のエラーを見て修正
- watcher は次回ファイル変更時に自動再試行
- 手動再試行は `npm run wiki:build`

### 10.3 watcher 自体のクラッシュ

- プロセスマネージャ未使用（手動 `npm run wiki:watch` で起動）
- クラッシュ時は手動再起動
- Phase 7 以降で pm2 / nodemon 統合検討

---

## 11. テスト戦略

### 11.1 単体テスト

- `tools/wiki_build.cjs` の各変換関数（東北家正規化、skills↔skillId、既定値補完、§5.7 chapter 本文パース）に単体テスト追加
- フレームワーク: **vitest** を採用（Vite 既存、追加コスト低、`npm install --save-dev vitest`）

### 11.2 統合テスト

- Phase 4 で生成された 243 ファイルを入力に full ビルド実行
- 生成された JSON が `src/game/data/` の Phase 4 直前状態（git stash 退避）と一致することを確認
- diff 0 が成功基準

### 11.3 リグレッション

- ゲーム起動テスト（QA URL: `http://localhost:5173/?qa=battlefull`）で Phase 4 前後の挙動同一を確認
- Phase 6 実装後、watcher 稼働状態でゲーム起動 → 動作不変を確認

---

## 改訂履歴

- 2026-06-29: Phase 5 初版作成。Phase 1〜4 確定事項を統合
- 2026-06-29: Phase 5 セルフレビュー対応。§2.2 wiki_import 実装事実明記 / §3 編集禁止例外明示 / §4.1 skills 複数件警告規定 / §4.9 chapter 本文記法を §5.7 へ詳細化 / §4.10 facility/software/term 完全除外 / §5.3 companion 系編集方針明文化 / §5.7 新設 / §8.4 ファイル名重複明文化 / §10.1 複数エラー収集方針追加 / §11.1 vitest 採用確定
