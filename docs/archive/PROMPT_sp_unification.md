# PROMPT: ミームタイプ名削除 + 兵士/ミーム呼称のSP統一（実装）

## 目的
1. `soldierName` フィールド（エディタ「ミームタイプ名」）を全廃。デッドフィールド。
2. 兵士(SP)を指す表示ラベルの「ミーム」「兵士」を「SP」へ統一。通貨ミーム(treasury)は据置。

## soldierName = デッド確定（コード根拠）
- 全キャラ（characters.json 約60件）+ test_characters.json 7件が保持。
- 使用箇所: 編集（tab-characters.js:230,373,409）+ シリアライズ素通し（GameContext.jsx:621 / SaveSystem.js:103 / BuildingSystem.js:163 createMobInstance）のみ。
- 表示・ロジックでの読取り **ゼロ**（PartyScene/BattleScene/widget/戦闘エンジン 全不参照）。
→ フィールド + エディタ入力 + シリアライズ通過を全削除。

## SP統一の原則
「ミーム」は2系統。一括置換禁止。兵士→「SP」、通貨→「ミーム」据置で衝突解消。
フィールド名（soldiers / maxSoldiers / soldierAtk / soldierDef）は用語表通り**内部維持**。**表示ラベルのみ**改称。

## 改称サイト（SP系・表示ラベル 21件）

| ファイル:行 | 現ラベル | → | フィールド |
|---|---|---|---|
| tab-characters.js:227 | ミーム（兵士）section見出し | SP | — |
| tab-characters.js:231 | 初期ミーム数 | 初期SP | soldiers |
| tab-characters.js:238 | 最大ミーム数 | 最大SP | maxSoldiers |
| tab-characters.js:246 | ミーム攻撃力 | SP攻撃力 | soldierAtk |
| tab-characters.js:252 | ミーム防御力 | SP防御力 | soldierDef |
| ItemSystem.js:130-132 | 兵士攻撃力/防御力/最大兵士数 | SP攻撃力/SP防御力/最大SP | soldierAtk/Def/maxSoldiers |
| ItemsScene.jsx:16-18 | 兵士攻撃力/防御力/最大兵士数 | 同上 | 同上 |
| shared.js:134-135 | ミーム攻撃力/防御力 | SP攻撃力/SP防御力 | soldierAtk/Def |
| tab-items.js:56-58 | ミーム攻撃力/防御力/最大ミーム数 | SP攻撃力/SP防御力/最大SP | soldierAtk/Def/maxSoldiers |
| tab-events.js:51,52,57,58 | ミーム（兵士）数/上限/攻撃力/防御力 | SP数/SP上限/SP攻撃力/SP防御力 | soldiers/maxSoldiers/soldierAtk/Def |

## soldierName 削除サイト
- tab-characters.js:229 ラベル行 +:230 input 削除。:373 読取り削除。:409 新規テンプレ既定削除。
- GameContext.jsx:621 / SaveSystem.js:103 / BuildingSystem.js:163 の soldierName 行削除。
- characters.json / test_characters.json 全 soldierName 削除。

## 任意（非表示・コメント/プローズ。一貫性のためやるなら）
- コメント「兵士」: BattleScene.jsx:713,729,1296 / BattleEngineV3.js:445,446,502,505 / ColorTokens.js:43。
- フレーバー文「ミーム」: tokens.js:40（技説明「敵のミーム」）/ GameEndScene.jsx:21（エンディング「ミームは束」）。文意で判断。

## 触るな（通貨系・「ミーム」据置）
treasury 表示。SaveScene.jsx:137 / SharedUI.jsx:40,63（TopBar）/ PartyScene.jsx:328,374,408（強化コスト）/ ResearchScene.jsx:102,126,399 / shared.js:26,27（low/high_treasury）/ tab-factions.js:98（初期treasury）/ tab-items.js:31（価格）/ tab-events.js:29（treasury増減）。

## 禁止
- ブラウザキャッシュ/ハードリロードを解決策にしない。
- 推論で原因断定しない。コード根拠のみ。
- デザイントークンは tokens.js から import。色直書き禁止。
