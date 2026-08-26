# 00_INVESTIGATION_FINDINGS

デモ（ボイロ劇場最小実装）着手前の実コード調査結果。2026-07-24 実ファイル読了に基づく（推測なし）。同日Chat側で再検証済み。

## 既存で使える資産（ゼロから作らない）

- **対話エンジン**: `src/scenes/ADVScene.jsx`（全930行）に実装済み。クリック進行・タイプライター・choice分岐・backlog・auto/skip、全て動作する状態で存在。
- **シナリオ形式**: `script`（type: narration/text/conversation/choice/cutin/end）+ `effects.default` + `onExit` 契約。実例 `src/game/data/events/theater/ev_theater_sample.json`（id: theater_sample_001, trigger: theater）。
- **シーンエディタ**: `tools/editor-modules/tab-events.js`（全1446行）にスクリプト編集UI実装済み【確認済】。`SCRIPT_STEP_TYPES`（L75-81: text/narration/choice/conversation/end）、ステップカード生成 `_buildScript`（L583-）、conversation一括編集（L789-）。音声・話者関連フィールドは全行grepで不在確認済み。
- **キャラ立ち絵**: `public/characters/portraits/char_NNN.png` 62枚（旧記載58枚は誤り）。`getPortrait()`（ADVScene.jsx L68）で解決、`StandingChar`（L73）で表示。
- **エディタ基盤**: `tools/editor.cjs` は素のNode `http` サーバ（Express等なし）、独自multipartパーサ。フロントは `tools/editor-modules/*.js` のバニラJS。

## 不足・要追加

1. **フォント未導入**: `index.html` にフォント読み込み一切なし【確認済】。使用中書体は `'Noto Sans JP'`・`'Zen Maru Gothic'`・`'Rajdhani'`（+monospace/inherit）。現状システムフォールバック表示。
2. **音声再生の仕組みが皆無**: `package.json` に音声ライブラリなし。`public/` に音声ファイルなし。`Audio` 再生コードなし。VOICEVOX連携はゼロから追加。
3. **動く立ち絵未対応**: `getPortrait(charKey)`（L68）は charKey のみで解決、表情差分未実装。L8のコメント「portrait_<id>_<expr>.png を読む」は実装と乖離【確認済】。PSDパーツ合成・自動まばたきは完全新規。
4. **kiritan_assets の所在**: リポジトリ内に不在。ホスト側の所在は未確認（PROMPT_03で確認）。

## 結論：デモの実装方針

Theaterイベント（`ev_theater_sample.json` 相当）を1本実データとして作成し、**既存の `ADVScene`+`TheaterScene` 経路（KNOWLEDGE.md §「TheaterScene（Phase 5）」）でそのまま再生できることを土台にする**。新規実装は以下3点に限定。

1. フォント読み込み追加（`PROMPT_01_font_setup.md`）
2. VOICEVOX音声再生の組み込み + エディタでの話者設定（`PROMPT_02_voicevox_audio.md`）
3. StandingCharのPSDパーツ描画化・自動まばたき（`PROMPT_03_psd_character_investigation.md`、調査のみ。実装は結果を見て別途）

## 実行順序

01 → 02 → 03（investigation）→ 03の結果を受けて実装プロンプトを別途作成。01・02・03は相互依存なし、並行着手可。
