# PROMPT: tools/wiki_build.cjs + tools/wiki_watch.cjs 実装（Phase 6）

## 目的
Phase 5 で確定した同期仕様（`docs/wiki/meta/sync_spec.md`）に基づき、Wiki → JSON ビルダー本体と chokidar watcher を実装する。Phase 4 で生成された 243 個の Markdown を入力として、`src/game/data/` の現状 JSON と **完全一致**（diff 0）する出力を生成できることを成功基準とする。

## 成果物

1. **`tools/wiki_build.cjs`**（新規）: Wiki → JSON ビルダー本体
2. **`tools/wiki_watch.cjs`**（新規）: chokidar 監視 + debounce + ビルド起動
3. **`tools/wiki_build.test.cjs`** または **`tests/wiki_build.test.cjs`**（新規）: vitest 単体テスト
4. **`package.json` 更新**: `wiki:build` / `wiki:watch` / `wiki:test` scripts 追加、`chokidar` および `vitest` 依存追加
5. **`build/data/`**（新規ディレクトリ、初回ビルドで自動生成）: 中間生成物

## 前提（必読ドキュメント）

実装着手前に **全文読了必須**:
- `docs/wiki/meta/sync_spec.md` ← Phase 6 実装の契約書
- `docs/wiki/meta/json_schema_inventory.md` ← フィールド・型・enum の棚卸し
- `docs/wiki/README.md` ← エンティティテンプレ 13 種
- `tools/wiki_import.cjs` ← Phase 4 実装、依存（js-yaml）・コード規約の参考

## 実装要件

### 1. tools/wiki_build.cjs

#### 1.1 アーキテクチャ

「収集 → 検証 → 出力」の 3 段階フェーズ構造（sync_spec.md §10.1）:

```
[収集フェーズ]
  └─ docs/wiki/**/*.md を再帰スキャン
  └─ frontmatter YAML パース
  └─ chapter.md 本文の YAML フェンスドコードブロック抽出（§5.7）
  └─ エンティティ別に内部表現に集約

[検証フェーズ]
  └─ 型検査（schema_inventory に基づく）
  └─ 必須フィールド検査
  └─ 参照整合性検査（factionId / charIds / mobSlots.templateId / chapter.events[].id）
  └─ ID 重複検査
  └─ chapter 本文記法違反検査（§5.7）
  └─ エラー全件収集、1 件でもあれば一括 stderr 出力 → exit 1

[出力フェーズ]
  └─ 既定値補完（§6）
  └─ Wiki 限定フィールド除外（§5.5）
  └─ 東北家 ID 逆正規化（§5.1）
  └─ skills 配列 → skillId 単一（§5.2、複数件時は警告）
  └─ JSON 書き出し: build/data/ → src/game/data/ にコピー
```

#### 1.2 監視・処理対象エンティティ（10 種）

| 入力ディレクトリ | 出力ファイル |
|---|---|
| `docs/wiki/characters/` | `src/game/data/characters.json`（`isTemplate:false` のレコードと mob_templates を統合） |
| `docs/wiki/mob_templates/` | 同上（`isTemplate:true` のレコードとして characters 配列に統合） |
| `docs/wiki/factions/` | `src/game/data/factions.json` |
| `docs/wiki/bases/` | `src/game/data/bases.json` |
| `docs/wiki/items/` | `src/game/data/items.json` |
| `docs/wiki/legions/` | `src/game/data/legions.json` |
| `docs/wiki/skills/` | `src/game/data/skills.json` |
| `docs/wiki/dungeons/` | `src/game/data/dungeons.json` |
| `docs/wiki/commands/` | `src/game/data/promotion_commands.json` |
| `docs/wiki/chapters/` | `src/game/data/events/<chapter>/<eventId>.json`（個別） + `src/game/data/events/_index.json`（集約） |

#### 1.3 完全除外（sync_spec.md §4.10）

以下は watcher が一切触らない:
- `docs/wiki/facilities/` → `src/game/data/facilities.json` 触らず
- `docs/wiki/softwares/` → `src/game/data/softwares.json` 生成しない
- `docs/wiki/terms/` → JSON 出力なし
- `docs/wiki/archive/` → 監視対象外
- `src/game/data/companion_lines.json` / `secretary_lines.json` → 触らず（既存維持）
- `src/game/data/test/` → 触らず

#### 1.4 出力先

