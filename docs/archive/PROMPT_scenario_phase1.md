# シナリオ Phase 1 実装 引き継ぎプロンプト

作成: 2026-05-26

---

## 概要

ゲーム開始〜エンディングまでの骨格シナリオを実装する。
**実装範囲**: イベントJSON（フラグ・baseTransfer・warFlag）のみ。
テキストは全てダミー。ダミーキャラ・ダミー軍団・アイテム・研究は今回対象外。

---

## 前提

- EventEngine.js: 完全実装済み
- condition types: `turn`, `flag`, `noFlag`, `hasChar`, `baseOwned`, `atWar`, `attackerFaction`, `defenderFaction`, `baseConquered`, `turnAfterFlag`, `defeatedChar`, `noOther`
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
| faction_new03 | ボーカル界 | base_092（北九州）※bases.jsonで確認済み |
| faction_new04 | AHS | base_074（京都）※bases.jsonで確認済み |

秩父 = base_023（faction_green所属）

---

## 調査済み既存イベントの注意点

### ev_mito_conquest.json（大都会制圧）

- **トリガー**: `base_conquered` → **EventEngineに未実装。現状発火しない**
- **effects**: `attackUnlock(faction_new02)` / `attackUnlock(faction_green)` / `warFlag(faction_green, atWar:true)` / `setFlagWithTurn:flag_mito_conquest_done` / `charJoin` × 2 が既に含まれている
- **対応**: トリガーを `player_turn` + `baseOwned:{baseId:'base_045'}` + `noFlag:flag_mito_conquest_done` に変更する。この修正も本タスクに含める。
- **フラグ名**: `flag_mito_conquest_done` を使う

---

## シナリオ全体タイムライン

想定総ターン数: **約100〜120ターン**（2ターンに1拠点制圧ペース基準）

拠点数概算: 大都会6 / さいたま14 / 東京3 / 自由都市24 / AHS18 / ボカロ14 = 全79拠点（小樽2は別途）

| フェーズ | ターン目安 | 内容 |
|---------|-----------|------|
| 大都会戦 | T1〜T15 | 大都会と交戦。水戸制圧で自由都市・埼玉解禁 |
| 自由都市開放・小樽膨張 | T10〜T35 | 自由都市攻略。小樽は5ターン猶予後に侵食開始 |
| 埼玉戦 | T20〜T55 | 秩父合流チャンスT25目安。東京吸収タイムリミットT55 |
| AHS戦 | T50〜T80 | ボカロ統一タイムリミットT80 |
| ボカロ戦 | T70〜T100 | AHS吸収前に介入するかで分岐 |
| エンディング | T90〜T120 | 条件次第で初音ミク戦追加 |

---

## タイムリミット4本の詳細設計

### TL-1: ウナ・しゅおとの合流（T25まで）

- `ev_una_joined`: trigger=`player_turn`
  - conditions: `baseOwned:{baseId:'base_023'}` + `noFlag:flag_una_joined` + `noFlag:flag_una_fled`
  - effects: `setFlag:flag_una_joined`（charJoinは後回し）
- `ev_una_fled`: trigger=`player_turn`
  - conditions: `turn:{op:'gte',value:25}` + `noFlag:flag_una_joined` + `noFlag:flag_una_fled` + `flag:flag_mito_conquest_done`
  - effects: `setFlag:flag_una_fled`

### TL-2: 埼玉タイムリミット（T55まで）

- `ev_saitama_absorbed`: trigger=`player_turn`
  - conditions: `turn:{op:'gte',value:55}` + `noFlag:flag_saitama_conquered_by_player` + `noFlag:flag_saitama_absorbed_by_tokyo`
  - effects: `baseTransfer:{fromFactionId:'faction_green',toFactionId:'faction_new01'}` + `setFlag:flag_saitama_absorbed_by_tokyo` + `warFlag:{factionId:'faction_new01',atWar:true}`
- `ev_tokyo_open`: trigger=`player_turn`
  - conditions: `baseOwned:{baseId:'base_028'}` + `noFlag:flag_saitama_conquered_by_player`
  - effects: `setFlag:flag_saitama_conquered_by_player` + `warFlag:{factionId:'faction_new01',atWar:true}`
- `ev_tokyo_conquered`: trigger=`player_turn`
  - conditions: `baseOwned:{baseId:'base_032'}` + `flag:flag_saitama_conquered_by_player` + `noFlag:flag_chara_unlock_zunko_itako`
  - effects: `setFlag:flag_chara_unlock_zunko_itako`

### TL-3: 小樽潮風との交戦タイミング（自由）

