# PROMPT_P2_promotion_devmode_ext.md — P2 プロモーション 限定コマンド拡張

> 種別: Code 引き継ぎ（拡張実装）
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md` §3 プロモーション仕様（§3.3〜§3.8 が本書スコープ）
> 前提プロンプト: `docs/prompts/PROMPT_P2_promotion_devmode.md`（汎用3種実装済み）
> QA: 人間が担当

---

## 0. 原則

- **本体への組み込みは引き続き禁止**、隔離 dev シーン（`?qa=promotion`）の拡張のみ
- データ駆動: 限定コマンドの効果は JSON の effects 配列、実装側は適用ロジックのみ
- デザイントークン import、色直書き禁止
- 指示範囲外を変えない、不明点は Chat に確認

---

## 1. スコープ（成功基準）

### 1.1 promotion_commands.json に限定2件追加

`src/game/data/promotion_commands.json` を §3.8 通りに更新:

```json
[
  { "id": "video",           "name": "動画収録",       "limited": false },
  { "id": "song",            "name": "歌",             "limited": false },
  { "id": "official_assets", "name": "公式素材供給",   "limited": false },
  {
    "id": "holy_land_collab",
    "name": "聖地コラボイベント",
    "limited": true,
    "maxUses": 3,
    "effects": [
      { "type": "add", "key": "maxSoldiers", "value": 200 },
      { "type": "add", "key": "soldiers", "value": 200 }
    ]
  },
  {
    "id": "official_mv",
    "name": "公式MV制作",
    "limited": true,
    "maxUses": 5,
    "effects": [
      { "type": "add", "key": "soldiers", "value": 100 },
      { "type": "add", "key": "charSong", "value": 1 }
    ]
  }
]
```

### 1.2 PromotionDevScene の state 拡張

```js
const [usesMap, setUsesMap] = useState({});            // {commandId: remainingUses}
const [unlockedCommands, setUnlockedCommands] = useState(new Set());  // 取得済み limited コマンドID
```

モックキャラに `charSong` フィールド追加（公式MV効果検証用、初期値0でOK）。

### 1.3 UI 表示ロジック

コマンドリスト表示条件:
- `limited === false` → 常時表示
- `limited === true && unlockedCommands.has(id) && (usesMap[id] ?? 0) >= 1` → 通常表示
- `limited === true && unlockedCommands.has(id) && (usesMap[id] ?? 0) === 0` → **グレーアウト表示**（クリック不可）
- `limited === true && !unlockedCommands.has(id)` → **非表示**

限定マーク表示:
- `limited === true` のコマンドにバッジ（例: 「LIMITED」「★」「枠アイコン」等）を表示
- uses 残量を限定コマンドのみに `${uses}/${maxUses}` 形式で表示

### 1.4 限定コマンド実行ロジック（単択 UX）

- 限定コマンドクリック → 対象キャラ選択画面（既存フロー流用）
- キャラ選択 → 効果2択モーダル**を出さず**、即 effects 配列を適用
- effects 配列の各要素 `{ type, key, value }` を実行キャラに適用:
  - `type:'add'` → `char[key] += value`
  - `type:'mul'` → `char[key] *= value`
  - `type:'set'` → `char[key] = value`
- 行動力 -1、`usesMap[id] -= 1`
- 行動力 < 1 または `usesMap[id] === 0` でグレーアウト

### 1.5 デバッグ用 uses 加算機能

§1.3.2 の「制限コマンド追加 +1」ボタンを限定コマンドごとに分割。

実装:
- 各限定コマンドの行（または別エリア）にデバッグボタン「+1」を配置
- クリック動作:
  - `usesMap[id]` を +1（**`maxUses` でクランプ**、超過分は捨てる）
  - `unlockedCommands` Set に `id` を追加（初回加算時）

### 1.6 リセット機能拡張

「リセット」ボタンクリック時:
- `usesMap` を `{}` に
- `unlockedCommands` を `new Set()` に
- mockChars / actionPoints も初期値に

### 1.7 共通部品の維持

§1.4（前回プロンプト）の「載せ替え準備」原則継続。限定コマンド分岐ロジックも純粋関数化し、本体載せ替え時に GameContext reducer へ移植可能な形で書く。

---

## 2. 範囲外（やらない）

- 本体への組み込み
- エディタ統合（P2-2 で別途）
- `grantPromotionUses` effect の EventEngine 実装（P4 で別途、デバッグ用ボタンで代用）
- 限定コマンドの本番実例追加（ダミー2件のみ）
- `effects` の `type` に `'add'`/`'mul'`/`'set'` 以外を追加すること
- 汎用3種の挙動変更（補充/上限増 2択 UX 維持）

---

## 3. 着手前の事前報告

1. `promotion_commands.json` 既存ファイルの現在内容（前回プロンプトで作成した版が想定通りか確認）
2. mockChars に `charSong` フィールドを追加する位置（初期値どのキャラに何を設定するか）
3. 限定マーク UI の案（バッジ文字 or アイコン、配置位置）

これら1メッセージで報告 → Chat 確認 → 着手。

---

## 4. 完了後の報告

§1.1〜§1.7 の達成状態を1項目ずつ列挙。
限定マークの実装方式（バッジ文字/アイコン）も明記。
QA は人間が担当するため Code 側で QA は行わない。
