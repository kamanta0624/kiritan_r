# 設計: ソフトウェア開発システム（layer 1: data & compute + editor）

> 状態: 設計レビュー中（実装未着手）  
> 関連: `docs/engine_flags.tsv`（11エンジン×キャラ保有調査） / `KNOWLEDGE.md`

---

## 0. スコープ

### この設計に含む（layer 1）

- データスキーマ: エンジン保有フラグ + 開発段階
- 計算ロジック: 開発 / バージョンアップ アクション、ステータス反映、セーブ移行
- 仲間画面UI: 現行の強化コマンド（SP補充 / SP上限UP）と同型で開発 / VerUpを出す
- エディタ: キャラごと11エンジン保有フラグの編集（`?` をオーナーが潰せるように）
- アイテムのデッドコード化（UIから除去・付与停止）

### この設計に含まない（別レイヤー・未設計）

- 各エンジンのボーナス種別と値
- VerUp の段階上限の具体値
- 研究ツリーの再設計とノード詳細（個々のノード内容・コスト・前提関係）
- バランス調整

**重要**: ボーナス値・VerUp上限・研究ノード詳細は未設計。実装時に勝手な値を入れない。

---

## 1. 概念モデル

| 用語 | 定義 |
|------|------|
| エンジン | 11種（Talk6: VOICEVOX / VOICEROID+A.I.VOICE / CeVIO Talk / Voicepeak / COEIROINK / CoeFont、Song5: CeVIO Song / NEUTRINO / UTAU / Synthesizer V / VOCALOID） |
| 保有フラグ | そのキャラが現実に持つエンジン。静的データ。エディタで設定 |
| 開発段階 | `0=なし → 1=実装 → 2..cap=バージョンアップ`。セーブ内ランタイム状態 |
| 開発 | `0 → 1`。1回のみ。発動時にボーナス適用 |
| バージョンアップ | `1 → 2..cap`。ソフト別上限まで。発動時にボーナス適用 |

**原則**: 保有フラグが `1` のエンジンだけが「なし / 実装 / VerUp」の対象。保有フラグが `0` のエンジンは仲間画面に出さない。

---

## 2. エンジンID

`characters.json` / `software.json` / UI / エディタで共通利用するキー。

| key | 表示名 | 系統 |
|-----|--------|------|
| `voicevox` | VOICEVOX | talk |
| `voiceroid` | VOICEROID / A.I.VOICE | talk |
| `cevio_talk` | CeVIO Talk | talk |
| `voicepeak` | Voicepeak | talk |
| `coeiroink` | COEIROINK | talk |
| `coefont` | CoeFont | talk |
| `cevio_song` | CeVIO Song | song |
| `neutrino` | NEUTRINO | song |
| `utau` | UTAU | song |
| `synthv` | Synthesizer V | song |
| `vocaloid` | VOCALOID | song |

---

## 3. データモデル

### 3.1 `characters.json`

各キャラに `engines` を追加する。これは**保有フラグ**であり、開発済みかどうかではない。

```json
"engines": {
  "voicevox": 0,
  "voiceroid": 0,
  "cevio_talk": 0,
  "voicepeak": 0,
  "coeiroink": 0,
  "coefont": 0,
  "cevio_song": 0,
  "neutrino": 0,
  "utau": 0,
  "synthv": 0,
  "vocaloid": 0
}
```

- 初期値は `docs/engine_flags.tsv` を見ながらエディタで設定。
- `?` は実装側で勝手に確定しない。オーナーがエディタで潰す。
- モブ / テンプレートは全0扱い。

### 3.2 `software.json`（新規）

エンジン定義マスタ。layer 1では**器だけ作る**。

```json
{
  "engines": [
    {
      "id": "voicevox",
      "name": "VOICEVOX",
      "category": "talk",
      "versionCap": 1,
      "develop": {
        "cost": 0,
        "effects": []
      },
      "versionup": []
    }
  ]
}
```

