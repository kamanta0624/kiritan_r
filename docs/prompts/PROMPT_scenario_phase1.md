# シナリオ Phase 1 実装 引き継ぎプロンプト

作成: 2026-05-25

---

## 概要

ゲーム開始〜エンディングまでの骨格シナリオを実装する。  
イベント・アイテム・研究の**大枠と発生条件**のみ。テキストは全てダミー。

---

## 前提

- EventEngine.js: 完全実装済み。condition types: `turn`, `flag`, `noFlag`, `hasChar`, `baseOwned`, `atWar`, `attackerFaction`, `defenderFaction`, `baseConquered`, `turnAfterFlag`, `defeatedChar`, `noOther`
- effect types: `treasury`, `charJoin`, `charLeave`, `charParam`, `baseIncome`, `battleCap`, `dungeonUnlock`, `warFlag`, `itemGain`, `itemLose`, `setFlag`, `setFlagWithTurn`, `clearFlag`, `charUsedThisTurn`, `baseTransfer`, `attackUnlock`, `legionForceAttack`, `legionUpdate`
- trigger types（実装済み）: `game_start`, `player_turn`, `enemy_turn`, `before_faction_turn`
- trigger types（**未実装・発火しない**）: `base_visit`, `base_attack`, `base_defense`, `base_conquered`
- イベントファイル形式: `src/game/data/events/<chapter>/ev_<id>.json`、`_index.json` にエントリ追加必須

---

## 勢力・本拠地マッピング

| 勢力ID | 名前 | 本拠地baseId |
|--------|------|-------------|
| 東北家 | 東北家（プレイヤー） | base_001（仙台） |
| faction_red | 大都会 | base_045（水戸） |
| faction_green | さいたま | base_028（春日部） |
| faction_yellow | 小樽潮風 | base_006（小樽） |
| faction_new01 | 東京 | base_032（秋葉原） |
| faction_new02 | 自由都市 | 複数（北海道〜沖縄） |
| faction_new03 | ボーカル界 | 未定（西日本想定） |
| faction_new04 | AHS | 未定（中部〜関西） |

秩父 = base_023（faction_green所属）

---

## 調査済み既存イベントの注意点

### ev_mito_conquest.json（大都会制圧）

- **トリガー**: `base_conquered` → **EventEngineに未実装のトリガー。現状発火しない**
- **effects**: `attackUnlock(faction_new02)` / `attackUnlock(faction_green)` / `warFlag(faction_green, atWar:true)` / `setFlagWithTurn: flag_mito_conquest_done` / `charJoin` × 2 が既に含まれている
- **対応**: トリガーを `player_turn` + `baseOwned: {baseId:'base_045'}` + `noFlag: flag_mito_conquest_done` に変更して既存systemで動作させる。この修正も本タスクに含める。
- **フラグ名**: `flag_mito_conquest_done` を使う。`flag_daitoshi_conquered` は作らない。

---

## シナリオ全体タイムライン

想定総ターン数: 約25〜30ターン

| フェーズ | ターン目安 | 内容 |
|---------|-----------|------|
| 大都会戦 | T1〜T8 | 開幕から大都会と交戦。本拠地（水戸）制圧で関東東北の拠点が東北家に + 自由都市・埼玉解禁 |
| 自由都市開放 | T5以降 | 大都会制圧後に自動解禁（ev_mito_conquestに含まれている） |
| 小樽膨張期 | T9〜T18 | 小樽が5ターン猶予後、3ターンおきに自由都市を侵食 |
| 埼玉戦 | T10〜T20 | 秩父合流チャンス(T10目安)。東京ずんこイタコ暴走タイムリミット |
| AHS戦 | T18〜T25 | ボカロ統一タイムリミット接近中 |
| ボカロ戦 | T22〜T28 | AHS吸収前に介入するかで分岐 |
| エンディング | T25〜T30 | 条件次第で初音ミク戦追加 |

---

## タイムリミット4本の詳細設計

### TL-1: ウナ・しゅおとの合流（T10まで）

- **条件**: T10以内にbase_023（秩父）をプレイヤーが制圧
- **成功**: イベント発火 → `charJoin` でウナ(char_una)・しゅお(char_shuo)が加入 + `setFlag: flag_una_joined`
- **失敗**: T10ターン到達時にflag未設定 → イベント「2人がAHSへ逃れた」発火 → AHSのキャラクリ条件フラグが永続封印
- **仕組み**: 
  - `ev_una_joined`: trigger=`player_turn`, conditions: `baseOwned:{baseId:'base_023'}` + `noFlag:flag_una_joined` + `noFlag:flag_una_fled`
  - `ev_una_fled`: trigger=`player_turn`, conditions: `turn:{op:'gte',value:10}` + `noFlag:flag_una_joined` + `noFlag:flag_una_fled` + `flag:flag_mito_conquest_done`
  - effect: `setFlag:flag_una_fled`、ADVで「2人はAHSに保護された」

### TL-2: 埼玉タイムリミット（T20まで）