| イベントID | trigger | conditions | effects |
|-----------|---------|-----------|---------|
| ev_otaru_phase1_start | player_turn | flag:flag_mito_conquest_done + noFlag:flag_otaru_active | setFlagWithTurn:flag_otaru_active |
| ev_otaru_expand_1 | player_turn | flag:flag_otaru_active + turnAfterFlag:flag_otaru_active>=5 + noFlag:flag_otaru_exp1_done + noFlag:flag_otaru_at_war | baseTransferSingle(base_054 ニセコ →faction_yellow) + setFlag:flag_otaru_exp1_done |
| ev_otaru_expand_2 | player_turn | flag:flag_otaru_exp1_done + turnAfterFlag:flag_otaru_exp1_done>=3 + noFlag:flag_otaru_exp2_done + noFlag:flag_otaru_at_war | baseTransferSingle(base_004 函館 →faction_yellow) + setFlag:flag_otaru_exp2_done |
| ev_otaru_expand_3 | player_turn | flag:flag_otaru_exp2_done + turnAfterFlag:flag_otaru_exp2_done>=3 + noFlag:flag_otaru_exp3_done + noFlag:flag_otaru_at_war | baseTransferSingle(base_052 苫小牧 →faction_yellow) + setFlag:flag_otaru_exp3_done |
| ev_otaru_declare_war | player_turn | flag:flag_otaru_exp2_done + turnAfterFlag:flag_otaru_exp2_done>=6 + noFlag:flag_otaru_at_war | warFlag(faction_yellow,atWar:true) + setFlag:flag_otaru_at_war |
| ev_otaru_war_flag_sync | player_turn | atWar:faction_yellow + noFlag:flag_otaru_at_war | setFlag:flag_otaru_at_war |
| ev_otaru_conquered | player_turn | baseOwned:{baseId:'base_006'} + noFlag:flag_otaru_conquered | baseTransfer(faction_yellow→東北家) + setFlag:flag_otaru_conquered |
| ev_otaru_max_check | player_turn | baseOwned:{baseId:'base_006'} + flag:flag_otaru_exp3_done + noFlag:flag_chara_unlock_otaru | setFlag:flag_chara_unlock_otaru |

priority: ev_otaru_expand_3=900、ev_otaru_declare_war=850（同ターン発火時の順序制御）

### TL-4: ボカロ統一タイムリミット（T80まで）

- `ev_ahs_conquered_flag`: trigger=`player_turn`
  - conditions: `baseOwned:{baseId:'base_074'}` + `noFlag:flag_ahs_conquered_by_player`
  - effects: `setFlag:flag_ahs_conquered_by_player`
- `ev_ahs_absorbed`: trigger=`player_turn`
  - conditions: `turn:{op:'gte',value:80}` + `noFlag:flag_ahs_conquered_by_player` + `noFlag:flag_ahs_absorbed`
  - effects: `baseTransfer:{fromFactionId:'faction_new04',toFactionId:'faction_new03'}` + `setFlag:flag_ahs_absorbed`
- `ev_vocalo_attacks`: trigger=`player_turn`
  - conditions: `flag:flag_ahs_absorbed` + `turn:{op:'gte',value:85}` + `noFlag:flag_vocalo_at_war`
  - effects: `warFlag:{factionId:'faction_new03',atWar:true}` + `setFlag:flag_vocalo_at_war`
- `ev_vocalo_conquered`: trigger=`player_turn`
  - conditions: `baseOwned:{baseId:'base_092'}` + `noFlag:flag_vocalo_conquered`
  - effects: `setFlag:flag_vocalo_conquered`

---

## エンディング条件

| エンディング | 必要フラグ |
|------------|-----------|
| 通常エンド | flag_vocalo_conquered |
| 初音ミク戦追加 | flag_vocalo_conquered + flag_saitama_conquered_by_player + flag_chara_unlock_otaru |

GameContext `checkVictory()` を `flag_vocalo_conquered` で勝利判定するよう拡張すること。
初音ミク戦の実装は今回対象外。フラグ判定のみ。

---

## 実装作業リスト

### 1. ev_mito_conquest.json トリガー修正

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
    ev_una_joined.json
    ev_una_fled.json
    ev_saitama_absorbed.json
    ev_tokyo_open.json
    ev_tokyo_conquered.json
  ch05_vocalo/
    ev_ahs_conquered_flag.json
    ev_ahs_absorbed.json
    ev_vocalo_attacks.json
    ev_vocalo_conquered.json
```

計17件。テキストはダミーでよい（「【ダミー】○○」等）。

### 3. _index.json へのエントリ追加

全17件をchapter付きで追記。

### 4. GameContext checkVictory() 拡張

`flag_vocalo_conquered` が立っているとき `gamePhase:'victory'` に遷移するよう修正。
現在の実装を確認してから判断すること。

---

## 制約・注意

- 全イベントtriggerは `player_turn` または `before_faction_turn`。`base_conquered` は使わない
- `baseOwned` conditionは「現在プレイヤーが所有しているか」の継続判定。`maxOccurrences:1` で重複発火を防ぐこと
- baseTransferで単一拠点を移譲する場合、`fromFactionId`+拠点指定のeffectは存在しない。EventEngineの`baseTransfer`は**勢力の全拠点を一括移譲**する仕様。**小樽侵食（expand_1〜3）は個別拠点の移譲が必要なため、以下のいずれかの対応が必要**:
  - 案A: EventEngineに `baseTransferSingle: {baseId, toFactionId}` を追加
  - 案B: 小樽侵食ロジックをGameContext/LegionAI側に実装し、イベントからは発火フラグのみ管理
  - **Code担当が判断して実装すること**
