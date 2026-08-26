# PROMPT: docs/wiki/README.md 作成

## 目的
Obsidian Vault 運用規約と全エンティティ frontmatter テンプレを 1 ファイルに集約する。

## 成果物
**ファイル**: `docs/wiki/README.md`（新規作成・1ファイルのみ）

## 前提
- Phase 1 棚卸し: `docs/wiki/meta/json_schema_inventory.md` 完成済
- 確定事項 14 項目（Q1〜Q15）反映済
- Phase 2 で「発見事項 8 項目」確定済（後述）

## Phase 1〜2 確定事項サマリ（README 冒頭に転記する）

### 確定事項 14 項目（Q1〜Q15）

| Q | 項目 | 決定 |
|---|---|---|
| - | 方向性 | Obsidian Vault を `docs/wiki/` に構築 |
| - | データ位置づけ | Wiki が一次資料、JSON は自動生成 |
| Q1 | ファイル名 | 日本語名（例 `紲星あかり.md`） |
| Q2 | イベント粒度 | 1 章=1 ページ集約、`chapters/<id>.md` |
| Q3 | 言語 | frontmatter / tags / id は英語、本文は日本語 |
| Q4 | KNOWLEDGE.md | 残す（概要のみ縮約）、詳細は Wiki |
| Q6 | 旧 kiritan | `docs/wiki/archive/` 配下に隔離統合 |
| Q8 | 必殺技 | character の frontmatter 内 `skills` 配列 |
| Q10 | タグ規約 | 階層タグ全採用（faction / chapter / region / type） |
| Q11 | 画像 | 参照のみ、`/characters/portraits/<id>.png` |
| Q12 | Obsidian 機能 | Dataview / Canvas / Excalidraw 全部使用 |
| Q13 | JSON 出力先 | `build/data/`、ビルドでコピー |
| Q14 | 同期 | ファイルウォッチャで双方向リアルタイム |
| Q15 | 初回インポート | 既存 JSON→Markdown 一括（frontmatter のみ、本文空） |

### Phase 2 発見事項 8 項目

1. **東北家 ID 例外** → Wiki frontmatter `id: faction_tohoku` に正規化、`legacyId: 東北家` を併記。JSON 出力時に `legacyId` があれば優先出力（互換維持）
2. **mob テンプレート**（characters.json 内 `isTemplate:true`）→ `mob_templates/` 別ディレクトリに分離
3. **test/ 配下**（`src/game/data/test/*.json`）→ Wiki 対象外
4. **台詞 JSON**（companion_lines.json / secretary_lines.json）→ キャラ frontmatter に `companionLines` / `secretaryLines` フィールドとして統合
5. **promotion_commands** → `commands/` 独立エンティティ
6. **facilities 構造** → `research: []` / `upgradeCommands: []` の 2 配列スキーマ（棚卸し記載通り、現状中身空）
7. **章ディレクトリ** → `ch01_tohoku`〜`ch05_vocalo` + `system` / `defeated` / `theater` の snake_case を踏襲、1 ファイル `chapters/<id>.md`
8. **_index.json 代替** → Wiki 側 `chapters/` が一次、`build/data/events/_index.json` はビルド時自動生成（Phase 6 watcher 仕様で詳細化）

---

## README.md の構成（必須セクションと順序）

1. はじめに（Wiki の位置づけ、一次資料は Wiki、JSON は自動生成）
2. 確定事項 14 項目（上記表をそのまま転記）
3. Phase 2 発見事項 8 項目（上記をそのまま転記）
4. ディレクトリ構成（下記）
5. 規約
   - 5.1 ファイル命名
   - 5.2 frontmatter 共通規約
   - 5.3 タグ階層
   - 5.4 実行時状態フィールドの扱い
   - 5.5 東北家 legacyId 規約
   - 5.6 nullable / 省略の扱い（ビルダーが既定値で補完）
6. エンティティ別テンプレ集（11 種、後述）
7. JSON 同期規約（一次=Wiki、出力先=build/data/、test/ 対象外、個別イベント記法は Phase 6 で確定）
8. 整合性検査（Phase 1 で「孤立参照 0 / 重複 ID 0」確認済の旨を記載）
9. メタデータ運用（meta/ 配下の役割、json_schema_inventory.md へのリンク）

ファイル冒頭にトップレベル目次（`##` 単位）を必ず置く。

---

## ディレクトリ構成（README に転記）

