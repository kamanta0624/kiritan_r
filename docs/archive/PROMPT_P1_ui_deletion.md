# PROMPT_P1_ui_deletion.md — P1 UI削除フェーズ

> 種別: Code 引き継ぎ（実装）
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md`
> 前提: 親仕様 §1 廃止/温存マトリクス、§2 メニュー構成、§8 P1 を読み込んでから着手
> QA: 人間が担当（本書に QA 手順を含めない）

---

## 0. 原則

- 内部温存原則: UI 経路のみ削除、データ構造・計算ロジック・JSON は残す
- Scene ファイル本体は削除しない（再有効化容易のため）
- ロジック側（戦闘エンジン / EventEngine / GameContext 内部 reducer）への変更禁止
- デザイントークンは `src/shared/tokens.js` から import、色の直書き禁止
- 指示範囲外のコード・コメントを変えない
- 不明点は勝手に判断せず Chat に確認

---

## 1. スコープ（成功基準）

P1 完了の必要十分条件は以下すべて。

### 1.1 NavButton 削除

- マップ BottomBar（`src/shared/SharedUI.jsx` の `BottomBar` 内 `isMap` ブロック）から `研究` / `アイテム` の NavButton 2行を削除
- `セーブ / 仲間 / 劇場 / ターン終了` は残す
- プロモーション / クラファン NavButton の追加は P2/P3 範囲、ここではやらない

### 1.2 TopBar 表示削除（D-3 該当）

- `src/shared/SharedUI.jsx` の `TopBar` 内、配列要素のうち `ミーム`（通貨表示）と `収入`（income 表示）の2項目を配列から削除
- `⚡（行動力）/ ターン / 拠点` は残す
- 該当配列はおおむね line 41〜45 周辺（`{label:'⚡', ...}` から始まるオブジェクト配列）。Code 側で実物を確認して該当2要素のみ削除すること

### 1.3 兵力 UI 削除

- `src/scenes/MapScene.jsx` の `NodePopup` 内、`['防御部隊', \`${fmtN(node.troops)} 兵\`, TXD],` の行を削除（おおむね line 264 周辺）
- 同ファイル line 415 周辺の `troops: b.soldiers ?? b.battleCapacity ?? 400,` の生成行も削除（D-1 確定）
- `src/scenes/BaseMenuScene.jsx` の `StatTile` のうち兵力相当の表示を削除（実物確認のうえ、兵力・soldiers・troops 等を表示しているタイルのみ）

### 1.4 強化コマンド UI 削除

- 仲間画面（`PartyScene.jsx` または `CharactersScene` 相当、実物確認）の強化コマンド `sp_refill` / `sp_max_up` の UI ボタン・関連表示を削除
- データ層 `upgradeUnlocks` / `purchasedUpgrades` は温存（reducer・state 構造を変えない）

### 1.5 アイテム効果の no-op 化

- イベント effect `itemGain` の処理を no-op 化（effect が呼ばれても state 変更を起こさない）
- 実装箇所: `src/game/systems/EventEngine.js` または effect ハンドラ実装箇所を実物確認
- effect 自体の参照削除は禁止（JSON 側の `itemGain` 記述は温存）

### 1.6 死にデータ削除

- `src/game/data/characters.json`: 全キャラから `battleCapacity` フィールド削除
- 着手前にプロジェクト全域で `battleCapacity` の grep を取り、`characters.json` 由来の参照箇所がゼロであることを確認
  - `bases.json` の `battleCapacity` は別物、対象外
  - `character.battleCapacity` / `char.battleCapacity` 等のアクセスパターンを検索

### 1.7 不変であること

- 戦闘発生フロー（隣接攻撃 / 防衛 / `?qa=battlefull`）動作
- セーブ / ロード動作
- ADV / 劇場 / ダンジョン動作
- アクションポイント・ターン・拠点数の表示・カウント
- ビルドエラー・型エラー・コンソールエラーなし

---

## 2. 範囲外（やらない）

- プロモーション / クラファン 画面実装（P2/P3）
- SP→ミーム呼称置換（P5）
- 「敵兵力」→「敵ミーム」置換（P5、`PartnerWidget.jsx` L132）
- 通貨 / income / troops 関連の reducer・state・計算ロジック削除（内部温存原則）
- Scene ファイル本体の削除
- BottomBar への新規 NavButton 追加
- KNOWLEDGE.md 更新（Chat が担当）

---

## 3. 着手前の事前報告

実装着手前に Chat に以下を報告:

1. `characters.battleCapacity` grep 結果（参照箇所一覧、ゼロでなければ着手保留）
2. 仲間画面の強化コマンド UI 実装ファイル名・行
3. `itemGain` effect ハンドラ実装ファイル名・行
4. `BaseMenuScene` の兵力 StatTile の行
5. `MapScene.jsx` の NodePopup 削除対象行（line 264 想定）と troops 生成行（line 415 想定）の実際の行番号

これら全部を1回のメッセージで報告。Chat 確認のうえ着手指示を出す。

---

## 4. 完了後の報告

実装後、各成功基準（§1.1〜§1.7）に対する達成状態を1項目ずつ列挙して報告。
QA は人間が担当するため、Code 側で QA は行わない。
