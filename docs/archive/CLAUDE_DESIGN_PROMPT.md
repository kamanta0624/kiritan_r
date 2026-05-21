# kiritan_r UI開発依頼

## プロジェクト概要

「きりたんの天下」は地域制圧型ターン制ストラテジーゲームです。
現在 React + Vite で全面リニューアル中です（kiritan_r）。

あなたにお願いしたいのは **UIコンポーネントの開発** です。
ゲームロジックは別途実装済みです。UIのみを担当してください。

---

## 既存デザイン（必読）

添付の `Game.html` が現在のデザインプロトタイプです。
以下のシーンが実装されています：

| シーンID | 内容 |
|----------|------|
| `map` | ワールドマップ（メイン画面） |
| `party` | キャラクター一覧・詳細 |
| `formation` | 攻撃編成（前衛2・後衛2） |
| `battle_action` | 戦闘行動選択 |
| `battle_resolve` | 戦闘解決アニメーション |
| `adv` | 会話・ADVシーン |

**これらのシーンはGame.htmlのデザインを踏襲してください。**

---

## 開発してほしいシーン（新規）

以下のシーンは Game.html に存在しません。
kiritan_r/docs/SCENE_FLOW.md の仕様と、Game.htmlのデザイントークンに合わせて新規開発してください。

### 1. `title` — タイトル画面

**内容:**
- ゲームタイトル「きりたんの天下」を大きく表示
- ボタン: はじめから / 続きから / ギャラリー / 設定 / クレジット
- 「ギャラリー」「設定」「クレジット」は空のプレースホルダーページでよい
- 周回プレイ解放時のみ「周回プレイ」ボタンも表示（`hasNewGamePlus` props）
- 雰囲気: 重厚・和風ファンタジー。東北の地図やキャラ立ち絵をバックに

### 2. `base_menu` — 拠点メニュー

**内容:**
- 拠点イラストを大きく表示（画像URLはpropsで渡す）
- 拠点名・所属勢力・収入を表示
- コマンドボタン（自勢力所有時）: 「攻撃」「訪問」「迷宮」
  - 「攻撃」は隣接する敵拠点がある場合のみ表示（`canAttack` props）
  - 「迷宮」はdungeonId設定済みの拠点のみ表示（`hasDungeon` props）
- コマンドボタン（敵拠点クリック時）: 「攻撃」のみ
- 「閉じる」ボタン
- モーダル形式（マップの上に重ねる）

### 3. `items` — アイテム管理

**内容:**
- 所持アイテム一覧（グリッド表示）
- アイテム選択で詳細パネル表示（名前・説明・効果・装備可能キャラ）
- 「装備」「売却」ボタン
- 上部にTopBar（Game.htmlのTopBarコンポーネントを流用）

### 4. `research` — 研究

**内容:**
- 研究一覧（カード形式）
- 各研究: 名前・説明・コスト（ミーム）・完了済みバッジ
- 「研究する」ボタン（コスト不足時はグレーアウト）
- 上部にTopBar

### 5. `save` — セーブ/ロード

**内容:**
- スロット3つ（スロット1〜3）
- 各スロット: セーブ日時・ターン数・拠点数・サムネイル（任意）
- 「セーブ」「ロード」ボタン
- 空スロットは「データなし」表示
- モーダル形式

### 6. `game_end` — ゲームエンド

**内容:**
- 勝利 or 敗北に応じて異なる演出
- 勝利: 「制圧完了」タイトル + エンディングテキスト + 「タイトルへ」「周回プレイ」ボタン
- 敗北: 「拠点陥落」タイトル + テキスト + 「タイトルへ」ボタン
- `isVictory` / `clearedCount`（キャラクリ数）をpropsで受け取る

### 7. `dungeon` — 迷宮探索

**内容:**
- 現在の階層表示（例: 3F / 5F）
- 探索者キャラのカード（HP・SP表示）
- コマンドボタン: 「進む」「戻る」「脱出する」
- 戦闘発生時はアニメーション演出（簡易でよい）
- フロア情報テキスト（「静寂が漂う…」などのフレーバーテキスト）
- 雰囲気: 薄暗い、緊張感、RPGダンジョン風

### 8. `new_game_plus` — 周回選択

**内容:**
- 「周回プレイ開始」タイトル
- 解放済み勢力のボタン一覧（例: 「小樽勢を仲間にする」）
- 選択した勢力の説明テキスト
- 「決定」「キャンセル」ボタン
- `unlockedFactions`（解放済み勢力リスト）をpropsで受け取る

---

## 技術仕様

### スタック
- React 18 + Vite
- CSSはインラインスタイル（styled-componentsやTailwind不使用）
- Game.htmlと同じデザイントークンを使用

### デザイントークン（Game.htmlから抜粋）
```js
const PK   = '#c4427a';  // プライマリ（ピンク）
const PK2  = '#9e2d5f';
const AC   = '#b87010';  // アクセント（ゴールド）
const AC2  = '#d4a044';
const TEAL = '#1a8a96';
const TX   = '#1c1020';  // テキスト（ダーク）
const TXD  = 'rgba(28,16,32,.55)';
const TXF  = 'rgba(28,16,32,.24)';
const BR   = 'rgba(0,0,0,.08)';

// glassモーフィズム
const glass = (extra={}) => ({
  background: 'rgba(255,253,251,.92)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.8)',
  boxShadow: '0 2px 18px rgba(0,0,0,.13)',
  ...extra,
});
```

### コンポーネント構造（Game.htmlから流用可能）
- `TopBar` — ターン/ミーム/収入/拠点表示バー
- `PartnerWidget` — 左下常駐パートナーUI

### ファイル構成
各シーンは独立したコンポーネントとして作成してください：
```
src/scenes/TitleScene.jsx
src/scenes/BaseMenuScene.jsx
src/scenes/ItemsScene.jsx
src/scenes/ResearchScene.jsx
src/scenes/SaveScene.jsx
src/scenes/GameEndScene.jsx
src/scenes/DungeonScene.jsx
src/scenes/NewGamePlusScene.jsx
```

### Props規約
各シーンは以下のpropsを受け取ります：
```js
// 共通
onNavigate(sceneId, params)  // シーン遷移
gameState                     // { turn, meme, income, bases }

// シーン固有はシーンごとに定義
```

---

## 納品物

1. 上記8シーンの `.jsx` ファイル
2. 各シーンをプレビューできる `PreviewApp.jsx`（シーン切り替えボタン付き）

---

## 参考

- `docs/Game.html` — 既存デザインプロトタイプ（必読）
- `docs/SCENE_FLOW.md` — 全画面遷移定義

既存シーン（map/party/formation/battle_action/battle_resolve/adv）は
Game.htmlのコードをReactコンポーネントに変換して `src/scenes/` に配置してください。