```
docs/wiki/
  README.md              ← 本プロンプトの成果物
  meta/
    json_schema_inventory.md   ← Phase 1 成果物
  characters/            ← <キャラ日本語名>.md
  mob_templates/         ← mob_NNN.md
  factions/              ← <勢力日本語名>.md
  bases/                 ← <拠点日本語名>.md
  facilities/            ← <施設日本語名>.md（将来用、現状空）
  items/                 ← <アイテム日本語名>.md
  legions/               ← <軍団日本語名>.md
  softwares/             ← <ソフト日本語名>.md（将来用、骨格のみ）
  chapters/              ← ch01_tohoku.md, system.md, theater.md 等
  commands/              ← promotion_commands を含む
  terms/                 ← 用語集（SP, 戦闘域, 参戦 等）
  archive/               ← 旧 kiritan 由来資料（Q6）
```

---

## 規約詳細（README に転記）

### 5.1 ファイル命名
- 人名・地名・固有名詞: 日本語ファイル名（例 `紲星あかり.md`、`仙台.md`）
- システム系（章 / コマンド / 用語 / mob_template）: ID のまま（例 `ch01_tohoku.md`, `mob_001.md`, `video.md`）
- ID は frontmatter `id` フィールドに常に英語で記載（例外: 東北家のみ `legacyId` 併記）

### 5.2 frontmatter 共通規約
- 全エンティティに `id`（必須、英語 ASCII snake_case）と `tags`（必須、階層タグ配列）
- 表示名は `name` フィールド（日本語）
- nullable は YAML の `null` または省略
- 実行時可変フィールド（`usedThisTurn` / `recoveryRate` / `equipment.item` / `factions.atWarWith` の変動 等）は Wiki 対象外。ビルダーが既定値注入

### 5.3 タグ階層
- `type/<entity>` 必須（例 `type/character`、`type/base`）
- `faction/<factionId>` キャラ・拠点・軍団・章に付与
- `chapter/<chapterId>` 章イベント関連に付与
- `region/<area>` 拠点・地域関連キャラに付与
- area enum: `chushikoku` / `hokkaido` / `kansai` / `kanto` / `koshinetsu` / `kyushu` / `okinawa` / `tohoku`

### 5.4 実行時状態フィールドの扱い
以下は Wiki 対象外（frontmatter に書かない、ビルダーがデフォルト挿入）:
- `usedThisTurn` (bool, 常に初期 false)
- `recoveryRate` (null)
- `equipment.item` (null)
- character の `factionId` 動的変化分（charJoin 効果による所属変動は events 側に記述）
- `factions.warFlags.canDeclareWar` / `eventTriggered`（イベント駆動変動だが初期値は記載）
- `factions.atWarWith` の初期値は記載、変動は events 側

### 5.5 東北家 legacyId 規約
- factions.id は本来 `faction_<color>` / `faction_new<NN>` の snake_case だが、現状 `東北家` のみ日本語直書き
- Wiki では正規化: `id: faction_tohoku`, `legacyId: 東北家`
- JSON ビルダーは `legacyId` があればそれを `id` として出力（既存コード互換）
- 将来のコード側リネームは別タスク

### 5.6 nullable / 省略
- 棚卸しで出現率 < 100% のフィールドは「任意」。Wiki 側で省略可
- 任意フィールドの既定値はビルダーで一元管理（テンプレに記載は不要だが、ビルダー実装時に明示する旨を README に注記）

---

## エンティティ別テンプレ 11 種（README に転記）

**注意**: 各テンプレは棚卸し（`docs/wiki/meta/json_schema_inventory.md`）の全フィールド・全 enum を反映すること。棚卸しに無いフィールドの追加禁止（softwares のみ将来用骨格として例外）。

### (1) character (`characters/<日本語名>.md`)

```yaml
---
id: char_001
name: 東北きりたん
factionId: faction_tohoku       # nullable
isLeader: true
isTemplate: false               # mob_templates/ 分離のため通常 false
role: attacker                  # enum: attacker | guardian
attackType: melee               # enum: melee | ranged | song
charHp: 200
charMaxHp: 200
charAttack: 60
charDefense: 8
charSong: 0
attack: 60                      # SP 攻撃値
defense: 70                     # SP 防御値
attackCount: 8                  # 未指定時デフォルト 8
soldiers: 1000
maxSoldiers: 2000
soldierAtk: 12
soldierDef: 10
strategyRate: 40
skills: []                      # Q8: 配列。skills[0] が旧 skillId と等価
specialType: null               # nullable
kana: きりたん                  # nullable
hireCost: 0
joinCondition: null
description: ""
talkEventId: null
battleBonus:
  attack:  { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 }
  defense: { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 }
  dungeon: { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 }
portrait: /characters/portraits/char_001.png   # 参考表示用（実体は convention-based）
companionLines: null            # nullable: triggers キー (turn_start/low_treasury/...) → 台詞配列マップ
secretaryLines: null            # nullable: 秘書役のみ。idle/turn_start/... → 台詞配列マップ
tags: [type/character, faction/faction_tohoku, region/tohoku]
---

<本文：日本語の人物紹介・背景・性格・関係性>
```

