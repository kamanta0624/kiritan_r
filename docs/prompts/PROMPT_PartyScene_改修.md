## PartyScene 改修タスク

### 対象ファイル
- src/scenes/PartyScene.jsx
- src/App.jsx（Props追加のみ）
- src/shared/SharedUI.jsx（TopBar改修）

### タスク一覧

#### 1. 行動力・ミーム表示（TopBar）
- App.jsx の `case 'characters':` で PartyScene に
  `actionPoints={game.actionPoints}` `maxActionPoints={game.maxActionPoints}`
  を追加で渡す
- PartyScene の TopBar 呼び出しに
  `actionPoints` `maxActionPoints` `meme={treasury}` を追加
- SharedUI.jsx の TopBar：breadcrumbモード時でも
  ⚡行動力・ミームを rightSlot の左に小さく表示する
  （既存の rightSlot は維持。追加コンポーネントをinlineで差し込む）

#### 2. キャラ選択ホバー時ポートレート
- characters.json の実フィールド名は `portrait`（既存マッピングで対応済み）
- LeftPanel・NameItem とも portrait が null の場合は非表示（実装済み）
- 動作しない場合は allChars 生成部のフィールドマッピングを確認・修正する

#### 3. CharDetail の STATS 拡充
- 実データに `spd` フィールドは存在しないため速度は追加しない
- 以下の項目を追加表示する：
  - SP上限：`char.memeMax`（バー不要、数値のみ）
  - HP：`char.hp`（StatBar, max=char.maxHp, color='#e57373'）
  - HP上限：`char.maxHp`（バー不要、数値のみ）
- 実データフィールドのマッピング確認：
  - hp      ← charHp
  - maxHp   ← charMaxHp
  - memeMax ← maxSoldiers
- 現在のSTATS欄（攻撃/防御/SP）の直下に追加

#### 4. UPGRADE確認ポップアップ（汎用）
- UPGRADEボタンクリック時、実行前に確認ダイアログを出す
- ダイアログ内容：
  - コマンド名・コスト（ミーム）
  - STATSのどの値がどう変わるか（before → after）
    - sp_refill: soldiers が X → min(X + floor(maxSoldiers * 0.5), maxSoldiers)
    - sp_max_up: maxSoldiers が X → X + 200
  - 「実行する」「キャンセル」ボタン
- CharDetail 内に `confirmState` useState で管理
- 「実行する」クリック時に onUpgrade を呼ぶ

#### 5. CHARACTER UPGRADE 確認ポップアップ
- タスク4と同様の確認ダイアログを追加
- 変化内容は cmd.desc をそのまま表示（数値プレビューは不要）
- 「実行する」クリック時に onPurchaseUpgrade を呼ぶ

### 注意事項
- characters.json のフィールド：charAttack, charDefense, charHp, charMaxHp, soldiers, maxSoldiers
- デザイントークンは tokens.js の PK/TEAL/AC/TX/TXD/TXF/BR/glass を使う
- ポップアップは position:fixed + zIndex:200 + glass() スタイル
- ファイル全体の書き換えは禁止。str_replace で差分のみ編集する
