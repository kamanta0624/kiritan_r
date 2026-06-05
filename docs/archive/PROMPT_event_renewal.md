# PROMPT_event_renewal.md — イベント刷新

## 概要

既存イベントを大幅削除し、新規イベントセットに置き換える。
タイムリミット関連イベント（ch02_saitama / ch03_otaru）は全て保持する。

---

## Step 1: 削除対象ファイル

以下のJSONファイルを削除する（`rm`）。

### system/
- `src/game/data/events/system/ev_join_itako.json`
- `src/game/data/events/system/ev_join_zunko.json`
- `src/game/data/events/system/ev_companion_choice_legacy.json`
- `src/game/data/events/system/ev_turn2_recruit_1.json`
- `src/game/data/events/system/ev_turn2_recruit_2.json`
- `src/game/data/events/system/ev_turn3_join_akane.json`
- `src/game/data/events/system/ev_turn3_join_aoi.json`
- `src/game/data/events/system/ev_turn3_join_akari.json`
- `src/game/data/events/system/ev_turn3_join_maki.json`
- `src/game/data/events/system/ev_turn3_join_yukari.json`
- `src/game/data/events/system/ev_turn3_join_sora.json`

### ch01_tohoku/
- `src/game/data/events/ch01_tohoku/ev_first_attack_from_natto.json`

### defeated/
- `src/game/data/events/defeated/ev_defeated_naruhanahi_me.json`
- `src/game/data/events/defeated/ev_defeated_naruhanahi_mikoto.json`

### placeholder/
- `src/game/data/events/placeholder/ev_defeated_placeholder_03.json`
- `src/game/data/events/placeholder/ev_defeated_placeholder_04.json`

### ch04_saitama_tl/（ディレクトリごと削除）
- `src/game/data/events/ch04_saitama_tl/ev_una_joined.json`
- `src/game/data/events/ch04_saitama_tl/ev_una_fled.json`
- `src/game/data/events/ch04_saitama_tl/ev_saitama_absorbed.json`
- `src/game/data/events/ch04_saitama_tl/ev_tokyo_open.json`
- `src/game/data/events/ch04_saitama_tl/ev_tokyo_conquered.json`

### ch05_vocalo/（ディレクトリごと削除）
- `src/game/data/events/ch05_vocalo/ev_ahs_conquered_flag.json`
- `src/game/data/events/ch05_vocalo/ev_ahs_absorbed.json`
- `src/game/data/events/ch05_vocalo/ev_vocalo_attacks.json`
- `src/game/data/events/ch05_vocalo/ev_vocalo_conquered.json`

---

## Step 2: 既存ファイルを上書き更新

### `src/game/data/events/system/ev_000_opening.json`

```json
{
  "id": "ev_000_opening",
  "name": "オープニング",
  "trigger": "game_start",
  "conditions": [],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_004",
          "position": "center",
          "text": "オープニング　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": []
  }
}
```

### `src/game/data/events/system/ev_turn1_status.json`

```json
{
  "id": "ev_turn1_status",
  "name": "1ターン目イベント",
  "trigger": "player_turn",
  "conditions": [
    {
      "type": "turn",
      "op": "eq",
      "value": 1
    }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_004",
          "position": "center",
          "text": "1ターン目イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": [
      {
        "type": "setFlag",
        "flag": "ev_turn1_done"
      }
    ]
  }
}
```

### `src/game/data/events/ch01_tohoku/ev_mito_conquest.json`