### (2) mob_template (`mob_templates/mob_NNN.md`)

```yaml
---
id: mob_001
isTemplate: true                # 必須
displayName: 歩兵部隊           # 必須
nameVariants: [更迭はう, ベルン, ドラン, フォーグ, ライエン]
statVariance: 0.15
factionId: null
role: attacker
attackType: melee
charHp: 4
charMaxHp: 4
charAttack: 4
charDefense: 0
charSong: 0
attack: 4
defense: 60
soldiers: 20
maxSoldiers: 20
soldierAtk: 6
soldierDef: 4
strategyRate: 0
hireCost: 0
description: 各地で見られる標準的な歩兵部隊。
battleBonus:
  attack:  { soldierAtk: 1, soldierDef: 0, charAttack: 0, charSong: 0 }
  defense: { soldierAtk: 0, soldierDef: 1, charAttack: 0, charSong: 0 }
  dungeon: { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 }
tags: [type/mob_template]
---
```

### (3) faction (`factions/<勢力日本語名>.md`)

```yaml
---
id: faction_red
name: 大都会
color: "#c4427a"
isPlayer: false
treasury: 500
atWarWith: []                   # 初期値のみ。変動は events
warFlags:
  canDeclareWar: false          # 任意（棚卸し出現率 75%）
  eventTriggered: false         # 任意
tags: [type/faction]
---
```

東北家のみ（legacyId 併記）:

```yaml
---
id: faction_tohoku
legacyId: 東北家
name: 東北家
color: "#d75d42"                # 棚卸し参照値
isPlayer: true
treasury: 500
atWarWith: []
warFlags:
  canDeclareWar: true
  eventTriggered: false
tags: [type/faction]
---
```

### (4) base (`bases/<拠点日本語名>.md`)

```yaml
---
id: base_001
name: 仙台
x: 1234
y: 567
factionId: faction_tohoku
income: 80
isCapital: true
adjacentBases: [base_002, base_003]
battleCapacity: 400
dungeonId: null                 # nullable
area: tohoku                    # enum: chushikoku | hokkaido | kansai | kanto | koshinetsu | kyushu | okinawa | tohoku
tags: [type/base, faction/faction_tohoku, region/tohoku]
---
```

棚卸しで 1 件のみ任意 `bgCastle`/`bgField` あり（共に null）。実用上省略可、必要時のみ追加。

### (5) facility (`facilities/<施設日本語名>.md`)

**棚卸し現状**: `facilities.json = { research: [], upgradeCommands: [] }`。エントリ実体無し。
**将来用エントリのスキーマ**（GameContext 参照に基づく骨格、本格運用は実装後）:

```yaml
---
id: <facility_id>
name: <表示名>
category: research              # enum: research | upgrade_command
description: ""
cost: 0
prerequisites:
  eventFlags: []
  requiredItemIds: []
  requiredCharIds: []
unlocks:
  upgradeCommands: []
tags: [type/facility]
---
```

README には「現状中身空、骨格は将来用」と注記必須。

### (6) item (`items/<アイテム日本語名>.md`)

```yaml
---
id: item_0001
name: テスト１
type: weapon
slotType: weapon
description: ""
effect:
  type: charAttack
  value: 10
cost: 300
sellPrice: 150
startWithPlayer: true
tags: [type/item]
---
```

### (7) legion (`legions/<軍団日本語名>.md`)

```yaml
---
id: legion_red_01
name: 納豆ファクトリー第一軍団
factionId: faction_red
charIds: [char_024, char_023]
mobSlots:
  - { slotId: slot_1, templateId: mob_001, charId: null, respawnIn: null }
  - { slotId: slot_2, templateId: mob_001, charId: null, respawnIn: null }
maxMobSlots: 2
attackPriority: [base_001, base_003, base_014, base_071]
defendBases: [base_003, base_014, base_071]
attackFrequency:
  type: every_turn              # null も可
isDefenseReserve: false         # 任意（棚卸し出現率 46%）
retreatRule:
  onAttack: char_dead           # enum: never | char_dead | loss_25
  onDefend: char_dead           # enum 同上
  onDefendBase: {}              # 任意 base_id → enum マップ
tags: [type/legion, faction/faction_red]
---
```

### (8) software (`softwares/<ソフト日本語名>.md`)

**将来用骨格。softwares.json 未実装、本格運用は実装後**

