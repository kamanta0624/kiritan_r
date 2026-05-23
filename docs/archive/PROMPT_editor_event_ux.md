# PROMPT_editor_event_ux — イベントエディタ UX 大改修

> 作成: 2026-05-23（ClaudeDesign → ClaudeCode 引き継ぎ）
> 対象: `tools/editor-modules/tab-events.js` のみ。ゲーム側（src/）は一切触らない。
> 完了後: `docs/archive/` へ移動

---

## 背景・問題点

シナリオ担当からの苦情を受け、イベントエディタのUX全面改修を行う。
現状の問題は以下の5点。

1. **イベント一覧が単純リストで分類なし** — 量が増えるとスクロールが必要で探せない
2. **フラグ直接テキスト入力** — ミスが起きやすく検索もできない
3. **キャラプルダウンが全キャラ表示** — 勢力絞り込みがなく重い
4. **会話編集ウィンドウが右ペイン300px固定** — 狭すぎて編集しにくい
5. **フラグ・条件で繋がる連続イベントの可視化がない** — 依存関係が把握できない

---

## 実装タスク一覧

### Task 1: イベント一覧のタグ/チャプターフィルタリング

**要件**
- `_index.json` の `chapter` フィールド（system / ch01_tohoku / ch02_saitama / defeated / placeholder）でグループ分け表示
- さらにtrigger種別でフィルタリング可能なセレクトボックスを追加
  - 全タイミング / ゲーム開始 / 自軍ターン / 敵軍ターン / 拠点攻撃時 / 拠点防衛時 / etc.
- 各イベントリストアイテムに現在ある `[type]` バッジに加え、triggerのアイコン/バッジを追加
- アコーディオン形式でchapterをグループ化（デフォルト展開）
- フィルタ状態を維持したまま選択・編集できること

**実装ポイント**
- `_buildList()` を全面書き直し
- `_index.json` の chapter 情報はロード時に `_events` に `_chapter` として付与する（保存には含めない）
- `/api/events` レスポンスに chapter 情報がない場合は id のプレフィックスから推定（`ev_turn` → system, `ev_saitama` → ch02_saitama など）

---

### Task 2: フラグ独立管理 + 入力補完

**要件**
- フラグを独立管理する「フラグ管理パネル」をエディタ上部に追加（折り畳み可能）
- 全イベントのconditions・effects・choices から `flag` フィールドを自動収集してフラグ一覧を生成
- フラグ入力箇所（`setFlag` / `clearFlag` / `setFlagWithTurn` / condition の `flag` / `noFlag`）をすべて `<datalist>` + `<input>` に変更
  - `<select>` ではなく `<input list="flag-list">` 形式で既存フラグ補完 + 新規入力も可能に
- フラグ一覧パネルには各フラグの「使用箇所」（イベントID一覧）を表示

**実装ポイント**
- `_collectAllFlags()` 関数を追加。`_events` 全体を走査して `Set<string>` を返す
- `<datalist id="flag-list">` をDOMに1個だけ生成し、フラグ変更時に更新
- フラグ管理パネルはトグルボタンで表示/非表示

---

### Task 3: キャラプルダウンの勢力絞り込み

**要件**
- キャラ選択セレクトボックスに「勢力フィルタ」を追加
- 勢力選択（全勢力 / 勢力A / 勢力B...）で表示キャラを絞り込み
- `characters.json` の `factionId` フィールドを使って所属勢力で分類
- セレクト内にoptgroup形式で勢力別グループ表示する選択肢も検討

**対象箇所**
- `_charSelect()` 関数
- `_charSelectRaw()` 関数
- `_buildConvPane()` 内のキャラセレクト
- `_buildEffectParams()` 内の charJoin / charLeave / charParam / charUsedThisTurn

**実装ポイント**
- `_data.factions.factions` から勢力一覧取得
- `_data.characters.characters` に `factionId` がある前提
- optgroup方式で一本化。`_charSelectWithGroup(obj, key, allowNone=true)` として共通化

---

### Task 4: 会話編集エリアの拡張

**要件**
- 右ペインの幅を `300px` → `420px` に拡大（`grid-template-columns: 260px 1fr 420px`）
- 各会話行のtextareaの `rows` を `2` → `3` に変更
- 右ペイン全体にmin-widthを設定してリサイズ時に潰れないようにする
- 中央・右ペインが狭い場合、タブレット対応として縦積みレイアウトに切り替えるメディアクエリ検討（任意）

