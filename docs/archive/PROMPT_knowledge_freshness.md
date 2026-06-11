# PROMPT_knowledge_freshness — KNOWLEDGE.md 鮮度修正

## 目的
KNOWLEDGE.md の実態乖離3点を修正。コードへの変更は一切なし。対象ファイルは `KNOWLEDGE.md` のみ。

## 背景（根拠）
- L53 が「docs/prompts/ 現在 空」と記載。実際は複数プロンプト存在。ディレクトリ内容のリアルタイム追跡は運用上不可能と判明 → 本ファイルでの内容言及自体を廃止する
- L94 PartyScene「実データ ✅」だが、トリアージP2の BUG-06（`joined` 不在・`??true` 誤フォールバック）/ BUG-07（非実在フィールド参照）が未解消。characters.json に portrait フィールドも未追加
- §6 テーブルの ✅ 基準が未定義で過大申告を誘発

## 編集1: L53（§3 ディレクトリ構成）

before:
```
  prompts/                ← 作業中のCode引き継ぎプロンプト（現在 空）
```
after:
```
  prompts/                ← 作業中のCode引き継ぎプロンプト（内容は本ファイルで追跡しない。ls で確認）
```

## 編集2: L94（§6 PartyScene 行）

before:
```
| characters | PartyScene.jsx | ✅ | ✅ | 勢力絞込・SP表示・全画面詳細・強化コマンド |
```
after:
```
| characters | PartyScene.jsx | ✅ | ⚠️ | 勢力絞込・SP表示・全画面詳細・強化コマンド。BUG-06/07（非実在フィールド参照）未解消・portrait未対応 |
```

## 編集3: L102（§6 テーブル直後「未実装: gallery / settings / credits。」の次行）

以下を追記:
```
凡例: ✅=接続・実データ整合済 / ⚠️=接続済だが実データ整合に未解消項目あり / ⬜=未接続 / 🔴=モックデータ。
```

## 編集4: L304-305（§14 docs 運用ルール のコードブロック内）

before:
```
docs/prompts/   ← 作業中のCode引き継ぎプロンプト（PROMPT_<名前>.md）
```
after:
```
docs/prompts/   ← 作業中のCode引き継ぎプロンプト（PROMPT_<名前>.md）。内容一覧は本ファイルに書かない
```

## スコープ除外（実施禁止）
- src/ 以下のコード変更
- §16 残タスクへのトリアージ項目統合（別プロンプト）
- docs/prompts/ 内の他ファイルの削除・移動
- 最終更新日行（L3）の日付を 2026-06-10 に更新するのは可。それ以外の行の変更は禁止

## 完了条件
- 上記4編集が KNOWLEDGE.md に反映されている
- diff が編集1〜4＋日付行のみであること