```yaml
---
id: software_001
name: <ソフト名>
status: planning                # enum: planning | in_development | released
factionId: faction_xxx
team: []                        # 担当 charId 配列
duration: 0                     # 開発ターン数
description: ""
tags: [type/software]
---
```

README に「現状未実装、将来用骨格」と注記必須。

### (9) chapter (`chapters/<chapterId>.md`)

```yaml
---
id: ch01_tohoku
title: 第一章 東北統一          # 日本語表示名（新規付与、JSON 実データには無いフィールド）
category: story                 # enum: story | system | defeated | theater
order: 1                        # story 系のみ。system/defeated/theater は null
events:
  - id: ev_000_opening
    trigger: game_start
    priority: 1000
    maxOccurrences: 1
  - id: ev_daitoshi_turn1
    trigger: player_turn
    priority: 900
    maxOccurrences: 1
  # ...
tags: [type/chapter, chapter/ch01_tohoku, region/tohoku]
---

## ev_000_opening
<本文：イベント1 の conditions / effects / script / 台詞>

## ev_daitoshi_turn1
<本文：イベント2>
```

**個別イベント本文の構造化記法**（conditions / effects / script の YAML or Markdown 表）は Phase 6 watcher 仕様で確定する。README には「Phase 6 で確定」と明記し、暫定では `## <eventId>` 見出しで区切る運用とする旨記載。

`category` 別の章 ID 一覧:
- `story`: ch01_tohoku / ch02_saitama / ch03_otaru / ch04_saitama_tl / ch05_vocalo
- `system`: system
- `defeated`: defeated
- `theater`: theater

### (10) command (`commands/<コマンド名>.md`)

```yaml
---
id: video
name: 動画収録
category: promotion             # 拡張用 enum（現状は promotion のみ）
limited: false                  # true なら uses>=1 で表示・実行可
effects: []                     # 将来拡張（現状空配列）
tags: [type/command, command/promotion]
---
```

### (11) term (`terms/<用語ID>.md`)

KNOWLEDGE.md §5 用語定義をエンティティ化。

```yaml
---
id: sp
name: SP
aliases: [ミーム（兵士）, soldiers]
forbidden: [兵士, 将軍]
description: ミーム（兵士）。soldiers フィールド。
tags: [type/term]
---
```

初期エントリ候補（KNOWLEDGE.md §5 由来）: `sp` / `battle_capacity` / `engagement`（参戦）/ `treasury`。

---

## 成功基準

1. `docs/wiki/README.md` が新規作成されている
2. 上記「ディレクトリ構成」「規約 6 節」「Phase 1〜2 確定事項」「エンティティテンプレ 11 種」が漏れなく記載
3. 各エンティティテンプレの全フィールドが棚卸し（`docs/wiki/meta/json_schema_inventory.md`）と一致
   - フィールド名・型・nullable 表記・enum 値が棚卸し記載と一字一句一致
   - 棚卸しに無いフィールドの追加は禁止（softwares のみ「将来用骨格」と明記して例外）
4. enum 値（`area` / `role` / `attackType` / `retreatRule.onAttack` 等）が棚卸しと一致
5. 「東北家 legacyId 規約」が独立セクション（5.5）で明示
6. 「実行時状態フィールドの扱い」が独立セクション（5.4）で明示
7. ファイル冒頭にトップレベル目次（`##` 単位）
8. 個別イベント本文構造化記法は「Phase 6 で確定」と明記（暫定で `## <eventId>` 見出し区切り）

## 禁止事項

- 棚卸しに無いフィールドの追加禁止（softwares・facility の将来用骨格・chapter の `title`/`category`/`order`/`events` は例外として明記）
- 既存ファイルの編集禁止（README.md のみ新規作成）
- `docs/wiki/` 配下のディレクトリ作成禁止（Phase 3 で別途実施）。本プロンプトは README.md 1 ファイル限定
- KNOWLEDGE.md の改変禁止（縮約は別フェーズ）
- 推測による拡張禁止（棚卸し記載がフィールド・enum・出現率の唯一の根拠）

## プログラマ 3 大美徳の適用

- **怠惰**: 棚卸しを完全再利用。同じ情報を二重に書き起こさない。エンティティ間で共通フィールドの説明は規約節で一度だけ書き、テンプレでは差分のみ
- **短気**: 「フィールド多すぎる」と感じても棚卸しを切り捨てない（実データに存在するフィールドは全部書く）
- **傲慢**: README は今後数十回参照される設計書。誤記・欠落・推測混入を許さない

## 引き継ぎ
完了後、`docs/wiki/README.md` のファイルパスとサイズを報告。Chat でレビュー → 修正があれば差し戻し → 無ければ本プロンプトを `docs/archive/` へ移動。