- **T20到達で未制圧**: `player_turn`トリガー → 「東京のずんこイタコが埼玉を制圧」
  - effect: `baseTransfer: {fromFactionId:'faction_green', toFactionId:'faction_new01'}`
  - `setFlag: flag_saitama_absorbed_by_tokyo`
  - `warFlag: {factionId:'faction_new01', atWar:true}`
  - ずんこイタコのキャラクリフラグが**立たない**
- **T20前にプレイヤーが春日部制圧**: `ev_tokyo_open`
  - conditions: `baseOwned:{baseId:'base_028'}` + `noFlag:flag_saitama_conquered_by_player`
  - effect: `setFlag:flag_saitama_conquered_by_player` + `warFlag:{factionId:'faction_new01', atWar:true}`
- **東京制圧後**: `ev_tokyo_conquered`
  - conditions: `baseOwned:{baseId:'base_032'}` + `flag:flag_saitama_conquered_by_player` + `noFlag:flag_chara_unlock_zunko_itako`
  - effect: `setFlag:flag_chara_unlock_zunko_itako`

### TL-3: 小樽潮風との交戦タイミング（自由）

- **早期交戦**: 大都会制圧直後に小樽攻撃→小樽は初期戦力のみ
- **最大版図待ち**: 小樽が自由都市を全制圧後に戦って倒す → `setFlag:flag_chara_unlock_otaru`

小樽の自由都市侵食ロジック（`player_turn`トリガー、連続イベントとして実装）:

| イベントID | 条件 | effect |
|-----------|------|--------|
| ev_otaru_phase1_start | flag_mito_conquest_done + noFlag:flag_otaru_active | setFlagWithTurn:flag_otaru_active |
| ev_otaru_expand_1 | flag_otaru_active + turnAfterFlag:flag_otaru_active>=5 + noFlag:flag_otaru_exp1_done + noFlag:flag_otaru_at_war | baseTransfer(函館 faction_new02→faction_yellow) + charJoin(char_otaru_ally1) + setFlag:flag_otaru_exp1_done |
| ev_otaru_expand_2 | flag_otaru_exp1_done + turnAfterFlag:flag_otaru_exp1_done>=3 + noFlag:flag_otaru_exp2_done + noFlag:flag_otaru_at_war | baseTransfer(オホーツク faction_new02→faction_yellow) + charJoin(char_otaru_ally2) + setFlag:flag_otaru_exp2_done |
| ev_otaru_expand_3 | flag_otaru_exp2_done + turnAfterFlag:flag_otaru_exp2_done>=3 + noFlag:flag_otaru_exp3_done + noFlag:flag_otaru_at_war | baseTransfer(釧路 faction_new02→faction_yellow) + setFlag:flag_otaru_exp3_done |
| ev_otaru_declare_war | flag_otaru_exp2_done + turnAfterFlag:flag_otaru_exp2_done>=3 + noFlag:flag_otaru_at_war | warFlag(faction_yellow, atWar:true) + setFlag:flag_otaru_at_war + legionUpdate(legion_yellow_01, attackFrequency:{type:'every_turn'}) |
| ev_otaru_conquered | baseOwned:{baseId:'base_006'} + noFlag:flag_otaru_conquered | baseTransfer(faction_yellow→東北家) + setFlag:flag_otaru_conquered |
| ev_otaru_max_check | baseOwned:{baseId:'base_006'} + flag:flag_otaru_exp3_done + noFlag:flag_chara_unlock_otaru | setFlag:flag_chara_unlock_otaru |

ev_otaru_declare_war は ev_otaru_expand_3 と同じターン条件になるので priority で順序制御すること（expand_3: priority:900、declare_war: priority:850）。

プレイヤーが先に攻撃した場合は `warFlag` が立ちる。こちらから攻撃した際のwarFlag設定はGameContext側の`declareWar()`で自動設定されるため、`flag_otaru_at_war`のみイベント側で付与されない点に注意。  
→ `ev_otaru_declare_war` とは別に `ev_otaru_war_flag_sync` で `atWar` conditionをチェックして `flag_otaru_at_war` を同期する処理を追加すること。

### TL-4: ボカロ統一タイムリミット（T22まで）

- **T22到達 + AHS未制圧**: 「ボカロ界がAHSを吸収」
  - effect: `baseTransfer:{fromFactionId:'faction_new04', toFactionId:'faction_new03'}` + `setFlag:flag_ahs_absorbed`
- **プレイヤーがT22前にAHSを制圧**: `baseOwned` で判定 → `setFlag:flag_ahs_conquered_by_player`
- **ボカロ界統一後+数ターン**: `legionForceAttack` で東北家に宣戦
  - `ev_vocalo_attacks`: conditions: `flag_ahs_absorbed` + `turn:{op:'gte',value:25}` + `noFlag:flag_vocalo_at_war`

---

## エンディング条件

| エンディング | 条件 |
|------------|------|
| 通常エンド | ボカロ界本拠地制圧（faction_new03の本拠地→要定義） |
| 初音ミク戦追加 | flag_saitama_conquered_by_player + flag_chara_unlock_otaru + ボカロ界制圧 |

