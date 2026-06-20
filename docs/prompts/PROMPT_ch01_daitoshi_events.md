# PROMPT_ch01_daitoshi_events

VS大都会チャプターのイベントJSON新規作成＋既存修正。セリフは全てダミー。

---

## 前提確認

- faction_red = 大都会
- EventEngine条件型: `defeatedChar`, `noFlag`, `flag`, `baseOwned`, `turn` 等（`noDefeatedChar`は存在しない）
- ルートA/B判定: `flag_awamo_joined`（既存 ev_defeated_awamo が setFlag 済み）で分岐
- charJoin factionId: `東北家`（固定）

---

## タスク1: 新規JSONファイル作成

以下7ファイルを `src/game/data/events/ch01_tohoku/` に作成する。

---

### 1-1. ev_daitoshi_turn1.json

```json
{
  "id": "ev_daitoshi_turn1",
  "name": "[1T]大都会作戦会議",
  "trigger": "enemy_turn",
  "conditions": [
    { "type": "turn", "op": "eq", "value": 1 },
    { "type": "noFlag", "flag": "flag_daitoshi_turn1" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_020", "position": "left", "text": "1ターン目大都会行動開始イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "setFlag", "flag": "flag_daitoshi_turn1" }
    ]
  }
}
```

---

### 1-2. ev_defense_sendai.json

```json
{
  "id": "ev_defense_sendai",
  "name": "[仙台防衛]防衛前ADV",
  "trigger": "base_defense",
  "conditions": [
    { "type": "attackerFaction", "factionId": "faction_red" },
    { "type": "noFlag", "flag": "flag_sendai_defense_adv" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_001", "position": "center", "text": "仙台防衛前ADV　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "setFlag", "flag": "flag_sendai_defense_adv" }
    ]
  }
}
```

> **注意**: `base_defense`はApp.jsx `startDefenseQueue`がキュー先頭アイテムのみで発火。仙台が先頭でない場合は発火しない。現状序盤は仙台が先頭になる想定で許容。

---

### 1-3. ev_defeated_meron.json

```json
{
  "id": "ev_defeated_meron",
  "name": "[北海道めろん撃破]めろん加入",
  "trigger": "char_defeated",
  "conditions": [
    { "type": "defeatedChar", "charId": "char_024" },
    { "type": "noFlag", "flag": "flag_meron_joined" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_024", "position": "left", "text": "北海道めろん撃破イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "charJoin", "charId": "char_024", "factionId": "東北家" },
      { "type": "setFlag", "flag": "flag_meron_joined" }
    ]
  }
}
```

---

### 1-4. ev_chanko_conquered_a.json

ルートA: あわも未撃破のまま郡山（base_021）を制圧 → 暗黒大将軍フェーズ移行

```json
{
  "id": "ev_chanko_conquered_a",
  "name": "[郡山制圧・ルートA]暗黒大将軍覚醒",
  "trigger": "base_conquered",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_021" },
    { "type": "noFlag", "flag": "flag_awamo_joined" },
    { "type": "noFlag", "flag": "flag_chanko_conquered" }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_023", "position": "left", "text": "[ルートA]郡山制圧・暗黒大将軍覚醒イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "setFlag", "flag": "flag_ankokugun_active" },
      { "type": "setFlag", "flag": "flag_chanko_conquered" }
    ]
  }
}
```

---

### 1-5. ev_chanko_conquered_b.json

ルートB: あわも撃破済みで郡山（base_021）を制圧 → ちゃんこ安堵確定フラグのみ

あわも/めろんの加入はev_defeated_awamo/meronが担当。このイベントではcharJoinしない。

```json
{
  "id": "ev_chanko_conquered_b",
  "name": "[郡山制圧・ルートB]ちゃんこ安堵",
  "trigger": "base_conquered",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_021" },
    { "type": "flag", "flag": "flag_awamo_joined" },
    { "type": "noFlag", "flag": "flag_chanko_conquered" }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_020", "position": "left", "text": "[ルートB]郡山制圧・ちゃんこ安堵イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "setFlag", "flag": "flag_chanko_conquered" }
    ]
  }
}
```

---

### 1-6. ev_mito_conquest_a.json

ルートA水戸（base_045）制圧 → ちゃんこ/しのび/つるぎ加入

