# kiritan_r

React 19 + Vite による戦略ゲーム。各種仕様・残タスクは `KNOWLEDGE.md` を参照（唯一の参照ドキュメント）。

## 環境要件

- Node.js v22（必須）
- nvm 推奨

## セットアップ

```bash
nvm use 22
npm install
```

## 起動

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run dev
# → localhost:5173
```

`npm run dev` は素の `vite`（ポート指定なし）＝デフォルト 5173。

## QA

```
http://localhost:5173/?qa=battlefull
```

## エディタツール

```bash
npm run editor
# = node tools/editor.cjs → localhost:3001
```

## プロセス管理

5173 のみ起動。5174・5175以降は kill。

```bash
lsof -i :5173 -i :5174 -i :5175 | grep LISTEN
```

## ドキュメント

- `KNOWLEDGE.md` — テックリード引き継ぎ（仕様・実装状況・残タスク）。**作業前に必読**
- `docs/prompts/` — 作業中の Code 引き継ぎプロンプト
- `docs/archive/` — 完了済み・旧ドキュメント
