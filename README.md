# kiritan_r

React 18 + Vite によるゲームプロジェクト。

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
# → localhost:5174
```

## QA

```
http://localhost:5174/?qa=battlefull
```

## エディタツール

```bash
node tools/editor.js
# → localhost:3001
```

## プロセス管理

5174 のみ起動。5173・5175以降は kill すること。

```bash
lsof -i :5173 -i :5174 -i :5175 | grep LISTEN
```
