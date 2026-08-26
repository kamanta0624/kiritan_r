# PROMPT_03_psd_character_investigation

## 環境・共通ルール

- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`
- **調査のみ。コード変更・ライブラリインストール一切禁止**
- 事実は必ずファイルパス+行番号（外部リポジトリはURL+ファイルパス）で根拠を示す。推論・憶測禁止。不明は「不明」、存在しないものは「不在」と明記
- 不明点・アクセス不能は勝手に判断せず、その旨を報告に明記
- 完了後、本ファイルを `docs/archive/` へ移動

## 目的

`ADVScene.jsx` の `StandingChar`（現状: 静止画PNG1枚表示）をPSDパーツ合成による動く立ち絵（自動まばたき）へ置き換える前段階の調査。**実装は行わない。** 報告書を出力し、Chatが実装プロンプトを別途作成する。

## 決定事項（前提）

キャラクター描画基盤はPSDパーツ方式で確定済み。Rive等の外部専用エディタ依存方式は不採用。以下の既存資産の流用可否を調査する。ゼロから設計・実装しない。

## 検証済みの事実（2026-07-24、調査の起点）

- `getPortrait(charKey)`: `src/scenes/ADVScene.jsx` L68。`/characters/portraits/<charKey>.png` 固定解決。表情差分は未実装（L8のコメントは実装と乖離）
- `StandingChar`: 同ファイル L73-。`isSpeaking` による bottom/scale/filter/zIndex 変化、`pos`（left/center/right）配置
- `public/characters/portraits/`: `char_*.png` **62枚**（旧記載の58枚は誤り）

## 調査項目

1. **github.com/oov/psd**（Go, MIT）: PSD/PSBパーサー。WASM化して Vite/React フロントで利用可能か。Node v22.22.2 環境でのビルド可否（Goツールチェイン要否含む）
2. **github.com/oov/PSDTool**（TypeScript, MIT）: ブラウザ上PSD読み込み・パーツプレビューUI。コード流用・移植可能な部分の特定
3. **github.com/oov/aviutl_psdtoolkit**: 「動く立ち絵」（自動まばたき・口パク）のレイヤー命名規則・挙動仕様の参照元。ライセンス確認必須
4. **PFVファイル形式**（PSDToolFavorites-v1）: パーツ組み合わせ記述形式。デモのデータモデルにそのまま採用できるか（形式仕様の所在と概要を報告）
5. **`StandingChar` 現行実装の影響範囲**: PSDパーツ描画（canvas等）に置き換えた場合に影響する箇所を、参照元含めて洗い出す（`getPortrait` 呼び出し箇所全列挙）
6. **PSD実ファイルのレイヤー構造**: 所在確定済み `docs/assets/psd/`（`四国めたん.psd` 7.1MB / `彩澄しゅお縮小_800pix.psd` 2.0MB の2件のみ）。各ファイルのレイヤー名一覧・階層構造を抽出し、項目3の「動く立ち絵」命名規則（`!`・`*` プレフィックス、まばたき・口パク用レイヤー等）に適合しているかを判定する。抽出には依存追加なしの使い捨てNodeスクリプトを使ってよい（リポジトリに残さず実行後削除、git statusクリーン維持）。あわせて、立ち絵PNG62枚に対しPSDは2キャラ分のみである事実を報告に明記する

外部リポジトリはWeb取得で調査。取得できない場合は項目ごとに「アクセス不能」と明記（代替手段で無理に取得しない）。

## 禁止事項

- コード変更禁止
- ライブラリのインストール禁止
- データモデル・UI設計の提案禁止（事実報告のみ）

## 成功基準・報告形式

報告書を `docs/prompts/voiro_theater_demo/03_REPORT_psd_investigation.md` に出力。以下を満たすまで見直すこと。

1. 調査項目1〜6すべてに結論がある（結論は「可/不可/不明/不在/アクセス不能」のいずれか+根拠）
2. すべての事実にパス+行番号またはURLの根拠が付いている
3. ライセンス（項目1〜3）の記載がある
4. 推論・提案が混入していない
5. `git status` がクリーン（報告書以外の変更なし）
