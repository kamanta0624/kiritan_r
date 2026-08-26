# PROMPT_P1_addendum.md — P1 追加スコープ（UI挙動変更）

> 種別: Code 引き継ぎ（実装）
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md`
> 前提プロンプト: `docs/prompts/PROMPT_P1_ui_deletion.md`（完了済み）
> QA: 人間が担当（本書に QA 手順を含めない）

---

## 0. 原則

- 内部温存原則: UI 経路のみ削除、データ構造・計算ロジック・JSON は残す
- ロジック側（戦闘エンジン / EventEngine / GameContext 内部 reducer）への変更禁止
- デザイントークンは `src/shared/tokens.js` から import、色の直書き禁止
- 指示範囲外のコード・コメントを変えない
- 不明点は勝手に判断せず Chat に確認

---

## 1. スコープ（成功基準）

### 1.1 TopBar breadcrumb 側ミーム表示削除

- `src/shared/SharedUI.jsx` の `TopBar` 内、`breadcrumb && (actionPoints != null || meme != null)` 分岐ブロック（おおむね line 56〜67）から `meme != null` の表示要素を削除
- `actionPoints` の表示は残す
- `meme` props そのものは TopBar の引数として残す（呼び出し側 PartyScene 等は変更しない）

### 1.2 BaseMenuScene 収入表示削除

- `src/scenes/BaseMenuScene.jsx` の `{/* Stats row */}` セクション（StatTile 収入を含む grid ブロック、おおむね line 81〜83）を完全削除
- StatTile が0個になるため grid コンテナごと削除
- `node.income` 参照箇所がなくなる
- `StatTile` 関数定義（line 127 周辺）は他で使われていないなら削除可。使われているなら温存。Code で参照箇所を確認のうえ判断

### 1.3 BaseMenuScene 訪問コマンド削除

- `src/scenes/BaseMenuScene.jsx` の commands 構築部分から `visit` 系コマンドの push 行を削除（おおむね line 23）
- `dest:'adv'` への遷移経路を断つ
- 攻撃 (`attack`) / 迷宮 (`dungeon`) コマンドは残す
- ADVScene 本体は削除しない（他経路から呼ばれるため）

### 1.4 NodePopup 挙動変更

- `src/scenes/MapScene.jsx` の `NodePopup` を以下の通り変更:
  - **表示タイミングをクリック時からホバー時に変更**（マウスオン/オフで開閉）
  - 「詳細を見る」ボタン削除
  - 「攻撃する」ボタン削除（`node.canAttack` 分岐ごと削除可）
  - 情報表示部分（収入 / 勢力 / 種別）は維持
- ノードのクリックイベントは `BaseMenuScene` を開く挙動に直結（従来の「NodePopup → 詳細を見るボタン」中継を撤廃）
- ホバー実装はクラス hover ベース or React state ベースを Code 裁量で選択
- クリック時 BaseMenuScene への遷移先は既存実装（`onNodeInfo` 等）を流用

### 1.5 BaseMenuScene 背景変更

- 現状 `background:'rgba(10,8,14,.72)'` + `backdropFilter:'blur(10px)'` のフルスクリーン暗背景を変更
- 以下のいずれかを **Code 裁量で選択**:
  - **案a**: ADVScene と同様の透過背景（マップが透けて見える）
  - **案b**: 暗背景を完全廃止し、マップそのまま + 画面中央に BaseMenuScene パネルをポップアップ表示
- 選択した方式を完了報告に明記

---

## 2. 範囲外（やらない）

- BaseMenuScene のコマンドレイアウト・ボタン形状・StatTile デザインの変更
- ADVScene 本体の削除（他から参照されるため温存）
- NodePopup の情報表示要素（収入/勢力/種別）の文字色・サイズ変更
- TopBar 配列内の表示要素（行動力/ターン/拠点）の変更
- MapScene のノード描画スタイル変更
- GameContext reducer・state 構造の変更
- KNOWLEDGE.md 更新（Chat が担当）

---

## 3. 着手前の事前報告

実装着手前に Chat に以下を報告:

1. `BaseMenuScene.jsx` の `StatTile` 関数の参照箇所（収入削除後に死にコード化するか確認）
2. `MapScene.jsx` の現状のノードクリックハンドラ実装（NodePopup を開いている箇所の特定）
3. ADVScene への遷移経路で `visit` コマンド以外の参照があるか（grep `'visit'` / `dest:'adv'`）
4. §1.5 で選択する案（a / b）と理由

これら全部を1回のメッセージで報告。Chat 確認のうえ着手指示を出す。

---

## 4. 完了後の報告

実装後、各成功基準（§1.1〜§1.5）に対する達成状態を1項目ずつ列挙して報告。
§1.5 は選択案（a / b）も明記。
QA は人間が担当するため、Code 側で QA は行わない。