- 第一出力: `build/data/<同上>`
- 第二出力: `src/game/data/<同上>`（`build/data/` からコピー）
- 過渡期は両方に書き込む（sync_spec.md §1）

#### 1.5 既定値補完（sync_spec.md §6）

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
| base | `bgCastle` / `bgField` | `null`（**Phase 4 で出力なしなら省略**、`null` 出力は出現実績 1% に限る） |
| legion | `isDefenseReserve` | `false` |
| legion | `attackFrequency` | `null` |
| skill | `specialType` | `null` |
| dungeon | `floors[].rewardItemId` / `eventId` | `null` |

**重要**: 既定値補完で発生する出力が Phase 4 直前の `src/game/data/` 原本と diff を生じる場合、その補完は **行わない**（Phase 4 実装は原本忠実なため、原本にないフィールドは省略のままが正解）。具体的には `base.bgCastle` / `bgField` は出現率 1% であり、原本では 99% 省略 → 補完しない。

#### 1.6 chapter 本文記法パース（sync_spec.md §5.7）

```markdown
## <eventId>
\`\`\`yaml
id: <eventId>
chapter: <chapterId>
trigger: ...
priority: ...
maxOccurrences: ...
conditions: [...]
effects: [...]
script: [...]
# 他、個別 event JSON の全フィールド
\`\`\`
```