**実装ポイント**
- `_render()` の grid-template-columns 変更
- `_buildConvPane()` 内の textarea rows 変更

---

### Task 5: フラグ連鎖イベント ノードグラフ表示

**要件**
- 新タブまたはモーダルで「イベント依存関係グラフ」を表示する機能を追加
- 各イベントをノードとし、以下の関係をエッジで表示:
  - `condition.type === 'flag'` で `flag: X` を要求するイベントA と、`effect.type === 'setFlag'` で `flag: X` を設定するイベントB を `B → A` でエッジ接続
  - `condition.type === 'noFlag'` も同様にエッジ表示（破線 or 赤エッジ）
  - `condition.type === 'baseConquered'` / `effect.type === 'baseTransfer'` も接続
- ノードはクリックでそのイベントを選択状態にしてメインエディタに戻る

**UI**
- 左ペイン上部に「グラフ表示」ボタンを追加
- クリックでグラフオーバーレイ（position:fixed, 全画面）を表示
- グラフはSVGで描画。外部ライブラリ不使用（簡易力学シミュレーション or 階層レイアウト）
- ノードには `ev.name` と `trigger` ラベル表示
- フラグ名でフィルタリングして部分グラフ表示できるフィルタ入力を追加

**実装ポイント**
- `_buildDependencyGraph()` 関数を追加
- エッジデータ構造: `{ from: evId, to: evId, flag: flagName, type: 'requires'|'blocks' }`
- 描画は `<svg>` + `<foreignObject>` or 純SVGで実装
- 階層レイアウト: triggerタイプでY座標をグループ化し、X座標は接続数で調整する簡易実装で可
- 完璧な力学シミュレーションは不要。視認性優先

---

## 実装順序

1. Task 4（会話エリア拡大）— 最小コスト、即効果
2. Task 1（フィルタリング）— 一覧管理の根本改善
3. Task 2（フラグ補完）— ミス防止
4. Task 3（キャラ絞り込み）— 操作性改善
5. Task 5（グラフ表示）— 最もコストが高い。1〜4完了後に着手

---

## 制約

- **ゲーム側（src/）は一切変更しない**
- `tools/editor-modules/tab-events.js` のみ編集
- `tools/editor.cjs` のAPIエンドポイントを追加が必要な場合は `editor.cjs` も編集可
- デザイントークンは `editor.css` の CSS変数（`--color-*`）を使うこと。色の直書き禁止
- 外部ライブラリ（npm install 等）は使用禁止。純粋なブラウザJS/SVGで実装

---

## データ構造参考

### _index.json エントリ
```json
{ "id": "ev_saitama_chain_1", "path": "ch02_saitama/ev_saitama_chain_1.json", "chapter": "ch02_saitama" }
```

### イベントJSON（個別ファイル）
```json
{
  "id": "ev_saitama_chain_1",
  "name": "埼玉連続イベント１",
  "trigger": "before_faction_turn",
  "conditions": [
    { "type": "flag", "flag": "flag_mito_conquest_done" },
    { "type": "noFlag", "flag": "flag_saitama_chain1_done" }
  ],
  "probability": 1, "priority": 900, "maxOccurrences": 1,
  "script": [ { "type": "conversation", "lines": [...] }, { "type": "end" } ],
  "effects": { "default": [ { "type": "setFlag", "flag": "flag_saitama_chain1_done" } ] }
}
```

### `/api/events` レスポンス（editor.cjs が返す）
```json
{ "events": [ ...全イベントの配列... ] }
```
現状はフラットな配列。chapter情報は含まれていない可能性があるため、`_index.json` を `/api/events-index` で別途取得するか、`/api/events` レスポンスに `_chapter` を付与するようeditor.cjsを修正すること。

---

## 完了条件

- [ ] Task 1: チャプター別アコーディオン + triggerフィルタが動作する
- [ ] Task 2: フラグ入力が全箇所でdatalist補完になっている
- [ ] Task 3: キャラセレクトがoptgroup勢力別表示になっている
- [ ] Task 4: 右ペイン420px、textarea rows=3
- [ ] Task 5: グラフオーバーレイが表示され、フラグエッジが正しく表示される
- [ ] ゲーム側ファイル（src/）に変更なし
- [ ] 保存・ロード動作が壊れていない
