# PROMPT: status フィールド廃止（実装）

## 目的
キャラの `status`（active=加入済 / standby=在野 / recruitable=雇用可）を全廃。加入判定を `factionId` へ一元化。雇用・戦死システムは存在しないため関連デッドコードも除去。

## 確定モデル（コード根拠）
membership が3系統に冗長化。これがバグ温床。
- (1) `char.status === 'active'` — createInitialState 足切り（GameContext.jsx:40）
- (2) `char.factionId` — PartyScene 表示フィルタ（App.jsx:528）
- (3) `faction.characters[]`（factions.json）— **ゲームコード不参照のデッドデータ**。列挙値 char_001〜003 が実id（char_004 等）と不一致。

### 真因（既調査・確定）
createInitialState が `status==='active'` で足切り → 在野(standby)キャラは初期 state.characters 不在 → charJoin(:434) は既存キャラ書換えのみ・不在キャラ追加せず → 在野キャラに到達不能。**status 廃止だけでは加入不能のまま**。初期 state への全キャラ投入が必須。

## 目標仕様
- 加入 = `factionId === playerFactionId`（東北家）。未加入 = `factionId:null`。
- status 全廃。
- 在野キャラも charJoin で加入できるよう、初期 state.characters に**全非テンプレキャラ**を投入（factionId はJSON値のまま）。表示は factionId でゲート。

## 実装（編集サイト）

### A. GameContext.jsx
1. :38-46 createInitialState — フィルタを `!c.isTemplate` のみに（status条件削除）。全非テンプレキャラを state.characters に投入。factionId は元値維持。
2. :434-437 charJoin — `status:'active'` 削除。`factionId` セットのみ残す。
3. :440-446 charLeave — `status:'standby'` 削除。`factionId:null` のみ。
4. :596 save serialize — `status:` 行削除。
5. :667 load deserialize — `status:` 行削除。

### B. SaveSystem.js
6. :82 / :177 — `status` 行削除。

### C. PartyScene.jsx
7. :463 `joined: c.joined ?? (c.status === 'active')` → status参照除去。App.jsx:528 で既に `factionId===player` でフィルタ済のため `joined: true` で足りるか、joined判定を factionId へ統一するか Code判断。

### D. BuildingSystem.js（デッドコード除去）
8. getHirePool(:91) / hire(:101) — 全リポジトリ呼出ゼロ。メソッドごと削除。
9. createMobInstance(:128内) `status:'active'` 行削除（モブは status 不参照になる）。
10. 冒頭コメント(:7) の recruitable 記述削除。

### E. tokens.js
11. CHARS の status 既定値（:37,41,45,49,53,57,61）削除。

### F. データ
12. characters.json 全キャラ `status` 削除。
13. factions.json `characters[]` 配列 = デッドデータ。削除可。**要確認**: new_game_plus の DEMO_FACTIONS が参照しないか。

### G. エディタ
14. tab-characters.js ステータスドロップダウン(:115-117)・フィルタタブ(:28-30) 削除。shared.js STATUS_LABELS(:18-20) 削除。
15. editor.cjs 新規キャラ生成テンプレの status 削除。

## 波及確認（Code担当・要検証）
- 初期 state.characters への全キャラ投入で EnemyAI / availableChars / 戦闘対象選択 が player以外キャラを誤って含めないか。各 consumer の factionId フィルタ精査。
- NEXT_TURN 回復・ペナルティ処理(GameContext:114) が全キャラを舐める。未加入(factionId:null)キャラ処理の可否確認。

## 非該当（触るな）
- BattleScene.jsx `unit.status`（active/pending/done = 戦闘ターン状態・別ドメイン）。:59,363,924,925,1159。
- WorldMapQAScene.jsx status（QAバッジ）。:89-91,455。

## 禁止
- ブラウザキャッシュ/ハードリロードを解決策にしない。該当時は調査結果をまとめ停止。
- 推論で原因断定しない。コード根拠のみ。
- デザイントークンは tokens.js から import。色直書き禁止。
