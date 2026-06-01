# 戦闘システム 追い修正プロンプト v1（別チャット継続用・自己完結）

前段調査 `docs/prompts/PROMPT_battle_bugs_v3.md`、恒久仕様 `KNOWLEDGE.md §9-1 / §14-1 / §18` を必ず併読。本プロンプトは残作業のまとめ。

## 厳守事項（過去に繰り返した失敗）

- **撤退（retreat）＝戦闘即終了は仕様**（KNOWLEDGE §9-1「撤退仕様」）。`_doRetreat`→`_finish` を消す/個別離脱化する提案（旧A案系）は仕様違反。禁止。
- 原因に推論を使わない。必ずコード・データ・実機の根拠を示す。
- ブラウザキャッシュ/ハードリロードを解決策と結論づけたら、推論を除く調査結果をまとめて停止。
- Chat（設計担当）は中規模編集をせず、実装はこのプロンプト基準で行う。

## 修正完了済み（コードで確認済み）

- **BUG-A**: 撤退時SP半減（onRoundEnd の hardcode `applyRetreatRule('loss_50')`）→ 行削除済み。
- **BUG-C**: `normalizeChar` の atk 解決順 → `soldierAtk ?? charAttack ?? 10` 済み。**ただし副作用あり（下記 残2）**。
- **BUG-B**: `LegionAI.getDefenders`（L130-153）の全勢力員フォールバック廃止→reserve参照に置換済み。legions.json に勢力別 `isDefenseReserve:true` の防衛モブ軍団7件追加済み。実機で郡山がmob防衛・つるぎ消滅を確認。
- **BUG-D**: overlay に `key={animState._seq}`（L1416）＋ onExchangeResult で `_seq:++animSeqRef.current`（L1280）。staleness解消。

---

## 残タスク（優先順）

### 残1【最優先】戦闘AIの撤退濫択を是正（B案・撤退終了挙動は維持）

**症状**: 敵が交戦せず即撤退→戦闘即終了で即勝利。

**原因（コード根拠）**:
1. 軍団 `retreatRule`（char_dead 等）が戦闘エンジンに**未結線**。`BattleEngineV3.applyRetreatRule(rule, side)` は実装存在するが BattleScene からの呼び出し0件（BUG-Aで唯一の呼び出しを削除して以降オーファン）。enemyUnits（BattleScene.jsx L1221-1231）も retreatRule を保持していない。
2. `BattleAI.selectAction`（BattleAI.js）は rear-melee に options=['defend','retreat']（攻撃肢なし）を与え→ランダムで 'retreat' を選ぶ。`selectAction`/`selectTarget` は V3 で「ランダム固定」。
3. 結果、敵 rear ユニットがルール無視でランダム撤退 →（仕様通り）`_doRetreat`→`_finish` で戦闘終了 → 交戦ゼロで勝利。

**修正方針**:
- 各 enemyUnit に所属軍団の `retreatRule` を渡す（enemyChars 構築元＝App.jsx / getDefenders 経路で legion を辿る）。
- AI が 'retreat' を選べる条件を retreatRule に従わせる。例: `char_dead` なら味方側に charHp<=0 のユニットが出るまで 'retreat' を options から除外。`never` なら常に除外。`loss_50`/`loss_25`/`hp_any` も同様にゲート。
- `_doRetreat`→`_finish` の終了挙動は**変更しない**（仕様）。プレイヤーの「撤退」ボタン（handleRetreatConfirm）も現状維持。
- 注意: rear-melee は攻撃肢が無いため、retreat を除外すると options=['defend'] のみになる。これは許容（防御継続）。
- 検証: char_dead の敵軍が、味方将軍が倒れるまで撤退しないこと。会津/郡山戦で即勝利が消えること。

### 残2 BUG-C の副作用（敵将軍攻撃力が誤り）

`normalizeChar` は atk を単一フィールド化（soldierAtk優先）。enemyUnits（L1223）が `charAttack: e.atk, soldierAtk: e.atk` と**両方に soldierAtk** を入れるため、敵の将軍本体攻撃力(charAttack)が soldierAtk に化ける（つるぎ: 本来 charAttack=21 が 8 に）。`_charParams` の将軍本人攻撃がこの値を使い過小。

**修正**: `normalizeChar` が soldierAtk と charAttack を別フィールドで保持し、enemyUnits で `charAttack`/`soldierAtk` を個別マップ。

### 残3 ハードコーディング解消（QA指摘・敵HP全部10の原因）

- enemyUnits（BattleScene.jsx L1221-1231）の `charHp:10`/`charMaxHp:10`/`attackCount:8` 固定 → normalizeChar が持つ実値（`e.hp`/`e.hpMax`、つるぎ実HP=9）を反映。**敵HPが全て10になる直接原因**。reserve mob も実HP無視で10表示。
- `BattleScene.jsx` L8-13 の色トークン（PK/AC/TEAL/TX 等）ファイル内再定義 → `src/shared/tokens.js` から import（§15「直書き禁止」違反）。
- `BattleEngineV3.js` マジック定数（`?? 70`/`?? 20`/倍率 `*8`・`0.7`・`0.8` 等）の名前付き集約。挙動不変・バランス据え置き。

### 残4 二重ログ調査（防御/撤退が各2回表示）

会津戦 ACTION LOG で「フォーグ が防御」「フォーグ が撤退」が各2回。原因未確定。候補:
- A: mobSlots=2 が同名 mob を2体生成（フォーグ×2）→各自ログ＝重複に見える。mob名にインデックス付与で回避可。
- B: `_doRetreat` の `_finish` が300ms遅延（`_delayedCall(300, …)`）。その窓で `doAction` の `checkGameOver()` が false（gameOver未設定）のため次の `processNext` が走り、追加ユニットが行動／二重処理する可能性。
- mob生成数と _finish レースを実機＋コードで切り分け。推論で断定しない。

### 残5 保留中の表示異常（syncDisplay系統・要精読）

- 敵生存カウント「ENEMY UNITS 0/N」が、敵複数生存(charHp>0)でも 0 表示。
- side panel の敵HP表示がエンジン実値と乖離（ログ「X 0/10 戦闘不能」時にパネルは 10/10）。
- 両者 `syncDisplay`/敵表示生成（BattleScene.jsx）を精読して切り分け。

---

## AI設計に関する申し送り

`BattleAI`（V3）は `selectAction`/`selectTarget` とも「ランダム固定」。戦略パラメータ未使用＝事実上 AI は全コマンドを乱択。残1は撤退濫択の応急是正に留まる。中期的には strategyRate 等を用いた行動選択ロジックの設計が必要（別タスク化）。

## 着手順

残1（最優先・即勝利解消）→ 残2（敵将軍攻撃力）→ 残3（HP実値化・ハードニング）→ 残4/残5（調査）。各々独立に検証可。完了後、本プロンプトと PROMPT_battle_bugs_v3.md を docs/archive/ へ移動。
