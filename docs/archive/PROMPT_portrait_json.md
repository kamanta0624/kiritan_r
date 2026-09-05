# PROMPT: portrait.json 出力と素体バウンディングボックス測定

対象: ClaudeCode
作成: 2026-08-19
前提: `docs/prompts/PROMPT_psd2ymm4.md`（完了済）, `docs/DESIGN_PORTRAIT_SCALE.md`, `ROADMAP.md` §3-2e

## 0. 背景

`public/characters/ymm4/<charKey>/` に15体ぶんのYMM4形式が出力済み。
ゲーム側がこれを読むには2つ足りない。

1. `preset.ini` はINI形式で、ブラウザにパーサが無い。**ビルド時にJSONへ落とす**
2. 身長正規化に必要な `psdBodyHeightPx`（キャラの頭頂〜足元のpx）が無い。
   PSDキャンバス高では代用できない（余白量が作者ごとに違う。800x800〜3543x6290）

**このプロンプトの範囲は変換ツールの出力追加のみ。`src/` は触るな。**

## 1. 成果物

`tools/psd2ymm4.cjs` を拡張し、各 `public/characters/ymm4/<charKey>/` に
`portrait.json` を追加出力する。既存の出力（カテゴリフォルダ・PNG・preset.ini）は変えるな。

## 2. portrait.json のスキーマ

```json
{
  "charKey": "char_024",
  "author": "shinobi",
  "canvas": { "w": 800, "h": 800 },
  "body": {
    "top": 48, "bottom": 800, "left": 236, "right": 563,
    "height": 752, "width": 327,
    "touchesTop": false, "touchesBottom": true
  },
  "drawOrder": ["後", "体", "口", "目", "眉", "顔色", "髪", "他"],
  "categories": {
    "体": ["基本.png", "赤面1.png", "青ざめ.png"],
    "目": ["通常.png", "細目.png"]
  },
  "default": { "体": "基本.png", "口": "微笑み.png", "目": "通常.png", "眉": "通常.png" },
  "presets": {}
}
```

- `canvas` — PSDキャンバス寸法。全PNGがこの寸法（トリムなしで出力済み）
- `body` — **`default.体` のPNGの不透明ピクセルのバウンディングボックス**。§3参照
- `drawOrder` — 上記の固定順。背面→前面。ハードコードでよい
- `categories` — カテゴリごとのファイル名配列。存在しないカテゴリはキーごと省く
- `default` — `preset.ini` の `[デフォルト]` と同一内容
- `presets` — `preset.ini` の `[デフォルト]` 以外のセクション。今回の15体は空になる

各PNGはキャンバス全域なので `left/top/w/h` をレイヤーごとに持つ必要はない。
**持たせるな。** 単純に重ねれば合う。

## 3. 素体バウンディングボックスの測定

**`default.体` を使うな**（2026-08-19 修正）。体カテゴリには素体・衣装・腕・
下着・小物が混在しており、`default.体` が「右手の武器」や「リボン」を指す個体が
実在する（クロワ・鳴花ヒメ/ミコト・mtu系で確認）。1枚選択では素体に当たらない。

**体カテゴリの全PNGを個別に測り、`height` が最大のものを `body` とする。**
素体は頭頂から足元までを含むため、体カテゴリ内で必ず最大高になる。

測定は各PNGの**アルファ値が1以上のピクセル**の最小外接矩形。

測定した全候補を `bodyCandidates` として `portrait.json` に併記しろ。
人間が採用値の妥当性を確認する。

```json
"bodyCandidates": [
  { "file": "基本.png",   "top": 48,  "bottom": 800, "height": 752 },
  { "file": "右手_武器持ち.png", "top": 320, "bottom": 370, "height": 50 }
]
```

- `touchesTop` = `body.top === 0`
- `touchesBottom` = `body.bottom === canvas.h`

`touchesBottom` が true なら**足が切れている疑い**がある（バストアップ構図か、
足元がキャンバス下端ぴったりに配置されている）。どちらかは機械判定できないので
**判定するな**。真偽値をそのまま出して報告に一覧を載せろ。人間が確認する。

### 3-1. `default.体` が小物を指す件は別問題（触るな）

体カテゴリの `default` が素体でないキャラが複数ある。これは
**デフォルト立ち絵が「武器だけ」「リボンだけ」で描画される表示バグ**だが、
`preset.ini` を書き換える必要があるため**このプロンプトの範囲外**。

根本原因は map 設計にある。YMM4 の `体` は preset.ini で1枚しか選べない
排他カテゴリなのに、同時に描く必要のあるパーツ（素体・衣装・腕・小物）を
すべて `体` に写している。正しくは素体＋衣装のみを `体` に置き、
腕差分や小物は `他`（`他1` `他2` で複数指定可）に置くべきだった。

**このプロンプトでは直すな。** 該当キャラを報告に一覧で出せ。
2本目（`PROMPT_adv_ymm4_loader.md`）のQA画面で目視確認してから
map 再設計か `defaultOverride` かを人間が決める。

PNGデコードは既存の `encodePng` の逆が要る。zlib展開＋PNGフィルタ逆適用を自前で書け。
**npmパッケージを追加するな。** PSDから直接測る方法（合成前のレイヤーの
`left/top/w/h` を使う）でもよい。どちらでも結果が同じなら手段は任せる。

## 4. 成功基準

自分で数値検証しろ。達成まで繰り返せ。

1. 15体すべてに `portrait.json` が生成され、`JSON.parse` が通る
2. `categories` の各ファイル名が、実際に該当カテゴリフォルダに存在する（全件照合）
3. `default` の各値が `categories` の対応配列に含まれる（全件照合）
4. `body.height > 0` かつ `body.height <= canvas.h` が15体すべてで成立
4b. `body` が `bodyCandidates` の中で最大 `height` を持つ要素と一致する（全15体）
5. 既存の PNG・`preset.ini` がバイト単位で無変更（再変換前後で比較）
6. `src/` と `public/characters/parts/` が無変更（`git status` で確認）

## 5. 報告に含めろ

**表1: 15体の測定結果**

| charKey | 作者 | canvas w×h | body file | body height | body/canvas比 | touchesTop | touchesBottom |
|---|---|---|---|---|---|---|---|

**表3: `default.体` が `body` と一致しないキャラ**

| charKey | default.体 | body file | 差 |
|---|---|---|---|

一致しないキャラが §3-1 の該当。2本目で扱う。

**表2: `DESIGN_PORTRAIT_SCALE.md` の身長と突き合わせた `PX_PER_CM` 逆算値**

各体について `body.height / height_cm` を出せ。身長が未設定のキャラは `-` とする。
この値のばらつきが、そのまま正規化の効き具合になる。

`char_pending_daishogun` は身長も `characters.json` 登録も無い。`-` でよい。

## 6. やるな

- `src/` の変更
- `public/characters/parts/` の変更
- 既存PNG・`preset.ini` の変更
- npmパッケージの追加
- `touchesBottom` から「足が切れている」と断定すること
- Moiky素材の取り込み（別プロンプト）
