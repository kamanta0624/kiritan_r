---
name: sync-impl-index
description: src/ の実装を走査して docs/IMPL_INDEX.md との差分を報告・補完する。シーン追加やreducer action追加後に使う。
---

1. src/App.jsx の renderScene switch を読んでシーン一覧を抽出する
2. src/context/GameContext.jsx の reducer action types を抽出する
3. src/game/systems/ 以下の主要エクスポートを確認する
4. docs/IMPL_INDEX.md と照合して未記載の項目を列挙してレポートする
5. ユーザー確認後、IMPL_INDEX.md を補完する
