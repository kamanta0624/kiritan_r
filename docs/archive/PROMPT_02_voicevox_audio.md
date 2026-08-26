# PROMPT_02_voicevox_audio

## 環境・共通ルール

- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`
- Node v22必須: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`
- devサーバ: `npm run dev` → localhost:5173（5173のみ、5174以降はkill）
- エディタ: `npm run editor`（= `node tools/editor.cjs`）→ localhost:3001
- 問題原因の特定は必ずコードを根拠にすること。推論での断定禁止
- ブラウザキャッシュ／ハードリロードが解決策という結論に至った場合、そこまでの調査結果をまとめて停止・報告
- 不明点は勝手に判断せず、停止して質問
- QAの1次担当は人間。ブラウザ目視確認は完了条件に含めず、人間QAへ引き継ぐ
- 問題を解く最小限のコードのみ。投機的実装・不要な抽象化禁止
- 完了後、本ファイルを `docs/archive/` へ移動

## 目的

theater経由のADV再生時、VOICEVOX Engineでステップのテキストを音声合成して再生できるようにする。エディタから話者IDを設定できるようにする。

## 検証済みの事実（2026-07-24）

- 音声再生の仕組みは皆無: `package.json` に音声ライブラリなし、`public/` に音声ファイルなし、`Audio` 使用コードなし（新規実装）
- `src/scenes/ADVScene.jsx`（全930行）:
  - `buildScenario(script)` L591: script（type: narration/text/conversation/choice/cutin/end）を内部scenarioへ展開
  - 現在ステップの描画: L840付近で `isSpeaking` 算出、L865で `DialogBox` 描画。`DialogBox` 定義はL212
  - 進行ロジック: `finish` L730 / `advance` L759。**変更禁止対象**
- `tools/editor-modules/tab-events.js`（全1446行）:
  - `SCRIPT_STEP_TYPES` L75-81（text/narration/choice/conversation/end）、ステップカード生成 `_buildScript` L583-、conversation行の型は `{ characterId, position, text }`（L265）
  - 音声・話者関連フィールドは**全行grepで不在確認済み**。追加は新規
- theaterイベント実例: `src/game/data/events/theater/ev_theater_sample.json`（trigger: 'theater'）
- theater→ADVの起動経路: KNOWLEDGE.md §「TheaterScene（Phase 5）」参照

## 事前確認（着手前に必ず実施、不明なら停止して質問）

1. VOICEVOX Engineの起動状態とポート（既定50021）: `curl -s http://localhost:50021/version`。応答がなければ停止し、人間にEngine起動を依頼
2. `GET /speakers` のレスポンス形式を実際に取得して確認（話者名・style IDの構造）
3. localhost:5173（およびエディタ localhost:3001）からのブラウザfetchがCORSで通るか実測。**通らない場合のみ** Vite devプロキシ追加等を検討し、方針を報告してから実装（Engine側設定変更の指示は人間へ確認）

## 作業内容

### 1. VOICEVOXクライアント

`src/game/systems/` に新規モジュールを1つ追加。`POST /audio_query`（text, speaker）→ `POST /synthesis`（query結果, speaker）→ wav Blob 取得をラップする。fetchベース、npmライブラリ追加禁止。Engine未起動・失敗時は無音で通常再生を継続（throwでADVを止めない）。

### 2. スクリプトデータ拡張

`narration` / `text` の各ステップ、および `conversation.lines[]` の各行に、**任意**フィールド `voice: { speakerId: number }` を追加可能にする。既存必須フィールドの変更禁止。`voice` なしのステップは従来どおり無音再生（後方互換必須）。

### 3. ADVScene再生時の音声再生

現在ステップ（idx）変化時、該当ステップに `voice` があれば合成→`Audio`で再生。タイプライター表示とは独立でよい（同時開始のみ、同期は将来課題）。次ステップへ進んだら前の再生は停止。`advance` / `finish` / choice分岐 / backlog のロジック変更禁止。

### 4. エディタでの話者設定

`tab-events.js` のステップ編集UIに話者選択欄を追加（`GET /speakers` からセレクトボックス生成）。narration/textはステップ単位、conversationは行単位。「音声なし」を既定選択肢にする。Engine未起動時はエディタが壊れず、欄が無効化またはID直接入力になること。既存フィールド・レイアウトの変更禁止（追加のみ）。characterId→話者の自動対応付けは実装しない（スコープ外）。

## 成功基準（Codeが自力で確認、満たすまでループ）

1. Node/curlでクライアントモジュール相当の2段階呼び出しを実行し、wavバイト列（サイズ>0）が取得できる
2. `ev_theater_sample.json` 相当のデモイベントに `voice` を設定したデータが存在し、`voice` なしの既存イベントJSONは無変更で妥当（後方互換）
3. `npm run dev` 起動・コンソールエラーなし。VOICEVOX Engine停止状態でも theater→ADV 再生がエラーなく進行する（コードパス上で確認）
4. `git diff` の変更範囲が「新規クライアントモジュール + ADVScene.jsxの音声再生追加分 + tab-events.jsの話者欄追加分 + デモ用イベントJSON」のみ
5. tab-events.js: 話者選択欄で設定→保存でイベントJSONに `voice.speakerId` が書き込まれる（保存後のJSONを読んで確認）

## 人間QAへの引き継ぎ事項（Codeは実施しない）

- Engine起動状態で theater→ADV 再生時に実際に音声が聞こえること
- 話者を変えると声が変わること
- クリック連打・skip時に音声が重ならないこと

## 禁止事項

- ADVScene.jsx のクリック進行・choice分岐・backlog等、既存ロジックの変更禁止（音声再生の追加のみ)
- tab-events.js の既存フィールド・レイアウトの変更禁止（話者選択欄の追加のみ）
- VOICEVOX以外のTTS対応禁止（スコープ外）
- npmパッケージ追加禁止
- 色の直書き禁止（UI追加時は `src/shared/tokens.js` から import。エディタ側は既存tab-events.jsの流儀に合わせる）