**パース規則**:
1. frontmatter 後の本文を `## ` 見出しで分割
2. 各 `## <eventId>` 見出しの直後（空行 0 個以上挟み）の最初の \`\`\`yaml フェンスドコードブロックを抽出
3. YAML パース → 個別 event の内部表現
4. 検証:
   - 見出し `<eventId>` と YAML 内 `id` が一致（不一致 → エラー）
   - YAML 内 `chapter` と chapter.md frontmatter `id` が一致（不一致 → エラー）
   - frontmatter `events[]` の各項目（id/trigger/priority/maxOccurrences）と YAML 内同名フィールドが一致（不一致 → エラー）
5. `_index.json` 集約: 全 chapter.md から `{ id, chapter, trigger, priority, maxOccurrences, path }` を抽出、`path` は `events/<chapter>/<eventId>.json`
6. `_index.json` の順序: chapter.md ファイル名アルファベット順 → 各 chapter 内 events[] 順

**Phase 4 で chapter.md の本文は空**。よって初回ビルドでは個別 event JSON の生成スキップ + `_index.json` の `path` フィールドだけ復元する設計が必要。**ただし `src/game/data/events/_index.json` の現状を読み取って path 等を引き継ぐのは禁止**（SSOT 原則）。Phase 6 初回ビルドで chapter.md 本文が空のままだと個別 event JSON は **生成されず**、`src/game/data/events/<chapter>/` 配下の既存 39 ファイルとの不整合が発生する。

**対策方針**: Phase 6 ビルダーは「chapter.md の本文が空の場合、個別 event JSON および `_index.json` の更新を **スキップ**」する。これにより既存の `src/game/data/events/` 配下を温存。chapter.md 本文に YAML ブロックが書き始められた時点でビルド対象に昇格。

→ つまり Phase 6 の初回統合テスト（§11.2）では event 関連ファイルは **更新対象外** とし、それ以外の 9 エンティティで diff 0 を達成する。

#### 1.7 東北家 ID 逆正規化（sync_spec.md §5.1）

1. `docs/wiki/factions/東北家.md` の frontmatter から `legacyId: 東北家` を読み取り、辞書 `{ "faction_tohoku": "東北家" }` を構築
2. characters / bases / legions の `factionId === "faction_tohoku"` を `"東北家"` に変換
3. factions.json 出力時は `id: faction_tohoku` を `id: 東北家` に変換、`legacyId` フィールドは出力しない

#### 1.8 skills 配列 → skillId 単一（sync_spec.md §5.2）

- `skills.length === 0` → `skillId: null`
- `skills.length === 1` → `skillId: skills[0]`
- `skills.length >= 2` → stderr 警告 + `skillId: skills[0]`

#### 1.9 Wiki 限定フィールド除外（sync_spec.md §5.5）

JSON 出力時に除外:
- `tags`（全エンティティ）
- `portrait`（character）
- `legacyId`（faction）
- `category` / `effects`（command）
- `title` / `category` / `order`（chapter; chapter.md は分解されるため自動的に除外）
- `companionLines` / `secretaryLines`（character）

#### 1.10 配列順序の保持（sync_spec.md §5.6）

- characters 配列: characters/ + mob_templates/ の md ファイル順
- bases 配列: bases/ の md ファイル順
- 他配列も同様

**順序基準**: 各ディレクトリ内の md ファイルを `fs.readdirSync` で取得 → `.sort()` で **アルファベット順**（ファイル名ロケール非依存）

ただし Phase 4 出力の `src/game/data/characters.json` の順序は **元の characters.json の配列順を継承している**（Phase 4 で `wiki_import.cjs` がそのまま順番に処理）。よって Phase 6 で Wiki から再構築すると **順序が変わる可能性** がある。

**対策**: 順序保持のため、各 md の frontmatter に **`_order` フィールド** を追加するか、または Phase 6 では順序差分は許容する（後者を推奨）。

→ 順序差分の検査方針: 統合テスト（§11.2）の diff 0 検査で順序差分のみが残る場合は、 **set 一致** で代替検査（`sort_keys + sort_array` 後の diff）。

### 2. tools/wiki_watch.cjs

#### 2.1 機能

- `docs/wiki/**/*.md` を chokidar で監視
- 変更検知（add / change / unlink）→ debounce 500ms → `wiki_build.cjs` を子プロセスまたは関数呼び出しで起動
- `docs/wiki/archive/**` は監視対象外（`ignored` オプション）
- ビルド中の変更イベントは無視（次回 debounce 周期で拾う）

#### 2.2 起動方法

```bash
npm run wiki:watch
```

#### 2.3 終了

`Ctrl+C` で chokidar インスタンスを close、プロセス終了。

### 3. package.json 更新

scripts に追加:

```json
{
  "scripts": {
    "wiki:build": "node tools/wiki_build.cjs",
    "wiki:watch": "node tools/wiki_watch.cjs",
    "wiki:test": "vitest run tools/wiki_build.test.cjs"
  },
  "devDependencies": {
    "chokidar": "^x.x.x",
    "vitest": "^x.x.x"
  }
}
```

`npm install --save-dev chokidar vitest` で導入。既存依存（js-yaml）はそのまま。

### 4. 単体テスト（vitest）

#### 4.1 テスト対象関数

`wiki_build.cjs` で以下を **export** し、テスト可能にする:
- `normalizeFactionId(factionId, legacyDict)` → JSON 用に逆変換
- `applyCharacterDefaults(character)` → 既定値補完
- `applyFactionDefaults(faction)` → 同上
- `convertSkillsToSkillId(skills)` → skills 配列 → skillId 単一（2 件以上で警告）
- `parseChapterBody(markdownBody)` → §5.7 個別イベント抽出
- `stripWikiOnlyFields(entity, type)` → Wiki 限定フィールド除外
- `buildIndexJson(allEvents)` → `_index.json` 構造生成

#### 4.2 必須テストケース

| 関数 | ケース |
|---|---|
| `normalizeFactionId` | `"faction_tohoku"` → `"東北家"` / `"faction_red"` → `"faction_red"` / `null` → `null` |
| `applyCharacterDefaults` | 全フィールド欠落 → 全 default 注入 / 一部存在 → 既存値保持 / `battleBonus` 欠損キー → 0 補完 |
| `convertSkillsToSkillId` | `[]` → `null` / `["pierce"]` → `"pierce"` / `["a","b"]` → `"a"` + stderr 警告 |
| `parseChapterBody` | 正常 YAML ブロック / 見出しと YAML id 不一致 → エラー / chapter 不一致 → エラー / YAML ブロック欠落 → null |
| `stripWikiOnlyFields` | character の tags/portrait/companionLines/secretaryLines 除外 / faction の tags/legacyId 除外 / command の tags/category/effects 除外 |
| `buildIndexJson` | events 配列を期待構造で生成 / path フィールドが `events/<chapter>/<eventId>.json` |

各関数で最低 3 ケース（正常 1 + 異常 2）。

### 5. 整合性検査（sync_spec.md §8.3）

ビルダーは以下を毎ビルド検査:
1. character.factionId が factions に存在（または null）
2. base.factionId が factions に存在
3. legion.factionId が factions に存在
4. legion.charIds の各要素が character.id に存在（isTemplate:false のみ）
5. legion.mobSlots[].templateId が character.id に存在（isTemplate:true のみ）
6. base.dungeonId が dungeons.id に存在（または null）
7. base.adjacentBases の各要素が base.id に存在
8. character.id / base.id / faction.id / legion.id / item.id / skill.id / dungeon.id / command.id それぞれの重複なし

違反時は §10.1 の収集 → 一括 stderr → exit 1。

## 成功基準

### 5.1 機能要件

1. `npm install --save-dev chokidar vitest` 成功
2. `node tools/wiki_build.cjs` が正常終了（exit code 0）
3. 生成された JSON が `src/game/data/` の Phase 4 直前状態と **diff 0**（events 関連を除く 9 ファイル）
   - 検証手順:
     ```bash
     # Phase 4 直前状態の取得（Phase 4 完了後、Wiki 経由で再生成された現状）
     git stash push -- src/game/data/  # 一旦退避
     # ※ Phase 4 完了済のため src/game/data/ は wiki_import.cjs 経由で出力済の状態
     git stash pop
     cp -r src/game/data /tmp/data_baseline
     
     # Phase 6 ビルド実行
     node tools/wiki_build.cjs
     
     # diff 検査（events を除く）
     for f in characters.json factions.json bases.json items.json legions.json skills.json dungeons.json promotion_commands.json; do
       diff /tmp/data_baseline/$f src/game/data/$f
     done
     ```
   - 順序差分のみ残る場合は `jq -S '.'` でソート後 diff 0 を成功とする

4. `node tools/wiki_watch.cjs` 起動 → `docs/wiki/characters/東北きりたん.md` を編集（例: description 末尾に空白追加）→ 1 秒以内に `src/game/data/characters.json` が更新される

### 5.2 単体テスト

5. `npm run wiki:test` で全ケース成功（各関数最低 3 ケース、合計 21 ケース以上）

### 5.3 統合テスト（events を除く）

6. 整合性検査で違反 0 件（Phase 1 で既に確認済の現状再現）

### 5.4 エラー処理動作確認

7. 故意に `docs/wiki/factions/東北家.md` の frontmatter を破壊（例: `id: ` の値削除）→ `node tools/wiki_build.cjs` が **複数エラー収集後一括 stderr 出力 → exit 1**、`src/game/data/` は **未変更**（破壊前の状態維持）

## 禁止事項

- `sync_spec.md` に無い変換規則の追加禁止（曖昧な場合は Chat に確認）
- `docs/wiki/` 配下の md ファイルへの書き込み禁止（読み取り専用、`wiki_build.cjs` は SSOT を改変しない）
- `src/game/data/companion_lines.json` / `secretary_lines.json` / `facilities.json` への書き込み禁止
- `src/game/data/test/` への書き込み禁止
- chapter 本文が空のときに個別 event JSON および `_index.json` を更新する処理の禁止（§1.6 参照）
- 既定値補完で Phase 4 原本に存在しないフィールドを追加する処理の禁止（特に `base.bgCastle` / `bgField`）
- `KNOWLEDGE.md` / `docs/wiki/README.md` / `docs/wiki/meta/*` への書き込み禁止
- 過剰な抽象化禁止（直接的に書く、ヘルパー関数は単体テスト可能な粒度で十分）
- `dev` 用にゲームプロセス（5173 ポート等）を起動する処理の禁止

## プログラマ 3 大美徳

- **怠惰**: sync_spec.md / 棚卸し / Phase 4 実装（wiki_import.cjs）を最大限再利用。共通変換関数は単体テスト可能な粒度で抽出、過剰な抽象化はしない
- **短気**: エラーをサイレント化しない。検証フェーズで違反検出 → 全件収集 → 一括出力 → exit 1。Phase 4 原本との diff 0 が達成できない場合、原因が特定できるまでコミットしない
- **傲慢**: 東北家逆正規化 / skills 配列 → skillId / 配列順序 / 既定値補完の各規約を、単体テストとリグレッションテストの両方で検証

## 引き継ぎ報告

完了後、以下を全文報告:
1. `npm run wiki:build` の標準出力・標準エラー出力
2. `npm run wiki:test` の vitest 結果（合計ケース数、PASS/FAIL）
3. `for f in characters.json factions.json bases.json items.json legions.json skills.json dungeons.json promotion_commands.json; do echo "=== $f ==="; diff /tmp/data_baseline/$f src/game/data/$f | head -20; done` の出力
4. `node tools/wiki_watch.cjs &` 起動後、test 編集での再ビルド成功ログ（Ctrl+C で停止）
5. エラー処理確認（東北家.md 破壊 → 復元）の stderr 全文

Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
