# PROMPT_scenario_endgame_restore — 終盤シナリオ復元（埼玉TL / ボカロTL）

対象: ClaudeCode。価値基準 = 怠惰・短気・傲慢。
着手前に `KNOWLEDGE.md` §8-5（複数発火・条件評価の鮮度）を必読。

---

## 背景・コンフリクト解消方針

`PROMPT_event_renewal.md`（実装済・live）が `ch04_saitama_tl/`（5件）と
`ch05_vocalo/`（4件）を**削除**した。一方 `PROMPT_scenario_phase1.md` は
同イベント群で終盤シナリオ（埼玉/東京/AHS/ボカロのタイムリミット＋エンディング）を
設計している。両者が対立＝コンフリクト。

**解消: scenario_phase1 側を採用し、削除された9件を復元する。**
renewal の削除済構成に対し、本プロンプトで終盤チェーンを追加する。

---

## 実装不要の既存基盤（コード確認済・触るな）

| 基盤 | 状態 | 根拠 |
|---|---|---|
| `baseTransferSingle` 効果 | 実装済 | `GameContext.jsx:417-418,545-546`、ch03 live 使用 |
| `baseTransfer`（勢力全拠点） | 実装済 | `ev_mito_conquest` live 使用（fromFactionId/toFactionId） |
| `checkVictoryCondition` の `flag_vocalo_conquered → victory` | **結線済** | `GameContext.jsx:736`。**変更不要** |
| 条件 `turn`(op gte/lte) | 実装済 | `EventEngine.js:127-130` |
| 条件 `turnAfterFlag` / `baseOwned` / `flag` / `noFlag` | 実装済 | live 使用実績 |
| 効果 `warFlag` / `setFlag` / `setFlagWithTurn` | 実装済 | live 使用実績 |

### ID 検証済（bases.json / factions.json 実値）
- base_023=秩父 / base_028=春日部 / base_032=秋葉原 / base_074=京都 / base_092=北九州
- faction_green=さいたま / faction_new01=東京 / faction_new03=ボーカル界 / faction_new04=AHS（仮） / faction_yellow=小樽潮風

---

## スコープ

- **JSON 9件 新規作成** + `_index.json` に 9件追記のみ。
- **コード変更ゼロ。** ch01/ch02/ch03 のイベントは触るな。
- テキストは全ダミー（`【ダミー】○○`）。charJoin は scenario_phase1 方針どおり後回し（フラグのみ）。

---

## Step 1: `ch04_saitama_tl/` を作成（5件）

### ev_una_joined.json
```json
{
  "id": "ev_una_joined",
  "name": "【ダミー】秩父制圧・ウナしゅお合流",
  "trigger": "player_turn",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_023" },
    { "type": "noFlag", "flag": "flag_una_joined" },
    { "type": "noFlag", "flag": "flag_una_fled" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】秩父を制圧。ウナ・しゅおが合流した。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_una_joined" } ] }
}
```

### ev_una_fled.json
```json
{
  "id": "ev_una_fled",
  "name": "【ダミー】ウナしゅお離脱（T25）",
  "trigger": "player_turn",
  "conditions": [
    { "type": "turn", "op": "gte", "value": 25 },
    { "type": "noFlag", "flag": "flag_una_joined" },
    { "type": "noFlag", "flag": "flag_una_fled" },
    { "type": "flag", "flag": "flag_mito_conquest_done" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】間に合わなかった。ウナ・しゅおは去った。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_una_fled" } ] }
}
```

### ev_tokyo_open.json
```json
{
  "id": "ev_tokyo_open",
  "name": "【ダミー】さいたま陥落・東京開放",
  "trigger": "player_turn",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_028" },
    { "type": "noFlag", "flag": "flag_saitama_conquered_by_player" }
  ],
  "probability": 1,
  "priority": 950,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】春日部を制圧。東京が動き出す。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [
    { "type": "setFlag", "flag": "flag_saitama_conquered_by_player" },
    { "type": "warFlag", "factionId": "faction_new01", "atWar": true }
  ] }
}
```

### ev_saitama_absorbed.json
```json
{
  "id": "ev_saitama_absorbed",
  "name": "【ダミー】さいたま東京吸収（T55タイムリミット）",
  "trigger": "player_turn",
  "conditions": [
    { "type": "turn", "op": "gte", "value": 55 },
    { "type": "noFlag", "flag": "flag_saitama_conquered_by_player" },
    { "type": "noFlag", "flag": "flag_saitama_absorbed_by_tokyo" }
  ],
  "probability": 1,
  "priority": 850,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】遅すぎた。さいたまは東京に吸収された。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [
    { "type": "baseTransfer", "fromFactionId": "faction_green", "toFactionId": "faction_new01" },
    { "type": "setFlag", "flag": "flag_saitama_absorbed_by_tokyo" },
    { "type": "warFlag", "factionId": "faction_new01", "atWar": true }
  ] }
}
```

### ev_tokyo_conquered.json
```json
{
  "id": "ev_tokyo_conquered",
  "name": "【ダミー】秋葉原制圧・ずん子いたこ解禁",
  "trigger": "player_turn",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_032" },
    { "type": "flag", "flag": "flag_saitama_conquered_by_player" },
    { "type": "noFlag", "flag": "flag_chara_unlock_zunko_itako" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】秋葉原を制圧。ずん子・いたこが解禁された。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_chara_unlock_zunko_itako" } ] }
}
```

---

## Step 2: `ch05_vocalo/` を作成（4件）

### ev_ahs_conquered_flag.json
```json
{
  "id": "ev_ahs_conquered_flag",
  "name": "【ダミー】AHS（京都）制圧フラグ",
  "trigger": "player_turn",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_074" },
    { "type": "noFlag", "flag": "flag_ahs_conquered_by_player" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】京都を制圧。AHSを下した。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_ahs_conquered_by_player" } ] }
}
```