```json
{
  "id": "ev_mito_conquest",
  "name": "水戸占領イベント",
  "trigger": "player_turn",
  "conditions": [
    {
      "type": "baseOwned",
      "baseId": "base_045"
    },
    {
      "type": "noFlag",
      "flag": "flag_mito_conquest_done"
    }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_020",
          "position": "left",
          "text": "水戸占領イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": [
      {
        "type": "charJoin",
        "charId": "char_020",
        "factionId": "東北家"
      },
      {
        "type": "charJoin",
        "charId": "char_021",
        "factionId": "東北家"
      },
      {
        "type": "baseTransfer",
        "fromFactionId": "faction_red",
        "toFactionId": "東北家"
      },
      {
        "type": "attackUnlock",
        "factionId": "faction_new02"
      },
      {
        "type": "attackUnlock",
        "factionId": "faction_green"
      },
      {
        "type": "setFlagWithTurn",
        "flag": "flag_mito_conquest_done"
      },
      {
        "type": "setFlag",
        "flag": "flag_saitama_chain_active"
      },
      {
        "type": "warFlag",
        "factionId": "faction_green",
        "atWar": true
      }
    ]
  }
}
```

---

## Step 3: 新規ファイル作成

### `src/game/data/events/system/ev_turn2_join_kotohaxsisters.json`

```json
{
  "id": "ev_turn2_join_kotohaxsisters",
  "name": "2ターン目：琴葉茜・葵加入",
  "trigger": "player_turn",
  "conditions": [
    {
      "type": "turn",
      "op": "eq",
      "value": 2
    },
    {
      "type": "noFlag",
      "flag": "flag_kotoha_sisters_joined"
    }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_008",
          "position": "left",
          "text": "2ターン目イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": [
      {
        "type": "charJoin",
        "charId": "char_008",
        "factionId": "東北家"
      },
      {
        "type": "charJoin",
        "charId": "char_009",
        "factionId": "東北家"
      },
      {
        "type": "setFlag",
        "flag": "flag_kotoha_sisters_joined"
      }
    ]
  }
}
```

### `src/game/data/events/defeated/ev_defeated_awamo.json`

```json
{
  "id": "ev_defeated_awamo",
  "name": "[沖縄あわも撃破]沖縄あわも加入",
  "trigger": "char_defeated",
  "conditions": [
    {
      "type": "defeatedChar",
      "charId": "char_023"
    },
    {
      "type": "noFlag",
      "flag": "flag_awamo_joined"
    }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_023",
          "position": "left",
          "text": "沖縄あわも撃破イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": [
      {
        "type": "charJoin",
        "charId": "char_023",
        "factionId": "東北家"
      },
      {
        "type": "setFlag",
        "flag": "flag_awamo_joined"
      }
    ]
  }
}
```

### `src/game/data/events/defeated/ev_defeated_shinobi.json`

```json
{
  "id": "ev_defeated_shinobi",
  "name": "[関西しのび撃破]関西しのび加入",
  "trigger": "char_defeated",
  "conditions": [
    {
      "type": "defeatedChar",
      "charId": "char_022"
    },
    {
      "type": "noFlag",
      "flag": "flag_shinobi_joined"
    }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_022",
          "position": "left",
          "text": "関西しのび撃破イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": [
      {
        "type": "charJoin",
        "charId": "char_022",
        "factionId": "東北家"
      },
      {
        "type": "setFlag",
        "flag": "flag_shinobi_joined"
      }
    ]
  }
}
```

### `src/game/data/events/theater/ev_theater_kotoha_sisters.json`

```json
{
  "id": "ev_theater_kotoha_sisters",
  "name": "琴葉姉妹の会話",
  "trigger": "theater",
  "category": "story",
  "title": "琴葉姉妹の会話",
  "description": "琴葉茜と琴葉葵が仲間にいるときに見られる会話。",
  "cost": {
    "actionPoints": 1
  },
  "conditions": [
    {
      "type": "hasChar",
      "charId": "char_008"
    },
    {
      "type": "hasChar",
      "charId": "char_009"
    }
  ],
  "probability": 1,
  "priority": 500,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_008",
          "position": "left",
          "text": "琴葉姉妹の会話　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": []
  }
}
```

### `src/game/data/events/theater/ev_theater_chanko.json`

