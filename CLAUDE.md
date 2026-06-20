## 必読ドキュメント（セッション開始時）
| ファイル | 役割 |
|---------|------|
| `docs/IMPL_INDEX.md` | 実装の場所一覧（どのファイルに何があるか） |
| `docs/flags.json` | フラグ台帳（新規フラグはここに登録してから実装） |
| `docs/KNOWLEDGE.md` | 設計思想・ゲームシステム仕様 |

## フラグ命名規則
- スネークケース + カテゴリプレフィックス
- 例: `story_kiritan_ch1_end`, `unlock_theater_tohoku`, `char_una_joined`
- 新フラグを追加するときは必ず `docs/flags.json` に登録してからJSONに書く

## コード修正の原則
- BattleEngineV3 の攻撃回数は `char.attackCount ?? 8`（ハードコードではなくデータ駆動）
- EventEngine の効果は `docs/IMPL_INDEX.md` の効果キー一覧を参照
- GameContext の action を増やすときは stateRef パターンを使う（非同期安全）