### ev_ahs_absorbed.json
```json
{
  "id": "ev_ahs_absorbed",
  "name": "【ダミー】AHSボカロ吸収（T80タイムリミット）",
  "trigger": "player_turn",
  "conditions": [
    { "type": "turn", "op": "gte", "value": 80 },
    { "type": "noFlag", "flag": "flag_ahs_conquered_by_player" },
    { "type": "noFlag", "flag": "flag_ahs_absorbed" }
  ],
  "probability": 1,
  "priority": 850,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】AHSはボーカル界に吸収された。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [
    { "type": "baseTransfer", "fromFactionId": "faction_new04", "toFactionId": "faction_new03" },
    { "type": "setFlag", "flag": "flag_ahs_absorbed" }
  ] }
}
```

### ev_vocalo_attacks.json
```json
{
  "id": "ev_vocalo_attacks",
  "name": "【ダミー】ボーカル界宣戦（T85）",
  "trigger": "player_turn",
  "conditions": [
    { "type": "flag", "flag": "flag_ahs_absorbed" },
    { "type": "turn", "op": "gte", "value": 85 },
    { "type": "noFlag", "flag": "flag_vocalo_at_war" }
  ],
  "probability": 1,
  "priority": 900,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】ボーカル界が全軍で攻めてきた。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [
    { "type": "warFlag", "factionId": "faction_new03", "atWar": true },
    { "type": "setFlag", "flag": "flag_vocalo_at_war" }
  ] }
}
```

### ev_vocalo_conquered.json
```json
{
  "id": "ev_vocalo_conquered",
  "name": "【ダミー】北九州制圧・ボーカル界統一",
  "trigger": "player_turn",
  "conditions": [
    { "type": "baseOwned", "baseId": "base_092" },
    { "type": "noFlag", "flag": "flag_vocalo_conquered" }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    { "type": "conversation", "lines": [
      { "characterId": "char_004", "position": "center", "text": "【ダミー】北九州を制圧。ボーカル界を統一した。" }
    ] },
    { "type": "end" }
  ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_vocalo_conquered" } ] }
}
```

> `flag_vocalo_conquered` 立 → 次の `checkVictoryCondition` 評価で `victory`（GameContext.jsx:736 結線済）。エンディング判定追加実装は不要。

---

## Step 3: `_index.json` に9件追記

`events` 配列末尾に以下を追加（chapter タグ付き）。

```json
{ "id": "ev_una_joined",        "path": "ch04_saitama_tl/ev_una_joined.json",        "chapter": "ch04_saitama_tl" },
{ "id": "ev_una_fled",          "path": "ch04_saitama_tl/ev_una_fled.json",          "chapter": "ch04_saitama_tl" },
{ "id": "ev_tokyo_open",        "path": "ch04_saitama_tl/ev_tokyo_open.json",        "chapter": "ch04_saitama_tl" },
{ "id": "ev_saitama_absorbed",  "path": "ch04_saitama_tl/ev_saitama_absorbed.json",  "chapter": "ch04_saitama_tl" },
{ "id": "ev_tokyo_conquered",   "path": "ch04_saitama_tl/ev_tokyo_conquered.json",   "chapter": "ch04_saitama_tl" },
{ "id": "ev_ahs_conquered_flag","path": "ch05_vocalo/ev_ahs_conquered_flag.json",    "chapter": "ch05_vocalo" },
{ "id": "ev_ahs_absorbed",      "path": "ch05_vocalo/ev_ahs_absorbed.json",          "chapter": "ch05_vocalo" },
{ "id": "ev_vocalo_attacks",    "path": "ch05_vocalo/ev_vocalo_attacks.json",        "chapter": "ch05_vocalo" },
{ "id": "ev_vocalo_conquered",  "path": "ch05_vocalo/ev_vocalo_conquered.json",      "chapter": "ch05_vocalo" }
```

直前要素のカンマ追加を忘れるな（現末尾は `ev_679817`）。

---

## 既知の注意（§8-5・条件評価の鮮度）

同一trigger・同一発火で `eligible` はループ前1回算出。先行effectのflagを後続条件は見ない。
端ケース: `ev_tokyo_open` と `ev_saitama_absorbed` が同一ターン（T≥55で春日部を当該ターン制圧）に
両方 eligible 化しうる。priority で `ev_tokyo_open(950)` を `ev_saitama_absorbed(850)` より上に設定済。
ただし priority は順序のみで再評価しないため、稀に両発火する（吸収は green 残拠点を東京へ移すだけ＝実害軽微）。
厳密排他が要るなら別途 §8-5 の「ループ内再評価」対応。本タスクでは許容。

---

## 完了条件

- 上記9 JSON が存在。`_index.json` の events が **31件**（現22＋9）。
- 起動コンソール `[EventEngine] 31件のイベントをロード`。
- `http://localhost:5174/?qa=battlefull` でエラーなく起動。
- フラグ進行の最低確認: 春日部制圧→`flag_saitama_conquered_by_player`、北九州制圧→`flag_vocalo_conquered`→勝利遷移。

## 完了後

- `KNOWLEDGE.md` §18 残タスクに終盤シナリオ復元を反映。
- 本プロンプトと `PROMPT_scenario_phase1.md`（設計元）を `docs/archive/` へ移動。

## スコープ外（別件フラグ・本タスクに含めない）

- `ch02_saitama/ev_saitama_chain_3.json` の `trigger: "turn_start"` は §18 未接続trigger。
  chain が3で停止し `ev_saitama_chain_4` の `legionForceAttack(faction_green→東北家)` 不発の疑い。
  別途調査プロンプト化を要検討。
