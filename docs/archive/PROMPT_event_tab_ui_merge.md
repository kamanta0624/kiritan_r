# イベントタブUI v6 マージ作業

## 納品物
`/Users/kamatashintarou/MCP_Learning/design_event_tab_v1/`
- `editor.css` — イベントタブ専用 `.ev-*` クラス追記
- `editor-modules/tab-events.js` — v6: style.cssTextをCSSクラスに集約

## レビュー済み確認事項
- editor.css末尾に `/* events tab — v2 design refresh */` ブロックが追加
- tab-events.js: `_showGraph()` 内のグラフオーバーレイのみ `style.cssText` 残存（許容済み）
- 通常編集UIのスタイルはすべて `.ev-*` クラスに移行済み
- ロジック変更なし

## マージ手順

### 1. editor.css
```bash
diff ~/MCP_Learning/kiritan_r/tools/editor.css ~/MCP_Learning/design_event_tab_v1/editor.css
```
既存ファイルへの追記のみ（既存クラスの変更なし）を確認してから上書き:
```bash
cp ~/MCP_Learning/design_event_tab_v1/editor.css ~/MCP_Learning/kiritan_r/tools/editor.css
```

### 2. tab-events.js
```bash
diff ~/MCP_Learning/kiritan_r/tools/editor-modules/tab-events.js ~/MCP_Learning/design_event_tab_v1/editor-modules/tab-events.js
```
確認後:
```bash
cp ~/MCP_Learning/design_event_tab_v1/editor-modules/tab-events.js ~/MCP_Learning/kiritan_r/tools/editor-modules/tab-events.js
```

### 3. 動作確認
localhost:3001 → イベントタブで以下を確認:
- 左ペイン: チャプター別アコーディオン・各アイテムのtype/trigger/p/pri表示
- 中央ペイン: セクション区切り（青左ボーダー）・フィールドラベル170px
- 右ペイン: 会話一括入力ヘッダ・テーブル列幅
- 保存・グラフボタン動作

### 4. 完了後
- KNOWLEDGE.md の残タスクから「イベントタブUI改善」を完了済みに更新
- 本プロンプトを docs/archive/ へ移動
