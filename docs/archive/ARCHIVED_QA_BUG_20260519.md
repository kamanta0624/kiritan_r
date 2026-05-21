# アーカイブ — 完了済みQA・バグ・差異記録
> 退避日: 2026-05-19

---

## 旧§8-2 実装済み差異（全解消）

| ID | 内容 | 状態 |
|----|------|------|
| E1〜E10 | エンジンコアループ（nextActor/即時executeAction/markActed等） | ✅ |
| F1・F2 | FormationScene選択ロジック | ✅ |
| U3 | 後衛近接のoptions制限 | ✅ |
| D1 | 「戦闘解決へ」ボタン廃止 | ✅ |
| D3 | FormationScene単一リスト化 | ✅ Code実装済み |
| D4 | charHP実データ接続 | ✅ |

---

## 旧§8-3 BResolveScene（廃止・削除完了）

旧バージョンに該当シーンなし。kiritan_rで独自追加されたが廃止確定。
V3.1でBResolveScene・BCurtain・RUnitBar および関連state/関数を全て削除済み。

---

## 旧§10 エンジン単体QA結果（全完了）

`http://localhost:5174/?qa=battlefull`

| ID | シナリオ | 結果 |
|----|---------|------|
| E01 | 近接2v2 normal | ✅ |
| E02 | ranged後衛攻撃確認 | ✅ |
| E03 | song後衛攻撃確認 | ✅ |
| E04 | 後衛近接はdeny | ✅ |
| E05 | 前衛限定ターゲット | ✅ |
| E06 | 前衛全滅後後衛target | ✅ |
| E07 | 5R制限 normal | ✅ |
| E08 | dungeon無制限 | ✅ |
| E09 | soldiers最小順 | ✅ |
| E10 | penaltyTurns書き戻し | ✅ |
| E11 | char書き戻し | ✅ |
| E12 | 作戦補正 | ✅ |
| E13 | duel 5R超え継続 | ✅ |
| E14 | duel 撤退deny | ✅ |
| E15 | strategyMult.winnerChar | ✅ |
| E16 | async executeAction 正常動作 | ✅ |
| E17 | _onExchangeResult 発火・animState更新 | Integration QAで確認 |
| E18 | 撤退フロー二重終了なし（M2） | Integration QAで確認 |

---

## 旧§11 解決済みバグ

| BUG | 内容 | 解決日 |
|-----|------|--------|
| BUG-001 | BottomBar研究ボタン重複・クリック不可 | 2026-05-14 |
| BUG-002 | MapSceneWrapper未使用デッドコード | 2026-05-14 |
| BUG-003 | MapScene NODES/EDGESハードコード | 2026-05-14 |
| BUG-004 | 戦闘2ラウンド終了バグ（stale closure） | 2026-05-14 |
| BUG-005 | ResearchScene BuildingSystem未接続 | 2026-05-14 |
| BUG-006 | 敵ターンLegionAI未接続 | 2026-05-14 |
| BUG-007 | GameEndScene実データ未接続 | 2026-05-14 |
| BUG-008 | BattleScene FALLBACK_ENEMIES残存 | 2026-05-14 |

---

## 旧§15 完了済みタスク

1. Design v4 レビュー・マージ判断 → 完了（V3.2 / 2026-05-18）
2. BResolveScene関連コード削除 → 完了（V3.1）
8. 決闘（duel）モードのUI対応 → 完了（Design v4マージ済み）
