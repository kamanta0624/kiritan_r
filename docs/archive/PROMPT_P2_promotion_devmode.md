# PROMPT_P2_promotion_devmode.md — P2 プロモーション画面 隔離開発

> 種別: Code 引き継ぎ（実装）
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md` §3 プロモーション仕様
> 方針: 完全新機能のためバグ・仕様漏れ多発を想定。**本体組み込みは禁止**、デバッグ環境で隔離開発 → 完成後に本体載せ替え
> QA: 人間が担当（本書に QA 手順を含めない）

---

## 0. 原則

- **本体（GameContext, BottomBar 等）には一切手を入れない**
- 隔離 dev シーンとして独立動作させる
- データ駆動: 効果値・名称は JSON、実装側は id と種別フラグのみで動作
- デザイントークン `src/shared/tokens.js` から import、色直書き禁止
- 指示範囲外を変えない、不明点は Chat に確認

---

## 1. スコープ（成功基準）

### 1.1 デバッグ環境構築

- `?qa=promotion` URL で開発用シーン起動
- 既存 QA URL パターン（`?qa=battlefull` → `BattleFullQAScene`）に倣う
- App.jsx の QA 分岐部分のみ追加（他 case ブロック・通常フローへの影響禁止）
- 通常マップ起動経路（BottomBar 等）からは到達不可

### 1.2 promotion_commands.json 新規作成

- パス: `src/game/data/promotion_commands.json`
- 初期データ（3種、汎用）:

```json
[
  { "id": "video", "name": "動画収録", "limited": false },
  { "id": "song", "name": "歌", "limited": false },
  { "id": "official_assets", "name": "公式素材供給", "limited": false }
]
```

- スキーマ:
  - `id`: コマンド一意 ID（string）
  - `name`: 表示名（string、本体UI/エディタ編集対象）
  - `limited`: 制限ありフラグ（boolean）
    - `false`: 汎用、無制限、`uses` 不問
    - `true`: 制限あり、`uses >= 1` のときのみ UI 表示・実行可
- 効果値（補充量・上限増分）は JSON に持たず**コード固定**（補充=満タン、上限増=+50）

### 1.3 PromotionDevScene 本体実装

- 新規ファイル: `src/scenes/PromotionDevScene.jsx`
- props 不要、内部で local state 管理（GameContext 非依存）

#### 1.3.1 モック state

ローカル useState で以下を保持:
```js
const [mockChars, setMockChars] = useState([
  { id:'kiritan',    name:'東北きりたん',  soldiers:100, maxSoldiers:200 },
  { id:'zundamon',   name:'ずんだもん',    soldiers:200, maxSoldiers:200 },  // 満タン
  { id:'tsumugi',    name:'春日部つむぎ',  soldiers:50,  maxSoldiers:150 },
]);
const [actionPoints, setActionPoints] = useState(5);  // 行動力モック
const [usesMap, setUsesMap] = useState({});  // {commandId: remainingUses}
```

#### 1.3.2 UI 構造

レイアウト案（Code 裁量で詳細調整可）:
1. ヘッダ: 「プロモーション (DEV)」+ 行動力残量表示
2. コマンドリスト: promotion_commands.json から `limited:false` のもの常時表示、`limited:true` のものは `usesMap[id] >= 1` のときのみ表示
3. コマンド選択 → 対象キャラ選択画面（モックキャラ一覧）
4. キャラ選択 → 効果2択モーダル（補充 / 上限増 +50）
   - 補充ボタン: 対象キャラ `soldiers == maxSoldiers` ならグレーアウト＋クリック不可
   - 上限増ボタン: 常時有効
5. 効果適用 → mockChars 更新、actionPoints -1、limited コマンドなら usesMap[id] -1
6. デバッグ用「リセット」ボタン: 全 state を初期値に戻す
7. デバッグ用「制限コマンド追加 +1」ボタン: 各 limited コマンドの uses を手動加算（grantPromotionUses 連動の代わり）

#### 1.3.3 効果適用ロジック

- 補充: `soldiers = maxSoldiers`
- 上限増: `maxSoldiers += 50`、`soldiers` は変更しない
- 行動力 < 1 のときコマンド実行不可（ボタン全グレーアウト）

### 1.4 載せ替え準備

- PromotionDevScene は最終的に PromotionScene として本体に統合される前提
- そのため、以下を分離して実装:
  - **共通 UI 部品**: コマンド一覧 / キャラ選択 / 効果2択モーダル → 再利用可能な関数コンポーネントとして書く
  - **state 接続層**: PromotionDevScene 側のみが local state、本体載せ替え時は GameContext に差し替え
- ロジック層（補充・上限増の値、グレーアウト判定）は将来 GameContext reducer に移植する想定で純粋関数として分離

---

## 2. 範囲外（やらない）

- **本体への組み込み**（BottomBar / GameContext / navigate('promotion') 等への変更全面禁止）
- エディタ統合（`tools/editor-modules/` への追加）→ P2-2 で別途
- `grantPromotionUses` effect の EventEngine 実装 → P4 で別途
- limited コマンドの実例追加（劇場イベント等）→ P4 で別途
- 既存シーン（PartyScene 等）の挙動変更
- KNOWLEDGE.md 更新（Chat が担当）

---

## 3. 着手前の事前報告

実装着手前に Chat に以下を報告:

1. `?qa=` 既存パターンの実装箇所（App.jsx の QA 分岐部分の行番号と構造）
2. モックキャラデータの初期値で問題ないか（テストケース網羅性）
3. UI レイアウトの大枠案（テキスト or 簡易ワイヤー）

これら全部を1回のメッセージで報告。Chat 確認のうえ着手指示を出す。

---

## 4. 完了後の報告

実装後、各成功基準（§1.1〜§1.4）に対する達成状態を1項目ずつ列挙して報告。
ファイルパス・主要関数名も明記。
QA は人間が担当するため、Code 側で QA は行わない。
