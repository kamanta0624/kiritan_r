# kiritan_r 画面遷移定義

> 対象: ClaudeDesign / テックリード参照用
> 更新: 2026-05-11

---

## シーン一覧

| シーンID | 表示名 | 状態 |
|----------|--------|------|
| `title` | タイトル | 要実装 |
| `map` | マップ | デザイン済(Game.html) |
| `base_menu` | 拠点メニュー | 要実装（Game.htmlのNodePopup拡張） |
| `formation` | 編成 | デザイン済(Game.html:AttackFormationScene) |
| `battle_action` | 行動選択 | デザイン済(Game.html:BActionScene) |
| `battle_resolve` | 戦闘 | デザイン済(Game.html:BResolveScene) |
| `dungeon` | 迷宮 | 要実装 |
| `characters` | キャラクター | デザイン済(Game.html:PartyScene) |
| `items` | アイテム | 要実装 |
| `research` | 研究 | 要実装 |
| `adv` | 会話 | デザイン済(Game.html:adv) |
| `save` | セーブ/ロード | 要実装 |
| `game_end` | ゲームエンド | 要実装 |
| `new_game_plus` | 周回選択 | 要実装 |
| `gallery` | ギャラリー | 空実装でよい |
| `settings` | 設定 | 空実装でよい |
| `credits` | クレジット | 空実装でよい |

---

## 遷移定義

### title

```
title
  → map              : はじめから（新規ゲーム開始）
  → map              : 続きから（セーブデータ選択後）
  → gallery          : ギャラリー
  → settings         : 設定
  → credits          : クレジット
  → new_game_plus    : 周回選択（引き継ぎデータ存在時のみ表示）
```

### map

```
map [常駐要素: パートナー左下, ターン数/ミーム/収入 トップバー]
  → base_menu        : 自勢力・敵拠点クリック
  → characters       : キャラクターボタン
  → items            : アイテムボタン
  → research         : 研究ボタン
  → save             : システムメニュー経由
  → adv              : ターン開始/終了イベント発火時（自動遷移）
  → game_end         : 勝利/敗北条件成立時（自動遷移）
```

### base_menu

```
base_menu [拠点イラスト大表示 + 拠点名/勢力/収入情報]
  コマンド（自勢力所有時）:
    → formation      : 攻撃（隣接する敵拠点が存在する場合のみ表示）
    → adv            : 訪問
    → dungeon        : 迷宮（dungeonId設定済み拠点のみ表示）
  コマンド（敵拠点クリック時）:
    → formation      : 攻撃（隣接かつ交戦状態の場合のみ表示）
  → map              : 閉じる
```

### formation

```
formation [前衛2 + 後衛2 スロット / キャラ一覧]
  前提: 攻撃対象拠点を保持して遷移
  → battle_action    : 出撃（前衛1人以上選択済みの場合のみ有効）
  → map              : キャンセル
```

### battle_action

```
battle_action [行動選択 / ラウンド表示]
  前提: formation情報・対象拠点・敵編成を保持
  各ユニットの行動選択:
    近接 / 遠距離 / 歌 / 防御 / 集中 / 撤退
    攻撃系 → 対象選択UI（前衛限定 or 全体）
  全ユニット行動確定後:
    → battle_resolve   : 自動遷移（1ラウンド分の解決へ）
  通常戦闘のみ:
    5ラウンド経過 or 一方全滅 → 結果へ
  イベント戦闘/迷宮戦闘:
    ラウンド無制限・撤退不可
```

### battle_resolve

```
battle_resolve [戦闘アニメーション再生]
  前提: battle_actionの行動結果を受け取る
  再生完了後:
    戦闘継続 → battle_action  : 次ラウンドの行動選択へ
    戦闘終了（通常）→ map     : マップに戻る（制圧/撤退結果を反映）
    戦闘終了（迷宮）→ dungeon : 迷宮に戻る
    戦闘終了（イベント）→ adv or map : イベント設定に従う
  ※ 作戦成功判定は戦闘開始時1回。全ラウンド通じてSPダメージ±10%/50%補正
```

### dungeon