- `versionCap` は暫定 `1`（開発のみ・VerUpなし）。上限確定後に変更。
- `develop.effects` / `versionup[].effects` は空。ボーナス未設計のため値を入れない。
- 後続で研究ツリーと接続する余地を残す。

### 3.3 ランタイム / セーブ

キャラごとに開発段階を保持する。

```js
char.engineDev = {
  voicevox: 0,
  voiceroid: 0,
  cevio_talk: 0,
  voicepeak: 0,
  coeiroink: 0,
  coefont: 0,
  cevio_song: 0,
  neutrino: 0,
  utau: 0,
  synthv: 0,
  vocaloid: 0
}
```

- `engineDev` はその周回のセーブ内のみ有効。
- NewGamePlusや別localStorageキーには持ち越さない。
- 研究と同じ寿命。
- 効果は開発 / VerUp時にキャラステータスへ焼き込み、`engineDev` は二重適用防止とUI表示に使う。

---

## 4. セーブ移行

- `SaveSystem.js` の `SAVE_VERSION` を繰り上げる。
- 旧セーブロード時、各キャラに `engineDev` が無ければ全0を補填。
- `engines` は `characters.json` 側の静的データなので、セーブ側に無くても最新キャラ定義から補う方針。
- 既存 `inventory` / `equipment` は残す。削除しない。

注意:
- 現コード `SaveSystem.js` は `SAVE_VERSION = 7`。
- `KNOWLEDGE.md` には `SAVE_VERSION = 9` とあり乖離している。layer 1実装時にドキュメント側も現コードに合わせて更新する。

---

## 5. 計算ロジック

`GameContext` に新アクションを追加する。

### 5.1 `developEngine(charId, engineKey)`

```txt
guard:
  - char が存在する
  - char.engines[engineKey] === 1
  - char.engineDev[engineKey] === 0
  - プレイヤー treasury >= software.develop.cost

処理:
  - treasury を消費
  - engineDev[engineKey] を 1 にする
  - develop.effects をキャラステータスへ焼き込み
  - UPDATE_CHAR
```

### 5.2 `versionUpEngine(charId, engineKey)`

```txt
guard:
  - char が存在する
  - char.engines[engineKey] === 1
  - char.engineDev[engineKey] >= 1
  - char.engineDev[engineKey] < software.versionCap
  - プレイヤー treasury >= 対応versionup.cost

処理:
  - treasury を消費
  - engineDev[engineKey] を +1
  - versionup.effects をキャラステータスへ焼き込み
  - UPDATE_CHAR
```

### 5.3 効果適用

現行 `purchaseUpgrade` の効果適用を参考にする。

既存:

- `charSong`
- `maxSoldiers`
- `spMaxUpCostMult`

layer 1では新しい効果値を設計しない。必要なら効果適用関数だけ共通化する。

---

## 6. 仲間画面 UI

`PartyScene.jsx` に「SOFTWARE / 開発状況」セクションを追加する。

### 表示ルール

- `char.engines[key] === 1` のエンジンだけ表示。
- `0` のエンジンは非表示。
- `engineDev[key] === 0`: 「未実装」+「開発」ボタン。
- `engineDev[key] >= 1`: 「実装済 / Ver.X」表示。
- `engineDev[key] < versionCap`: 「バージョンアップ」ボタン。
- `engineDev[key] >= versionCap`: 「上限」表示。

### UI方針

- 現行の `CHARACTER UPGRADE` 節と同じカード / ボタン / 確認ダイアログを使う。
- ボタン押下後の確認も `confirmState` を再利用。
- `onDevelopEngine` / `onVersionUpEngine` を `PartyScene` にpropsで渡す。

---

## 7. エディタ

対象: `tools/editor-modules/tab-characters.js`

### 追加UI

キャラ詳細フォームに「エンジン保有」セクションを追加。

