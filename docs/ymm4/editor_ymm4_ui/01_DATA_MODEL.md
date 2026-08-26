# 01_DATA_MODEL — タイムラインJSON仕様（ビート/シーン2層構造）

`docs/ymm4/editor_ymm4_ui/00_UI_REQUIREMENTS.md`の決定事項に基づく、theaterイベントの新データモデル。現行`script`配列（逐次、フレーム概念なし）を置き換える。

## 全体構造

```jsonc
{
  // イベントメタデータ（既存のev_theater_*.jsonと同じ、変更なし）
  "id": "theater_sample_001",
  "name": "テストイベント",
  "trigger": "theater",
  "category": "recurring",
  "title": "テストイベント",
  "description": "動作確認用の繰り返しイベント",
  "cost": { "actionPoints": 1 },
  "conditions": [],
  "probability": 1,
  "priority": 0,
  "maxOccurrences": -1,

  // ここから新規：シーン（タイムライン本体）
  "scene": {
    "fps": 30,

    // 一般ゾーン：背景・一般字幕（ナレーション）・BGM・SE
    "general": {
      "background": [
        { "id": "bg1", "file": "bg_battle.jpg", "start": 0, "length": -1 }
      ],
      "bgm": [
        { "id": "bgm1", "file": "bgm_calm.wav", "start": 0, "length": -1, "volume": 70, "loop": true }
      ],
      "se": [],
      "narration": [
        { "id": "n1", "text": "【テストイベント】", "start": 0, "length": 60 }
      ],
      "video": [],   // 未使用、拡張余地のみ確保
      "shape": []    // 未使用、拡張余地のみ確保
    },

    // キャラ専用ゾーン：キャラIDごとに立ち絵・ボイス・表情トラック
    "characters": {
      "char_006": {
        "displayName": "彩澄しゅお",
        "position": "center",
        "standing": [
          { "id": "c1", "rigRef": "/characters/parts/char_006/rig.json", "start": 0, "length": -1 }
        ],
        "voice": [
          {
            "id": "v4",
            "start": 180, "length": 150,
            "text": "長きにわたる遠征を経て、東北家は仙台へと帰還した…",
            "speakerId": 13,
            "volumeOverride": null,
            "file": "/audio/voice/theater_sample_001/003.wav"
          }
        ],
        "expression": [
          { "id": "e4", "preset": "smile", "start": 180, "length": 150 }
        ]
      }
    }
  },

  // ビート列：クリック進行の順序。各要素はscene内アイテムへの参照のみ持つ
  "beats": [
    { "index": 1, "kind": "narration", "ref": "n1" },
    { "index": 2, "kind": "voice", "charKey": "char_006", "ref": "v4" },
    { "index": 3, "kind": "choice", "options": [
      { "text": "はい", "next": 4 },
      { "text": "いいえ", "next": 6 }
    ]},
    { "index": 4, "kind": "end" }
  ],

  "effects": { "default": [] }
}
```

## 設計原則

- **`scene`＝シーン層**。ビートをまたいで持続するアイテム（背景・BGM・立ち絵表示）を保持。`length: -1`は「明示的な終了まで持続」を表す
- **`beats`＝ビート層**。クリックで進行する順序そのもの。実体データは持たず、`scene`内アイテムのIDを`ref`で参照するだけ（データの二重管理を避ける）
- **`start`/`length`はフレーム単位（fps=30固定）**。ボイスアイテムの`length`はVOICEVOX生成後の実尺（自動計算）。ただし**クリック進行の可否には使わない**（クリック待ちの制御はビート層が担う）。タイムラインUI上の表示・ビート内の細かいSE/BGM切替タイミング指定にのみ使う
- **ボイスの話者・パラメータ**：`speakerId`のみアイテムに保持。話速・音高・抑揚・音量・前後無音長さは`voice_presets.json`（別ファイル、キャラごとのデフォルト）を参照。`volumeOverride`が非nullの場合のみ、そのアイテムだけ音量を上書き
- **一般字幕（narration）とキャラのボイス（voice）は別物**。ナレーションは`text`を直接持つ。キャラのセリフは`voice`アイテムの`text`がそのまま字幕表示にも使われる（別に字幕アイテムを作らない）
- **ボイスwavのパス規約**：`/audio/voice/{eventId}/{3桁連番}.wav`。現行`tools/editor.cjs`の`/api/voice/generate`（502行目）が`/audio/voice/${eventId}/${seq}.wav`で書き込む実態に合わせる。実ファイルは`public/audio/voice/`配下
- **未生成ボイスは`file: null` / `length: null`**。ダミー値を置かず未生成状態を明示する。タイムラインUIは`length: null`を「未生成」として最小幅グレー表示。VOICEVOX生成成功時に両方を実値で埋める

## 話者プリセット（別ファイル）

`src/game/data/voice_presets.json`（新規、独立ファイル）

配置根拠：`src/game/data/`は`characters.json`・`secretary_lines.json`等のフラットな`*.json`構成で、`App.jsx`が直接importする規約。`voice_presets.json`はこれに整合。`characters.json`（62体）への統合は不採用（演出専用データとゲームデータの分離を保つ）。

```json
{
  "char_006": {
    "speakerId": 13,
    "speedScale": 1.0,
    "pitchScale": 0.0,
    "intonationScale": 1.0,
    "volumeScale": 1.0,
    "prePhonemeLength": 0.1,
    "postPhonemeLength": 0.1
  }
}
```

## 旧`script`形式との対応表

| 旧`script.type` | 新モデルでの表現 |
|---|---|
| `narration` | `scene.general.narration[]` + `beats[].kind: "narration"` |
| `text`（キャラ発話） | `scene.characters[charKey].voice[]` + `beats[].kind: "voice"` |
| `conversation.lines[]` | 各lineを個別の`voice`アイテム＋個別ビートに分解（1行=1ビートの原則通り） |
| `choice` | `beats[].kind: "choice"`、`options[].next`でビートindexへ分岐 |
| `cutin` | **新モデルでは非対応**（下記参照） |
| `end` | `beats[].kind: "end"` |

### cutinを非対応とする根拠

全JSONデータ（`src/game/data/`・`public/`）で`cutin`の使用実績は**0件**。存在するのは`ADVScene.jsx`のデモ用定数（41行目）、`buildScenario`のパーサ分岐（718行目）、`PersonaCutin`コンポーネント（429行目）のみで、実イベントからは一度も呼ばれていない。

投機的実装を避けるため`beats[].kind`に`cutin`を含めない。`PersonaCutin`コンポーネント自体は削除せず残し、必要になった時点で`kind: "cutin"`を追加して配線する（コンポーネントは実装済みのため追加コストは小さい）。

## 移行方針

既存`ev_theater_*.json`（3件）は変換せず、新形式で作り直す（決定済み）。

## 未確定・要確認

**なし。** 旧・未確定3点は以下で解消（2026-07-25）。

| 項目 | 決定 | 根拠 |
|---|---|---|
| `cutin`の扱い | 新モデルでは非対応 | 実データ使用実績0件。コンポーネントのみ残置 |
| `voice_presets.json`の配置 | `src/game/data/`直下の独立ファイル | 既存フラット`*.json`構成に整合。演出データとゲームデータを分離 |
| 未生成ボイスの`length` | `file`・`length`とも`null` | ダミー値による見た目のずれ・誤解を防ぐ |

あわせてボイスwavのパス表記を実装実態（`/audio/voice/{eventId}/{3桁連番}.wav`）に修正済み。

## 次工程

データモデル確定。この仕様に基づく実装プロンプト（データ層＋ADVScene再生ロジック＋エディタUI）の作成に進む。