エンディング判定は既存 `checkVictory()` の拡張、またはGameContextの`gamePhase`管理で対応。  
→ **GameContext修正が必要。Code担当が判断して実装すること。**

---

## 実装作業リスト

### 1. ev_mito_conquest.json のトリガー修正

```json
"trigger": "player_turn",
"conditions": [
  {"type": "baseOwned", "baseId": "base_045"},
  {"type": "noFlag", "flag": "flag_mito_conquest_done"}
]
```

### 2. イベントJSONファイル作成

```
src/game/data/events/
  ch03_otaru/
    ev_otaru_phase1_start.json
    ev_otaru_expand_1.json
    ev_otaru_expand_2.json
    ev_otaru_expand_3.json
    ev_otaru_declare_war.json
    ev_otaru_war_flag_sync.json
    ev_otaru_conquered.json
    ev_otaru_max_check.json
  ch04_saitama_tl/
    ev_una_fled.json
    ev_una_joined.json
    ev_saitama_absorbed.json
    ev_tokyo_open.json
    ev_tokyo_conquered.json
  ch05_vocalo/
    ev_ahs_conquered_flag.json
    ev_ahs_absorbed.json
    ev_vocalo_attacks.json
    ev_vocalo_conquered.json
    ev_miku_war_start.json
```

テキストは全てダミー文字列でよい（「【ダミー】○○イベント発火」等）。

### 3. `_index.json` へのエントリ追加

全新規イベントをchapter付きで追記。

### 4. LegionAIへの軍団追加（legions.json）

追加するlegionの最低限フィールド:

```json
{
  "id": "legion_new03_01",
  "name": "ボーカル界軍団（ダミー）",
  "factionId": "faction_new03",
  "charIds": [],
  "mobSlots": [{"slotId":"slot_1","templateId":"mob_001","charId":null,"respawnIn":null}],
  "maxMobSlots": 1,
  "attackPriority": [],
  "defendBases": [],
  "attackFrequency": null,
  "retreatRule": {"onAttack":"loss_25","onDefend":"char_dead","onDefendBase":{}}
}
```

同様に `legion_new04_01`（AHS）も追加。

### 5. characters.json にダミーキャラ追加

| charId | displayName | factionId |
|--------|-------------|-----------|
| char_una | ウナ（ダミー） | null |
| char_shuo | しゅお（ダミー） | null |
| char_zunko_itako | ずんこイタコ（ダミー） | faction_new01 |
| char_otaru_ally1 | 小樽仲間A（ダミー） | null |
| char_otaru_ally2 | 小樽仲間B（ダミー） | null |
| char_miku | 初音ミク（ダミー） | faction_new03 |

statは `mob_001` と同等のダミー値。`isLeader: true`、`isTemplate: false`。

### 6. items.json アイテム追加（ダミー）

既存フォーマット踏襲。以下5種追加:

| itemId | name |
|--------|------|
| item_otaru_emblem | 小樽の証 |
| item_saitama_key | 埼玉城の鍵 |
| item_vocalo_score | ボーカル楽譜 |
| item_miku_permission | ミクの許可証 |
| item_una_letter | ウナからの手紙 |

### 7. facilities.json 研究追加（ダミー）

既存フォーマット踏襲（turns / prerequisites / unlocks フィールド必須）。以下3種追加:

| id | name | prerequisites |
|----|------|--------------|
| research_otaru_info | 小樽情報収集 | [] |
| research_saitama_tactic | 対埼玉戦術 | [] |
| research_vocalo_analysis | ボーカル分析 | ["research_saitama_tactic"] |

### 8. faction_new03・faction_new04 の本拠地設定

`factions.json` に本拠地情報は持たないが、`legions.json` の `defendBases` と `bases.json` の `factionId` 整合性が必要。  
ボーカル界・AHSの拠点を `bases.json` で確認し、faction_new03/faction_new04に割り当てられた拠点の中から「首都」を1つ決定してlegionのdefendBasesに設定すること。

---

## 実装順序（推奨）

1. `ev_mito_conquest.json` トリガー修正
2. characters.json ダミーキャラ追加
3. legions.json ボカロ・AHS軍団追加
4. ch03_otaru 全イベント作成
5. ch04_saitama_tl 全イベント作成
6. ch05_vocalo 全イベント作成
7. `_index.json` 全エントリ追加
8. items.json アイテム追加
9. facilities.json 研究追加
10. GameContext `checkVictory()` エンディング条件拡張（flag_vocalo_conquered等）

---

## 制約・注意

- `base_visit` / `base_defense` / `base_conquered` トリガーは**発火しない**。全て `player_turn` か `before_faction_turn` で実装すること
- `baseConquered` conditionは `eventFlags['conquered_<baseId>'] === true` を参照するが、このフラグの自動設定はGameContextの `conquerBase()` 実装に依存する。`baseOwned` conditionの方が確実。可能な限り `baseOwned` で代替すること
- `baseOwned` conditionは「そのターンに制圧したか」ではなく「現在プレイヤーが所有しているか」の判定。`maxOccurrences:1` で重複発火を防ぐこと
- 新規charIdをcharJoinで使う前に必ずcharacters.jsonにエントリが存在すること