```
dungeon [現在階層表示 / フロア情報]
  前提: baseIdからdungeonId取得。clearedFloorsを保持
  コマンド:
    進む  → 次階層へ（ランダム敵出現判定 or 固定敵 or フロアイベント）
    戻る  → 前階層へ
    脱出  → map（探索終了。clearedFloors保存）
  戦闘発生時:
    → battle_action  : 迷宮戦闘モード（ラウンド無制限・撤退不可）
  フロアイベント発生時:
    → adv            : 会話/アイテム入手/仲間追加等
  プレイヤー全滅時:
    → map            : 強制脱出（clearedFloors保存）
  最深部クリア:
    → adv or map     : dungeons.json設定に従う
```

### characters

```
characters [キャラ一覧 / 詳細パネル]
  詳細パネル内:
    → adv            : 会話ボタン（talkEventId設定済みキャラのみ）
  表示情報: HP / SP / 攻撃 / 防御 / 歌唱力 / 作戦成功率 / 特技 / 戦闘不能ペナルティ残ターン
  → map              : 閉じる
```

### items

```
items [所持アイテム一覧 / 装備スロット]
  → map              : 閉じる
```

### research

```
research [研究一覧 / 実行ボタン]
  → map              : 閉じる
```

### adv

```
adv [立ち絵 / テキスト / 選択肢]
  前提: eventIdを受け取って発火
  イベント完了後:
    → 呼び出し元シーンに戻る（map / dungeon / characters / base_menu）
  ※ 選択肢によりフラグ分岐。charJoin/treasury/warFlag等のeffect適用
```

### save

```
save [スロット一覧]
  → map              : 閉じる（セーブ/ロード後）
  ※ 引き継ぎデータ（キャラクリフラグ・周回解放）は別スロットで管理
```

### game_end

```
game_end [勝利 or 敗北テキスト / エンディング演出]
  → title            : タイトルへ戻る
  → new_game_plus    : 周回プレイ（キャラクリ条件満たした場合のみ表示）
```

### new_game_plus

```
new_game_plus [周回ボーナス選択]
  前提: 引き継ぎデータに周回解放済み勢力が存在
  選択: 「XX勢を仲間にする」（解放済み勢力のみ表示）
  → map              : 選択確定→新規ゲーム開始（初期配置変更済み）
```

---

## 常駐要素

| 要素 | 表示シーン | 概要 |
|------|-----------|------|
| パートナー | map | 左下常駐。クリックで台詞表示 |
| トップバー | map / characters / items / research | ターン / ミーム / 収入 |
| システムメニュー | map | セーブ・ロード・設定へのアクセス |

---

## 戦闘モード区分

| モード | ラウンド上限 | 撤退 | 設定箇所 |
|--------|------------|------|---------|
| 通常戦闘 | 5 | 可 | 固定 |
| 迷宮戦闘 | 無制限 | 不可 | dungeons.json |
| イベント戦闘 | 設定可能 | 設定可能 | events.json |

---

## データ追加項目（kiritan → kiritan_r移行時に対応）

### characters.json 追加フィールド
```js
{
  "strategyRate": 30,        // 作戦成功率
  "skillId": null,           // 特技ID（skills.json参照）
  "talkEventId": null,       // 個別会話イベントID
  "penaltyTurns": 0,         // 戦闘不能ペナルティ残ターン
  "charaClearFlags": []      // キャラクリ達成フラグ一覧
}
```

### dungeons.json 追加フィールド
```js
{
  "battleMode": "dungeon",   // "dungeon" = ラウンド無制限・撤退不可
  "battleCapacity": 200      // 迷宮ごとの戦闘域
}
```

### events.json 追加フィールド
```js
{
  "battleMode": "event",     // イベント戦闘モード
  "maxRounds": 10,           // イベント戦闘のラウンド上限（省略時は無制限）
  "allowRetreat": false      // 撤退可否
}
```

### 新規: inheritance_save.json（引き継ぎデータ）
```js
{
  "charaClear": {
    "char_001": true,
    "char_025": false
  },
  "unlockedFactions": ["faction_yellow"]
}
```
