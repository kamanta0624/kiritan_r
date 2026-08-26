# PROMPT_02b_voice_pregen

## 環境・共通ルール

- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`
- Node v22必須: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`
- devサーバ: `npm run dev` → localhost:5173（5173のみ、5174以降はkill）
- エディタ: `npm run editor`（= `node tools/editor.cjs`）→ localhost:3001
- 問題原因の特定は必ずコードを根拠にすること。推論での断定禁止
- ブラウザキャッシュ／ハードリロードが解決策という結論に至った場合、そこまでの調査結果をまとめて停止・報告
- 不明点は勝手に判断せず、停止して質問
- QAの1次担当は人間。ブラウザ目視・聴感確認は完了条件に含めず、人間QAへ引き継ぐ
- 問題を解く最小限のコードのみ。投機的実装・不要な抽象化禁止
- 完了後、本ファイルを `docs/archive/` へ移動

## 目的（要件変更）

PROMPT_02の実装はゲーム実行時にVOICEVOX Engineへ合成リクエストする方式だった。これを**事前生成方式**に置き換える。

- 音声wavは**エディタでの制作時に生成**し、`public/` 配下にファイルとして保持する
- **ゲーム実行時はwavファイルを再生するだけ**。ゲームからVOICEVOX Engineへの通信を完全に排除する
- Engine起動が必要なのは制作時（エディタでの生成操作時）のみ

## 検証済みの事実（2026-07-24、現状 = PROMPT_02完了直後）

- `src/game/systems/VoicevoxClient.js`: `synthesize`（audio_query→synthesis、失敗時null）と `fetchSpeakers`。ゲーム側から参照中
- `src/scenes/ADVScene.jsx`:
  - L5: `import { synthesize } from '../game/systems/VoicevoxClient.js'`
  - L604/612/616/623: buildScenarioでの `voice` 透過（**維持**）
  - L755-787: prefetchキャッシュ（`voiceCacheRef`）+ idx変化時再生のuseEffect（**置き換え対象**）
- `tools/editor-modules/tab-events.js`:
  - L104 `_speakers` / L117 `_loadSpeakers`（ブラウザから直接 `http://localhost:50021/speakers`）/ L1463 `_voiceSelect`
  - L657/663（text・narration）、L874（conversation行）に話者選択欄。保存で `voice.speakerId` がJSONに書かれる（動作確認済み）
- `tools/editor.cjs`（全469行、素のNode http）:
  - L94-95: `url.parse` によるルーティング。`/api/save/events`（L328-）がイベントJSON保存の実例
  - L73: `writeFileSync` + `JSON.stringify(data, null, 2)` の保存ヘルパー
  - L160-171: `_index.json` → 各イベントJSONのロード実例（`DATA` 配下 `events/`）
- voice付きデモイベント: `src/game/data/events/theater/ev_theater_voice_demo.json`（narration=3, conversation行=8/3）
- Node v22はグローバルfetch使用可（editor.cjsからEngineを直接叩ける）

## 作業内容

### 1. エディタサーバに音声生成エンドポイント追加（`tools/editor.cjs`）

`POST /api/voice/generate`（body: `{ eventId }`）を追加。処理:

1. `_index.json` から該当イベントJSONをロード
2. `script` を走査し、`voice.speakerId` を持つ全ステップ（narration/text/conversation.lines[]）を script 順に列挙
3. `public/audio/voice/<eventId>/` を**作り直し**（既存削除→再作成。孤児wav防止）
4. 各ステップをEngineで合成（audio_query→synthesis、既定 localhost:50021）し `<連番3桁>.wav` で書き出し
5. 各ステップの `voice` に `file: "/audio/voice/<eventId>/<連番>.wav"` を書き込み、イベントJSONを保存（L73ヘルパーの流儀）
6. 結果 `{ generated: n, failed: [...] }` を返す。Engine未起動・合成失敗時はJSONを変更せず、エラー内容を返す（500等）

### 2. エディタUIに生成ボタン追加（`tools/editor-modules/tab-events.js`）

イベント編集画面の保存ボタン付近に「音声一括生成」ボタンを追加。押下で上記エンドポイントを呼び、結果（生成数/失敗）を表示。失敗時もエディタが壊れないこと。既存フィールド・レイアウトの変更禁止（追加のみ）。

### 3. ゲーム側を再生専用化（`src/scenes/ADVScene.jsx`）

- L5のimportと、L755-787のprefetch/合成コードを**削除**
- 置き換え: idx変化時、現在ステップに `voice.file` があれば `new Audio(voice.file)` で再生。次ステップへ進んだら前の再生を停止。`voice.file` なし（speakerIdのみ含む）は無音
- buildScenarioの `voice` 透過（L604/612/616/623）は維持
- `advance` / `finish` / choice分岐 / backlog のロジック変更禁止

### 4. Engineクライアントの整理

- `src/game/systems/VoicevoxClient.js` を**削除**（合成ロジックはeditor.cjs内へ。src/配下にEngine通信コードを残さない）
- エディタの話者一覧取得（tab-events.js L117の直接fetch）は現行維持でよい

### 5. デモデータ更新

`ev_theater_voice_demo.json` に対して生成を実行し、`voice.file` 付きJSONと `public/audio/voice/` 配下のwavを成果物として含める。

## 運用ルール（報告に明記）

テキスト・話者を変更したら「音声一括生成」を再実行する（自動追従はしない。スコープ外）。

## 成功基準（Codeが自力で確認、満たすまでループ）

1. Engine起動状態で `/api/voice/generate` 実行 → `public/audio/voice/ev_theater_voice_demo相当のeventId/` にwavが生成され（サイズ>0）、イベントJSONの全voiceステップに `voice.file` が書き込まれる
2. `grep -rn "50021\|VoicevoxClient" src/` が**0件**（ゲームからEngine依存が消滅）
3. Engine**停止**状態で `npm run dev` 起動・コンソールエラーなし。voice付きイベントのコードパスが `voice.file` のAudio再生のみで完結している
4. Engine停止状態で生成ボタン押下 → エディタが壊れずエラー表示、JSON無変更
5. `git diff` の変更範囲が「editor.cjs + tab-events.js + ADVScene.jsx + VoicevoxClient.js削除 + デモイベントJSON + 生成wav」のみ
6. voiceなし既存イベントJSONが無変更（後方互換）

## 人間QAへの引き継ぎ事項（Codeは実施しない）

- **Engine停止状態で**theater→ADV再生し、音声が聞こえること（事前生成方式の本質確認）
- クリック直後に遅延なく再生されること
- クリック連打・skip時に音声が重ならないこと
- エディタで話者変更→再生成→声が変わること

## 禁止事項

- ADVScene.jsx のクリック進行・choice分岐・backlog等、既存ロジックの変更禁止
- npmパッケージ追加禁止。wav→mp3等の変換禁止（ffmpeg等の外部依存を増やさない。将来課題）
- ゲーム側での合成・キャッシュ・プリロード実装禁止（ブラウザのAudioに任せる）
- characterId→話者の自動対応付け・音声の自動再生成など、指示外の機能追加禁止