```json
{
  "id": "ev_mito_conquest_a",
  "name": "[水戸制圧・ルートA]ちゃんこ軍門",
  "trigger": "base_conquered",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_045" },
    { "type": "flag", "flag": "flag_ankokugun_active" },
    { "type": "noFlag", "flag": "flag_mito_conquest_done" }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_020", "position": "left", "text": "[ルートA]水戸制圧・ちゃんこ軍門イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "charJoin", "charId": "char_020", "factionId": "東北家" },
      { "type": "charJoin", "charId": "char_021", "factionId": "東北家" },
      { "type": "charJoin", "charId": "char_022", "factionId": "東北家" },
      { "type": "baseTransfer", "fromFactionId": "faction_red", "toFactionId": "東北家" },
      { "type": "setFlagWithTurn", "flag": "flag_mito_conquest_done" }
    ]
  }
}
```

---

### 1-7. ev_mito_conquest_b.json

ルートB水戸（base_045）制圧 → あんこもん加入

```json
{
  "id": "ev_mito_conquest_b",
  "name": "[水戸制圧・ルートB]あんこもん加入",
  "trigger": "base_conquered",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_045" },
    { "type": "noFlag", "flag": "flag_ankokugun_active" },
    { "type": "noFlag", "flag": "flag_mito_conquest_done" }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        { "characterId": "char_107", "position": "left", "text": "[ルートB]水戸制圧・あんこもん加入イベント　セリフダミー" }
      ]
    },
    { "type": "end" }
  ],
  "effects": {
    "default": [
      { "type": "charJoin", "charId": "char_107", "factionId": "東北家" },
      { "type": "baseTransfer", "fromFactionId": "faction_red", "toFactionId": "東北家" },
      { "type": "setFlagWithTurn", "flag": "flag_mito_conquest_done" }
    ]
  }
}
```

---

## タスク2: _index.jsonにエントリ追加

`src/game/data/events/_index.json` の `"events"` 配列に以下を追加する。
既存の `ev_mito_conquest` エントリは**削除する**（ev_mito_conquest_a/bで置き換え）。

```json
{ "id": "ev_daitoshi_turn1",     "path": "ch01_tohoku/ev_daitoshi_turn1.json",     "chapter": "ch01_tohoku" },
{ "id": "ev_defense_sendai",     "path": "ch01_tohoku/ev_defense_sendai.json",     "chapter": "ch01_tohoku" },
{ "id": "ev_defeated_meron",     "path": "ch01_tohoku/ev_defeated_meron.json",     "chapter": "ch01_tohoku" },
{ "id": "ev_chanko_conquered_a", "path": "ch01_tohoku/ev_chanko_conquered_a.json", "chapter": "ch01_tohoku" },
{ "id": "ev_chanko_conquered_b", "path": "ch01_tohoku/ev_chanko_conquered_b.json", "chapter": "ch01_tohoku" },
{ "id": "ev_mito_conquest_a",    "path": "ch01_tohoku/ev_mito_conquest_a.json",    "chapter": "ch01_tohoku" },
{ "id": "ev_mito_conquest_b",    "path": "ch01_tohoku/ev_mito_conquest_b.json",    "chapter": "ch01_tohoku" }
```

削除するエントリ:
```json
{ "id": "ev_mito_conquest", "path": "ch01_tohoku/ev_mito_conquest.json", "chapter": "ch01_tohoku" }
```

---

## タスク3: 既存ファイル削除

`src/game/data/events/ch01_tohoku/ev_mito_conquest.json` を削除する（_index.jsonから除外済みのためViteバンドルには含まれないが、ファイルとして残るのは混乱を招く）。

---

## 補足

**ルートB条件**: `flag_awamo_joined`はev_defeated_awamoでのみセットされる。めろんを先に倒してあわもを後に倒した場合でもルートB成立（あわも加入時点で条件達成）。正仕様。

---

## 検証手順（QA）

1. 新規ゲーム開始 → 1T終了 → 大都会ADVが発火するか確認
2. 郡山（base_021）をあわも健在のまま制圧 → ev_chanko_conquered_a発火確認（`flag_ankokugun_active`がセットされるか）
3. 水戸（base_045）制圧 → ev_mito_conquest_a発火・ちゃんこ/しのび/つるぎ加入確認
4. 別ゲームであわも（char_023）を先に撃破 → ev_defeated_awamo発火・加入確認
5. めろん（char_024）を撃破 → ev_defeated_meron発火・加入確認
6. あわも/めろん撃破後に郡山制圧 → ev_chanko_conquered_b発火確認
7. 水戸制圧 → ev_mito_conquest_b発火・あんこもん加入確認
8. 仙台防衛発生時 → ev_defense_sendai発火（1回のみ）確認
