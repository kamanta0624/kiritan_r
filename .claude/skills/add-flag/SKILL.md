---
name: add-flag
description: 新フラグを docs/flags.json に登録してから実装箇所に追加するワークフロー。新フラグの追加が必要なときは必ずこのスキルを使う。
---

1. docs/flags.json を読んで既存フラグ一覧と命名規則を確認する
2. 新フラグ名をスネークケース+カテゴリプレフィックスで決める
   - story_*, unlock_*, char_*, event_* 等 CLAUDE.md の規則に従う
3. docs/flags.json に新フラグを追記する（登録が先、実装は後）
4. ユーザーが指定した実装箇所（イベントJSON、GameContext等）にフラグ参照を追加する
5. docs/IMPL_INDEX.md の該当セクションに追記が必要なら更新する
