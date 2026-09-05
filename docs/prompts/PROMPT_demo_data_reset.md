# PROMPT_demo_data_reset

体験版のデータ基盤を整える。対象は `characters.json` と `legions.json` の2ファイルのみ。
イベントJSONは別プロンプト（PROMPT_demo_events_rebuild）で扱う。触るな。

---

## 成功基準

1. `src/game/data/characters.json` で `factionId: "東北家"` を持つ非テンプレキャラが7名ちょうど
2. 同ファイルに `char_111`（大江戸ちゃんこ（源氏丸））が存在し、`soldiers`/`maxSoldiers` が 10、`charHp`/`charMaxHp` が 30
3. `src/game/data/legions.json` の大都会3軍団が下表と一致
4. `npm run dev` が起動し、コンソールにJSONパースエラーが出ない
5. 上記4点を自分で確認してから完了報告すること

---

## 1. characters.json — 東北家の所属を7名へ

`factionId` を `"東北家"` のまま残すのは以下7名のみ。

| id | 名前 |
|---|---|
| char_004 | 東北きりたん |
| char_005 | 音街ウナ |
| char_006 | 彩澄しゅお |
| char_016 | ずんだもん |
| char_017 | 四国めたん |
| char_018 | 九州そら |
| char_019 | 中国うさぎ |

以下9名は `factionId` を `null` へ変更する。**削除するな。** 後続のイベントで `charJoin` により加入させる。

| id | 名前 |
|---|---|
| char_014 | 東北ずん子 |
| char_015 | 東北イタコ |
| char_039 | 重音テト |
| char_084 | 猫使アル |
| char_085 | 猫使ビィ |
| char_100 | 藍田ノエル |
| char_101 | ROSA |
| char_107 | あんこもん |
| char_109 | 里石ユカ |

`char_110` は `isTemplate: true` のモブテンプレート。`GameContext.jsx:42` の
`filter(c => !c.isTemplate)` で state から除外されるため**対処不要。触るな。**

### 根拠

`GameContext.jsx:40-42` が非テンプレの全キャラを state に投入済み。
`charJoin`（同 L456-463）は `factionId` を上書きするだけで変更前の値を問わない。
よって `factionId: null` の在野キャラも、`faction_red` 所属キャラも、後から加入できる。

---

## 2. characters.json — char_111 の追加

`char_020`（大江戸ちゃんこ）のレコードを**全フィールド複製**し、以下だけを変更する。

| フィールド | 値 |
|---|---|
| `id` | `"char_111"` |
| `name` | `"大江戸ちゃんこ（源氏丸）"` |
| `description` | `"秘密結社大都会の総帥。力士型ロボット源氏丸に搭乗した姿"` |
| `soldiers` | `10` |
| `maxSoldiers` | `10` |
| `charHp` | `30` |
| `charMaxHp` | `30` |

`soldiers` を 0 にするな。0 だと以下3箇所のフィルタで戦闘参加者から除外され、
源氏丸が戦闘に一切出てこない。

- `App.jsx:440-446`（防衛編成の敵キャラ抽出）… `(c.soldiers ?? 0) > 0`
- `App.jsx:463-469`（戦闘の敵キャラ抽出）… 同上
- `LegionAI.js:281-293` `_getLegionCombatChars` … `c.soldiers > 0 && c.charHp > 0`

10 は「除外されない最小限の値」として置いた暫定値。

**`charDefense` / `charSong` / `defense` / `soldierAtk` / `soldierDef` / `charAttack` /
`attackCount` / `strategyRate` は char_020 の値をそのまま据え置け。**
これらは戦闘システム刷新の決着待ち。JSONにコメントは書けないので、
本プロンプトの記載をもって未確定であることの記録とする。

配置位置は `char_110` の直後。

### char_020 の現行値（複製元・参照用）

```
"charHp": 7, "charMaxHp": 7, "charAttack": 10, "charDefense": 5, "charSong": 0,
"attack": 10, "defense": 70, "attackCount": 8,
"soldiers": 710, "maxSoldiers": 710, "soldierAtk": 7, "soldierDef": 10,
"strategyRate": 20, "attackType": "melee", "role": "attacker",
"factionId": "faction_red", "isLeader": false, "isTemplate": false
```

`battleBonus` / `equipment` 等のネストしたオブジェクトも同じ構造で複製すること。

---

## 3. legions.json — 大都会3軍団の再構成

現行の `attackPriority` / `defendBases` には自由都市（`base_014` 会津 /
`base_071` 高崎 / `base_047` 三陸）が含まれている。**全て破棄**し、下表に置き換える。

### legion_red_01（納豆ファクトリー第一軍団）

| フィールド | 値 |
|---|---|
| `charIds` | `["char_024", "char_023"]`（めろん・あわも）変更なし |
| `attackPriority` | `["base_001", "base_003", "base_021"]` |
| `defendBases` | `[]` |
| `mobSlots` / `maxMobSlots` | 現行のまま（slot_1 / slot_2、mob_001） |
| `attackFrequency` | `{"type": "every_turn"}` 変更なし |
| `retreatRule.onDefendBase` | `{}` へ変更（現行の `base_071` 指定を削除） |

### legion_faction_red_02（新規軍団）

| フィールド | 値 |
|---|---|
| `charIds` | `["char_021", "char_022", "char_111"]`（つるぎ・しのび・源氏丸ちゃんこ） |
| `attackPriority` | `[]` |
| `defendBases` | `["base_003", "base_021"]` |
| `attackFrequency` | `null` |
| `maxMobSlots` | `0` 変更なし |

`name` は `"新規軍団"` のままでよい。改名は不要。

### legion_faction_red_reserve（大都会防衛隊）

変更なし。触るな。

### 補足

- `mainCount` フィールドは追加するな。`LegionAI.js:172` が `?? 2` で既定値を持つ
- 水戸（`base_045`）の防衛軍団はこのプロンプトでは作らない。
  制圧直前にイベントで `legion_faction_red_02` の編成を組み替える設計。
  そのための `legionUpdate` 改修は別プロンプト

---

## やるな

- イベントJSON（`src/game/data/events/` 配下）への変更
- `bases.json` / `factions.json` への変更
- `BattleEngineV3.js` / `LegionAI.js` / `GameContext.jsx` への変更
- 上表に無いキャラの `factionId` 変更
- ステータス値の「バランス調整」。指定された値以外を動かすな
- 指示範囲外のコードやコメントの整形
