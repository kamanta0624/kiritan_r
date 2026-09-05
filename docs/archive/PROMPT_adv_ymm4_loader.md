# PROMPT: ADVScene を YMM4 形式へ差し替え ＋ 立ち絵スケール検証QA

対象: ClaudeCode
作成: 2026-08-19
前提: `PROMPT_portrait_json.md`（先に完了させること）, `docs/DESIGN_PORTRAIT_SCALE.md`, `KNOWLEDGE.md` §17

## 0. 背景と方針（2026-08-19 人間決定）

| 論点 | 決定 |
|---|---|
| `preset.ini` のパース | **ビルド時にJSON化**（= `portrait.json`）。ランタイムINIパースはしない |
| 表情の指定方法 | **プリセット名とカテゴリ指定の両対応。原則はプリセット名** |
| 既存 `rig.json` 方式 | **廃止**。`char_006` `char_017` もYMM4へ移行し `public/characters/parts/` を消す |
| `PX_PER_CM` | **QA画面でスライダを動かして実画面で決める** |

基準身長は **155cm**（`DESIGN_PORTRAIT_SCALE.md` §1、確定53体の中央値）。

## 1. 成果物

1. `src/scenes/ADVScene.jsx` のローダを `rig.json` + `parts.json` から `portrait.json` へ差し替え
2. `?qa=portrait` の検証QA画面（新規シーン）
3. `char_006` 彩澄しゅお / `char_017` 四国めたん のYMM4化と `public/characters/parts/` 削除

## 2. ローダ差し替え

現行（`ADVScene.jsx:72-140`）:

- `useRigData(charKey)` が `/characters/parts/<charKey>/rig.json` と `parts.json` を fetch
- `CompositeChar` が `rig.base` のレイヤーIDを走査し、`left/top/w/h` を % に換算して配置
- `aspectRatio: cw/ch` でキャンバス比を保持。**身長正規化なし**

新方式:

- `/characters/ymm4/<charKey>/portrait.json` を fetch
- `drawOrder` の順に、各カテゴリの選択ファイルを `<img>` で重ねる
- **全PNGがキャンバス全域なので座標計算は不要**。全て `width:100% height:100%` で重なる
- 選択の解決順: プリセット名指定 → カテゴリ個別指定で上書き → 未指定は `default`

イベントスクリプトからの指定形式:

```js
{ char:'c1', face:'怒り' }                    // プリセット名（原則こちら）
{ char:'c1', parts:{ 目:'ジト目.png', 口:'はわわ.png' } }  // カテゴリ個別
{ char:'c1', face:'怒り', parts:{ 口:'はわわ.png' } }      // 併用。partsが勝つ
```

**変換した15体は `presets` が空**（作者の表情セットがPSDから復元できないため）。
プリセット名が `portrait.json.presets` に無い場合は `default` にフォールバックし、
`console.warn` を出せ。エラーにするな。

### まばたき

現行の `rig.blink.frames`（レイヤーID配列の連番）は YMM4 形式に対応物が無い。
**まばたきは今回実装しない。** `default` の目を出したままにしろ。
`blinkFrame` 関連のコードは消せ。復活は別プロンプトで扱う。

### 身長正規化

```
表示高px = height_cm * PX_PER_CM
img枠の高さ = 表示高px * (canvas.h / body.height)
```

`height_cm` は `DESIGN_PORTRAIT_SCALE.md` の値。**51体が未設定**なので、
未設定キャラは基準身長 **155cm** で描画しろ。

身長データは `src/game/data/characterHeight.json` に新規作成し、
`DESIGN_PORTRAIT_SCALE.md` §2 の確定53体を転記しろ。§3 の未設定51体は
キーごと省け（`null` を書くな）。

足元をそろえるため、枠は `bottom` 基準で配置する。現行の
`bottom: isSpeaking ? '-2%' : '-6%'` の演出は維持しろ。

## 3. `?qa=portrait` 検証QA画面

`src/App.jsx:410-414` の `qaParam` 分岐に `portrait` を追加。
`?qa=battlefull` `?qa=promotion` と同じ作りにしろ。

要件:

- `public/characters/ymm4/` に存在する**全 charKey** を対象にする。
  ディレクトリ一覧をハードコードするな。ビルド時に列挙して import するか、
  `portrait.json` の索引ファイルを吐くか、手段は任せる。
  **後から Moiky素材43体を追加しても自動で増える作りにしろ**
- charKey の**昇順**で表示。1画面に並べる体数は可変にしろ（4/8/全部 の切替）
- 画面上部に `PX_PER_CM` のスライダを置く。範囲は 2.0〜10.0、刻み0.1。
  現在値と「155cm換算での表示高px」を数値で常時表示しろ
- 各キャラの下に `charKey` / キャラ名 / 使用身長cm / 身長データの有無 を出せ
- **`body.touchesBottom` が true のキャラは枠に赤い縁を付けろ**。足切れ疑いの目視確認用
- 背景は単色でよい。ADVの演出（brightness・drop-shadow）は掛けるな。素の絵を見る画面だ

デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止。

## 4. `char_006` / `char_017` の移行

`docs/assets/psd/彩澄しゅお縮小_800pix.psd` と `docs/assets/psd/四国めたん.psd` を
`tools/psd2ymm4.cjs` で変換しろ。この2体は Moiky氏素材のはずだが
YMM4フォルダの有無を先に確認しろ。あれば変換せずコピーでよい。

`psd2ymm4.map.json` に必要なら `moiky_psd` エントリを足せ。
**構造を実測してから足せ。既存エントリを流用するな**（§5-1・§5-2 の前例がある）。

移行後、`public/characters/parts/` を**ディレクトリごと削除**しろ。
`ADVScene.jsx` から `rig.json` / `parts.json` への参照が消えていることを
`grep -rn "rig.json\|parts.json" src/` で確認しろ。

## 5. 成功基準

自分で検証しろ。達成まで繰り返せ。

1. `npm run build` が通る
2. `grep -rn "rig.json\|parts.json" src/` が0件
3. `public/characters/parts/` が存在しない
4. `?qa=portrait` が起動し、`public/characters/ymm4/` 配下の全 charKey が
   charKey昇順で描画される（1体も欠けない。件数を数えて照合しろ）
5. スライダを動かすと全キャラの表示サイズが連動して変わる
6. `touchesBottom` が true のキャラに赤縁が付く
7. ADVScene で `char_006` の立ち絵が表示される（従来の静止画フォールバックではなく合成）
8. `characterHeight.json` の件数が53である

## 6. 検証手順

**Playwright を使うな。** 前回14分ハングした実績がある（KNOWLEDGE参照）。
`npm run dev` で 5173 を起動し、URLを人間に伝えて目視確認を依頼しろ。

起動前に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認し、
5174以降が生きていたら kill しろ。5173のみ起動する。

## 7. やるな

- まばたきの実装
- 表情プリセットの発明（`presets` が空なら空のまま）
- `PX_PER_CM` の値をコードに焼くこと（スライダで決めるのが目的）
- 色の直書き（`tokens.js` から import）
- Moiky素材43体の取り込み（別プロンプト。ただしQA画面は追加に自動追従すること）
- Playwright の起動

## 8. 判断に迷ったら

勝手に決めず質問しろ。特に:

- `char_006` / `char_017` のPSDが Moiky素材と同一かどうか
- QA画面の charKey 列挙方法（Vite の `import.meta.glob` が使えるか要確認）
