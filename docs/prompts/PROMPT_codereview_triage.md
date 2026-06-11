# コードレビュー トリアージ（Code投入前・整理）

`docs/CODE_REVIEW.md` 全項目の優先順位整理。ターン1関連（BUG-04）は実装済みのため除外。
本文書は Code への実装プロンプトではない。プロンプト切り出しの判断材料（ロードマップ）。

---

## 0. 虚偽前提の検出（プロンプト化禁止）

### CLEANUP-11 / `PROMPT_delete_qa_scenes.md` は虚偽前提

- 主張: 「`?qa=battlefull`等のURLパラメータ分岐は存在しない。QAシーン3ファイルは死にimport」
- コード根拠: `src/App.jsx:233-242` に早期returnが実在。
  ```
  const qaParam = new URLSearchParams(window.location.search).get('qa');
  if (qaParam === 'battle')     return <BattleQAScene .../>;
  if (qaParam === 'battlefull') return <BattleFullQAScene .../>;
  if (qaParam === 'worldmap')   return <WorldMapQAScene .../>;
  ```
- 本番QA手順も `http://localhost:5173/?qa=battlefull`。QAシーンは生存コード
- 対応: QAシーン3ファイル削除禁止。`PROMPT_delete_qa_scenes.md` は docs/archive/ へ移動済み（2026-06-10）

---

## 1. 優先順位マトリクス

| 優先 | 区分 | 基準 |
|------|------|------|
| P1 | 機能破壊バグ | 機能が無効化・誤動作。即修正 |
| P2 | 実データ整合 | 実データにないフィールド参照・誤情報表示 |
| P3 | 死にコード・規約違反 | 参照ゼロ削除・トークン直書き。低リスク（怠惰） |
| P4 | 設計変更 | ディレクター判断・大型。プロンプト化前に方針決定要 |
| 調査 | 未確認 | 実装前にChatがコード確認すべき項目 |

### P1 機能破壊バグ

| ID | ファイル | 内容 |
|----|---------|------|
| BUG-01 | App | ロードキャンセルで`map`遷移・`game_start`未発火 |
| BUG-02 | SaveScene | ロード失敗でも成功トースト |
| BUG-03 | ADVScene | CHAR_ID_MAP未登録キャラの立ち絵・話者タグ欠落 |
| BUG-08 | TheaterScene | `story`カテゴリ未定義で劇場非表示 |
| BUG-05 | MapScene/BaseMenu | ダンジョン経路（DESIGN-05に依存） |

### P2 実データ整合

| ID | ファイル | 内容 |
|----|---------|------|
| BUG-06 | PartyScene | `joined`フィールド不在・`??true`誤フォールバック |
| BUG-07 | PartyScene | LeftPanel/CharDetailの非実在フィールド多数 |
| DESIGN-06 | MapScene/BaseMenu | `troops`不在・`battleCapacity`を「防御部隊X兵」誤表記 |
| NOTE-24 | FormationScene | `troops`参照（同根） |
| CLEANUP-04 | BaseMenu | `node.owner`/`ally`/`neutral`分岐がdead（常にundefined） |
| CLEANUP-05 | BaseMenu | `ownerLabel`「東北家」直書き |

### P3 死にコード・規約違反

| ID | ファイル | 内容 |
|----|---------|------|
| CLEANUP-08 | src/assets | Viteテンプレ残骸（hero/react/vite） |
| CLEANUP-09 | SaveSystem.js | 死にコード（未import） |
| CLEANUP-10 | ColorTokens.js | Phaser版残骸（未参照） |
| CLEANUP-01 | SaveScene/GameContext | location/leader廃止・DEMO_SLOTS・_dummy削除 |
| CLEANUP-02 | SharedUI | BottomBar「編成済みX人」モック表示削除 |
| CLEANUP-03 | BaseMenu | 「訪問」ボタン廃止（劇場集約済み） |
| CLEANUP-06 | ItemsScene | 売却ボタン廃止（ミーム加算なし未完成） |
| NOTE-07 | ADVScene | DEMOモック残骸・window露出 |
| LINT-01〜04 | TitleScene/SaveScene | 直書きカラー・未使用import/state・window汚染 |

### P4 設計変更（ディレクター判断要）

| ID | 内容 | 判断事項 |
|----|------|---------|
| DESIGN-12 | 敵ターンフロー勢力単位化 | 大型。EventEngine/JSON波及。トリガー追加要 |
| CLEANUP-07 | 必殺システム整理 | 用語再定義・効果のハードコード排除。別途設計 |
| MISSING-01 | 敵の野戦/籠城選択AI | LegionAI新メソッド。BUG-09と接続 |
| DESIGN-05 | NodePopup廃止・即BaseMenu遷移 | BUG-05と同時 |
| DESIGN-11 | PartnerWidget表示方針 | 案A/B/Cから選択 |
| DESIGN-07 | Legend廃止 | 単独可 |
| DESIGN-08 | MiniMap操作強化 | 仕様確定要 |
| DESIGN-09 | BOUNDARY_Xグロー廃止 | 背景画像差替と同時 |
| DESIGN-10 | 「タイトルへ戻る」追加 | 単独可 |
| BUG-03 | CHAR_ID_MAP | 手動追記 vs データ駆動化の選択 |

### 調査（実装前にChat確認）

NOTE-17（getTheaterEvents実装）, NOTE-21/22/23（ダンジョンpenalty/フラグ/敵構造）, NOTE-30（clearedCount）, NOTE-32（ngpFactionId処理）, NOTE-26（strategyRate確率）。

---

## 2. Code投入プロンプト単位（1プロンプト1責任）

同一ファイル・同根の指摘はまとめる（責任は単一テーマ）。異ファイル横断は分割。投入順は上から。

| # | プロンプト案 | 含む項目 | 範囲 | 責任 |
|---|------------|---------|------|------|
| 2 | PROMPT_load_flow_fix | BUG-01, BUG-02 | App/SaveScene | ロード経路の遷移先・成否トースト |
| 3 | PROMPT_party_realdata | BUG-06, BUG-07, NOTE-11 | PartyScene + skills prop | 実在フィールドのみ参照に統一 |
| 4 | PROMPT_troops_label | DESIGN-06, NOTE-24 | Map/BaseMenu/Formation | `troops`排除・「戦闘域」表記 |
| 5 | PROMPT_theater_story | BUG-08 | TheaterScene | `story`カテゴリ追加 |
| 6 | PROMPT_basemenu_owner | CLEANUP-04, CLEANUP-05 | BaseMenu | owner分岐をisOwnedに一本化・勢力名はfactionName |
| 7 | PROMPT_save_cleanup | CLEANUP-01, CLEANUP-02 | SaveScene/GameContext/SharedUI | location/leader/CHARS連鎖削除 |
| 8 | PROMPT_deadcode_purge | CLEANUP-08, CLEANUP-09, CLEANUP-10 | assets/SaveSystem/ColorTokens | 参照ゼロ確認後に一括削除 |
| 9 | PROMPT_lint_cleanup | LINT-01〜04, NOTE-07 | Title/Save/ADV | 直書き色・未使用import/state・window汚染 |

各プロンプト確定時に対象ファイルをコード確認し、行番号・除外範囲を明記してから切り出す。

---

判断待ち項目 → `PROMPT_director_decisions.md`
調査タスク → `PROMPT_investigation_queue.md`