```json
{
  "id": "ev_theater_chanko",
  "name": "大江戸ちゃんこの会話",
  "trigger": "theater",
  "category": "story",
  "title": "大江戸ちゃんこの会話",
  "description": "大江戸ちゃんこが仲間にいるときに見られる会話。",
  "cost": {
    "actionPoints": 1
  },
  "conditions": [
    {
      "type": "hasChar",
      "charId": "char_020"
    }
  ],
  "probability": 1,
  "priority": 500,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_020",
          "position": "left",
          "text": "大江戸ちゃんこの会話　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": []
  }
}
```

---

## Step 4: `_index.json` を全面置き換え

`src/game/data/events/_index.json` を以下の内容で全面置き換える。

```json
{
  "_comment": "イベントインデックス。新規イベント追加時はここにエントリを追加すること。",
  "_schema": {
    "id": "イベントID（ファイル内のidと一致させること）",
    "path": "src/data/events/ からの相対パス",
    "chapter": "管理用タグ（system / ch01 / ch02 / ... / defeated / theater）"
  },
  "events": [
    {
      "id": "ev_000_opening",
      "path": "system/ev_000_opening.json",
      "chapter": "system"
    },
    {
      "id": "ev_turn1_status",
      "path": "system/ev_turn1_status.json",
      "chapter": "system"
    },
    {
      "id": "ev_turn2_join_kotohaxsisters",
      "path": "system/ev_turn2_join_kotohaxsisters.json",
      "chapter": "system"
    },
    {
      "id": "ev_mito_conquest",
      "path": "ch01_tohoku/ev_mito_conquest.json",
      "chapter": "ch01_tohoku"
    },
    {
      "id": "ev_saitama_chain_1",
      "path": "ch02_saitama/ev_saitama_chain_1.json",
      "chapter": "ch02_saitama"
    },
    {
      "id": "ev_saitama_chain_2",
      "path": "ch02_saitama/ev_saitama_chain_2.json",
      "chapter": "ch02_saitama"
    },
    {
      "id": "ev_saitama_chain_3",
      "path": "ch02_saitama/ev_saitama_chain_3.json",
      "chapter": "ch02_saitama"
    },
    {
      "id": "ev_saitama_chain_4",
      "path": "ch02_saitama/ev_saitama_chain_4.json",
      "chapter": "ch02_saitama"
    },
    {
      "id": "ev_otaru_phase1_start",
      "path": "ch03_otaru/ev_otaru_phase1_start.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_expand_1",
      "path": "ch03_otaru/ev_otaru_expand_1.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_expand_2",
      "path": "ch03_otaru/ev_otaru_expand_2.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_expand_3",
      "path": "ch03_otaru/ev_otaru_expand_3.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_declare_war",
      "path": "ch03_otaru/ev_otaru_declare_war.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_war_flag_sync",
      "path": "ch03_otaru/ev_otaru_war_flag_sync.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_conquered",
      "path": "ch03_otaru/ev_otaru_conquered.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_otaru_max_check",
      "path": "ch03_otaru/ev_otaru_max_check.json",
      "chapter": "ch03_otaru"
    },
    {
      "id": "ev_defeated_awamo",
      "path": "defeated/ev_defeated_awamo.json",
      "chapter": "defeated"
    },
    {
      "id": "ev_defeated_shinobi",
      "path": "defeated/ev_defeated_shinobi.json",
      "chapter": "defeated"
    },
    {
      "id": "theater_sample_001",
      "path": "theater/ev_theater_sample.json",
      "chapter": "theater"
    },
    {
      "id": "ev_theater_kotoha_sisters",
      "path": "theater/ev_theater_kotoha_sisters.json",
      "chapter": "theater"
    },
    {
      "id": "ev_theater_chanko",
      "path": "theater/ev_theater_chanko.json",
      "chapter": "theater"
    }
  ]
}
```

---

## 完了条件

- 削除対象ファイルが全て存在しない
- Step 3 の新規ファイルが全て存在する
- `_index.json` の `events` 配列が上記の21件（theater_sample_001含む）と一致する
- 起動してコンソールに `[EventEngine] 21件のイベントをロード` と表示される
- `http://localhost:5174/?qa=battlefull` でエラーなく起動する
