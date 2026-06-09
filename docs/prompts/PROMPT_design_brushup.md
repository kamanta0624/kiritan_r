# PROMPT_design_brushup — UIブラッシュアップ（ClaudeDesign宛）

> 渡すファイル一式: `docs/prompts/design_brushup_src/`
> 受領後、本ファイルと同フォルダを ClaudeDesign に渡す。

## 0. 役割

ClaudeDesign は **見た目（JSX/style）のブラッシュアップのみ**。ロジック接続は範囲外。
納品物はレビュー後にマージ。ロジック品質は期待しない＝ロジックに触るな。

## 1. 厳守（変更禁止）

- import / hooks（useGame等）/ props / イベントハンドラ / データアクセス式（`char.xxx`/`g.actions.xxx`等）を**一切変えない**。参照キー名・呼び出し順・条件分岐を保持。
- 画面に出る**ドメイン文言（用語・ラベル・数値の意味）を変えない**。表記ゆれ修正含め勝手に書き換えない。判断はディレクターに差し戻し。
- `tokens.js` / `SharedUI.jsx` は**参照専用。編集禁止**。
- 対象外シーンに触れない（§3）。

## 2. 必須ルール（コーディング規約）

- 色・余白等のデザイン値は `src/shared/tokens.js` から import（`PK,PK2,AC,AC2,TEAL,TX,TXD,TXF,BR,glass`）。**色の直書き禁止**。新色が要るなら追加せずディレクターへ提案。
- スクロール禁止: `overflow-y: auto/scroll` を**使うな**。`max-height`＋直接オーバーフロー、またはレイアウト再構成で収める。
- フォントは既存踏襲（`'Noto Sans JP'` 本文 / `'Rajdhani'` 数値）。
- レイアウト枠は既存踏襲: 上下バー各 52px・`position:absolute`・グラスUI（`glass()`）。
- `tokens.js` の `CHARS / GAME_STATE / ROLES` はPhaser期のレガシーモック。**デザイン根拠に使うな**（本番は GameContext 実データ）。design値は token定数のみ参照。

## 3. 対象 / 対象外

**対象（14シーン）**: Title, Map, BaseMenu, Formation, Battle, EnemyTurn, Party, Items, Research, Save, GameEnd, ADV, Theater, Dungeon

**参照専用（編集禁止）**: tokens.js, SharedUI.jsx（TopBar/BottomBar/NavButton）

**対象外（渡さない・触らない）**:
- NewGamePlusScene — ロジック未接続・ダミーデータ。ブラッシュアップ時期尚早
- QAシーン（BattleQAScene / BattleFullQAScene / WorldMapQAScene）— 内部ツール

## 4. デザイン方針

既存のビジュアル言語（暖色グラスUI／PK-AC-TEAL基調／Noto Sans JP＋Rajdhani／明るい背景）を**踏襲して磨く**。新テーマ・新パレットへの刷新は不可。狙いは以下4点の統一:

1. **階層** — 主要アクション／情報／補助の視覚的優先度を明確化。CTAボタン様式を全シーンで統一。
2. **リズム** — 余白・角丸・区切り線の値を揃える。バラついた padding/gap を token基準の段階値に収束。
3. **状態フィードバック** — hover/active/disabled/選択中の表現を NavButton 系と整合。
4. **収まり** — §2スクロール禁止に従い、はみ出し箇所を `max-height`＋レイアウトで解消。

## 5. シーン別メモ（現状の役割・注意）

- **Title** — 入口。最小構成。
- **Map** — メインHUB。PartnerWidget（秘書立ち絵・防衛プロンプトモーダル）統合済。モーダル層と背景の階層整理。
- **BaseMenu** — 拠点メニュー。
- **Formation** — 出撃編成。全キャラ単一リスト・最大4体・選択順で前衛/後衛。選択中状態の表現重要。
- **Battle** — Design v4（V3.2）+ アニメoverlay。最大・最重要。overlay層を壊さない。SP/HPゲージ・交換アニメ表示の視認性。
- **EnemyTurn** — 敵ターンカットイン。
- **Party** — 勢力絞込・SP表示・全画面詳細・強化コマンド。立ち絵表示あり。情報密度高。
- **Items / Research / Save / GameEnd** — 一覧・キュー・スロット・結果。様式統一の主対象。
- **ADV** — 会話表示。`{script,effects,onExit}` 契約。台詞バブル・立ち絵・選択肢の体裁。`key={dialogId}` での再マウント前提を壊さない。
- **Theater** — Phase5。イベント候補一覧→選択。
- **Dungeon** — 5フェーズ探索。

## 6. 納品形式

- **1シーン1ファイル単位で返す**（レビュー容易・差分小）。一括投下不可。
- 各納品に「変更点サマリ（見た目のみ）」を3行以内で添付。ロジック非改変を明記。
- 不明・実装不能はディレクターへ差し戻し。自己判断でロジック/文言を変えない。
