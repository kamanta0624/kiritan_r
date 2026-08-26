# PROMPT_01_font_setup

## 環境・共通ルール

- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`
- Node v22必須: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`
- devサーバ: `npm run dev` → localhost:5173。5173のみ使用、5174以降が立ったらkill（確認: `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN`）
- 問題原因の特定は必ずコードを根拠にすること。推論での断定禁止
- ブラウザキャッシュ／ハードリロードが解決策という結論に至った場合、そこまでの調査結果をまとめて停止・報告
- 不明点は勝手に判断せず、停止して質問
- QAの1次担当は人間。ブラウザ目視確認は完了条件に含めず、人間QAへ引き継ぐ
- 完了後、本ファイルを `docs/archive/` へ移動

## 目的

既存コードが指定している `'Noto Sans JP'` 等の font-family を実際にブラウザへ読み込ませる。現状は index.html にフォント読み込みが一切なく、システムフォールバックで表示されている。

## 検証済みの事実（2026-07-24）

- `index.html`: `<head>` 内にフォント関連の `<link>`・`@font-face`・`@import` なし
- `src/` 配下で使用中の書体（`grep -rn "fontFamily" src/` で確認済み）: `'Noto Sans JP'`、`'Zen Maru Gothic'`、`'Rajdhani'`（他は monospace / inherit のみ）
- 使用箇所例: `src/scenes/ADVScene.jsx`、`src/scenes/TitleScene.jsx`、`src/scenes/DungeonScene.jsx` ほか

## 対象ファイル

- `index.html` のみ

## 作業内容

1. `grep -rn "fontFamily\|font-family" src/` で使用書体と fontWeight の組を洗い出し、必要weightを確定する（上記3書体以外が出たら追加。fontWeightは実際に使われている値のみ）
2. `index.html` の `<head>` に Google Fonts 読み込みタグを追加する。形式:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=...&display=swap" rel="stylesheet">
```

weight指定は手順1の結果に合わせること（例示の 400;500;700;900 をそのまま使わない）。

## 成功基準（Codeが自力で確認、満たすまでループ)

1. `index.html` の `<link>` が、手順1で確定した全書体・全weightを網羅している（洗い出し結果と読み込みURLの対応表を報告に含める）
2. `git diff --stat` の変更が `index.html` のみ
3. `npm run dev` が起動し、コンソールにフォント関連エラーが出ない

## 人間QAへの引き継ぎ事項（Codeは実施しない）

- theater/ADVシーン表示中、DevToolsのフォント確認で Noto Sans JP / Zen Maru Gothic / Rajdhani が実際に適用されていること

## 禁止事項

- `index.html` 以外の変更禁止
- フォント読み込み以外のCSS・スタイル変更禁止
- npmパッケージ追加禁止（フォントはCDN読み込みのみ）
