# PROMPT: wiki_build.cjs 既定値補完ロジックの完全化（フォローアップ）

## 目的
Phase 6 で受領した `tools/wiki_build.cjs` は `PROMPT_wiki_watcher.md §1.5 重要注記`（「Phase 4 原本と diff を生じる場合は補完しない」）に従って既定値補完を一部省略していたが、これは **sync_spec.md §6 の既定値補完規約と矛盾** していた。本フォローアップで sync_spec §6 を厳守する完全な既定値補完ロジックに修正する。

## 背景
- Phase 6 受領時点の `characters.json`: `specialType` 5 件 / `talkEventId` 53 件のみ
- 元データ（baseline）: `specialType` 7 件 / `talkEventId` 55 件（mob_001 と char_110 のみ baseline に存在、Phase 6 出力では欠落）
- 原因: ビルダーが「md に書かれていれば出力、無ければ補完なし」ロジックだった
- 正しい設計: sync_spec §6 通り、全 character で specialType / talkEventId を null 補完（md 省略時）→ 全 108 件で一貫したスキーマを保つ

## 旧プロンプト §1.5 注記の取り消し
PROMPT_wiki_watcher.md の以下注記は **取り消し**:
> **重要**: 既定値補完で発生する出力が Phase 4 直前の `src/game/data/` 原本と diff を生じる場合、その補完は **行わない**

→ **sync_spec.md §6 を絶対基準とする**。原本との diff が拡大しても、§6 通り補完することがデータ一貫性として正しい。

## 修正範囲
**ファイル**: `tools/wiki_build.cjs` のみ（および `tools/wiki_build.test.cjs` または `.mjs` のテスト追加分）

**修正対象関数**: `applyCharacterDefaults()` および各エンティティの既定値補完関数

## 既定値補完の完全仕様（sync_spec.md §6 そのまま）

md frontmatter で省略されている場合、JSON 出力時に以下既定値を **必ず** 注入:

| エンティティ | フィールド | 既定値 |
|---|---|---|
| character | `usedThisTurn` | `false` |
| character | `recoveryRate` | `null` |
| character | `equipment` | `{ item: null }` |
| character | `specialType` | `null` |
| character | `kana` | `null` |
| character | `talkEventId` | `null` |
| character | `joinCondition` | `null` |
| character | `battleBonus.attack.{soldierAtk,soldierDef,charAttack,charSong}` | `0` |
| character | `battleBonus.defense.{soldierAtk,soldierDef,charAttack,charSong}` | `0` |
| character | `battleBonus.dungeon.{soldierAtk,soldierDef,charAttack,charSong}` | `0` |
| faction | `warFlags` | `{}` |
| base | `bgCastle` | `null` |
| base | `bgField` | `null` |
| legion | `isDefenseReserve` | `false` |
| legion | `attackFrequency` | `null` |
| skill | `specialType` | `null` |
| dungeon | `floors[].rewardItemId` | `null`（各 floor ごと） |
| dungeon | `floors[].eventId` | `null`（各 floor ごと） |

## 修正方針

1. 各エンティティの既定値補完関数を **必ず全フィールド** 補完するように修正
2. md frontmatter にキーが **存在しない場合** および **値が `undefined`** の場合に既定値を注入
3. md frontmatter で **明示的に `null` が書かれている場合** は `null` を維持
4. md frontmatter で **値が存在する場合** はその値を維持

## 単体テスト追加

`tools/wiki_build.test.cjs`（または `.mjs`）に以下ケースを追加（既存テストは保持）:

| 関数 | 追加ケース | 期待 |
|---|---|---|
| `applyCharacterDefaults` | specialType 欠落 → null 補完 | `{ ..., specialType: null }` |
| `applyCharacterDefaults` | talkEventId 欠落 → null 補完 | `{ ..., talkEventId: null }` |
| `applyCharacterDefaults` | specialType: null 明示 → そのまま | `{ ..., specialType: null }` |
| `applyCharacterDefaults` | specialType: "char_strike" 値あり → そのまま | `{ ..., specialType: "char_strike" }` |
| `applyBaseDefaults`（既存なら拡張） | bgCastle 欠落 → null 補完 | `{ ..., bgCastle: null }` |
| `applyBaseDefaults` | bgField 欠落 → null 補完 | `{ ..., bgField: null }` |

合計 6 ケース追加（既存 24 ケース + 新 6 ケース = 30 ケース）。

## 成功基準

1. `npm run wiki:build` で正常終了（exit code 0）
2. `npm run wiki:test` で全テスト PASS（30 ケース以上）
3. 出力された `src/game/data/characters.json` で **全 108 件** に以下フィールドが存在:
   - `usedThisTurn`
   - `recoveryRate`
   - `equipment`
   - `specialType`
   - `kana`
   - `talkEventId`
   - `joinCondition`
   - `battleBonus.attack` / `battleBonus.defense` / `battleBonus.dungeon`（各 4 サブフィールド）
4. 出力された `src/game/data/bases.json` で **全 92 件** に `bgCastle` および `bgField` フィールドが存在
5. 出力された `src/game/data/legions.json` で **全 15 件** に `isDefenseReserve` および `attackFrequency` フィールドが存在
6. 出力された `src/game/data/factions.json` で **全 8 件** に `warFlags` フィールドが存在（空 object でも可）
7. ベースラインとの diff は **拡大する** が、新規差分はすべて「null または既定値の追加」のみであることを確認（ゲーム実害なし）

## 検証コマンド例

```bash
# specialType と talkEventId の出現件数確認（108 件期待）
jq '[.characters[] | select(.specialType != null or .specialType == null)] | length' src/game/data/characters.json
jq '[.characters[] | select(.talkEventId != null or .talkEventId == null)] | length' src/game/data/characters.json

# bgCastle / bgField の出現件数確認（92 件期待）
jq '[.bases[] | select(has("bgCastle"))] | length' src/game/data/bases.json
jq '[.bases[] | select(has("bgField"))] | length' src/game/data/bases.json

# isDefenseReserve / attackFrequency 出現件数確認（15 件期待）
jq '[.legions[] | select(has("isDefenseReserve"))] | length' src/game/data/legions.json
jq '[.legions[] | select(has("attackFrequency"))] | length' src/game/data/legions.json
```

## 禁止事項

- 既定値補完以外のロジック変更禁止（東北家正規化・skills 配列・chapter 本文等のロジックは現状維持）
- Wiki md への書き込み禁止
- `src/game/data/companion_lines.json` / `secretary_lines.json` / `facilities.json` への書き込み禁止
- sync_spec.md / README.md / json_schema_inventory.md への変更禁止
- 過剰な抽象化禁止（既存の補完関数に必要なフィールドを追加するだけ、新規ヘルパー関数の濫造禁止）

## 引き継ぎ報告

完了後、以下を全文報告:
1. `npm run wiki:build` の標準出力・標準エラー出力
2. `npm run wiki:test` の vitest 結果（合計ケース数、PASS/FAIL）
3. §検証コマンド例 の jq 出力結果（108 / 108 / 92 / 92 / 15 / 15 が期待値）
4. `wc -l src/game/data/characters.json` / `wc -l src/game/data/bases.json` の行数（補完追加で行数増加が確認できる）

Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