- 11チェックボックス
- Talk / Song でグルーピング
- `?` の管理はTSV側。エディタ保存値は 0/1 のみ。

### 保存

`saveChar()` で以下を保存:

```js
c.engines = {
  voicevox: checked(...),
  voiceroid: checked(...),
  ...
}
```

### 新規キャラ

`addChar()` の初期値:

```js
engines: {
  voicevox:0, voiceroid:0, cevio_talk:0, voicepeak:0, coeiroink:0, coefont:0,
  cevio_song:0, neutrino:0, utau:0, synthv:0, vocaloid:0
}
```

### TSV

`docs/engine_flags.tsv` は調査資料。エディタで値を確定した後、必要なら別途JSON反映する。layer 1でTSV自動取り込みは必須ではない。

---

## 8. アイテムのデッドコード化

削除しない。復活可能な状態で凍結する。

### 実施内容

- BottomBar から「アイテム」ボタンを非表示。
- `ItemsScene` / `ItemSystem` / `items.json` / `inventory` / `equipment` は残す。
- `itemGain` エフェクトは no-op 化または警告ログのみ。
- ダンジョン `rewardItem` 付与は停止。見えない在庫増殖を防ぐ。

### コメント

関連箇所に `@deprecated item system frozen` などのコメントを付ける。

---

## 9. 研究ツリーとの接続（後続）

本layerでは実装しない。ただし接続モデルは確定済み。以下を前提に器を用意する。

### 確定モデル

- **研究＝プレイヤー全体の解禁のみ**。研究はボーナス値を供給しない。開発コストやVerUp上限を変更しない。
- **二段構え**:
  1. 研究画面でノードを完了 → そのソフトの開発（または特定VerUp段階）がプレイヤー全体で**解禁**される。
  2. 仲間画面で、そのソフトを**保有するキャラ**だけが、解禁済みの開発 / VerUpを実行（ミーム消費）。
- ボーナスの種別・値は `software.json`（開発 / VerUp定義）側に固定で持つ。研究はそれを「実行可能にするゲート」に過ぎない。
- 保有していないキャラには解禁されても何も起きない（恩恵なし）。

### layer 1で用意する器

- `software.json` の各 develop / versionup を、研究解禁フラグでゲートできるよう `requiredResearch`（解禁キー）参照の余地を残す。
- ボーナス値供給・コスト変更・上限変更といった「研究が数値を動かす」仕組みは**作らない**（モデル外）。

---

## 10. 判断事項

| ID | 論点 | 推奨 / 現方針 |
|----|------|---------------|
| D1 | `engines` の意味 | 保有フラグ。開発段階ではない |
| D2 | 開発段階の保存場所 | `char.engineDev` |
| D3 | 周回持ち越し | なし。研究と同じくセーブ内のみ |
| D4 | ゲーム開始時の初期開発段階 | 全員0推奨。必要なら後で「初期実装」項目を追加 |
| D5 | 開発 / VerUp の消費 | 現行強化と同じくミーム消費。値は未設計 |
| D6 | ボーナス | 未設計のため空。勝手に値を入れない |
| D7 | 既存 `purchaseUpgrade` を流用するか | 新アクション追加推奨。UIは流用、処理責務は分ける |
| D8 | アイテム | 削除せずUIから隠して凍結 |

---

## 11. 実装順（layer 1）

1. `software.json` 雛形追加
2. `characters.json` に `engines` を追加（全0またはTSV確定済み分を反映）
3. `SaveSystem` / `GameContext` で `engineDev` 補填・保存
4. `GameContext` に `developEngine` / `versionUpEngine` 追加
5. エディタに11エンジン保有チェックボックス追加
6. `PartyScene` に SOFTWARE セクション追加
7. アイテムUI非表示・itemGain/rewardItem付与停止
8. `KNOWLEDGE.md` 同期
9. `npm run build` 確認
